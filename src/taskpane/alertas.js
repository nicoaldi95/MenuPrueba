/*
 * AuditX — Alertas del encargo
 *
 * Reemplaza «Listado Alertas»: fecha, usuario, descripción, respuesta y comentarios.
 * Una alerta nace sola cuando:
 *   · un papel vence o está por vencer (3 días)            → tipo «Vencimiento»
 *   · un papel se devuelve con comentario                  → tipo «Devuelto»
 *   · el contenido cambia después de revisado o firmado    → tipo «Cambio relevante»
 *   · se acerca una visita, hito o fecha clave (7 días)    → tipo «Cronograma»
 *   · alguien deja un comentario dirigido al usuario       → tipo «Comentario» (se cierra sola al cerrar el comentario)
 * Quien la recibe (o un supervisor / socio) la documenta: «Atendida», «Justificada» o «No procede».
 * Si el papel se firma, sus alertas de vencimiento se cierran solas.
 */

import { crearAlmacen } from "./almacen.js";
import flujo, { ESTADO, hoyISO } from "./flujo.js";
import proyecto from "./proyecto.js";
import tareas from "./tareas.js";

/* global window, document */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/alertas/v1", claveLocal: "auditx.alertas.v1", raiz: "alertas" });

export const TIPOS = ["Vencimiento", "Devuelto", "Cambio relevante", "Cronograma", "Comentario", "Tareas"];

/*
 * Las 7 alertas que se podían encender o apagar en «Listado de Alertas» del VBA (celdas K334–K340 de «Hoja Control»).
 * conexion: "activa"    ya genera alertas en el complemento
 *           "cubierta"  el complemento ya lo exige de forma más estricta (no se puede firmar con comentarios abiertos)
 *           "pendiente" se conecta cuando se migre el módulo que la origina («modulo»); la preferencia ya queda guardada
 */
export const ALERTAS_CONFIGURABLES = [
  { id: "atipicos", celda: "K334", etiqueta: "¿Valores atípicos en la revisión analítica?", conexion: "pendiente", modulo: "Revisión analítica", predeterminada: false },
  { id: "materialidad", celda: "K335", etiqueta: "¿Se cambió la base sobre la cual se calcula la materialidad?", conexion: "pendiente", modulo: "Materialidad", predeterminada: false },
  { id: "riesgos", celda: "K336", etiqueta: "¿Hay riesgos significativos?", conexion: "pendiente", modulo: "Evaluación de riesgos", predeterminada: false },
  { id: "comentarios-abiertos", celda: "K337", etiqueta: "¿Comentarios del PT sin cerrarse?", conexion: "cubierta", predeterminada: true },
  { id: "ajustes", celda: "K338", etiqueta: "¿Los ajustes y/o reclasificaciones son materiales?", conexion: "pendiente", modulo: "Ajustes y reclasificaciones", predeterminada: false },
  { id: "comentario-pendiente", celda: "K339", etiqueta: "Comentario pendiente por responder", conexion: "activa", predeterminada: true },
  { id: "tareas-completadas", celda: "K340", etiqueta: "¿Eliminar tareas completadas al 100%?", conexion: "activa", predeterminada: false },
];
export const RESPUESTAS = ["Atendida", "Justificada", "No procede"];
const DIAS_PREVIOS_PAPEL = 3;
const DIAS_PREVIOS_EVENTO = 7;

let datos = null;
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));

async function persistir() {
  datos.actualizado = new Date().toISOString();
  const instantanea = copia(datos);
  cola = cola.then(() => Almacen.guardar(instantanea));
  return cola;
}

function configActual() {
  const f = (datos && datos.config && datos.config.flags) || {};
  return ALERTAS_CONFIGURABLES.map((x) => ({ ...x, activa: x.id in f ? !!f[x.id] : x.predeterminada }));
}
const estaActiva = (id) => (configActual().find((x) => x.id === id) || {}).activa;

const sumarDias = (iso, n) => {
  const [a, m, d] = iso.split("-").map(Number);
  return hoyISO(new Date(a, m - 1, d + n));
};
const diasHasta = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  const [a2, m2, d2] = hoyISO().split("-").map(Number);
  return Math.round((new Date(a, m - 1, d) - new Date(a2, m2 - 1, d2)) / 86400000);
};

function destinatarios(papelId) {
  const f = flujo.ficha(papelId);
  const ids = new Set(Object.values(f.asignados));
  if (!ids.size) flujo.personas(true).filter((p) => flujo.puedeAsignar(p.id)).forEach((p) => ids.add(p.id)); // sin responsables: avisa a quienes asignan
  return [...ids];
}

function agregar(a) {
  if (a.clave && datos.alertas.some((x) => x.clave === a.clave)) return false;
  datos.alertas.push({ id: "al-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fecha: new Date().toISOString(), estado: "Abierta", respuesta: "", comentarios: "", respondidaPor: null, fechaRespuesta: "", clave: "", papel: "", para: [], ...a });
  return true;
}

function cerrarSolas() {
  let cambio = false;
  datos.alertas.forEach((a) => {
    if (a.estado !== "Abierta" || a.tipo !== "Vencimiento" || !a.papel) return;
    const f = flujo.ficha(a.papel);
    if (f.estado === ESTADO.FIRMADO) {
      a.estado = "Atendida";
      a.respuesta = "Atendida";
      a.comentarios = "Se cerró sola: el papel se firmó.";
      a.fechaRespuesta = new Date().toISOString();
      a.respondidaPor = { id: "sistema", nombre: "AuditX", cargo: "" };
      cambio = true;
    }
  });
  return cambio;
}

/* Revisa vencimientos y cronograma; es seguro llamarla muchas veces (no repite alertas). */
async function revisar() {
  let cambio = cerrarSolas();
  flujo.listar().forEach((f) => {
    if (f.estado === ESTADO.FIRMADO || !f.fechas.vence) return;
    const dias = diasHasta(f.fechas.vence);
    if (dias < 0) cambio = agregar({ clave: "venc:" + f.id + ":" + f.fechas.vence, tipo: "Vencimiento", papel: f.id, para: destinatarios(f.id), descripcion: f.id + " venció el " + f.fechas.vence + " y no está firmado (" + f.estado + ")." }) || cambio;
    else if (dias <= DIAS_PREVIOS_PAPEL) cambio = agregar({ clave: "porvenc:" + f.id + ":" + f.fechas.vence, tipo: "Vencimiento", papel: f.id, para: destinatarios(f.id), descripcion: f.id + " vence " + (dias === 0 ? "hoy" : "en " + dias + (dias === 1 ? " día" : " días")) + " (" + f.fechas.vence + "). Estado: " + f.estado + "." }) || cambio;
  });
  const quienes = flujo.personas(true).filter((p) => flujo.puedeAsignar(p.id)).map((p) => p.id);
  proyecto.agenda().filter((x) => x.origen !== "papel").forEach((x) => {
    const dias = diasHasta(x.fecha);
    if (dias >= 0 && dias <= DIAS_PREVIOS_EVENTO) cambio = agregar({ clave: "crono:" + x.titulo + ":" + x.fecha, tipo: "Cronograma", para: quienes, descripcion: x.titulo + " es " + (dias === 0 ? "hoy" : "en " + dias + (dias === 1 ? " día" : " días")) + " (" + x.fecha + ")." }) || cambio;
  });
  if (estaActiva("tareas-completadas")) {
    const mes = hoyISO().slice(0, 7);
    flujo.personas(true).forEach((p) => {
      const n = tareas.retirables(p.id, false);
      if (n) cambio = agregar({ clave: "tareas:" + p.id + ":" + mes, tipo: "Tareas", para: [p.id], descripcion: "Hay " + n + " tarea(s) completada(s) al 100 % hace " + tareas.DIAS_PARA_RETIRAR + " días o más. ¿Desea retirarlas del registro? (en «Consultar y Responder Tareas»)" }) || cambio;
    });
  }
  if (cambio) await persistir();
  pintarPanel();
  return cambio;
}

/* Reacciona a lo que pasa en el flujo. */
async function alCambiarFlujo(e) {
  const { id, accion, por } = e.detail;
  const f = flujo.ficha(id);
  const ultimo = f.historial[0] || {};
  let cambio = false;
  if (accion === "devolver") {
    const prepara = f.asignados.prepara;
    cambio = agregar({ clave: "dev:" + ultimo.fecha, tipo: "Devuelto", papel: id, para: prepara ? [prepara] : destinatarios(id), descripcion: id + " fue devuelto por " + por.nombre + (ultimo.nota ? ": «" + ultimo.nota + "»" : ".") });
  } else if (accion === "contenido-modificado") {
    cambio = agregar({ clave: "cambio:" + ultimo.fecha, tipo: "Cambio relevante", papel: id, para: destinatarios(id), descripcion: "El contenido de " + id + " cambió después de revisado o firmado. " + (ultimo.nota || "") });
  } else if (accion === "fechas" || accion === "firmar") {
    cambio = await revisar();
    return cambio;
  }
  if (cambio) await persistir();
  pintarPanel();
}

/* Comentarios PT: nace una alerta para el destinatario y se cierra sola cuando el comentario se cierra. */
async function alCambiarComentario(e) {
  const { tipo, comentario: c } = e.detail;
  const clave = "com:" + c.id;
  let cambio = false;
  if (tipo === "nuevo" && estaActiva("comentario-pendiente")) {
    cambio = agregar({ clave, tipo: "Comentario", papel: c.papel === "General" ? "" : c.papel, para: [c.para.id], descripcion: c.de.nombre + " le dejó un comentario" + (c.papel === "General" ? "" : " en " + c.papel) + ": «" + c.texto + "»" });
  } else if (tipo === "cerrado") {
    const a = datos.alertas.find((x) => x.clave === clave && x.estado === "Abierta");
    if (a) {
      a.estado = "Atendida";
      a.respuesta = "Atendida";
      a.comentarios = "Se cerró sola: " + c.cerradoPor.nombre + " cerró el comentario." + (c.respuesta ? " «" + c.respuesta + "»" : "");
      a.fechaRespuesta = new Date().toISOString();
      a.respondidaPor = { id: "sistema", nombre: "AuditX", cargo: "" };
      cambio = true;
    }
  }
  if (cambio) await persistir();
  pintarPanel();
}

function pintarPanel() {
  const panel = window.AuditX && window.AuditX.panel;
  if (!panel) return;
  const n = datos.alertas.filter((a) => a.estado === "Abierta").length;
  panel.marcarEstado("alertas", n ? { estado: "vencido", texto: n + (n === 1 ? " abierta" : " abiertas") } : null);
  document.dispatchEvent(new CustomEvent("auditx:alertas-cambio"));
}

function listar({ estado, tipo, para, papel } = {}) {
  return datos.alertas
    .filter((a) => (!estado || a.estado === estado) && (!tipo || a.tipo === tipo) && (!para || a.para.includes(para)) && (!papel || a.papel === papel))
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map(copia);
}

function puedeDocumentar(a, pid) {
  return flujo.puede(pid, "documentar-alertas") && (a.para.includes(pid) || flujo.puedeAsignar(pid));
}

async function responder(id, { respuesta, comentarios }, { por } = {}) {
  const a = datos.alertas.find((x) => x.id === id);
  if (!a) return { ok: false, error: "No existe esa alerta." };
  if (a.estado !== "Abierta") return { ok: false, error: "Esa alerta ya está documentada." };
  if (!flujo.puede(por, "documentar-alertas")) return { ok: false, error: "Su perfil no tiene permiso para documentar y registrar alertas." };
  if (!puedeDocumentar(a, por)) return { ok: false, error: "Solo quien recibió la alerta, un supervisor o el socio pueden documentarla." };
  if (!RESPUESTAS.includes(respuesta)) return { ok: false, error: "Elija una respuesta." };
  if (respuesta !== "Atendida" && !(comentarios && comentarios.trim())) return { ok: false, error: "Escriba el comentario que justifica la respuesta." };
  const x = flujo.persona(por);
  a.estado = "Atendida";
  a.respuesta = respuesta;
  a.comentarios = (comentarios || "").trim();
  a.respondidaPor = x ? { id: x.id, nombre: x.nombre, cargo: x.cargo } : { id: por, nombre: "Desconocido", cargo: "" };
  a.fechaRespuesta = new Date().toISOString();
  await persistir();
  pintarPanel();
  return { ok: true, alerta: copia(a) };
}

const COLA_MAX = 50;
/* Enciende o apaga alertas. «cambios»: { idAlerta: true|false }. Solo quien aprueba (administra) puede hacerlo. */
async function guardarConfig(cambios, { por } = {}) {
  if (!flujo.puedeAdministrar(por)) return { ok: false, error: "Solo quien aprueba puede activar o desactivar las alertas." };
  const antes = configActual();
  const cambiados = antes.filter((x) => x.id in (cambios || {}) && !!cambios[x.id] !== x.activa);
  if (!cambiados.length) return { ok: false, error: "No hay cambios por guardar." };
  datos.config = datos.config || { flags: {}, historial: [] };
  const quien = flujo.persona(por);
  cambiados.forEach((x) => {
    datos.config.flags[x.id] = !!cambios[x.id];
    datos.config.historial.push({ fecha: new Date().toISOString(), por: quien ? { id: quien.id, nombre: quien.nombre, cargo: quien.cargo } : { id: por, nombre: "Desconocido", cargo: "" }, alerta: x.etiqueta, estado: !!cambios[x.id] });
  });
  if (datos.config.historial.length > COLA_MAX) datos.config.historial = datos.config.historial.slice(-COLA_MAX);
  await persistir();
  await revisar();
  return { ok: true, cambiados: cambiados.length };
}

async function iniciar() {
  datos = (await Almacen.cargar()) || { version: 1, alertas: [], actualizado: "" };
  datos.alertas = datos.alertas || [];
  datos.config = datos.config || { flags: {}, historial: [] };
  document.addEventListener("auditx:flujo-cambio", alCambiarFlujo);
  document.addEventListener("auditx:comentarios-cambio", alCambiarComentario);
  document.addEventListener("auditx:tareas-cambio", () => estaActiva("tareas-completadas") && revisar());
  document.addEventListener("auditx:proyecto-cambio", (e) => e.detail && e.detail.seccion === "cronograma" && revisar());
  await revisar();
  return api;
}

const api = {
  iniciar,
  TIPOS,
  RESPUESTAS,
  revisar,
  config: configActual,
  guardarConfig,
  historialConfig: () => copia((datos.config && datos.config.historial) || []).reverse(),
  ALERTAS_CONFIGURABLES,
  listar,
  responder,
  puedeDocumentar,
  abiertas: (pid) => listar({ estado: "Abierta", para: pid }).length,
  total: () => datos.alertas.length,
  diasHasta,
  _reiniciar: async () => {
    datos = { version: 1, alertas: [], config: { flags: {}, historial: [] }, actualizado: "" };
    await persistir();
    pintarPanel();
  },
};

export default api;
