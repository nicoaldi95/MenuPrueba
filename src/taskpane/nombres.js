/*
 * AuditX — Nombres personalizados de los botones («Personalizar Botones» del VBA)
 *
 * Solo cambia el TEXTO que se ve en el menú, el buscador y las fichas de los papeles.
 * El identificador interno (AA-01…) y la configuración del botón nunca se tocan: el flujo, las firmas,
 * el historial y los eventos siguen usando el mismo id aunque el nombre cambie.
 * Se personalizan los papeles cuyo nombre empieza por su código (AA-01 Cuestionario…); el código queda fijo.
 * Los nombres se guardan dentro del libro (cada proyecto puede tener los suyos).
 * Evento emitido: «auditx:nombres-cambio»
 */

import { PAQUETES } from "./botones.config.js";
import flujo from "./flujo.js";
import { crearAlmacen } from "./almacen.js";

/* global document */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/nombres/v1", claveLocal: "auditx.nombres.v1", raiz: "nombres" });

export const LARGO_MAX = 120;
export const ACCION_PERMISO = "personalizar-botones";

let datos = { nombres: {}, historial: [] };
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));
const persistir = () => {
  const x = copia(datos);
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:nombres-cambio"));

/* Un botón es personalizable si su nombre original empieza por su código: «AA-01 Cuestionario…». */
export function partes(entrada) {
  if (!entrada || entrada.tipo === "menu" || !entrada.etiqueta || !entrada.id) return null;
  const pre = entrada.id + " ";
  return entrada.etiqueta.startsWith(pre) ? { codigo: entrada.id, original: entrada.etiqueta.slice(pre.length).trim() } : null;
}

/* Lo que se muestra: el nombre personalizado si existe; si no, el original. Nunca cambia el id. */
export function etiqueta(entrada) {
  const p = partes(entrada);
  const n = p && datos.nombres[entrada.id];
  return n ? p.codigo + " " + n : entrada.etiqueta;
}

function recorrer() {
  const lista = [];
  PAQUETES.forEach((paq) => {
    const ir = (entradas) =>
      entradas.forEach((e) => {
        if (e.tipo === "menu") return ir(e.hijos);
        const p = partes(e);
        if (p) lista.push({ id: e.id, codigo: p.codigo, original: p.original, actual: datos.nombres[e.id] || p.original, personalizado: !!datos.nombres[e.id], seccion: paq.nombre });
      });
    ir(paq.entradas);
  });
  return lista;
}

function permiso(por) {
  return flujo.puede(por, ACCION_PERMISO) ? null : "Su perfil no puede personalizar los botones.";
}

function anotar(cambios, por) {
  if (!cambios.length) return;
  const x = flujo.persona(por);
  datos.historial.push({ fecha: new Date().toISOString(), por: x ? { id: x.id, nombre: x.nombre, cargo: x.cargo } : { id: por, nombre: "Desconocido", cargo: "" }, cambios });
  if (datos.historial.length > 100) datos.historial.shift();
}

/* Limpia lo escrito; si repite el código lo quita; si queda igual al original, no se considera cambio. */
function limpiar(texto, codigo) {
  let t = String(texto == null ? "" : texto).replace(/\s+/g, " ").trim();
  if (t.toLowerCase().startsWith(codigo.toLowerCase() + " ")) t = t.slice(codigo.length + 1).trim();
  return t;
}

/* cambios: { id: "nuevo nombre" }. Se valida todo antes de guardar nada. */
async function guardar(cambios, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const base = recorrer();
  const aplicar = [];
  for (const [id, texto] of Object.entries(cambios || {})) {
    const b = base.find((x) => x.id === id);
    if (!b) return { ok: false, error: "«" + id + "» no se puede personalizar." };
    const t = limpiar(texto, b.codigo);
    if (!t) return { ok: false, error: "El nombre de " + b.codigo + " no puede quedar vacío. Use «Restablecer» para volver al original." };
    if (t.length > LARGO_MAX) return { ok: false, error: "El nombre de " + b.codigo + " es muy largo (máximo " + LARGO_MAX + " caracteres)." };
    if (t === b.actual) continue;
    aplicar.push({ b, t });
  }
  if (!aplicar.length) return { ok: true, cambiados: 0 };
  anotar(aplicar.map(({ b, t }) => b.codigo + ": «" + b.actual + "» → «" + t + "»"), por);
  aplicar.forEach(({ b, t }) => {
    if (t === b.original) delete datos.nombres[b.id];
    else datos.nombres[b.id] = t;
  });
  await persistir();
  avisar();
  return { ok: true, cambiados: aplicar.length };
}

async function restablecer(id, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const b = recorrer().find((x) => x.id === id);
  if (!b) return { ok: false, error: "«" + id + "» no se puede personalizar." };
  if (!b.personalizado) return { ok: true, cambiados: 0 };
  anotar([b.codigo + ": restablecido al original «" + b.original + "»"], por);
  delete datos.nombres[id];
  await persistir();
  avisar();
  return { ok: true, cambiados: 1 };
}

async function restablecerTodos({ por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const hechos = recorrer().filter((b) => b.personalizado);
  /* también limpia nombres de botones que ya no existan en el menú */
  const huerfanos = Object.keys(datos.nombres).filter((id) => !hechos.some((b) => b.id === id));
  if (!hechos.length && !huerfanos.length) return { ok: true, cambiados: 0 };
  anotar(["Restableció todos los nombres al original (" + hechos.length + ")"], por);
  datos.nombres = {};
  await persistir();
  avisar();
  return { ok: true, cambiados: hechos.length };
}

async function iniciar() {
  const g = await Almacen.cargar();
  datos = { nombres: { ...((g && g.nombres) || {}) }, historial: (g && g.historial) || [] };
  flujo.usarRotulo(etiqueta); // las fichas de los papeles muestran el mismo nombre que el menú
  return api;
}

const api = {
  iniciar,
  etiqueta,
  partes,
  lista: recorrer,
  historial: () => datos.historial.slice().reverse(),
  guardar,
  restablecer,
  restablecerTodos,
  LARGO_MAX,
  _reiniciar: async () => {
    datos = { nombres: {}, historial: [] };
    await persistir();
    avisar();
  },
};

export default api;
