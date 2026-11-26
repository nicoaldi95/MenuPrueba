/*
 * AuditX — Hojas de Excel que genera el complemento (plantillas)
 *
 * En el libro original cada opción de Monitoreo y Control mostraba una hoja oculta con su propia plantilla. En el complemento
 * los datos viven en las pantallas, y desde cada una se puede «Llevar a la hoja de Excel»: la hoja se crea con su plantilla si no
 * existe, y si ya existe se actualiza (se reemplaza lo que había por los datos de hoy).
 *
 *   estatus       «Estatus PT Auditoria»      documentos del cliente, resumen por sección y firmas de cada papel
 *   indice        «Indice»                    listado de papeles con su sección, ruta y enlace a la hoja
 *   alertas       «Listado Alertas»           fecha, usuario, descripción, respuesta y comentarios
 *   tareas        «Registro Activ. Ejecucion» registro de tareas
 *   kanban        «Kanban Proyecto Ej»        tarjetas por estado
 *   dash-tareas   «Dashboard Ej»              indicadores y gráficos de tareas
 *   dash-proyecto «Dashboard Proyecto»        indicadores y gráficos del proyecto
 *
 * Los constructores de datos (datos*) no tocan Excel: se pueden probar solos.
 */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import alertas from "./alertas.js";
import tareas, { ESTADOS, PRIORIDADES } from "./tareas.js";
import docsCliente from "./docs-cliente.js";
import { CATALOGO, SECCIONES } from "./catalogo.js";
import { resumen } from "./vista-estatus.js";
import { el } from "./ui.js";

/* global Excel */

export const HOJAS = {
  estatus: { nombre: "Estatus PT Auditoria", ref: "EPT", titulo: "ESTATUS DE FIRMAS PAPELES DE TRABAJO" },
  indice: { nombre: "Indice", ref: "Indice", titulo: "ÍNDICE DE PAPELES DE TRABAJO" },
  alertas: { nombre: "Listado Alertas", ref: "LA", titulo: "LISTADO DE ALERTAS" },
  tareas: { nombre: "Registro Activ. Ejecucion", ref: "", titulo: "" },
  kanban: { nombre: "Kanban Proyecto Ej", ref: "", titulo: "" },
  "dash-tareas": { nombre: "Dashboard Ej", ref: "", titulo: "DASHBOARD DE TAREAS" },
  "dash-proyecto": { nombre: "Dashboard Proyecto", ref: "", titulo: "DASHBOARD DEL PROYECTO" },
};

const COLOR_TITULOS = "#0F1A2C";
const sinExcel = () => typeof Excel === "undefined" || !Excel.run;
const fmtF = (iso) => {
  if (!iso) return "";
  const t = String(iso);
  if (t.length > 10 && !isNaN(new Date(t))) {
    const d = new Date(t); // marca de tiempo: se muestra el día local
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }
  return t.slice(0, 10).split("-").reverse().join("/");
};
const nombreDe = (pid) => (pid && flujo.persona(pid) ? flujo.persona(pid).nombre : "");
const letra = (n) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/* ===================================================================== datos (sin Excel) */

export function datosAlertas() {
  const cab = ["Fecha", "Usuario Activo", "Descripción Alerta", "Respuesta", "Comentarios Adicionales", "Tipo", "Estado"];
  const filas = alertas
    .listar()
    .slice()
    .reverse()
    .map((a) => [fmtF(a.fecha), (a.para || []).map(nombreDe).filter(Boolean).join(", "), a.descripcion || "", a.respuesta || "", a.comentarios || "", a.tipo || "", a.estado || ""]);
  return { cab, filas };
}

export function datosIndice() {
  const cab = ["Nombre PT", "Sección", "Ruta de Acceso"];
  const filas = CATALOGO.map((c) => ({ fila: [c.nombre, c.seccion, c.ruta || ""], hoja: c.hoja || "" }));
  return { cab, filas };
}

export function datosTareas() {
  const cab = ["No.", "Usuario Asigna", "Proceso", "Nombre de la Tarea", "Detalle de tarea", "Responsable", "Prioridad", "Fecha Inicio", "Vencimiento", "Estado", "% Progreso", "Comentarios", "Archivo Adjunto", "Enviado"];
  const filas = tareas
    .lista()
    .sort((a, b) => a.no - b.no)
    .map((t) => [t.no, nombreDe(t.asigna), t.proceso || "", t.nombre, t.detalle || "", nombreDe(t.responsable), t.prioridad, fmtF(t.inicio), fmtF(t.vencimiento), t.estado, (t.progreso || 0) / 100, t.comentarios || "", t.adjunto || "", t.avisada ? "SI" : "NO"]);
  return { cab, filas };
}

export function datosKanban() {
  const lista = tareas.lista();
  const columnas = ESTADOS.map((e) => ({ estado: e, tarjetas: lista.filter((t) => t.estado === e).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.no - b.no) }));
  return { cab: ["Tarea", "Responsable", "Vence", "Prioridad"], columnas };
}

export function datosDashTareas() {
  const lista = tareas.lista();
  const venc = lista.filter((t) => tareas.esVencida(t)).length;
  const prom = lista.length ? lista.reduce((a, t) => a + (t.progreso || 0), 0) / lista.length / 100 : 0;
  const kpis = [["Total de tareas", lista.length], ...ESTADOS.map((e) => [e, lista.filter((t) => t.estado === e).length]), ["Vencidas", venc], ["Avance promedio", prom]];
  const porEstado = ESTADOS.map((e) => [e, lista.filter((t) => t.estado === e).length]);
  const porPrioridad = PRIORIDADES.map((p) => [p, lista.filter((t) => t.prioridad === p).length]);
  const resp = [...new Set(lista.map((t) => t.responsable))];
  const porResponsable = resp.map((r) => {
    const mias = lista.filter((t) => t.responsable === r);
    return [nombreDe(r) || "Sin responsable", mias.length, mias.filter((t) => t.estado === "Completado").length, mias.filter((t) => tareas.esVencida(t)).length];
  });
  return { kpis, porEstado, porPrioridad, porResponsable };
}

export function datosDashProyecto() {
  const r = resumen();
  const p = proyecto.proyecto();
  const docs = docsCliente.resumenDocs();
  const kpis = [
    ["Avance (papeles aprobados)", r.avance],
    ["Papeles del catálogo", r.total],
    ["Papeles en el flujo", r.enFlujo],
    ["Aprobados", r.aprobados],
    ["Pendientes", r.pendientes],
    ["Vencidos sin firmar", r.vencidos],
    ["Documentos del cliente cargados", docs.cargados + " de " + docs.usados],
    ["Tareas", tareas.lista().length],
    ["Alertas abiertas", alertas.listar({ estado: "Abierta" }).length],
    ["Personas en el equipo", flujo.personas(true).length],
  ];
  const nombres = { prepara: "Preparados", revisa: "Revisados", supervisa: "Supervisados", aprueba: "Aprobados" };
  const cab = ["Sección", "Total", ...r.roles.map((x) => nombres[x] || x), "Pendientes"];
  const porSeccion = r.filas.map((f) => [f.seccion, f.total, ...r.roles.map((x) => f[x]), f.total - f.aprueba]);
  const equipo = flujo.personas(true).map((x) => [x.nombre, x.cargo || "", flujo.nombrePerfil(x.perfil)]);
  return { entidad: p.entidad || "", kpis, cab, porSeccion, equipo, resumen: r };
}

export function datosEstatus() {
  const r = resumen();
  const nombres = { prepara: "Preparados", revisa: "Revisados", supervisa: "Supervisados", aprueba: "Aprobados" };
  const cabResumen = ["Sección", "Total", ...r.roles.map((x) => nombres[x] || x), "Pendientes"];
  const resumenSecciones = r.filas.map((f) => [f.seccion, f.total, ...r.roles.map((x) => f[x]), f.total - f.aprueba]);
  const docs = docsCliente.lista().map((d) => [d.nombre, d.aplica ? "Aplica" : "No Aplica", d.cargado ? "SI" : "NO", d.enlace]);
  const enFlujo = new Set(flujo.papeles().map((p) => p.id));
  const rolesRev = flujo.rolesActivos();
  const celda = (x) => (x && x.persona !== undefined ? (x.persona ? x.persona.nombre + " " + fmtF(x.fecha) : "") : x ? x.nombre + " " + fmtF(x.fecha) : "");
  const filaPapel = (c) => {
    const usado = enFlujo.has(c.codigo);
    if (!usado) return [c.nombre, "", "", "", "", "", "", ""];
    const q = flujo.quienYComo(c.codigo);
    const rev = (rolNombre) => q.reviso.find((x) => x.rol === rolNombre);
    const nomRev = (rolId) => (rolesRev.find((x) => x.id === rolId) || {}).nombre;
    return [
      c.nombre,
      "SI",
      q.elaboro ? q.elaboro.nombre + " " + fmtF(q.elaboro.fecha) : "",
      celda(rev(nomRev("revisa"))),
      celda(rev(nomRev("supervisa"))),
      q.firmo ? q.firmo.nombre + " " + fmtF(q.firmo.fecha) : "",
      q.firmo ? fmtF(q.firmo.fecha) : "",
      "",
    ];
  };
  const papeles = SECCIONES.map((s) => ({ seccion: s, filas: CATALOGO.filter((c) => c.seccion === s).map(filaPapel) })).filter((g) => g.filas.length);
  return { cabResumen, resumenSecciones, docs, papeles };
}

/* ===================================================================== escritura en Excel */

async function obtenerHoja(ctx, nombre) {
  let h = ctx.workbook.worksheets.getItemOrNullObject(nombre);
  await ctx.sync();
  let creada = false;
  if (h.isNullObject) {
    h = ctx.workbook.worksheets.add(nombre);
    creada = true;
  }
  return { h, creada };
}

async function limpiar(ctx, h, filas = 600, columnas = "Z") {
  h.getRange("A1:" + columnas + filas).clear();
  try {
    h.charts.load("items");
    await ctx.sync();
    h.charts.items.forEach((g) => g.delete());
  } catch (e) {
    /* sin gráficos previos */
  }
}

/* Encabezado de los papeles: entidad, NIT, período, responsables y referencia. */
function encabezado(h, { titulo, ref, colRef, celdaTitulo = "B1", papelId }) {
  const enc = proyecto.encabezado();
  let f = null;
  try {
    f = papelId ? flujo.ficha(papelId) : null;
  } catch (e) {
    f = null;
  }
  h.getRange(celdaTitulo).values = [[titulo]];
  h.getRange(celdaTitulo).format.font.bold = true;
  h.getRange(celdaTitulo).format.font.size = 16;
  h.getRange("A5:A7").values = [["Entidad (o cliente):"], ["Preparado por:"], ["Supervisado por:"]];
  h.getRange("D6:D7").values = [["Revisado por:"], ["Aprobado por:"]];
  h.getRange("B5:E5").values = [[enc.entidad || "", enc.nit ? "ID. " + enc.nit : "", "Período de auditoría de: " + fmtF(enc.desde), "Hasta: " + fmtF(enc.hasta)]];
  h.getRange(colRef + "5:" + colRef + "6").values = [["Referencia"], [ref]];
  if (f && f.asignados) {
    h.getRange("B6").values = [[nombreDe(f.asignados.prepara)]];
    h.getRange("E6").values = [[nombreDe(f.asignados.revisa)]];
    h.getRange("B7").values = [[nombreDe(f.asignados.supervisa)]];
    h.getRange("E7").values = [[nombreDe(f.asignados.aprueba)]];
  }
}

function titulosTabla(h, fila, desde, valores) {
  const r = h.getRange(desde + fila + ":" + letra(desde.charCodeAt(0) - 64 + valores.length - 1) + fila);
  r.values = [valores];
  r.format.fill.color = COLOR_TITULOS;
  r.format.font.color = "#FFFFFF";
  r.format.font.bold = true;
  return r;
}

function bloque(h, fila, col1, filas, formatoNumero) {
  if (!filas.length) return;
  const c2 = letra(col1 + filas[0].length - 1);
  const r = h.getRange(letra(col1) + fila + ":" + c2 + (fila + filas.length - 1));
  r.values = filas;
  if (formatoNumero) r.numberFormat = filas.map((f) => f.map(() => formatoNumero));
}

function grafico(h, tipo, rango, titulo, desde, hasta) {
  const g = h.charts.add(tipo, h.getRange(rango), "Columns");
  g.title.text = titulo;
  g.setPosition(desde, hasta);
  return g;
}

const ESCRITORES = {
  async alertas(ctx, h) {
    const d = datosAlertas();
    encabezado(h, { titulo: HOJAS.alertas.titulo, ref: HOJAS.alertas.ref, colRef: "G" });
    titulosTabla(h, 14, "A", d.cab);
    bloque(h, 15, 1, d.filas);
    h.getRange("A:A").format.columnWidth = 90;
    h.getRange("B:B").format.columnWidth = 150;
    h.getRange("C:C").format.columnWidth = 380;
    h.getRange("D:D").format.columnWidth = 90;
    h.getRange("E:E").format.columnWidth = 260;
    h.getRange("F:G").format.columnWidth = 90;
    return d.filas.length;
  },

  async indice(ctx, h) {
    const d = datosIndice();
    encabezado(h, { titulo: HOJAS.indice.titulo, ref: HOJAS.indice.ref, colRef: "F" });
    h.getRange("B11").values = [["Buscar Papel de trabajo: use el filtro de la fila 13"]];
    titulosTabla(h, 13, "B", d.cab);
    bloque(h, 14, 2, d.filas.map((x) => x.fila));
    // enlaces a la hoja de cada papel, solo si esa hoja existe en el libro
    ctx.workbook.worksheets.load("items/name");
    await ctx.sync();
    const existentes = new Set(ctx.workbook.worksheets.items.map((s) => s.name));
    d.filas.forEach((x, i) => {
      if (x.hoja && existentes.has(x.hoja)) h.getRange("B" + (14 + i)).hyperlink = { documentReference: "'" + x.hoja + "'!A1", textToDisplay: x.fila[0] };
    });
    try {
      h.autoFilter.apply(h.getRange("B13:D" + (13 + d.filas.length)));
    } catch (e) {
      /* el filtro es opcional */
    }
    h.getRange("A:A").format.columnWidth = 110;
    h.getRange("B:B").format.columnWidth = 380;
    h.getRange("C:D").format.columnWidth = 190;
    return d.filas.length;
  },

  async tareas(ctx, h) {
    const d = datosTareas();
    titulosTabla(h, 1, "A", d.cab);
    bloque(h, 2, 1, d.filas);
    if (d.filas.length) h.getRange("K2:K" + (1 + d.filas.length)).numberFormat = d.filas.map(() => ["0%"]);
    h.getRange("A:A").format.columnWidth = 45;
    h.getRange("B:C").format.columnWidth = 130;
    h.getRange("D:E").format.columnWidth = 220;
    h.getRange("F:F").format.columnWidth = 130;
    h.getRange("G:K").format.columnWidth = 85;
    h.getRange("L:M").format.columnWidth = 200;
    h.freezePanes.freezeRows(1);
    return d.filas.length;
  },

  async kanban(ctx, h) {
    const d = datosKanban();
    h.getRange("J2:J3").values = [["Fecha actual"], [fmtF(flujo.hoyISO())]];
    h.getRange("J2").format.font.bold = true;
    let total = 0;
    d.columnas.forEach((col, i) => {
      const c0 = 1 + i * 5;
      h.getRange(letra(c0) + "6").values = [[col.estado + " (" + col.tarjetas.length + ")"]];
      h.getRange(letra(c0) + "6").format.font.bold = true;
      h.getRange(letra(c0) + "6").format.font.size = 13;
      titulosTabla(h, 7, letra(c0), d.cab);
      bloque(h, 8, c0, col.tarjetas.map((t) => ["#" + t.no + " " + t.nombre, nombreDe(t.responsable), fmtF(t.vencimiento), t.prioridad]));
      col.tarjetas.forEach((t, k) => {
        const p = h.getRange(letra(c0 + 3) + (8 + k));
        p.format.fill.color = t.prioridad === "Alta" ? "#F8D7D3" : t.prioridad === "Media" ? "#FBEFC9" : "#DDEBDD";
        if (tareas.esVencida(t)) h.getRange(letra(c0 + 2) + (8 + k)).format.font.color = "#B3261E";
      });
      h.getRange(letra(c0) + ":" + letra(c0)).format.columnWidth = 230;
      h.getRange(letra(c0 + 1) + ":" + letra(c0 + 3)).format.columnWidth = 90;
      total += col.tarjetas.length;
    });
    return total;
  },

  async "dash-tareas"(ctx, h) {
    const d = datosDashTareas();
    h.getRange("A1").values = [[HOJAS["dash-tareas"].titulo]];
    h.getRange("A1").format.font.bold = true;
    h.getRange("A1").format.font.size = 16;
    titulosTabla(h, 3, "A", ["Indicador", "Valor"]);
    bloque(h, 4, 1, d.kpis);
    h.getRange("B" + (3 + d.kpis.length)).numberFormat = [["0%"]];
    let f = 5 + d.kpis.length;
    titulosTabla(h, f, "A", ["Estado", "Tareas"]);
    bloque(h, f + 1, 1, d.porEstado);
    const fEstado = f;
    f += d.porEstado.length + 2;
    titulosTabla(h, f, "A", ["Prioridad", "Tareas"]);
    bloque(h, f + 1, 1, d.porPrioridad);
    const fPrio = f;
    f += d.porPrioridad.length + 2;
    titulosTabla(h, f, "A", ["Responsable", "Tareas", "Completadas", "Vencidas"]);
    bloque(h, f + 1, 1, d.porResponsable);
    const fResp = f;
    h.getRange("A:A").format.columnWidth = 190;
    h.getRange("B:D").format.columnWidth = 90;
    if (d.porEstado.some((x) => x[1])) {
      grafico(h, "ColumnClustered", "A" + fEstado + ":B" + (fEstado + d.porEstado.length), "Tareas por estado", "F3", "M17");
      grafico(h, "ColumnClustered", "A" + fPrio + ":B" + (fPrio + d.porPrioridad.length), "Tareas por prioridad", "F19", "M33");
      if (d.porResponsable.length) grafico(h, "BarClustered", "A" + fResp + ":D" + (fResp + d.porResponsable.length), "Tareas por responsable", "F35", "M52");
    }
    return d.kpis[0][1];
  },

  async "dash-proyecto"(ctx, h) {
    const d = datosDashProyecto();
    h.getRange("A1").values = [[HOJAS["dash-proyecto"].titulo]];
    h.getRange("A1").format.font.bold = true;
    h.getRange("A1").format.font.size = 16;
    if (d.entidad) h.getRange("A2").values = [[d.entidad]];
    titulosTabla(h, 4, "A", ["Indicador", "Valor"]);
    bloque(h, 5, 1, d.kpis);
    h.getRange("B5").numberFormat = [["0.0%"]];
    let f = 6 + d.kpis.length;
    titulosTabla(h, f, "A", d.cab);
    bloque(h, f + 1, 1, d.porSeccion);
    const fSec = f;
    f += d.porSeccion.length + 2;
    titulosTabla(h, f, "A", ["Equipo", "Cargo", "Perfil"]);
    bloque(h, f + 1, 1, d.equipo);
    h.getRange("A:A").format.columnWidth = 220;
    h.getRange("B:G").format.columnWidth = 100;
    if (d.porSeccion.some((x) => x[1])) {
      grafico(h, "ColumnClustered", "A" + fSec + ":" + letra(d.cab.length) + (fSec + d.porSeccion.length), "Papeles por sección y estatus", "J4", "R22");
    }
    return d.kpis.length;
  },

  async estatus(ctx, h) {
    const d = datosEstatus();
    encabezado(h, { titulo: HOJAS.estatus.titulo, ref: HOJAS.estatus.ref, colRef: "H", celdaTitulo: "A1" });
    titulosTabla(h, 12, "A", ["Información del Proyecto", "Aplica/No Aplica", "¿Se encuentra cargado?", "Enlace"]);
    bloque(h, 13, 1, d.docs);
    const usados = d.docs.filter((x) => x[1] === "Aplica").length;
    const cargados = d.docs.filter((x) => x[1] === "Aplica" && x[2] === "SI").length;
    h.getRange("A" + (13 + d.docs.length) + ":D" + (13 + d.docs.length)).values = [["Documentos usados / cargados / faltantes", usados, cargados, usados - cargados]];
    h.getRange("A" + (13 + d.docs.length)).format.font.bold = true;
    titulosTabla(h, 12, "G", d.cabResumen);
    bloque(h, 13, 7, d.resumenSecciones);
    let fila = 13 + d.docs.length + 3;
    titulosTabla(h, fila, "A", ["Papeles de Trabajo", "Utilizado", "Preparado", "Revisado", "Supervisado", "Aprobado", "Fecha Ultima Firma", "Observaciones"]);
    fila++;
    d.papeles.forEach((g) => {
      h.getRange("A" + fila).values = [[g.seccion]];
      h.getRange("A" + fila + ":H" + fila).format.fill.color = "#E7E4D8";
      h.getRange("A" + fila).format.font.bold = true;
      fila++;
      bloque(h, fila, 1, g.filas);
      fila += g.filas.length;
    });
    h.getRange("A:A").format.columnWidth = 330;
    h.getRange("B:H").format.columnWidth = 130;
    return fila;
  },
};

/* Lleva los datos de hoy a la hoja de la opción. Devuelve { ok, creada, filas } o { ok:false, motivo }. */
export async function llevarAHoja(id) {
  const info = HOJAS[id];
  if (!info || !ESCRITORES[id]) return { ok: false, motivo: "error", error: "No hay hoja para esa opción." };
  if (sinExcel()) return { ok: false, motivo: "fuera-de-excel" };
  try {
    let creada = false;
    let filas = 0;
    await Excel.run(async (ctx) => {
      const r = await obtenerHoja(ctx, info.nombre);
      creada = r.creada;
      await limpiar(ctx, r.h);
      filas = await ESCRITORES[id](ctx, r.h);
      r.h.visibility = "Visible";
      r.h.activate();
      await ctx.sync();
    });
    return { ok: true, creada, filas, nombre: info.nombre };
  } catch (e) {
    console.error("AuditX: no se pudo llevar a la hoja", id, e);
    return { ok: false, motivo: "error", error: e && e.message ? e.message : String(e) };
  }
}

/* Botón + mensaje para las pantallas. */
export function botonHoja(id, texto) {
  const caja = el("div", "if-hoja");
  const info = HOJAS[id];
  const b = el("button", "fl-btn", texto || "Llevar a la hoja de Excel");
  b.type = "button";
  b.dataset.accion = "llevar-hoja";
  const msg = el("p", "fl-msg");
  msg.hidden = true;
  b.addEventListener("click", async () => {
    b.disabled = true;
    const r = await llevarAHoja(id);
    b.disabled = false;
    msg.hidden = false;
    if (r.ok) {
      msg.dataset.tipo = "ok";
      msg.textContent = "Hoja «" + info.nombre + "» " + (r.creada ? "creada" : "actualizada") + ".";
    } else {
      msg.dataset.tipo = "error";
      msg.textContent = r.motivo === "fuera-de-excel" ? "Esta función solo funciona dentro de Excel." : "No se pudo escribir la hoja: " + (r.error || "error desconocido");
    }
  });
  caja.append(b, msg);
  return caja;
}

export default { HOJAS, llevarAHoja, botonHoja, datosAlertas, datosIndice, datosTareas, datosKanban, datosDashTareas, datosDashProyecto, datosEstatus };

