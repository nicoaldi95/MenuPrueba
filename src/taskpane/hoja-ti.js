/*
 * AuditX — TI · Tiempo Invertido (M2-10)
 * El papel vive en una hoja de Excel, igual que en el AuditX original (hoja oculta «TI - Tiempo Invertido»,
 * que el botón mostraba). Aquí, si la hoja no existe en el libro, el complemento la CREA con la misma plantilla;
 * si ya existe, solo la abre. Nunca pisa lo que el equipo escribió (horas, actividades).
 *
 * Plantilla original (hoja de 295, A1:Y166):
 *   A1:G4     título «TIEMPO INVERTIDO EN LA AUDITORÍA»
 *   A5:G7     entidad, NIT, período, referencia «TI», preparado / revisado / supervisado / aprobado por
 *   A10:Y22   cuadro por auditor (10 filas): tiempo según actividades, horas por mes, totales, presupuesto, diferencias
 *   B24:H166  registro de actividades (142 filas): actividad, ref. del usuario, inicio, fin, tiempo total
 */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";

/* global Excel, document */

export const HOJA_TI = "TI - Tiempo Invertido";
export const FILA_USUARIOS = 13;
export const MAX_USUARIOS = 10; // filas 13–22 de la plantilla
export const FILA_ACT_1 = 25;
export const FILA_ACT_N = 166;

const AZUL = "#0F1A2C";
const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const COL_MES = "IJKLMNOPQRST";

/* Código corto del usuario (columna «Ref.»): iniciales; si se repite, se le agrega un número. */
export function codigosUsuarios(personas) {
  const usados = new Set();
  return personas.map((p) => {
    const ini = p.nombre
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .join("")
      .slice(0, 3);
    let c = ini || "U";
    let n = 2;
    while (usados.has(c)) c = ini + n++;
    usados.add(c);
    return { codigo: c, persona: p };
  });
}

const fmtFecha = (iso) => {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? Number(d) + "/" + m + "/" + a : String(iso);
};

/* Datos del encabezado, tomados del proyecto y del flujo. */
export function datosEncabezado() {
  const enc = proyecto.encabezado();
  const f = flujo.ficha("ti-tiempo");
  const nom = (id) => (id && flujo.persona(id) ? flujo.persona(id).nombre : "");
  return {
    entidad: enc.entidad || "",
    nit: enc.nit ? "ID. " + enc.nit : "",
    desde: "Período de auditoría de: " + fmtFecha(enc.desde),
    hasta: "Hasta: " + fmtFecha(enc.hasta),
    preparo: nom(f.asignados.prepara),
    reviso: nom(f.asignados.revisa),
    superviso: nom(f.asignados.supervisa),
    aprobo: nom(f.asignados.aprueba),
  };
}

const sinExcel = () => typeof Excel === "undefined" || !Excel.run;

export async function existeHoja() {
  if (sinExcel()) return false;
  let existe = false;
  await Excel.run(async (ctx) => {
    const h = ctx.workbook.worksheets.getItemOrNullObject(HOJA_TI);
    await ctx.sync();
    existe = !h.isNullObject;
  });
  return existe;
}

function escribirEncabezado(h) {
  const d = datosEncabezado();
  h.getRange("B5").values = [[d.entidad]];
  h.getRange("C5").values = [[d.nit]];
  h.getRange("D5").values = [[d.desde]];
  h.getRange("E5").values = [[d.hasta]];
  h.getRange("B6").values = [[d.preparo]];
  h.getRange("E6").values = [[d.reviso]];
  h.getRange("B7").values = [[d.superviso]];
  h.getRange("E7").values = [[d.aprobo]];
}

function construir(ctx, h, usuarios) {
  const oscuro = (a1) => {
    const r = h.getRange(a1);
    r.format.fill.color = AZUL;
    r.format.font.color = "#FFFFFF";
    r.format.font.bold = true;
    r.format.horizontalAlignment = "Center";
    r.format.verticalAlignment = "Center";
    r.format.wrapText = true;
    return r;
  };
  const borde = (a1) => {
    const r = h.getRange(a1);
    ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight", "InsideHorizontal", "InsideVertical"].forEach((b) => {
      const x = r.format.borders.getItem(b);
      x.style = "Continuous";
      x.color = "#B7B7B7";
    });
  };

  h.getRange("A1:BE167").format.font.name = "Arial";
  h.getRange("A1:BE167").format.font.size = 11;

  /* A1:G4 — título */
  h.getRange("A1:G4").merge();
  h.getRange("A1").values = [["TIEMPO INVERTIDO EN LA AUDITORÍA"]];
  oscuro("A1:G4").format.font.size = 14;

  /* A5:G7 — encabezado */
  h.getRange("A5:A7").values = [["Entidad (o cliente):"], ["Preparado por:"], ["Supervisado por:"]];
  h.getRange("D6:D7").values = [["Revisado por:"], ["Aprobado por:"]];
  h.getRange("G5").values = [["Referencia"]];
  h.getRange("G6:G7").merge();
  h.getRange("G6").values = [["TI"]];
  h.getRange("A5:A7").format.font.bold = true;
  h.getRange("D6:D7").format.font.bold = true;
  h.getRange("G5:G7").format.font.bold = true;
  h.getRange("G5:G7").format.horizontalAlignment = "Center";
  h.getRange("G6:G7").format.verticalAlignment = "Center";
  escribirEncabezado(h);

  /* A10:Y12 — títulos del cuadro por auditor */
  const t = [["Usuario", "NOMBRE DEL AUDITOR", "CARGO", "TIEMPO SEGÚN EMPLEADO", "DIAS SEGÚN TIEMPO "]];
  h.getRange("A10").values = [[t[0][0]]];
  h.getRange("B10").values = [[t[0][1]]];
  h.getRange("E10").values = [[t[0][2]]];
  h.getRange("G10").values = [[t[0][3]]];
  h.getRange("H10").values = [[t[0][4]]];
  h.getRange("I10:T10").values = [MESES];
  h.getRange("U10:Y10").values = [["TOTAL HORAS", "TOTAL HORAS SEGÚN CUADRO DE TIEMPO INVERTIDO", "DIFERENCIA HORAS", "HORAS PRESUPUESTADAS", "DIFERENCIA"]];
  ["A", "G", "H", ...COL_MES.split(""), "U", "V", "W", "X", "Y"].forEach((c) => h.getRange(c + "10:" + c + "12").merge());
  h.getRange("B10:D12").merge();
  h.getRange("E10:F12").merge();
  oscuro("A10:Y12");

  /* A13:Y22 — un auditor por fila */
  for (let i = 0; i < MAX_USUARIOS; i++) {
    const r = FILA_USUARIOS + i;
    h.getRange("B" + r + ":D" + r).merge();
    h.getRange("E" + r + ":F" + r).merge();
    const u = usuarios[i];
    if (u) {
      h.getRange("A" + r).values = [[u.codigo]];
      h.getRange("B" + r).values = [[u.persona.nombre]];
      h.getRange("E" + r).values = [[u.persona.cargo]];
    }
    h.getRange("G" + r).formulas = [["=SUMIF($E$" + FILA_ACT_1 + ":$E$" + FILA_ACT_N + ",A" + r + ",$H$" + FILA_ACT_1 + ":$H$" + FILA_ACT_N + ")"]];
    h.getRange("H" + r).formulas = [["=INT(G" + r + ")"]];
    h.getRange("U" + r).formulas = [["=SUM(I" + r + ":T" + r + ")"]];
    h.getRange("V" + r).formulas = [["=G" + r + "*24"]];
    h.getRange("W" + r).formulas = [["=V" + r + "-U" + r]];
    h.getRange("Y" + r).formulas = [["=X" + r + "-V" + r]];
  }
  h.getRange("G13:G22").numberFormat = Array(10).fill(['[h] "horas" : mm "minutos"']);
  h.getRange("A13:Y22").format.horizontalAlignment = "Center";
  h.getRange("A13:Y22").format.verticalAlignment = "Center";
  h.getRange("B13:B22").format.horizontalAlignment = "Left";
  h.getRange("I13:T22").format.fill.color = "#F2F6FB"; // horas por mes: las escribe el equipo
  h.getRange("X13:X22").format.fill.color = "#F2F6FB";
  borde("A10:Y22");

  /* B24:H166 — registro de actividades */
  h.getRange("B24:D24").merge();
  h.getRange("B24").values = [["ACTIVIDAD"]];
  h.getRange("E24:H24").values = [["Ref. (Usuario)", "Hora de inicio", "Hora de finalización", "Tiempo total (h/m)"]];
  oscuro("B24:H24");
  h.getRange("A24").format.rowHeight = 56;
  const n = FILA_ACT_N - FILA_ACT_1 + 1;
  const acts = [];
  const form = [];
  for (let r = FILA_ACT_1; r <= FILA_ACT_N; r++) {
    h.getRange("B" + r + ":D" + r).merge();
    acts.push(["Ingresar actividad a realizar"]);
    form.push(['=IF(F' + r + '=" - "," - ",G' + r + "-F" + r + ")"]);
  }
  h.getRange("B" + FILA_ACT_1 + ":B" + FILA_ACT_N).values = acts;
  h.getRange("H" + FILA_ACT_1 + ":H" + FILA_ACT_N).formulas = form;
  h.getRange("F" + FILA_ACT_1 + ":G" + FILA_ACT_N).numberFormat = Array(n).fill(["d/m/yyyy h:mm AM/PM", "d/m/yyyy h:mm AM/PM"]);
  h.getRange("H" + FILA_ACT_1 + ":H" + FILA_ACT_N).numberFormat = Array(n).fill(["[h]:mm"]);
  h.getRange("E" + FILA_ACT_1 + ":H" + FILA_ACT_N).format.horizontalAlignment = "Center";
  h.getRange("B" + FILA_ACT_1 + ":D" + FILA_ACT_N).format.horizontalAlignment = "Left";
  h.getRange("B" + FILA_ACT_1 + ":D" + FILA_ACT_N).format.font.color = "#7F7F7F";
  h.getRange("F" + FILA_ACT_1 + ":G" + FILA_ACT_N).format.fill.color = "#F2F6FB";
  h.getRange("E" + FILA_ACT_1 + ":E" + FILA_ACT_N).format.fill.color = "#F2F6FB";
  borde("B24:H" + FILA_ACT_N);

  /* Anchos (originales, en caracteres ≈ ×5.5 pt) */
  const ancho = { A: 18.4, B: 12, C: 12, D: 32.1, E: 20.3, F: 20, G: 24.3, H: 11.7, U: 19.7 };
  COL_MES.split("").forEach((c) => (ancho[c] = c === "I" ? 7 : c === "M" ? 7.6 : 9));
  ["V", "W", "X", "Y"].forEach((c) => (ancho[c] = 16));
  Object.keys(ancho).forEach((c) => (h.getRange(c + ":" + c).format.columnWidth = ancho[c] * 5.5));
  h.getRange("A10").format.rowHeight = 42;
  h.getRange("A11").format.rowHeight = 35;
}

/* Opciones que dependen de versiones más nuevas de Excel: si faltan, la hoja queda igual, sin ellas. */
async function extras(ctx, h) {
  try {
    const dv = h.getRange("E" + FILA_ACT_1 + ":E" + FILA_ACT_N).dataValidation;
    dv.rule = { list: { inCellDropDown: true, source: "=$A$13:$A$22" } };
    dv.ignoreBlanks = true;
    dv.prompt = { showPrompt: true, title: "Ref.", message: "Elija el usuario del equipo del encargo al que corresponde este tiempo." };
    await ctx.sync();
  } catch (e) {
    console.warn("AuditX: lista de usuarios en «Ref.» no disponible en esta versión de Excel", e);
  }
  try {
    h.showGridlines = false;
    await ctx.sync();
  } catch (e) {
    /* sin cuadrícula oculta */
  }
  try {
    h.pageLayout.setPrintArea("A10:Y" + FILA_ACT_N);
    h.pageLayout.orientation = "Landscape";
    await ctx.sync();
  } catch (e) {
    /* sin área de impresión */
  }
}

/* Crea la hoja si no existe y la abre. Devuelve { ok, creada } o { ok:false, motivo }. */
export async function abrirOCrear() {
  if (sinExcel()) return { ok: false, motivo: "fuera-de-excel" };
  try {
    let creada = false;
    let aviso = "";
    await Excel.run(async (ctx) => {
      let h = ctx.workbook.worksheets.getItemOrNullObject(HOJA_TI);
      await ctx.sync();
      if (h.isNullObject) {
        const personas = flujo.personas(true);
        if (personas.length > MAX_USUARIOS) aviso = "La plantilla tiene " + MAX_USUARIOS + " filas para auditores; los " + (personas.length - MAX_USUARIOS) + " usuarios restantes no se incluyeron.";
        h = ctx.workbook.worksheets.add(HOJA_TI);
        try {
          construir(ctx, h, codigosUsuarios(personas.slice(0, MAX_USUARIOS)));
          await ctx.sync();
        } catch (err) {
          // no dejar una hoja a medias: el próximo intento la crea completa
          try {
            h.delete();
            await ctx.sync();
          } catch (e2) {
            /* ya no existe */
          }
          throw err;
        }
        await extras(ctx, h);
        creada = true;
      }
      h.visibility = "Visible";
      h.activate();
      await ctx.sync();
    });
    return { ok: true, creada, aviso };
  } catch (e) {
    console.error("AuditX: no se pudo crear/abrir la hoja TI", e);
    return { ok: false, motivo: "error" };
  }
}

/* Actualiza entidad, período y responsables, y agrega a la tabla los usuarios nuevos. No toca horas ni actividades. */
export async function sincronizar() {
  if (sinExcel()) return { ok: false, motivo: "fuera-de-excel" };
  try {
    let agregados = 0;
    let sinLugar = 0;
    let existe = true;
    await Excel.run(async (ctx) => {
      const h = ctx.workbook.worksheets.getItemOrNullObject(HOJA_TI);
      await ctx.sync();
      if (h.isNullObject) {
        existe = false;
        return;
      }
      escribirEncabezado(h);
      const rango = h.getRange("A13:B22");
      rango.load("values");
      await ctx.sync();
      const hay = new Set(rango.values.map((f) => String(f[1]).trim().toLowerCase()).filter(Boolean));
      const usados = new Set(rango.values.map((f) => String(f[0]).trim()).filter(Boolean));
      let fila = rango.values.findIndex((f) => !String(f[0]).trim() && !String(f[1]).trim());
      for (const p of flujo.personas(true)) {
        if (hay.has(p.nombre.toLowerCase())) continue;
        if (fila < 0) {
          sinLugar++;
          continue;
        }
        let c = codigosUsuarios([p])[0].codigo;
        let n = 2;
        const base = c;
        while (usados.has(c)) c = base + n++;
        usados.add(c);
        const r = FILA_USUARIOS + fila;
        h.getRange("A" + r).values = [[c]];
        h.getRange("B" + r).values = [[p.nombre]];
        h.getRange("E" + r).values = [[p.cargo]];
        agregados++;
        fila = rango.values.findIndex((f, i) => i > fila && !String(f[0]).trim() && !String(f[1]).trim());
      }
      await ctx.sync();
    });
    return existe ? { ok: true, agregados, sinLugar } : { ok: false, motivo: "no-existe" };
  } catch (e) {
    console.error("AuditX: no se pudo sincronizar la hoja TI", e);
    return { ok: false, motivo: "error" };
  }
}

/* Si la hoja ya existe, mantiene el encabezado al día cuando cambia el flujo o el proyecto. */
let temporizador = null;
export function vigilar() {
  const pedir = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => {
      try {
        if (await existeHoja()) await sincronizar();
      } catch (e) {
        /* la hoja se actualiza la próxima vez */
      }
    }, 800);
  };
  ["auditx:flujo-cambio", "auditx:proyecto-cambio"].forEach((ev) => document.addEventListener(ev, pedir));
}

export default { HOJA_TI, abrirOCrear, sincronizar, existeHoja, vigilar, codigosUsuarios, datosEncabezado };
