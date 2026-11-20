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

/* global window, document */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/alertas/v1", claveLocal: "auditx.alertas.v1", raiz: "alertas" });

export const TIPOS = ["Vencimiento", "Devuelto", "Cambio relevante", "Cronograma", "Comentario"];
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
  if (tipo === "nuevo") {
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
  return a.para.includes(pid) || flujo.puedeAsignar(pid);
}

async function responder(id, { respuesta, comentarios }, { por } = {}) {
  const a = datos.alertas.find((x) => x.id === id);
  if (!a) return { ok: false, error: "No existe esa alerta." };
  if (a.estado !== "Abierta") return { ok: false, error: "Esa alerta ya está documentada." };
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

async function iniciar() {
  datos = (await Almacen.cargar()) || { version: 1, alertas: [], actualizado: "" };
  datos.alertas = datos.alertas || [];
  document.addEventListener("auditx:flujo-cambio", alCambiarFlujo);
  document.addEventListener("auditx:comentarios-cambio", alCambiarComentario);
  document.addEventListener("auditx:proyecto-cambio", (e) => e.detail && e.detail.seccion === "cronograma" && revisar());
  await revisar();
  return api;
}

const api = {
  iniciar,
  TIPOS,
  RESPUESTAS,
  revisar,
  listar,
  responder,
  puedeDocumentar,
  abiertas: (pid) => listar({ estado: "Abierta", para: pid }).length,
  total: () => datos.alertas.length,
  diasHasta,
  _reiniciar: async () => {
    datos = { version: 1, alertas: [], actualizado: "" };
    await persistir();
    pintarPanel();
  },
};

export default api;
