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
  proyecto: { entidad: "", nit: "", firma: "", desde: "", hasta: "", encargo: "", tipo: TIPOS_ENCARGO[0], marco: MARCOS[0], fechaInforme: "" },
  empresa: { razonSocial: "", nombreComercial: "", representante: "", actividad: "", ciudad: "", direccion: "", correo: "", telefono: "", rutaOneDrive: "" },
  cronograma: cronogramaVacio(),
  onedrive: { exigir: false, rutas: {} }, // la ruta es de cada persona, no de la empresa
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

const ETIQ_PROYECTO = { entidad: "Entidad (cliente)", nit: "NIT / ID", firma: "Firma de auditoría", desde: "Período desde", hasta: "Período hasta", encargo: "Nombre del encargo", tipo: "Tipo de encargo", marco: "Marco normativo", fechaInforme: "Fecha del informe" };
const ETIQ_EMPRESA = { razonSocial: "Razón social", nombreComercial: "Nombre comercial", representante: "Representante legal", actividad: "Actividad económica", ciudad: "Ciudad", direccion: "Dirección", correo: "Correo de contacto", telefono: "Teléfono", rutaOneDrive: "Carpeta OneDrive" };

async function guardarProyecto(nuevo, { por, seccion = "Información del proyecto" } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const { corte1, corte2, ...resto } = nuevo;
  const p = { ...datos.proyecto, ...resto };
  Object.keys(p).forEach((k) => (p[k] = String(p[k] == null ? "" : p[k]).trim()));
  const clave = (id) => datos.cronograma.fechasClave.find((x) => x.id === id) || {};
  const c1 = corte1 === undefined ? (clave("planificacion").aplica ? clave("planificacion").fecha || "" : "") : String(corte1 || "").trim();
  const c2 = corte2 === undefined ? (clave("precierre").aplica ? clave("precierre").fecha || "" : "") : String(corte2 || "").trim();
  const donde = seccion === "Configurar Empresa" ? "" : " en «Configurar Empresa»";
  if (!p.entidad) return { ok: false, error: "Escriba la entidad (cliente)" + donde + "." };
  /* Igual que el VBA: el inicio del período y el corte final son obligatorios; los cortes 1 y 2 son opcionales. */
  if (!p.desde) return { ok: false, error: "Escriba la fecha de inicio del período de auditoría" + donde + "." };
  if (!p.hasta) return { ok: false, error: "Escriba el corte final (hasta)" + donde + ": es la fecha de cierre del período." };
  const orden = [["Inicio del período", p.desde], ["Corte 1", c1], ["Corte 2", c2], ["Corte final", p.hasta]].filter((x) => x[1]);
  for (let i = 1; i < orden.length; i++) if (orden[i][1] < orden[i - 1][1]) return { ok: false, error: "«" + orden[i][0] + "» no puede ser anterior a «" + orden[i - 1][0] + "»." };
  if (p.fechaInforme && p.fechaInforme < p.hasta) return { ok: false, error: "La fecha del informe no puede ser anterior al cierre del período." };
  const cambios = diferencias(datos.proyecto, p, ETIQ_PROYECTO);
  /* Los cortes son las fechas clave del cronograma: se guardan juntos para que no se desajusten. */
  const nuevas = datos.cronograma.fechasClave.map((x) => {
    const f = x.id === "planificacion" ? c1 : x.id === "precierre" ? c2 : x.id === "cierre" ? p.hasta : null;
    return f === null ? x : { ...x, fecha: f, aplica: x.id === "cierre" ? true : !!f };
  });
  datos.cronograma.fechasClave.forEach((x) => {
    const n = nuevas.find((y) => y.id === x.id);
    if (x.id !== "cierre" && ((x.fecha || "") !== (n.fecha || "") || !!x.aplica !== !!n.aplica)) cambios.push(x.etiqueta + ": " + (n.aplica ? n.fecha : "no aplica"));
  });
  anotar(seccion, cambios, por);
  datos.proyecto = p;
  datos.cronograma.fechasClave = nuevas;
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

/* ------------------------------------------------------------------ carpeta OneDrive (por persona) */

/* Acepta «C:\\…», «\\\\servidor\\…» o «/…» (Mac); quita comillas y barra final (Windows pega «Copiar como ruta» con comillas). */
const limpiarRuta = (t) => {
  let r = String(t || "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (r.length > 3) r = r.replace(/[\\/]+$/, "");
  return r;
};
const RUTA_VALIDA = /^([A-Za-z]:[\\/]|\\\\|\/)/;

async function guardarRutaOneDrive(pid, ruta, { por } = {}) {
  const quien = flujo.persona(pid);
  if (!quien) return { ok: false, error: "No existe ese usuario." };
  if (por !== pid && !flujo.puedeAdministrar(por)) return { ok: false, error: "Cada usuario registra su propia carpeta." };
  const r = limpiarRuta(ruta);
  if (!r) return { ok: false, error: "Escriba la ruta de la carpeta." };
  if (!RUTA_VALIDA.test(r)) return { ok: false, error: "Escriba la ruta completa, por ejemplo C:\\Users\\su-nombre\\OneDrive\\AuditX." };
  const antes = datos.onedrive.rutas[pid] || "";
  if (antes === r) return { ok: true, sinCambios: true };
  anotar("Carpeta OneDrive", [quien.nombre + ": «" + (antes || "—") + "» → «" + r + "»"], por);
  datos.onedrive.rutas[pid] = r;
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "onedrive" } }));
  return { ok: true };
}

/* «Exigir carpeta OneDrive» (casilla del formulario Configurar empresa del VBA): pide la ruta a cada usuario. */
async function guardarExigirOneDrive(valor, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  if (!!datos.onedrive.exigir === !!valor) return { ok: true, sinCambios: true };
  anotar("Carpeta OneDrive", ["Pedir la carpeta OneDrive a cada usuario: " + (valor ? "sí" : "no")], por);
  datos.onedrive.exigir = !!valor;
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:proyecto-cambio", { detail: { seccion: "onedrive" } }));
  return { ok: true };
}

/* Lo que llevan en el encabezado todos los papeles: entidad, NIT y período. */
function encabezado() {
  const p = datos.proyecto;
  return { entidad: p.entidad, nit: p.nit, firma: p.firma, desde: p.desde, hasta: p.hasta };
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
  datos.cronograma.fechasClave = lista.map((n) => ({ id: n.id, etiqueta: n.etiqueta, fecha: n.fecha || "", aplica: n.id === "cierre" ? true : !!n.aplica }));
  const cierre = datos.cronograma.fechasClave.find((x) => x.id === "cierre");
  if (cierre && cierre.fecha) datos.proyecto.hasta = cierre.fecha; // el corte final es el cierre del período
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
  datos.onedrive = { exigir: false, ...(datos.onedrive || {}), rutas: { ...((datos.onedrive || {}).rutas || {}) } };
  datos.historial = datos.historial || [];
  const cr = cronogramaVacio();
  datos.cronograma = { fechasClave: (datos.cronograma && datos.cronograma.fechasClave) || cr.fechasClave, eventos: (datos.cronograma && datos.cronograma.eventos) || [] };
  const ci = datos.cronograma.fechasClave.find((x) => x.id === "cierre");
  if (ci) {
    ci.aplica = true;
    if (datos.proyecto.hasta) ci.fecha = datos.proyecto.hasta;
    else if (ci.fecha) datos.proyecto.hasta = ci.fecha;
  }
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
  rutaOneDrive: (pid) => datos.onedrive.rutas[pid] || "",
  exigeOneDrive: () => !!datos.onedrive.exigir,
  guardarRutaOneDrive,
  guardarExigirOneDrive,
  _reiniciar: async () => {
    datos = vacio();
    await persistir();
  },
};

export default api;
