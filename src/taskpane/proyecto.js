/*
 * AuditX — Datos del proyecto y de la empresa
 *
 * Reúne lo que el VBA pedía en «Información del proyecto» y «Configurar Empresa»:
 *   · proyecto: cliente que se audita, NIT, período, encargo
 *   · empresa:  datos generales de la empresa y ruta de la carpeta OneDrive
 *
 * Los papeles (AA-01…) toman de aquí el encabezado: window.AuditX.proyecto.encabezado()
 * Evento emitido: «auditx:proyecto-cambio»
 */

import { crearAlmacen } from "./almacen.js";
import flujo, { hoyISO } from "./flujo.js";

/* global window, document */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/proyecto/v1", claveLocal: "auditx.proyecto.v1", raiz: "proyecto" });

export const TIPOS_ENCARGO = ["Auditoría de estados financieros", "Revisoría fiscal", "Auditoría interna", "Revisión limitada", "Otro encargo de aseguramiento"];
export const MARCOS = ["NIIF para Pymes", "NIIF plenas", "NIIF para microempresas", "Normas del sector público", "Otro marco"];

const cronogramaVacio = () => ({
  fechasClave: [
    { id: "planificacion", etiqueta: "Corte de planificación", fecha: "", aplica: true },
    { id: "precierre", etiqueta: "Corte de pre-cierre", fecha: "", aplica: true },
    { id: "cierre", etiqueta: "Corte de cierre", fecha: "", aplica: true },
  ],
  eventos: [],
});

const vacio = () => ({
  proyecto: { entidad: "", nit: "", desde: "", hasta: "", encargo: "", tipo: TIPOS_ENCARGO[0], marco: MARCOS[0], fechaInforme: "" },
  empresa: { razonSocial: "", nombreComercial: "", representante: "", actividad: "", ciudad: "", direccion: "", correo: "", telefono: "", rutaOneDrive: "" },
  cronograma: cronogramaVacio(),
  historial: [],
  actualizado: "",
});

let datos = null;
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));

async function persistir() {
  datos.actualizado = new Date().toISOString();
  const instantanea = copia(datos);
  cola = cola.then(() => Almacen.guardar(instantanea));
  return cola;
}

function permiso(por) {
  if (!flujo.puedeAdministrar(por)) return "Solo " + flujo.ROLES.filter((r) => r.id === "aprueba").map((r) => r.nombre).join("") + " puede modificar estos datos.";
  return null;
}

function anotar(seccion, cambios, por) {
  if (!cambios.length) return;
  const x = flujo.persona(por);
  datos.historial.push({ fecha: new Date().toISOString(), seccion, por: x ? { id: x.id, nombre: x.nombre, cargo: x.cargo } : { id: por, nombre: "Desconocido", cargo: "" }, cambios });
  if (datos.historial.length > 200) datos.historial.shift();
}

function diferencias(antes, despues, etiquetas) {
  return Object.keys(despues).filter((k) => (antes[k] || "") !== (despues[k] || "")).map((k) => (etiquetas[k] || k) + ": «" + (antes[k] || "—") + "» → «" + (despues[k] || "—") + "»");
}

const ETIQ_PROYECTO = { entidad: "Entidad (cliente)", nit: "NIT / ID", desde: "Período desde", hasta: "Período hasta", encargo: "Nombre del encargo", tipo: "Tipo de encargo", marco: "Marco normativo", fechaInforme: "Fecha del informe" };
const ETIQ_EMPRESA = { razonSocial: "Razón social", nombreComercial: "Nombre comercial", representante: "Representante legal", actividad: "Actividad económica", ciudad: "Ciudad", direccion: "Dirección", correo: "Correo de contacto", telefono: "Teléfono", rutaOneDrive: "Carpeta OneDrive" };

async function guardarProyecto(nuevo, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const p = { ...datos.proyecto, ...nuevo };
  Object.keys(p).forEach((k) => (p[k] = String(p[k] == null ? "" : p[k]).trim()));
  if (!p.entidad) return { ok: false, error: "Escriba la entidad (cliente)." };
  if (p.desde && p.hasta && p.hasta < p.desde) return { ok: false, error: "El período «hasta» no puede ser anterior al «desde»." };
  if (p.fechaInforme && p.hasta && p.fechaInforme < p.hasta) return { ok: false, error: "La fecha del informe no puede ser anterior al cierre del período." };
  anotar("Información del proyecto", diferencias(datos.proyecto, p, ETIQ_PROYECTO), por);
  datos.proyecto = p;
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "proyecto" } }));
  return { ok: true };
}

async function guardarEmpresa(nuevo, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const e = { ...datos.empresa, ...nuevo };
  Object.keys(e).forEach((k) => (e[k] = String(e[k] == null ? "" : e[k]).trim()));
  if (e.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.correo)) return { ok: false, error: "El correo no es válido." };
  anotar("Configurar Empresa", diferencias(datos.empresa, e, ETIQ_EMPRESA), por);
  datos.empresa = e;
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "empresa" } }));
  return { ok: true };
}

/* Lo que llevan en el encabezado todos los papeles: entidad, NIT y período. */
function encabezado() {
  const p = datos.proyecto;
  return { entidad: p.entidad, nit: p.nit, desde: p.desde, hasta: p.hasta };
}


/* ------------------------------------------------------------------ cronograma */

const TIPOS_EVENTO = ["Visita de auditoría", "Hito", "Reunión", "Entrega"];

function sinPermisoCronograma(por) {
  return flujo.puedeAsignar(por) ? null : "Solo " + ["supervisa", "aprueba"].map(flujo.nombreRol).join(" o ") + " pueden modificar el cronograma.";
}

/* Un año antes de una fecha AAAA-MM-DD (el 29 de febrero pasa al 28). */
function unAnioAntes(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  const dia = m === 2 && d === 29 ? 28 : d;
  return String(a - 1) + "-" + String(m).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
}

function cronograma() {
  const c = copia(datos.cronograma);
  const cierre = c.fechasClave.find((x) => x.id === "cierre");
  c.cierreAnterior = cierre && cierre.aplica ? unAnioAntes(cierre.fecha) : "";
  return c;
}

async function guardarFechasClave(lista, { por } = {}) {
  const sin = sinPermisoCronograma(por);
  if (sin) return { ok: false, error: sin };
  const aplican = lista.filter((x) => x.aplica && x.fecha);
  for (let i = 1; i < aplican.length; i++)
    if (aplican[i].fecha < aplican[i - 1].fecha) return { ok: false, error: "«" + aplican[i].etiqueta + "» no puede ser anterior a «" + aplican[i - 1].etiqueta + "»." };
  const antes = datos.cronograma.fechasClave;
  const cambios = lista
    .filter((n) => { const o = antes.find((x) => x.id === n.id) || {}; return (o.fecha || "") !== (n.fecha || "") || !!o.aplica !== !!n.aplica; })
    .map((n) => n.etiqueta + ": " + (n.aplica ? n.fecha || "sin fecha" : "no aplica"));
  anotar("Cronograma", cambios, por);
  datos.cronograma.fechasClave = lista.map((n) => ({ id: n.id, etiqueta: n.etiqueta, fecha: n.fecha || "", aplica: !!n.aplica }));
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "cronograma" } }));
  return { ok: true };
}

async function guardarEvento(ev, { por } = {}) {
  const sin = sinPermisoCronograma(por);
  if (sin) return { ok: false, error: sin };
  const e = { id: ev.id || "ev-" + Date.now().toString(36), titulo: String(ev.titulo || "").trim(), tipo: ev.tipo || TIPOS_EVENTO[0], fecha: ev.fecha || "", fechaFin: ev.fechaFin || "", responsable: ev.responsable || "", notas: String(ev.notas || "").trim() };
  if (!e.titulo) return { ok: false, error: "Escriba el título del evento." };
  if (!e.fecha) return { ok: false, error: "Elija la fecha del evento." };
  if (e.fechaFin && e.fechaFin < e.fecha) return { ok: false, error: "La fecha final no puede ser anterior a la inicial." };
  const i = datos.cronograma.eventos.findIndex((x) => x.id === e.id);
  anotar("Cronograma", [(i >= 0 ? "Editó: " : "Agregó: ") + e.titulo + " (" + e.fecha + ")"], por);
  if (i >= 0) datos.cronograma.eventos[i] = e;
  else datos.cronograma.eventos.push(e);
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "cronograma" } }));
  return { ok: true, evento: copia(e) };
}

async function eliminarEvento(id, { por } = {}) {
  const sin = sinPermisoCronograma(por);
  if (sin) return { ok: false, error: sin };
  const e = datos.cronograma.eventos.find((x) => x.id === id);
  if (!e) return { ok: false, error: "No existe ese evento." };
  anotar("Cronograma", ["Eliminó: " + e.titulo + " (" + e.fecha + ")"], por);
  datos.cronograma.eventos = datos.cronograma.eventos.filter((x) => x.id !== id);
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "cronograma" } }));
  return { ok: true };
}

/* Todo lo que tiene fecha en el encargo: fechas clave, eventos y vencimientos de papeles. */
function agenda() {
  const lista = [];
  datos.cronograma.fechasClave.filter((x) => x.aplica && x.fecha).forEach((x) => lista.push({ fecha: x.fecha, titulo: x.etiqueta, origen: "clave", tipo: "Fecha clave" }));
  datos.cronograma.eventos.forEach((x) => lista.push({ fecha: x.fecha, fechaFin: x.fechaFin, titulo: x.titulo, origen: "evento", tipo: x.tipo, id: x.id, responsable: x.responsable, notas: x.notas }));
  flujo.listar().forEach((f) => {
    if (f.estado === "Firmado") return;
    if (f.fechas.programada) lista.push({ fecha: f.fechas.programada, titulo: f.id + " programado", origen: "papel", tipo: "Programado", papel: f.id });
    if (f.fechas.vence) lista.push({ fecha: f.fechas.vence, titulo: f.id + " vence", origen: "papel", tipo: "Vencimiento", papel: f.id, vencido: f.vencido });
  });
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo));
}

async function iniciar() {
  datos = (await Almacen.cargar()) || vacio();
  const base = vacio();
  datos.proyecto = { ...base.proyecto, ...datos.proyecto };
  datos.empresa = { ...base.empresa, ...datos.empresa };
  datos.historial = datos.historial || [];
  const cr = cronogramaVacio();
  datos.cronograma = { fechasClave: (datos.cronograma && datos.cronograma.fechasClave) || cr.fechasClave, eventos: (datos.cronograma && datos.cronograma.eventos) || [] };
  return api;
}

const api = {
  iniciar,
  proyecto: () => ({ ...datos.proyecto }),
  empresa: () => ({ ...datos.empresa }),
  historial: () => datos.historial.slice().reverse(),
  encabezado,
  TIPOS_EVENTO,
  cronograma,
  guardarFechasClave,
  guardarEvento,
  eliminarEvento,
  agenda,
  hoyISO,
  guardarProyecto,
  guardarEmpresa,
  _reiniciar: async () => {
    datos = vacio();
    await persistir();
  },
};

export default api;
