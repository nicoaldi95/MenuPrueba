/*
 * AuditX — Historial «quién y cómo»
 *
 * Reúne los movimientos de todos los papeles (quién, qué hizo, cuándo y con qué comentario) para
 * consultarlos, escribirlos en una hoja del libro o sacarlos en PDF.
 */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import { crearPdf } from "./pdf.js";

/* global Excel */

export const HOJA_HISTORIAL = "Historial AuditX";

export const fechaHora = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
};

/* filtro: { papel, persona (id), accion, desde, hasta (AAAA-MM-DD), texto } */
export function entradas(filtro = {}) {
  const ids = filtro.papel ? [filtro.papel] : flujo.papeles().map((p) => p.id);
  const lista = [];
  ids.forEach((id) => {
    const f = flujo.ficha(id);
    f.historial.forEach((h) => lista.push({ ...h, papel: id, etiquetaPapel: f.etiqueta, etiqueta: flujo.etiquetaAccion(h.accion) }));
  });
  const t = (filtro.texto || "").trim().toLowerCase();
  return lista
    .filter((e) => {
      const dia = fechaHora(e.fecha).slice(0, 10);
      if (filtro.persona && e.por.id !== filtro.persona) return false;
      if (filtro.accion && e.accion !== filtro.accion) return false;
      if (filtro.desde && dia < filtro.desde) return false;
      if (filtro.hasta && dia > filtro.hasta) return false;
      if (t && !(e.papel + " " + e.por.nombre + " " + e.etiqueta + " " + e.nota).toLowerCase().includes(t)) return false;
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const ACCIONES_FILTRO = ["iniciar", "enviar", "visto-bueno", "devolver", "firmar", "reabrir", "contenido-modificado", "asignar", "fechas"];

function lineaEntrada(e) {
  const mov = e.de !== e.a ? "  (" + e.de + " -> " + e.a + ")" : "";
  return fechaHora(e.fecha) + "  " + e.papel + "  " + e.por.nombre + (e.por.cargo ? " (" + e.por.cargo + ")" : "") + " - " + e.etiqueta + mov;
}

function encabezadoPdf(titulo, extra) {
  const p = proyecto.proyecto();
  const yo = flujo.usuarioActual();
  const partes = [p.entidad || "Entidad sin definir", p.nit ? "NIT " + p.nit : "", p.desde && p.hasta ? "Período " + p.desde + " a " + p.hasta : ""].filter(Boolean).join("  -  ");
  return { titulo, subtitulo: partes + "\nGenerado el " + fechaHora(new Date().toISOString()) + (yo ? " por " + yo.nombre : "") + (extra ? "\n" + extra : "") };
}

/* PDF cronológico con las entradas que se estén viendo. */
export function pdfDeEntradas(lista, descripcionFiltro = "") {
  const bloques = [];
  if (!lista.length) bloques.push({ texto: "No hay movimientos con ese filtro." });
  lista.forEach((e) => {
    bloques.push({ texto: lineaEntrada(e), negrita: true, tam: 9.5, espacioAntes: 5 });
    if (e.nota) bloques.push({ texto: e.nota, tam: 9, sangria: 14 });
  });
  return crearPdf({ ...encabezadoPdf("Historial de firmas y movimientos", descripcionFiltro), bloques });
}

/* Una ficha por papel: estado, responsables y su historial. */
export function pdfDeFichas(ids) {
  const bloques = [];
  ids.forEach((id, i) => {
    const f = flujo.ficha(id);
    const q = flujo.quienYComo(id);
    bloques.push({ texto: f.id + "  " + f.etiqueta.replace(/^AA-\S+\s*/, ""), negrita: true, tam: 11, espacioAntes: i ? 14 : 0 });
    bloques.push({ texto: "Estado: " + f.estado + (f.vencido ? " (vencido)" : "") + (f.fechas.vence ? "  -  Vence " + f.fechas.vence : ""), tam: 9.5 });
    const resp = flujo.rolesActivos().map((r) => r.nombre + ": " + (f.asignados[r.id] ? (flujo.persona(f.asignados[r.id]) || { nombre: "?" }).nombre : "sin asignar")).join("   |   ");
    bloques.push({ texto: resp, tam: 9.5 });
    if (q.firmo) bloques.push({ texto: "Firmado por " + q.firmo.nombre + " (" + q.firmo.cargo + ") el " + fechaHora(q.firmo.fecha), tam: 9.5, negrita: true });
    if (!f.historial.length) bloques.push({ texto: "Sin movimientos.", tam: 9, sangria: 14 });
    f.historial.slice().reverse().forEach((h) => {
      bloques.push({ texto: fechaHora(h.fecha) + "  " + h.por.nombre + " - " + flujo.etiquetaAccion(h.accion) + (h.de !== h.a ? "  (" + h.de + " -> " + h.a + ")" : ""), tam: 9, sangria: 14, espacioAntes: 2 });
      if (h.nota) bloques.push({ texto: h.nota, tam: 8.5, sangria: 28 });
    });
  });
  return crearPdf({ ...encabezadoPdf("Ficha de firmas de los papeles de trabajo", ids.length + (ids.length === 1 ? " papel" : " papeles")), bloques });
}

/* Escribe el historial en una hoja del libro (la crea o la reemplaza). */
export async function enviarAHoja(lista) {
  if (typeof Excel === "undefined" || !Excel.run) return { ok: false, motivo: "fuera-de-excel" };
  const filas = [["Fecha", "Papel", "Nombre del papel", "Persona", "Cargo", "Rol", "Acción", "Estado anterior", "Estado nuevo", "Comentario"]].concat(
    lista.map((e) => [fechaHora(e.fecha), e.papel, e.etiquetaPapel, e.por.nombre, e.por.cargo, e.rol ? flujo.nombreRol(e.rol) : "", e.etiqueta, e.de, e.a, e.nota])
  );
  try {
    await Excel.run(async (ctx) => {
      let hoja = ctx.workbook.worksheets.getItemOrNullObject(HOJA_HISTORIAL);
      await ctx.sync();
      if (hoja.isNullObject) hoja = ctx.workbook.worksheets.add(HOJA_HISTORIAL);
      else hoja.getRange().clear();
      const rango = hoja.getRangeByIndexes(0, 0, filas.length, filas[0].length);
      rango.numberFormat = filas.map((f) => f.map(() => "@")); // todo como texto: sin conversiones de fecha
      rango.values = filas;
      hoja.getRangeByIndexes(0, 0, 1, filas[0].length).format.font.bold = true;
      hoja.freezePanes.freezeRows(1);
      rango.format.autofitColumns();
      hoja.activate();
      await ctx.sync();
    });
    return { ok: true, filas: filas.length - 1 };
  } catch (e) {
    console.error("AuditX: no se pudo escribir el historial en la hoja", e);
    return { ok: false, motivo: "error" };
  }
}
