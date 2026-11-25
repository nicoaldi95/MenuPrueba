/*
 * AuditX — Actualizar información de los papeles de trabajo (UserForm24 del VBA, M2-08)
 *
 * En el VBA: se elegía otro libro AuditX anterior y, por etapa (Pre-planificación, Planificación, Específicos), se copiaba
 * celda por celda su contenido sobre las hojas de este libro; al final escribía un reporte.txt con las diferencias.
 * Aquí: el libro anterior se lee en el complemento (no se abre otra ventana de Excel), se trae solo lo de las etapas marcadas,
 * y el reporte queda a la vista y en el historial (sin crear archivos sueltos). Los usuarios y los datos de la empresa NO se traen.
 * Evento emitido: «auditx:actualizar-cambio»
 */

import flujo from "./flujo.js";
import { crearAlmacen } from "./almacen.js";
import { ETAPAS } from "./actualizar-pt.hojas.js";

/* global document, FileReader, Excel, Office */

export { ETAPAS };
export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/actualizar-pt/v1", claveLocal: "auditx.actualizarpt.v1", raiz: "actualizar" });
export const EXTENSIONES = [".xlsx", ".xlsm"];
export const MAX_BYTES = 80 * 1024 * 1024;
const PREFIJO = "ax_";

let datos = { historial: [] };
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));
const persistir = () => {
  const x = copia(datos);
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:actualizar-cambio"));

export async function iniciar() {
  const g = await Almacen.cargar();
  if (g && Array.isArray(g.historial)) datos = { historial: g.historial };
}
export const historial = () => copia(datos.historial).reverse();
export const etapas = () => ETAPAS.map((e) => ({ id: e.id, nombre: e.nombre, hojas: e.hojas.length }));

const hayExcel = () => typeof Excel !== "undefined" && !!Excel.run;
function admiteImportar() {
  try {
    return typeof Office === "undefined" || !Office.context || !Office.context.requirements || Office.context.requirements.isSetSupported("ExcelApi", "1.13");
  } catch (e) {
    return true;
  }
}

/* ¿Se puede usar este archivo? (solo revisa nombre y tamaño; el contenido se valida al traerlo) */
export function validarArchivo(archivo) {
  if (!archivo) return "Elija el archivo AuditX anterior.";
  const n = (archivo.name || "").toLowerCase();
  if (!EXTENSIONES.some((e) => n.endsWith(e))) return "El archivo debe ser un libro de Excel (.xlsx o .xlsm). Si es un .xls antiguo, ábralo en Excel y guárdelo como .xlsm.";
  if (archivo.size > MAX_BYTES) return "El archivo pesa más de 80 MB; es demasiado grande para traerlo desde aquí.";
  if (!archivo.size) return "El archivo está vacío.";
  return null;
}

const leerBase64 = (archivo) =>
  new Promise((ok, mal) => {
    const l = new FileReader();
    l.onerror = () => mal(new Error("No se pudo leer el archivo."));
    l.onload = () => ok(String(l.result).split(",")[1] || "");
    l.readAsDataURL(archivo);
  });

function anotar(texto, por) {
  const x = flujo.persona(por);
  datos.historial.push({ fecha: new Date().toISOString(), por: x ? { id: x.id, nombre: x.nombre, cargo: x.cargo } : { id: por, nombre: "Desconocido", cargo: "" }, cambios: [texto] });
  if (datos.historial.length > 50) datos.historial.shift();
}

/*
 * Trae la información. Devuelve { ok, traidas, sinHojaAqui[], sinHojaAntes[], fallos[] } — la «lista de diferencias» del reporte.txt.
 * Por cada hoja: se importa copia temporal desde el archivo anterior, se copia su contenido y formato sobre la hoja de este libro y se borra la copia.
 */
export async function actualizar({ archivo, etapasElegidas }, { por, alAvanzar = () => {} } = {}) {
  if (!por || !flujo.persona(por)) return { ok: false, error: "No se reconoce al usuario." };
  const p = flujo.persona(por);
  if (p.activo === false) return { ok: false, error: "Su usuario está desactivado." };
  const err = validarArchivo(archivo);
  if (err) return { ok: false, error: err };
  const elegidas = ETAPAS.filter((e) => (etapasElegidas || []).includes(e.id));
  if (!elegidas.length) return { ok: false, error: "Marque al menos una etapa para traer." };
  if (!hayExcel()) return { ok: false, motivo: "fuera-de-excel", error: "Solo se puede traer la información dentro de Excel." };
  if (!admiteImportar()) return { ok: false, error: "Esta versión de Excel no permite traer hojas de otro libro desde el complemento (requiere ExcelApi 1.13). Actualice Excel." };
  let b64;
  try {
    b64 = await leerBase64(archivo);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const r = { traidas: 0, porEtapa: {}, sinHojaAqui: [], sinHojaAntes: [], fallos: [] };
  try {
    await Excel.run(async (ctx) => {
      const aqui = ctx.workbook.worksheets;
      aqui.load("items/name");
      await ctx.sync();
      const nombresAqui = new Set(aqui.items.map((h) => h.name));
      /* las que existen en este libro; las demás no se pueden actualizar */
      const total = elegidas.reduce((n, e) => n + e.hojas.length, 0);
      let hechas = 0;
      for (const etapa of elegidas) {
        r.porEtapa[etapa.id] = 0;
        const presentes = etapa.hojas.filter((n) => nombresAqui.has(n));
        etapa.hojas.filter((n) => !nombresAqui.has(n)).forEach((n) => { r.sinHojaAqui.push(n); hechas++; });
        if (!presentes.length) continue;
        let ids;
        try {
          const res = ctx.workbook.insertWorksheetsFromBase64(b64, { sheetNameStrings: presentes, sheetNamePrefix: PREFIJO, positionType: "End" });
          await ctx.sync();
          ids = res.value || [];
        } catch (e) {
          throw new Error("No se pudo leer el archivo anterior: ¿es un libro AuditX? (" + (e && e.message ? e.message : e) + ")");
        }
        const temporales = ids.map((id) => ctx.workbook.worksheets.getItem(id));
        temporales.forEach((t) => t.load("name"));
        await ctx.sync();
        const porNombre = new Map();
        temporales.forEach((t) => porNombre.set(t.name, t));
        const usadas = new Set();
        for (const nombre of presentes) {
          const t = porNombre.get((PREFIJO + nombre).slice(0, 31));
          if (!t) {
            r.sinHojaAntes.push(nombre);
          } else {
            usadas.add(t.name);
            try {
              const rango = t.getUsedRangeOrNullObject(false);
              rango.load("isNullObject");
              await ctx.sync();
              if (!rango.isNullObject) {
                aqui.getItem(nombre).getRange("A1").copyFrom(rango, "All");
                await ctx.sync();
              }
              r.traidas++;
              r.porEtapa[etapa.id]++;
            } catch (e) {
              r.fallos.push(nombre);
            }
          }
          hechas++;
          alAvanzar(hechas, total);
        }
        /* las copias temporales siempre se borran */
        temporales.forEach((t) => t.delete());
        await ctx.sync();
      }
    });
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "No se pudo traer la información: " + e };
  }
  const resumen = elegidas.map((e) => e.nombre + " " + r.porEtapa[e.id]).join(", ");
  anotar("Información traída de «" + archivo.name + "»: " + r.traidas + " hojas (" + resumen + ")" + (r.sinHojaAntes.length ? "; " + r.sinHojaAntes.length + " no estaban en el archivo anterior" : "") + (r.fallos.length ? "; " + r.fallos.length + " con error" : ""), por);
  await persistir();
  avisar();
  return { ok: true, ...r };
}

export default { ETAPAS, etapas, historial, iniciar, validarArchivo, actualizar, EXTENSIONES, MAX_BYTES };
