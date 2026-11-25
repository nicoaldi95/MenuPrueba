/*
 * AuditX — Registro de comunicaciones (hoja «Registro Comunicaciones», referencia RC; UserForm55 del VBA)
 *
 * En el VBA: un formulario pedía fecha, remitente, destinatario, asunto, observaciones y un archivo; copiaba el archivo a
 * «Documentos Adjuntos\\Comunicaciones» y agregaba una fila a la hoja RC con un enlace al archivo.
 * Aquí el registro vive en el complemento (formulario, búsqueda, corrección) y se puede llevar a la hoja de Excel
 * «Registro Comunicaciones» —la del papel RC, para imprimir o firmar— con «Actualizar hoja».
 * El archivo no se copia desde el complemento: se registra su enlace o nombre (copiarlo es parte del backend).
 * Evento emitido: «auditx:comunicaciones-cambio»
 */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import { crearAlmacen } from "./almacen.js";

/* global document, Excel */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/comunicaciones/v1", claveLocal: "auditx.comunicaciones.v1", raiz: "comunicaciones" });

export const HOJA_RC = "Registro Comunicaciones";
export const FILA_TITULOS = 14;
export const FILA_1 = 15;
export const MAX_FILAS = 144; // filas 15–158 de la plantilla original
export const LARGOS = { texto: 120, observaciones: 1000, enlace: 500 };

let datos = { comunicaciones: [] };
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));
const persistir = () => {
  const x = copia(datos);
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:comunicaciones-cambio"));

export async function iniciar() {
  const g = await Almacen.cargar();
  datos = { comunicaciones: g && Array.isArray(g.comunicaciones) ? g.comunicaciones : [] };
}

const esFecha = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(a, mes - 1, d);
  return f.getFullYear() === a && f.getMonth() === mes - 1 && f.getDate() === d;
};
const quien = (pid) => {
  const x = flujo.persona(pid);
  return x ? { id: x.id, nombre: x.nombre, cargo: x.cargo } : { id: pid, nombre: "Desconocido", cargo: "" };
};

/* Lista ordenada por fecha de la comunicación (la más reciente primero). Filtros: texto, desde, hasta. */
export function lista({ texto = "", desde = "", hasta = "" } = {}) {
  const t = texto.trim().toLowerCase();
  return copia(datos.comunicaciones)
    .filter((c) => (!desde || c.fecha >= desde) && (!hasta || c.fecha <= hasta))
    .filter((c) => !t || [c.remitente, c.destinatario, c.asunto, c.observaciones, c.enlace].join(" ").toLowerCase().includes(t))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.no - a.no);
}
export const total = () => datos.comunicaciones.length;

function validar(c) {
  const v = {
    fecha: String(c.fecha || "").trim(),
    remitente: String(c.remitente || "").trim(),
    destinatario: String(c.destinatario || "").trim(),
    asunto: String(c.asunto || "").trim(),
    observaciones: String(c.observaciones || "").trim(),
    enlace: String(c.enlace || "").trim(),
  };
  if (!v.fecha) return { error: "Escriba la fecha de la comunicación." };
  if (!esFecha(v.fecha)) return { error: "Por favor ingrese una fecha válida." };
  if (!v.remitente) return { error: "Escriba el remitente." };
  if (!v.destinatario) return { error: "Escriba el destinatario." };
  if (!v.asunto) return { error: "Escriba el asunto." };
  if (v.remitente.length > LARGOS.texto || v.destinatario.length > LARGOS.texto || v.asunto.length > LARGOS.texto) return { error: "Remitente, destinatario y asunto admiten hasta " + LARGOS.texto + " caracteres." };
  if (v.observaciones.length > LARGOS.observaciones) return { error: "Las observaciones admiten hasta " + LARGOS.observaciones + " caracteres." };
  if (v.enlace.length > LARGOS.enlace) return { error: "El enlace admite hasta " + LARGOS.enlace + " caracteres." };
  return { v };
}
const activo = (por) => {
  const p = flujo.persona(por);
  return p && p.activo !== false;
};

export async function crear(campos, { por } = {}) {
  if (!activo(por)) return { ok: false, error: "Su usuario no está activo; no puede registrar comunicaciones." };
  const r = validar(campos || {});
  if (r.error) return { ok: false, error: r.error };
  if (datos.comunicaciones.length >= MAX_FILAS) return { ok: false, error: "El registro ya tiene " + MAX_FILAS + " comunicaciones (el máximo de la hoja RC)." };
  const no = datos.comunicaciones.reduce((m, c) => Math.max(m, c.no), 0) + 1;
  const c = { no, ...r.v, registro: { por: quien(por), fecha: new Date().toISOString() }, modificaciones: [] };
  datos.comunicaciones.push(c);
  await persistir();
  avisar();
  return { ok: true, comunicacion: copia(c) };
}

/* Corregir: quien la registró o quien aprueba. */
export const puedeEditar = (c, pid) => !!c && activo(pid) && (c.registro.por.id === pid || flujo.puedeAdministrar(pid));
export const puedeEliminar = (pid) => activo(pid) && flujo.puedeAdministrar(pid);

export async function editar(no, campos, { por } = {}) {
  const c = datos.comunicaciones.find((x) => x.no === no);
  if (!c) return { ok: false, error: "No se encontró la comunicación." };
  if (!puedeEditar(c, por)) return { ok: false, error: "Solo quien registró la comunicación o quien aprueba puede corregirla." };
  const r = validar(campos || {});
  if (r.error) return { ok: false, error: r.error };
  const cambios = Object.keys(r.v).filter((k) => r.v[k] !== c[k]);
  if (!cambios.length) return { ok: false, error: "No hay cambios por guardar." };
  c.modificaciones.push({ fecha: new Date().toISOString(), por: quien(por), campos: cambios });
  Object.assign(c, r.v);
  await persistir();
  avisar();
  return { ok: true, comunicacion: copia(c) };
}

export async function eliminar(no, { por } = {}) {
  if (!puedeEliminar(por)) return { ok: false, error: "Solo quien aprueba puede eliminar comunicaciones del registro." };
  const i = datos.comunicaciones.findIndex((x) => x.no === no);
  if (i < 0) return { ok: false, error: "No se encontró la comunicación." };
  datos.comunicaciones.splice(i, 1);
  await persistir();
  avisar();
  return { ok: true };
}

/* ------------------------------------------------------------------ hoja de Excel (papel RC) */

const sinExcel = () => typeof Excel === "undefined" || !Excel.run;
const fmt = (iso) => iso.split("-").reverse().join("/");
const esEnlace = (s) => /^(https?:\/\/|\\\\|[A-Za-z]:\\)/.test(s);

export async function existeHoja() {
  if (sinExcel()) return false;
  let existe = false;
  await Excel.run(async (ctx) => {
    const h = ctx.workbook.worksheets.getItemOrNullObject(HOJA_RC);
    await ctx.sync();
    existe = !h.isNullObject;
  });
  return existe;
}

function plantilla(h) {
  const enc = proyecto.encabezado();
  let f = null;
  try {
    f = flujo.ficha("comunicaciones"); // el papel RC aún no participa del flujo: sin responsables, esas celdas quedan vacías
  } catch (e) {
    f = null;
  }
  const nom = (id) => (id && flujo.persona(id) ? flujo.persona(id).nombre : "");
  h.getRange("B1").values = [["REGISTRO DE COMUNICACIONES"]];
  h.getRange("B1").format.font.bold = true;
  h.getRange("B1").format.font.size = 16;
  h.getRange("A5:A7").values = [["Entidad (o cliente):"], ["Preparado por:"], ["Supervisado por:"]];
  h.getRange("D6:D7").values = [["Revisado por:"], ["Aprobado por:"]];
  h.getRange("G5:G6").values = [["Referencia"], ["RC"]];
  h.getRange("B5:E5").values = [[enc.entidad || "", enc.nit ? "ID. " + enc.nit : "", "Período de auditoría de: " + (enc.desde ? fmt(enc.desde) : ""), "Hasta: " + (enc.hasta ? fmt(enc.hasta) : "")]];
  if (f && f.asignados) {
    h.getRange("B6").values = [[nom(f.asignados.prepara)]];
    h.getRange("E6").values = [[nom(f.asignados.revisa)]];
    h.getRange("B7").values = [[nom(f.asignados.supervisa)]];
    h.getRange("E7").values = [[nom(f.asignados.aprueba)]];
  }
  const t = h.getRange("A" + FILA_TITULOS + ":F" + FILA_TITULOS);
  t.values = [["Fecha Comunicación", "Remitente", "Destinatario", "Asunto", "Observaciones", "Enlace"]];
  t.format.fill.color = "#0F1A2C";
  t.format.font.color = "#FFFFFF";
  t.format.font.bold = true;
  h.getRange("A:A").format.columnWidth = 110;
  h.getRange("B:E").format.columnWidth = 150;
  h.getRange("F:F").format.columnWidth = 220;
}

/* Lleva el registro a la hoja «Registro Comunicaciones» (la crea con la plantilla si no existe). Reemplaza las filas de datos. */
export async function actualizarHoja() {
  if (sinExcel()) return { ok: false, motivo: "fuera-de-excel" };
  try {
    let creada = false;
    const filas = copia(datos.comunicaciones).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.no - b.no);
    await Excel.run(async (ctx) => {
      let h = ctx.workbook.worksheets.getItemOrNullObject(HOJA_RC);
      await ctx.sync();
      if (h.isNullObject) {
        h = ctx.workbook.worksheets.add(HOJA_RC);
        creada = true;
      }
      plantilla(h);
      h.getRange("A" + FILA_1 + ":F" + (FILA_1 + MAX_FILAS - 1)).clear("Contents");
      if (filas.length) {
        const r = h.getRange("A" + FILA_1 + ":F" + (FILA_1 + filas.length - 1));
        r.values = filas.map((c) => [fmt(c.fecha), c.remitente, c.destinatario, c.asunto, c.observaciones, c.enlace]);
        filas.forEach((c, i) => {
          if (c.enlace && esEnlace(c.enlace)) h.getRange("F" + (FILA_1 + i)).hyperlink = { address: c.enlace, textToDisplay: c.enlace };
        });
      }
      h.visibility = "Visible";
      h.activate();
      await ctx.sync();
    });
    return { ok: true, creada, filas: filas.length };
  } catch (e) {
    console.error("AuditX: no se pudo actualizar la hoja RC", e);
    return { ok: false, motivo: "error", error: e && e.message ? e.message : String(e) };
  }
}

export default { iniciar, lista, total, crear, editar, eliminar, puedeEditar, puedeEliminar, actualizarHoja, existeHoja, HOJA_RC, MAX_FILAS };
