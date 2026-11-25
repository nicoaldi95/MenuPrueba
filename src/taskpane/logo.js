/*
 * AuditX — Logo de los papeles de trabajo («Cambiar logo de los papeles», UserForm32 del VBA)
 *
 * En el VBA: se elegía la forma (rectangular 140×40 o cuadrado 60×60) y una imagen; el programa BORRABA TODOS los
 * objetos de cada hoja (menos 70 de configuración) y ponía el logo en A1. Aquí:
 *   · solo se reemplaza el logo de la esquina A1 (la imagen que ya estaba ahí); gráficos, botones y otras imágenes no se tocan;
 *   · la imagen conserva su proporción (no se deforma);
 *   · el logo queda guardado en el libro y se puede volver a aplicar (por ejemplo, cuando aparezcan hojas nuevas).
 * Evento emitido: «auditx:logo-cambio»
 */

import flujo from "./flujo.js";
import { crearAlmacen } from "./almacen.js";
import { HOJAS_EXCLUIDAS } from "./hojas-papeles.js";

/* global document, window, Image, FileReader, Excel, Office */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/logo/v1", claveLocal: "auditx.logo.v1", raiz: "logo" });

export const FORMAS = [
  { id: "rectangular", nombre: "Rectangular (140 × 40)", ancho: 140, alto: 40 },
  { id: "cuadrado", nombre: "Cuadrado (60 × 60)", ancho: 60, alto: 60 },
];
export const NOMBRE_FIGURA = "AuditX_Logo";
export const MAX_BYTES = 3 * 1024 * 1024;
export const TIPOS = ["image/png", "image/jpeg", "image/gif"];
const ESCALA = 4; // píxeles por punto: se guarda nítido aunque se amplíe el zoom
const POR_LOTE = 10;

let datos = { logo: null, aplicado: null, historial: [] };
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));
const persistir = () => {
  const x = copia(datos);
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:logo-cambio"));
const permiso = (por) => (flujo.puede(por, "personalizar-botones") ? null : "Su perfil no puede cambiar el logo de los papeles.");

function anotar(texto, por) {
  const x = flujo.persona(por);
  datos.historial.push({ fecha: new Date().toISOString(), por: x ? { id: x.id, nombre: x.nombre, cargo: x.cargo } : { id: por, nombre: "Desconocido", cargo: "" }, cambios: [texto] });
  if (datos.historial.length > 50) datos.historial.shift();
}

/* Valida el archivo, lo ajusta a la caja de la forma elegida (sin deformarlo) y devuelve el PNG en base64. */
export function procesarImagen(archivo, formaId) {
  return new Promise((resolve) => {
    const forma = FORMAS.find((f) => f.id === formaId);
    if (!forma) return resolve({ ok: false, error: "Elija la forma del logo." });
    if (!archivo) return resolve({ ok: false, error: "Elija el archivo de la imagen." });
    if (!TIPOS.includes(archivo.type)) return resolve({ ok: false, error: "La imagen debe ser PNG, JPG o GIF." });
    if (archivo.size > MAX_BYTES) return resolve({ ok: false, error: "La imagen pesa más de 3 MB. Use una más liviana." });
    const lector = new FileReader();
    lector.onerror = () => resolve({ ok: false, error: "No se pudo leer el archivo." });
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => resolve({ ok: false, error: "El archivo no es una imagen válida." });
      img.onload = () => {
        const w0 = img.naturalWidth, h0 = img.naturalHeight;
        if (!w0 || !h0) return resolve({ ok: false, error: "El archivo no es una imagen válida." });
        const k = Math.min(forma.ancho / w0, forma.alto / h0); // «contener»: cabe entera en la caja
        const ancho = Math.round(w0 * k * 100) / 100;
        const alto = Math.round(h0 * k * 100) / 100;
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(ancho * ESCALA));
        c.height = Math.max(1, Math.round(alto * ESCALA));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/png");
        resolve({ ok: true, forma: forma.id, nombreArchivo: archivo.name, base64: url.split(",")[1], ancho, alto, vista: url });
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function hayExcel() {
  return typeof Excel !== "undefined" && !!Excel.run;
}
function admiteImagenes() {
  try {
    return typeof Office === "undefined" || !Office.context || !Office.context.requirements || Office.context.requirements.isSetSupported("ExcelApi", "1.9");
  } catch (e) {
    return true;
  }
}

/* Cuántas hojas del libro llevarían el logo (todas menos las de configuración). null si no se está dentro de Excel. */
async function contar() {
  if (!hayExcel()) return null;
  try {
    return await Excel.run(async (ctx) => {
      const hojas = ctx.workbook.worksheets;
      hojas.load("items/name");
      await ctx.sync();
      const fuera = new Set(HOJAS_EXCLUIDAS);
      const aplican = hojas.items.filter((h) => !fuera.has(h.name)).length;
      return { aplican, excluidas: hojas.items.length - aplican, total: hojas.items.length };
    });
  } catch (e) {
    return null;
  }
}

/* Reemplaza el logo de la esquina A1 en todas las hojas del libro, menos las de configuración. */
async function aplicarAHojas({ logo, quitar = false, alAvanzar = () => {} } = {}) {
  if (!hayExcel()) return { ok: false, motivo: "fuera-de-excel", error: "Solo se puede aplicar dentro de Excel. El logo quedó guardado y se aplicará cuando lo ejecute desde Excel." };
  if (!quitar && !admiteImagenes()) return { ok: false, error: "Esta versión de Excel no permite insertar imágenes desde el complemento (requiere ExcelApi 1.9)." };
  const resultado = { hojas: 0, omitidas: [], fallos: [] };
  try {
    await Excel.run(async (ctx) => {
      const hojas = ctx.workbook.worksheets;
      hojas.load("items/name");
      await ctx.sync();
      const fuera = new Set(HOJAS_EXCLUIDAS);
      const objetivo = hojas.items.filter((h) => !fuera.has(h.name));
      resultado.excluidas = hojas.items.length - objetivo.length;
      if (!objetivo.length) return;
      for (let i = 0; i < objetivo.length; i += POR_LOTE) {
        const lote = objetivo.slice(i, i + POR_LOTE);
        const hacer = async (grupo) => {
          grupo.forEach((h) => h.shapes.load("items/name,items/type,items/left,items/top"));
          await ctx.sync();
          grupo.forEach((h) => {
            h.shapes.items.forEach((f) => {
              /* nuestro logo anterior, o la imagen que ya estaba en la esquina A1 */
              if (f.name === NOMBRE_FIGURA || (f.type === "Image" && f.left <= 20 && f.top <= 20)) f.delete();
            });
            if (!quitar) {
              const f = h.shapes.addImage(logo.base64);
              f.name = NOMBRE_FIGURA;
              f.left = 0;
              f.top = 0;
              f.width = logo.ancho;
              f.height = logo.alto;
            }
          });
          await ctx.sync();
        };
        try {
          await hacer(lote);
          resultado.hojas += lote.length;
        } catch (e) {
          /* si falla el lote (p. ej. una hoja protegida), se reintenta hoja por hoja para saber cuál */
          for (const h of lote) {
            try {
              await hacer([h]);
              resultado.hojas += 1;
            } catch (e2) {
              resultado.fallos.push(h.name);
            }
          }
        }
        alAvanzar(Math.min(i + POR_LOTE, objetivo.length), objetivo.length);
      }
    });
  } catch (e) {
    return { ok: false, error: "No se pudo aplicar el logo: " + (e && e.message ? e.message : e) };
  }
  if (!quitar && !resultado.hojas && !resultado.fallos.length) return { ok: false, error: "Este libro no tiene hojas de papeles a las que aplicar el logo (solo tiene hojas de configuración).", ...resultado };
  return { ok: true, ...resultado };
}

/* Guarda el logo en el libro y lo aplica a las hojas (como el botón del VBA: elegir y listo). */
async function cambiar({ archivo, forma }, { por, alAvanzar } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const p = await procesarImagen(archivo, forma);
  if (!p.ok) return p;
  const logo = { forma: p.forma, nombreArchivo: p.nombreArchivo, base64: p.base64, ancho: p.ancho, alto: p.alto };
  datos.logo = logo;
  anotar("Logo cambiado: " + p.nombreArchivo + " (" + FORMAS.find((f) => f.id === p.forma).nombre + ")", por);
  const r = await aplicarAHojas({ logo, alAvanzar });
  datos.aplicado = r.ok ? { fecha: new Date().toISOString(), hojas: r.hojas, fallos: r.fallos } : datos.aplicado;
  await persistir();
  avisar();
  return { ...r, guardado: true, vista: p.vista };
}

async function volverAAplicar({ por, alAvanzar } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  if (!datos.logo) return { ok: false, error: "Todavía no hay un logo guardado." };
  const r = await aplicarAHojas({ logo: datos.logo, alAvanzar });
  if (r.ok) {
    datos.aplicado = { fecha: new Date().toISOString(), hojas: r.hojas, fallos: r.fallos };
    anotar("Logo aplicado de nuevo a " + r.hojas + " hojas", por);
    await persistir();
    avisar();
  }
  return r;
}

/* Quita el logo de las hojas y del libro. (El logo anterior que traía cada hoja no se puede recuperar desde aquí.) */
async function quitar({ por, alAvanzar } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  if (!datos.logo) return { ok: false, error: "No hay un logo guardado." };
  const r = await aplicarAHojas({ quitar: true, alAvanzar });
  if (!r.ok && r.motivo !== "fuera-de-excel") return r;
  anotar("Logo quitado de los papeles", por);
  datos.logo = null;
  datos.aplicado = null;
  await persistir();
  avisar();
  return { ok: true, ...r };
}

async function iniciar() {
  const g = await Almacen.cargar();
  datos = { logo: (g && g.logo) || null, aplicado: (g && g.aplicado) || null, historial: (g && g.historial) || [] };
  return api;
}

const api = {
  iniciar,
  logo: () => (datos.logo ? { ...datos.logo, vista: "data:image/png;base64," + datos.logo.base64 } : null),
  aplicado: () => (datos.aplicado ? copia(datos.aplicado) : null),
  historial: () => datos.historial.slice().reverse(),
  contar,
  hojasExcluidas: () => HOJAS_EXCLUIDAS.length,
  cambiar,
  volverAAplicar,
  quitar,
  procesarImagen,
  FORMAS,
  _reiniciar: async () => {
    datos = { logo: null, aplicado: null, historial: [] };
    await persistir();
    avisar();
  },
};

export default api;
