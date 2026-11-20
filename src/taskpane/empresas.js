/*
 * AuditX — Empresas adicionales («Crear otras empresas», UserForm33 del VBA)
 *
 * En el VBA: hasta 7 empresas por libro; cada una copiaba el libro y armaba carpetas.
 * Aquí (decisión de Diseño, M2-01): cada empresa adicional es un encargo propio, SIN tope.
 * Se registra la ficha (9 datos del formulario original) y el equipo que se le asigna con los mismos roles.
 * El expediente en SharePoint se crea con el flujo M2-06; mientras tanto queda registrada su estructura.
 * Evento emitido: «auditx:empresas-cambio»
 */

import { crearAlmacen } from "./almacen.js";
import flujo from "./flujo.js";

/* global document */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/empresas/v1", claveLocal: "auditx.empresas.v1", raiz: "empresas" });

/* Los 9 datos de UserForm33, con sus etiquetas originales. */
export const CAMPOS = [
  { id: "nombre", etiqueta: "Nombre de la empresa", requerido: true },
  { id: "nit", etiqueta: "NIT/RUC/Núm. de identificación", requerido: true },
  { id: "direccion", etiqueta: "Dirección" },
  { id: "lugar", etiqueta: "Lugar de ejecución" },
  { id: "contacto", etiqueta: "Nombre del contacto" },
  { id: "celular", etiqueta: "Celular del contacto" },
  { id: "correo", etiqueta: "Email del contacto" },
  { id: "gerente", etiqueta: "Nombre del gerente" },
  { id: "empleados", etiqueta: "Número de empleados" },
];

/* Carpetas que el VBA creaba por empresa. */
export const ESTRUCTURA = [
  "Proyecto",
  "Información Financiera",
  "Documentos Adjuntos / Pre-Planificación",
  "Documentos Adjuntos / Planificación",
  "Documentos Adjuntos / Sustantivas",
  "Documentos Adjuntos / Controles",
  "Documentos Adjuntos / Impuestos",
  "Documentos Adjuntos / Informes",
  "Documentos Adjuntos / Finalización",
  "Documentos Adjuntos / Otra Info Cliente",
];

export const LIMITE = null; // el VBA topaba en 7; sin tope por decisión de Diseño (por confirmar con el cliente)

let datos = null;
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));
const persistir = () => {
  const x = copia(datos);
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:empresas-cambio"));
const norm = (t) => String(t || "").trim().toLowerCase().replace(/[\s.\-]/g, "");

function validar(n, id) {
  const e = {};
  CAMPOS.forEach((c) => (e[c.id] = String(n[c.id] == null ? "" : n[c.id]).trim()));
  if (!e.nombre) return { error: "Escriba el nombre de la empresa." };
  if (!e.nit) return { error: "Escriba el NIT / número de identificación." };
  if (e.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.correo)) return { error: "El email del contacto no es válido." };
  if (e.celular && !/^[+\d][\d\s\-()]{5,}$/.test(e.celular)) return { error: "El celular debe tener solo números (puede llevar +, espacios o guiones)." };
  if (e.empleados && !/^\d+$/.test(e.empleados)) return { error: "El número de empleados debe ser un entero." };
  const otra = datos.lista.find((x) => x.id !== id && (norm(x.nit) === norm(e.nit) || x.nombre.toLowerCase() === e.nombre.toLowerCase()));
  if (otra) return { error: "Ya existe «" + otra.nombre + "» con ese nombre o NIT." };
  return { e };
}

function permiso(por) {
  return flujo.puedeAdministrar(por) ? null : "Solo " + flujo.nombreRol("aprueba") + " puede crear o modificar empresas.";
}

/* Con «mismoEquipo» la nueva empresa recibe a los usuarios activos con los mismos roles (como decía el formulario). */
async function crear(n, { por, mismoEquipo = true } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  if (LIMITE && datos.lista.length >= LIMITE) return { ok: false, error: "Se alcanzó el límite de " + LIMITE + " empresas." };
  const v = validar(n, null);
  if (v.error) return { ok: false, error: v.error };
  const x = flujo.persona(por);
  const equipo = mismoEquipo ? flujo.personas(true).map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo, roles: p.roles.slice() })) : [];
  const emp = {
    id: "emp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    ...v.e,
    creada: new Date().toISOString(),
    por: x ? { id: x.id, nombre: x.nombre } : { id: por, nombre: "Desconocido" },
    equipo,
    expediente: "Por crear en SharePoint",
  };
  datos.lista.push(emp);
  await persistir();
  avisar();
  return { ok: true, empresa: copia(emp) };
}

async function actualizar(id, n, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  const i = datos.lista.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false, error: "No existe esa empresa." };
  const v = validar(n, id);
  if (v.error) return { ok: false, error: v.error };
  datos.lista[i] = { ...datos.lista[i], ...v.e };
  await persistir();
  avisar();
  return { ok: true, empresa: copia(datos.lista[i]) };
}

async function eliminar(id, { por } = {}) {
  const sin = permiso(por);
  if (sin) return { ok: false, error: sin };
  if (!datos.lista.some((x) => x.id === id)) return { ok: false, error: "No existe esa empresa." };
  datos.lista = datos.lista.filter((x) => x.id !== id);
  await persistir();
  avisar();
  return { ok: true };
}

async function iniciar() {
  datos = (await Almacen.cargar()) || { lista: [] };
  datos.lista = datos.lista || [];
  return api;
}

const api = {
  iniciar,
  listar: () => copia(datos.lista),
  obtener: (id) => copia(datos.lista.find((x) => x.id === id) || null),
  crear,
  actualizar,
  eliminar,
  CAMPOS,
  ESTRUCTURA,
  LIMITE,
  _reiniciar: async () => {
    datos = { lista: [] };
    await persistir();
  },
};

export default api;
