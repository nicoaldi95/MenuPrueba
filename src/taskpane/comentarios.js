/*
 * AuditX — Comentarios del papel de trabajo (Comentarios PT)
 *
 * Reemplaza la hoja «Comentarios PT»: fecha y hora, id, de / para, comentario y cerrado.
 *   · Cualquier persona del proyecto deja un comentario sobre un papel (o uno general) dirigido a alguien.
 *   · El destinatario recibe una alerta de tipo «Comentario».
 *   · Un papel con comentarios abiertos no se puede firmar.
 *   · Cierra el comentario quien lo escribió, quien lo recibió, o un supervisor / el socio.
 * Guardado: dentro del libro (namespace propio), igual que el flujo.
 */

import { crearAlmacen } from "./almacen.js";
import flujo from "./flujo.js";

/* global document, window */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/comentarios/v1", claveLocal: "auditx.comentarios.v1", raiz: "comentarios" });

export const GENERAL = "General";

let datos = { version: 1, comentarios: [], actualizado: "" };
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));

async function persistir() {
  datos.actualizado = new Date().toISOString();
  const inst = copia(datos);
  cola = cola.then(() => Almacen.guardar(inst));
  return cola;
}

const quien = (pid) => {
  const p = flujo.persona(pid);
  return p ? { id: p.id, nombre: p.nombre, cargo: p.cargo } : { id: pid || "", nombre: "Usuario desconocido", cargo: "" };
};

function avisar(tipo, c) {
  document.dispatchEvent(new CustomEvent("auditx:comentarios-cambio", { detail: { tipo, comentario: copia(c), papel: c.papel } }));
}

function listar({ papel, estado, para, de } = {}) {
  return datos.comentarios
    .filter((c) => (!papel || c.papel === papel) && (!estado || (estado === "abierto") === !c.cerrado) && (!para || c.para.id === para) && (!de || c.de.id === de))
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map(copia);
}

const abiertosDe = (papel) => datos.comentarios.filter((c) => c.papel === papel && !c.cerrado);

function puedeCerrar(c, pid) {
  return !!pid && (c.de.id === pid || c.para.id === pid || flujo.puedeAsignar(pid));
}

async function agregar({ papel, para, texto }, { por } = {}) {
  const t = (texto || "").trim();
  if (!flujo.persona(por)) return { ok: false, error: "No se sabe quién comenta." };
  if (!t) return { ok: false, error: "Escriba el comentario." };
  if (!para || !flujo.persona(para)) return { ok: false, error: "Elija a quién va dirigido." };
  const n = datos.comentarios.length + 1;
  const c = {
    id: "C-" + String(n).padStart(3, "0"),
    fecha: new Date().toISOString(),
    papel: papel || GENERAL,
    de: quien(por),
    para: quien(para),
    texto: t,
    cerrado: false,
    cerradoPor: null,
    fechaCierre: "",
    respuesta: "",
  };
  datos.comentarios.push(c);
  await persistir();
  avisar("nuevo", c);
  return { ok: true, comentario: copia(c) };
}

async function cerrar(id, { por, respuesta } = {}) {
  const c = datos.comentarios.find((x) => x.id === id);
  if (!c) return { ok: false, error: "No existe ese comentario." };
  if (c.cerrado) return { ok: false, error: "Ese comentario ya está cerrado." };
  if (!puedeCerrar(c, por)) return { ok: false, error: "Solo quien lo escribió, quien lo recibió, un supervisor o el socio pueden cerrarlo." };
  c.cerrado = true;
  c.cerradoPor = quien(por);
  c.fechaCierre = new Date().toISOString();
  c.respuesta = (respuesta || "").trim();
  await persistir();
  avisar("cerrado", c);
  return { ok: true, comentario: copia(c) };
}

async function iniciar() {
  const guardado = await Almacen.cargar();
  if (guardado && Array.isArray(guardado.comentarios)) datos = guardado;
  flujo.registrarBloqueo((id, accion) => {
    if (accion !== "firmar") return null;
    const n = abiertosDe(id).length;
    return n ? "No se puede firmar: hay " + n + (n === 1 ? " comentario abierto." : " comentarios abiertos.") + " Ciérrelos antes de firmar." : null;
  });
  return api;
}

const api = {
  iniciar,
  listar,
  agregar,
  cerrar,
  puedeCerrar,
  abiertos: (papel) => abiertosDe(papel).length,
  total: () => datos.comentarios.length,
  _reiniciar: async () => {
    datos = { version: 1, comentarios: [], actualizado: "" };
    await persistir();
  },
};

export default api;
