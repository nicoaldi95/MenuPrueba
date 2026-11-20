/*
 * AuditX — Motor del flujo de trabajo
 *
 * Responde, para cada papel de trabajo: quién lo elabora, quién lo revisa, quién lo firma,
 * cuándo y cómo (qué se hizo en cada paso). Es independiente de la pantalla.
 *
 *   Estados:  Pendiente → En elaboración → En revisión → (Devuelto →) Revisado → Firmado
 *
 * Guardado: dentro del libro (parte XML personalizada), de modo que el historial viaja con el archivo.
 * Fuera de Excel (vista previa en navegador) usa localStorage.
 * Para llevarlo a SharePoint basta con reemplazar las dos funciones de `Almacen`.
 *
 * API pública: window.AuditX.flujo (ver el final del archivo).
 * Evento emitido: «auditx:flujo-cambio»  detail: { id, accion, de, a, por }
 */

import { PAQUETES } from "./botones.config.js";
import { ROLES, REGLAS, PERSONAS, ALMACEN } from "./flujo.config.js";
import { puedePerfil, perfilDesdeRoles, PERFILES, ACCIONES, nombrePerfil, matriz } from "./permisos.js";
import { crearAlmacen } from "./almacen.js";

/* global window, document */

export const ESTADO = {
  PENDIENTE: "Pendiente",
  ELABORACION: "En elaboración",
  REVISION: "En revisión",
  DEVUELTO: "Devuelto",
  REVISADO: "Revisado",
  FIRMADO: "Firmado",
};

/* ------------------------------------------------------------------ almacenamiento */

export const Almacen = crearAlmacen({ namespace: ALMACEN.namespace, claveLocal: ALMACEN.claveLocal, raiz: "flujo" });

/* Fecha de hoy en la zona del usuario (AAAA-MM-DD). toISOString() usaría UTC y en Bogotá adelanta el día por la noche. */
export function hoyISO(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return fecha.getFullYear() + "-" + p(fecha.getMonth() + 1) + "-" + p(fecha.getDate());
}

/* ------------------------------------------------------------------ estado en memoria */

let datos = null; // lo que se guarda en el libro
let cola = Promise.resolve(); // las escrituras se hacen de una en una

const ahora = () => new Date().toISOString();
const copia = (o) => JSON.parse(JSON.stringify(o));

function papelesDelMenu() {
  const lista = [];
  const recorrer = (entradas) =>
    entradas.forEach((e) => {
      if (e.tipo === "menu") recorrer(e.hijos);
      else if (e.enFlujo) lista.push({ id: e.id, etiqueta: e.etiqueta, codigo: e.codigo || "" });
    });
  PAQUETES.forEach((p) => recorrer(p.entradas));
  return lista;
}

function papelNuevo() {
  return { estado: ESTADO.PENDIENTE, etapa: null, asignados: {}, fechas: { programada: "", vence: "" }, historial: [] };
}

function datosIniciales() {
  return {
    version: 1,
    config: {
      rolesActivos: ROLES.filter((r) => r.activo).map((r) => r.id),
      separarFunciones: REGLAS.separarFunciones,
    },
    personas: copia(PERSONAS).map((x) => ({ correo: "", activo: true, ...x })),
    papeles: {},
    actualizado: ahora(),
  };
}

function completarDatos() {
  // Papeles nuevos del menú aparecen solos; los que ya tienen historial no se tocan.
  papelesDelMenu().forEach((p) => {
    if (!datos.papeles[p.id]) datos.papeles[p.id] = papelNuevo();
  });
  (datos.personas || []).forEach((x) => {
    if (x.activo === undefined) x.activo = true;
    if (x.correo === undefined) x.correo = "";
    if (!x.perfil || !PERFILES.some((p) => p.id === x.perfil)) x.perfil = perfilDesdeRoles(x.roles);
  });
}

async function persistir() {
  datos.actualizado = ahora();
  const instantanea = copia(datos);
  cola = cola.then(() => Almacen.guardar(instantanea)).catch((e) => {
    console.error("AuditX flujo: no se pudo guardar", e);
    throw e;
  });
  return cola;
}

/* ------------------------------------------------------------------ consultas */

const meta = (id) => papelesDelMenu().find((p) => p.id === id) || { id, etiqueta: id, codigo: "" };
const persona = (pid) => (datos.personas || []).find((p) => p.id === pid) || null;
const nombreRol = (rid) => (ROLES.find((r) => r.id === rid) || { nombre: rid }).nombre;

function rolesActivos() {
  return ROLES.filter((r) => r.fijo || datos.config.rolesActivos.includes(r.id));
}
function rolesRevision() {
  return rolesActivos().filter((r) => r.id !== "prepara" && r.id !== "aprueba");
}

function papel(id) {
  const p = datos.papeles[id];
  if (!p) throw new Error("Papel desconocido: " + id);
  return p;
}

function vencido(id) {
  const p = papel(id);
  if (p.estado === ESTADO.FIRMADO || !p.fechas.vence) return false;
  return p.fechas.vence < hoyISO();
}

/* Qué pasos del flujo están cumplidos en este momento (se pierden si el papel se devuelve o reabre). */
function pasosCumplidos(p) {
  const orden = ["prepara", ...rolesRevision().map((r) => r.id), "aprueba"];
  const hechos =
    p.estado === ESTADO.PENDIENTE || p.estado === ESTADO.ELABORACION || p.estado === ESTADO.DEVUELTO ? 0
    : p.estado === ESTADO.REVISION ? orden.indexOf(p.etapa)
    : p.estado === ESTADO.REVISADO ? orden.length - 1
    : orden.length;
  const r = { prepara: false, revisa: false, supervisa: false, aprueba: false };
  orden.forEach((rol, i) => (r[rol] = i < hechos));
  return r;
}

function ficha(id) {
  const p = papel(id);
  return {
    pasos: pasosCumplidos(p),
    ...meta(id),
    estado: p.estado,
    etapa: p.etapa,
    asignados: { ...p.asignados },
    fechas: { ...p.fechas },
    vencido: vencido(id),
    historial: p.historial.slice().reverse(), // más reciente primero
  };
}

function esDe(pid, id, rol) {
  return papel(id).asignados[rol] === pid;
}

function quienEs(pid) {
  const p = persona(pid);
  return p ? { id: p.id, nombre: p.nombre, cargo: p.cargo } : { id: pid || "", nombre: "Usuario desconocido", cargo: "" };
}

/* Acciones que una persona puede hacer ahora sobre un papel, y por qué no puede las demás. */
function acciones(id, pid) {
  const p = papel(id);
  const usuario = persona(pid);
  const res = [];
  const prepara = p.asignados.prepara;
  const separar = datos.config.separarFunciones;
  const puedeRol = (rol) => !!usuario && usuario.roles.includes(rol);
  const bloqueoSeparacion = (rol) =>
    separar && rol !== "prepara" && prepara === pid ? "Quien elaboró el papel no puede " + (rol === "aprueba" ? "firmarlo." : "revisarlo.") : null;

  const turnoDe = (rol) => {
    if (usuario && usuario.activo === false) return { ok: false, motivo: "El usuario está desactivado." };
    const asignado = p.asignados[rol];
    if (asignado && asignado !== pid) return { ok: false, motivo: "Le corresponde a " + quienEs(asignado).nombre + "." };
    if (!puedeRol(rol)) return { ok: false, motivo: "Su perfil no tiene el rol «" + nombreRol(rol) + "»." };
    const b = bloqueoSeparacion(rol);
    if (b) return { ok: false, motivo: b };
    return { ok: true };
  };

  const agregar = (accion, etiqueta, rol, extra = {}) => {
    const t = turnoDe(rol);
    res.push({ accion, etiqueta, rol, disponible: t.ok, motivo: t.motivo || "", ...extra });
  };

  switch (p.estado) {
    case ESTADO.PENDIENTE:
      agregar("iniciar", "Empezar elaboración", "prepara");
      break;
    case ESTADO.ELABORACION:
    case ESTADO.DEVUELTO:
      agregar("enviar", "Enviar a revisión", "prepara");
      break;
    case ESTADO.REVISION:
      agregar("visto-bueno", "Dar visto bueno", p.etapa);
      agregar("devolver", "Devolver con comentario", p.etapa, { requiereNota: REGLAS.notaObligatoria, peligro: true });
      break;
    case ESTADO.REVISADO:
      agregar("firmar", "Firmar", "aprueba");
      agregar("devolver", "Devolver con comentario", "aprueba", { requiereNota: REGLAS.notaObligatoria, peligro: true });
      break;
    case ESTADO.FIRMADO:
      agregar("reabrir", "Reabrir el papel", "aprueba", { requiereNota: REGLAS.notaObligatoria, peligro: true });
      break;
  }
  /* Otros módulos (p. ej. Comentarios PT) pueden impedir una acción con un motivo. */
  res.forEach((a) => {
    if (!a.disponible) return;
    for (const f of bloqueos) {
      const m = f(id, a.accion, pid);
      if (m) {
        a.disponible = false;
        a.motivo = m;
        break;
      }
    }
  });
  return res;
}

const bloqueos = [];
function registrarBloqueo(fn) {
  if (!bloqueos.includes(fn)) bloqueos.push(fn);
}

/* ------------------------------------------------------------------ acciones */

function anotar(id, pid, accion, de, a, nota, rol) {
  papel(id).historial.push({
    fecha: ahora(),
    por: quienEs(pid),
    rol: rol || "",
    accion,
    de,
    a,
    nota: nota ? String(nota).trim() : "",
  });
}

function avisarCambio(id, accion, de, a, pid) {
  const f = ficha(id);
  pintarEnPanel(id);
  document.dispatchEvent(new CustomEvent("auditx:flujo-cambio", { detail: { id, accion, de, a, por: quienEs(pid), estado: f.estado } }));
}

const ETIQUETA_ACCION = {
  iniciar: "Empezó la elaboración",
  enviar: "Envió a revisión",
  "visto-bueno": "Dio visto bueno",
  devolver: "Devolvió con comentario",
  firmar: "Firmó",
  reabrir: "Reabrió el papel",
  "contenido-modificado": "Contenido modificado",
  asignar: "Asignó responsable",
  fechas: "Cambió las fechas",
};

async function ejecutar(id, accion, { por, nota } = {}) {
  const p = papel(id);
  const def = acciones(id, por).find((a) => a.accion === accion);
  if (!def) return { ok: false, error: "Esa acción no corresponde al estado actual (" + p.estado + ")." };
  if (!def.disponible) return { ok: false, error: def.motivo };
  if (def.requiereNota && !(nota && String(nota).trim())) return { ok: false, error: "Escriba el motivo antes de continuar." };

  const de = p.estado;
  const rol = def.rol;
  if (!p.asignados[rol]) p.asignados[rol] = por; // quien actúa sin estar asignado queda como responsable

  switch (accion) {
    case "iniciar":
      p.estado = ESTADO.ELABORACION;
      break;
    case "enviar": {
      const etapas = rolesRevision();
      if (etapas.length) {
        p.estado = ESTADO.REVISION;
        p.etapa = etapas[0].id;
      } else {
        p.estado = ESTADO.REVISADO;
        p.etapa = null;
      }
      break;
    }
    case "visto-bueno": {
      const etapas = rolesRevision().map((r) => r.id);
      const sig = etapas[etapas.indexOf(p.etapa) + 1];
      if (sig) p.etapa = sig;
      else {
        p.estado = ESTADO.REVISADO;
        p.etapa = null;
      }
      break;
    }
    case "devolver":
      p.estado = ESTADO.DEVUELTO;
      p.etapa = null;
      break;
    case "firmar":
      p.estado = ESTADO.FIRMADO;
      break;
    case "reabrir":
      p.estado = ESTADO.ELABORACION;
      p.etapa = null;
      break;
  }
  anotar(id, por, accion, de, p.estado, nota, rol);
  await persistir();
  avisarCambio(id, accion, de, p.estado, por);
  return { ok: true, papel: ficha(id) };
}

/* El módulo de cada papel avisa aquí cuando el contenido cambia (tras guardar). */
async function registrarCambio(id, { por, resumen } = {}) {
  const p = papel(id);
  const de = p.estado;
  if (de === ESTADO.PENDIENTE) {
    p.estado = ESTADO.ELABORACION;
    if (!p.asignados.prepara && persona(por) && persona(por).roles.includes("prepara")) p.asignados.prepara = por;
    anotar(id, por, "iniciar", de, p.estado, resumen);
  } else if (REGLAS.cambioReabre && [ESTADO.REVISION, ESTADO.REVISADO, ESTADO.FIRMADO].includes(de)) {
    p.estado = ESTADO.ELABORACION;
    p.etapa = null;
    const extra = de === ESTADO.FIRMADO ? "La firma quedó sin efecto." : "La revisión quedó sin efecto.";
    anotar(id, por, "contenido-modificado", de, p.estado, (resumen ? resumen + " " : "") + extra);
  } else {
    return { ok: true, cambio: false };
  }
  await persistir();
  avisarCambio(id, de === ESTADO.PENDIENTE ? "iniciar" : "contenido-modificado", de, p.estado, por);
  return { ok: true, cambio: true, papel: ficha(id) };
}

async function asignar(id, rol, personaId, { por } = {}) {
  const p = papel(id);
  const quien = persona(por);
  if (!quien || !REGLAS.puedenAsignar.some((r) => quien.roles.includes(r))) {
    return { ok: false, error: "Solo " + REGLAS.puedenAsignar.map(nombreRol).join(" o ") + " pueden asignar responsables." };
  }
  if (p.estado === ESTADO.FIRMADO) return { ok: false, error: "El papel está firmado. Reábralo para cambiar responsables." };
  if (!rolesActivos().some((r) => r.id === rol)) return { ok: false, error: "El rol «" + nombreRol(rol) + "» no está activo en este proyecto." };
  if (personaId) {
    const destino = persona(personaId);
    if (destino && destino.activo === false) return { ok: false, error: "Esa persona está desactivada." };
    if (!destino || !destino.roles.includes(rol)) return { ok: false, error: "Esa persona no tiene el rol «" + nombreRol(rol) + "»." };
    if (datos.config.separarFunciones && rol !== "prepara" && p.asignados.prepara === personaId)
      return { ok: false, error: "Quien elabora el papel no puede ser también su " + nombreRol(rol).toLowerCase() + "." };
    if (datos.config.separarFunciones && rol === "prepara" && Object.entries(p.asignados).some(([r, x]) => r !== "prepara" && x === personaId))
      return { ok: false, error: "Esa persona ya es revisora o firmante de este papel." };
  }
  const antes = p.asignados[rol] ? quienEs(p.asignados[rol]).nombre : "sin asignar";
  if (personaId) p.asignados[rol] = personaId;
  else delete p.asignados[rol];
  const despues = personaId ? quienEs(personaId).nombre : "sin asignar";
  anotar(id, por, "asignar", p.estado, p.estado, nombreRol(rol) + ": " + antes + " → " + despues, rol);
  await persistir();
  avisarCambio(id, "asignar", p.estado, p.estado, por);
  return { ok: true, papel: ficha(id) };
}

async function fijarFechas(id, { programada, vence }, { por } = {}) {
  const p = papel(id);
  const prog = programada != null ? programada : p.fechas.programada;
  const vence_ = vence != null ? vence : p.fechas.vence;
  if (prog && vence_ && vence_ < prog) return { ok: false, error: "La fecha de vencimiento no puede ser anterior a la programada." };
  p.fechas.programada = prog;
  p.fechas.vence = vence_;
  anotar(id, por, "fechas", p.estado, p.estado, "Programada: " + (p.fechas.programada || "—") + " · Vence: " + (p.fechas.vence || "—"));
  await persistir();
  avisarCambio(id, "fechas", p.estado, p.estado, por);
  return { ok: true, papel: ficha(id) };
}

async function configurar({ rolesActivos: nuevos, separarFunciones } = {}, { por } = {}) {
  if (!puede(por, "modificar-perfiles")) return { ok: false, error: sinPermiso("modificar-perfiles") };
  if (nuevos) {
    const ids = new Set(nuevos.concat(ROLES.filter((r) => r.fijo).map((r) => r.id)));
    if (Object.values(datos.papeles).some((p) => p.estado === ESTADO.REVISION))
      return { ok: false, error: "Hay papeles en revisión. Termine o devuélvalos antes de cambiar los roles." };
    datos.config.rolesActivos = ROLES.filter((r) => ids.has(r.id)).map((r) => r.id);
  }
  if (typeof separarFunciones === "boolean") datos.config.separarFunciones = separarFunciones;
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:flujo-config"));
  return { ok: true };
}

async function guardarPersonas(lista) {
  datos.personas = copia(lista);
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:flujo-config"));
  return { ok: true };
}


/* ------------------------------------------------------------------ usuarios y perfiles */

function puedeAdministrar(pid) {
  const x = persona(pid);
  return !!x && x.activo !== false && REGLAS.puedenAdministrarUsuarios.some((r) => x.roles.includes(r));
}

/* Permiso de la matriz por perfil. */
function puede(pid, accion) {
  const x = persona(pid);
  return !!x && x.activo !== false && puedePerfil(x.perfil, accion);
}
const sinPermiso = (accion) => "Su perfil no tiene permiso para: " + ((ACCIONES.find((a) => a.id === accion) || {}).nombre || accion).toLowerCase() + ".";

function enUso(pid) {
  const papeles = Object.values(datos.papeles);
  return {
    asignado: papeles.some((p) => Object.values(p.asignados).includes(pid)),
    historial: papeles.some((p) => p.historial.some((h) => h.por.id === pid)),
  };
}

async function guardarPersona(x, { por } = {}) {
  const nueva = !x.id || !persona(x.id);
  const accion = nueva ? "crear-usuario" : "modificar-perfiles";
  if (!puede(por, accion)) return { ok: false, error: sinPermiso(accion) };
  if (x.perfil && !PERFILES.some((p) => p.id === x.perfil)) return { ok: false, error: "Perfil no válido." };
  const nombre = String(x.nombre || "").trim();
  if (!nombre) return { ok: false, error: "Escriba el nombre." };
  if (!x.roles || !x.roles.length) return { ok: false, error: "Elija al menos un rol." };
  if (x.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.correo)) return { ok: false, error: "El correo no es válido." };
  if ((datos.personas || []).some((y) => y.id !== x.id && y.nombre.toLowerCase() === nombre.toLowerCase())) return { ok: false, error: "Ya existe un usuario con ese nombre." };
  const limpio = { id: x.id || "p-" + Date.now().toString(36), nombre, cargo: String(x.cargo || "").trim(), correo: String(x.correo || "").trim(), roles: x.roles.slice(), perfil: x.perfil || (persona(x.id) || {}).perfil || perfilDesdeRoles(x.roles), activo: x.activo !== false };
  const i = datos.personas.findIndex((y) => y.id === limpio.id);
  if (i >= 0) {
    // quitar un rol a quien ya lo ejerce en un papel abierto dejaría el papel trabado
    const perdidos = datos.personas[i].roles.filter((r) => !limpio.roles.includes(r));
    const trabado = Object.entries(datos.papeles).find(([, p]) => p.estado !== ESTADO.FIRMADO && perdidos.some((r) => p.asignados[r] === limpio.id));
    if (trabado) return { ok: false, error: "Está asignado como «" + nombreRol(perdidos.find((r) => datos.papeles[trabado[0]].asignados[r] === limpio.id)) + "» en " + trabado[0] + ". Cambie esa asignación primero." };
    // el último administrador no puede perder la capacidad de administrar
    const antes = datos.personas[i];
    if (puedeAdministrar(antes.id) && !limpio.roles.some((r) => REGLAS.puedenAdministrarUsuarios.includes(r)) && datos.personas.filter((y) => y.activo !== false && puedeAdministrar(y.id)).length === 1) return { ok: false, error: "Debe quedar al menos un administrador activo." };
    datos.personas[i] = limpio;
  } else datos.personas.push(limpio);
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:flujo-config"));
  return { ok: true, persona: copia(limpio) };
}

async function activarPersona(pid, activo, { por } = {}) {
  if (!puede(por, "habilitar-usuario")) return { ok: false, error: sinPermiso("habilitar-usuario") };
  const x = persona(pid);
  if (!x) return { ok: false, error: "No existe ese usuario." };
  if (!activo) {
    if (pid === por) return { ok: false, error: "No puede desactivarse a sí mismo." };
    const ult = datos.personas.filter((y) => y.activo !== false && puedeAdministrar(y.id));
    if (ult.length === 1 && ult[0].id === pid) return { ok: false, error: "Debe quedar al menos un administrador activo." };
    const abierto = Object.entries(datos.papeles).find(([, p]) => p.estado !== ESTADO.FIRMADO && Object.values(p.asignados).includes(pid));
    if (abierto) return { ok: false, error: "Tiene responsabilidades en " + abierto[0] + ". Reasígnelas antes de desactivarlo." };
  }
  x.activo = !!activo;
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:flujo-config"));
  return { ok: true };
}

async function eliminarPersona(pid, { por } = {}) {
  if (!puede(por, "eliminar-usuario")) return { ok: false, error: sinPermiso("eliminar-usuario") };
  if (pid === por) return { ok: false, error: "No puede eliminarse a sí mismo." };
  const u = enUso(pid);
  if (u.asignado || u.historial) return { ok: false, error: "Tiene movimientos en el historial de los papeles. Desactívelo en lugar de eliminarlo." };
  datos.personas = datos.personas.filter((y) => y.id !== pid);
  await persistir();
  document.dispatchEvent(new CustomEvent("auditx:flujo-config"));
  return { ok: true };
}

/* ------------------------------------------------------------------ consultas para tableros */

function listar({ estado, personaId, soloVencidos } = {}) {
  return Object.keys(datos.papeles)
    .map(ficha)
    .filter((f) => (!estado || f.estado === estado) && (!soloVencidos || f.vencido) && (!personaId || Object.values(f.asignados).includes(personaId)));
}

/* Qué papeles le tocan a una persona (le toca elaborar, revisar o firmar ahora). */
function pendientesDe(pid) {
  return Object.keys(datos.papeles)
    .map(ficha)
    .filter((f) => acciones(f.id, pid).some((a) => a.disponible && (f.asignados[a.rol] === pid || (!f.asignados[a.rol] && f.estado !== ESTADO.PENDIENTE))));
}

/* «¿Quién y cómo lo hizo?»: última persona y fecha de cada paso. */
function quienYComo(id) {
  const h = papel(id).historial;
  const ultimo = (accion, rol) => {
    for (let i = h.length - 1; i >= 0; i--) if (h[i].accion === accion && (!rol || h[i].rol === rol)) return h[i];
    return null;
  };
  const f = ficha(id);
  return {
    elaboro: ultimo("iniciar") ? { ...ultimo("iniciar").por, fecha: ultimo("iniciar").fecha } : null,
    reviso: rolesRevision().map((r) => {
      const x = ultimo("visto-bueno", r.id);
      return { rol: r.nombre, persona: x ? x.por : null, fecha: x ? x.fecha : null };
    }),
    firmo: f.estado === ESTADO.FIRMADO && ultimo("firmar") ? { ...ultimo("firmar").por, fecha: ultimo("firmar").fecha } : null,
    estado: f.estado,
  };
}

/* ------------------------------------------------------------------ usuario que actúa */

/* Mientras no exista inicio de sesión de Microsoft 365, se elige entre las personas de ejemplo. */
function usuarioActual() {
  let id = null;
  try {
    id = window.localStorage.getItem(ALMACEN.claveUsuario);
  } catch (e) {
    /* sin almacenamiento */
  }
  const p = persona(id);
  return p && p.activo !== false ? p : (datos.personas || []).find((x) => x.activo !== false) || null;
}
function cambiarUsuario(pid) {
  try {
    window.localStorage.setItem(ALMACEN.claveUsuario, pid);
  } catch (e) {
    /* sin almacenamiento */
  }
  document.dispatchEvent(new CustomEvent("auditx:flujo-usuario", { detail: { id: pid } }));
}

/* ------------------------------------------------------------------ pintar en el panel */

function pintarEnPanel(id) {
  const panel = window.AuditX && window.AuditX.panel;
  if (!panel) return;
  const f = ficha(id);
  /* Responsable del turno: quien debe actuar ahora (o quien firmó). */
  const rolTurno = f.estado === ESTADO.REVISION ? f.etapa : f.estado === ESTADO.REVISADO || f.estado === ESTADO.FIRMADO ? "aprueba" : "prepara";
  const quien = persona(f.asignados[rolTurno]);
  const primero = quien ? " · " + quien.nombre.split(" ")[0] : "";
  if (f.vencido) return panel.marcarEstado(id, { estado: "vencido", texto: "Vencido" + primero });
  if (f.estado === ESTADO.PENDIENTE) return panel.marcarEstado(id, quien ? { estado: "", texto: "Pendiente" + primero } : null);
  const clase = f.estado === ESTADO.FIRMADO ? "firmado" : f.estado === ESTADO.REVISION ? "revision" : "";
  panel.marcarEstado(id, { estado: clase, texto: f.estado + primero });
}
function pintarTodos() {
  Object.keys(datos.papeles).forEach(pintarEnPanel);
}

/* ------------------------------------------------------------------ arranque */

async function iniciar() {
  datos = await Almacen.cargar();
  const nuevo = !datos;
  if (nuevo) datos = datosIniciales();
  completarDatos();
  if (nuevo) await persistir().catch(() => {});
  pintarTodos();
  document.dispatchEvent(new CustomEvent("auditx:flujo-listo"));
  return api;
}

const api = {
  iniciar,
  ESTADO,
  ROLES,
  listo: () => !!datos,
  etiquetaAccion: (a) => ETIQUETA_ACCION[a] || a,
  nombreRol,
  papeles: () => papelesDelMenu(),
  personas: (soloActivas) => copia(datos.personas.filter((x) => !soloActivas || x.activo !== false)),
  puedeAdministrar,
  puede,
  PERFILES,
  ACCIONES,
  nombrePerfil,
  matriz,
  puedeAsignar: (pid) => {
    const x = persona(pid);
    return !!x && x.activo !== false && REGLAS.puedenAsignar.some((r) => x.roles.includes(r));
  },
  hoyISO,
  guardarPersona,
  activarPersona,
  eliminarPersona,
  persona: (pid) => (persona(pid) ? copia(persona(pid)) : null),
  rolesActivos: () => rolesActivos().map((r) => ({ ...r })),
  separarFunciones: () => datos.config.separarFunciones,
  ficha,
  acciones,
  registrarBloqueo,
  ejecutar,
  registrarCambio,
  asignar,
  fijarFechas,
  configurar,
  guardarPersonas,
  listar,
  pendientesDe,
  quienYComo,
  usuarioActual,
  cambiarUsuario,
  repintarPanel: pintarTodos,
  _reiniciar: async () => {
    datos = datosIniciales();
    completarDatos();
    await persistir();
    pintarTodos();
  },
};

export default api;
