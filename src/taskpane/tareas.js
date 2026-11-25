/*
 * AuditX — Registro de tareas («Registro Activ. Ejecucion» del VBA, Hoja178) y «Asignar Tareas» (UserForm7, M8-02)
 *
 * En el VBA: una hoja oculta con una fila por tarea (usuario que asigna, proceso, nombre, detalle, responsable, prioridad,
 * inicio, vencimiento, estado, % de progreso, comentarios, adjunto, «Enviado») y un formulario para agregar filas (máximo 1000).
 * Aquí el registro vive dentro del complemento (se guarda en el libro igual que el flujo): no hace falta una hoja visible.
 * Lo usarán «Consultar y Responder Tareas», «Kanban» y «Dashboard de Tareas».
 * Evento emitido: «auditx:tareas-cambio»
 */

import flujo from "./flujo.js";
import { crearAlmacen } from "./almacen.js";

/* global document */

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/tareas/v1", claveLocal: "auditx.tareas.v1", raiz: "tareas" });

export const PRIORIDADES = ["Baja", "Media", "Alta"];
export const ESTADOS = ["Pendiente", "En Progreso", "Completado"];
export const ESTADOS_AL_ASIGNAR = ["Pendiente", "En Progreso"]; // «Completado» no se ofrece al asignar (como en el original)
export const PROGRESOS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
export const PROCESOS = ["Pre-planificación", "Planificación", "Ejecución", "Cierre", "Informe", "Monitoreo y Control"]; // por confirmar con Auditool
export const MAX_TAREAS = 1000;
export const LARGO_NOMBRE = 120;
export const LARGO_DETALLE = 1000;

let datos = { tareas: [] };
let cola = Promise.resolve();
const copia = (o) => JSON.parse(JSON.stringify(o));
const persistir = () => {
  const x = copia(datos);
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:tareas-cambio"));

export async function iniciar() {
  const g = await Almacen.cargar();
  datos = { tareas: g && Array.isArray(g.tareas) ? g.tareas : [] };
}

const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(new Date(s + "T00:00:00").getTime()) && new Date(s + "T00:00:00").toISOString().slice(0, 10) === s;
export function sumarDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return flujo.hoyISO(new Date(a, m - 1, d + n));
}
/* Vencimiento sugerido: una semana después del inicio (como el formulario original). */
export const vencimientoSugerido = (inicio) => (esFecha(inicio) ? sumarDias(inicio, 7) : "");

/* Quién puede recibir tareas: usuarios activos. */
export const responsables = () => flujo.personas(true);

export const lista = () => copia(datos.tareas);
export const asignadasPor = (pid) => copia(datos.tareas.filter((t) => t.asigna === pid));
export const deUsuario = (pid) => copia(datos.tareas.filter((t) => t.responsable === pid));

/*
 * Crea una tarea. «campos»: proceso, nombre, detalle, responsable, prioridad, inicio, vencimiento, estado, progreso.
 * Reglas del formulario original: todo obligatorio; el responsable no puede ser quien asigna; el vencimiento no puede ser
 * anterior a hoy ni al inicio.
 */
export async function crear(campos, { por } = {}) {
  const quien = flujo.persona(por);
  if (!quien || quien.activo === false) return { ok: false, error: "Su usuario no está activo; no puede asignar tareas." };
  const c = campos || {};
  const nombre = String(c.nombre || "").trim();
  const detalle = String(c.detalle || "").trim();
  if (!c.proceso || !c.responsable || !c.prioridad || !c.estado || c.progreso === "" || c.progreso == null || !nombre || !detalle || !c.vencimiento)
    return { ok: false, error: "El formulario debe completarse en su totalidad, por favor verifique." };
  if (!PROCESOS.includes(c.proceso)) return { ok: false, error: "Elija un proceso de la lista." };
  if (!PRIORIDADES.includes(c.prioridad)) return { ok: false, error: "Elija la prioridad: Baja, Media o Alta." };
  if (!ESTADOS_AL_ASIGNAR.includes(c.estado)) return { ok: false, error: "Al asignar, el estado solo puede ser Pendiente o En Progreso." };
  const prog = Number(c.progreso);
  if (!PROGRESOS.includes(prog)) return { ok: false, error: "El avance debe ser 0 %, 10 %, … o 90 %." };
  const resp = flujo.persona(c.responsable);
  if (!resp || resp.activo === false) return { ok: false, error: "El responsable elegido no es un usuario activo." };
  if (c.responsable === por) return { ok: false, error: "El usuario responsable de la tarea no puede ser el mismo que asigna la tarea, por favor verifique." };
  if (nombre.length > LARGO_NOMBRE) return { ok: false, error: "El nombre de la tarea es muy largo (máximo " + LARGO_NOMBRE + " caracteres)." };
  if (detalle.length > LARGO_DETALLE) return { ok: false, error: "El detalle es muy largo (máximo " + LARGO_DETALLE + " caracteres)." };
  const inicio = c.inicio || flujo.hoyISO();
  if (!esFecha(inicio)) return { ok: false, error: "Debe ingresar una fecha de inicio con el formato correcto, por favor rectifique." };
  if (!esFecha(c.vencimiento)) return { ok: false, error: "Debe ingresar una fecha de vencimiento con el formato correcto, por favor rectifique." };
  if (c.vencimiento < flujo.hoyISO()) return { ok: false, error: "La fecha de vencimiento no puede ser inferior a la fecha actual." };
  if (c.vencimiento < inicio) return { ok: false, error: "La fecha de vencimiento no puede ser inferior a la fecha de inicio de la tarea." };
  if (datos.tareas.length >= MAX_TAREAS) return { ok: false, error: "El registro ya tiene " + MAX_TAREAS + " tareas; debe retirar tareas completadas antes de agregar más." };
  const numero = datos.tareas.reduce((m, t) => Math.max(m, t.no), 0) + 1;
  const tarea = {
    no: numero,
    asigna: por,
    proceso: c.proceso,
    nombre,
    detalle,
    responsable: c.responsable,
    prioridad: c.prioridad,
    inicio,
    vencimiento: c.vencimiento,
    estado: c.estado,
    progreso: prog,
    comentarios: "",
    adjunto: "",
    avisada: false, // «Enviado» del original: ¿ya se le avisó a quien asignó que la tarea se completó?
    creada: new Date().toISOString(),
  };
  datos.tareas.push(tarea);
  await persistir();
  avisar();
  return { ok: true, tarea: copia(tarea) };
}

export default { iniciar, lista, asignadasPor, deUsuario, crear, responsables, vencimientoSugerido, sumarDias, PRIORIDADES, ESTADOS, ESTADOS_AL_ASIGNAR, PROGRESOS, PROCESOS, MAX_TAREAS };
