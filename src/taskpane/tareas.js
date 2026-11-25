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
export const PROGRESOS_RESPUESTA = Array.from({ length: 21 }, (_, i) => i * 5); // al responder: de 0 a 100 de 5 en 5
export const DIAS_PARA_RETIRAR = 15;
export const LARGO_COMENTARIO = 1000;
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

export const esVencida = (t) => t.estado !== "Completado" && t.vencimiento < flujo.hoyISO();
const diasEntre = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

/* Tareas del usuario sin completar (lo que el original le recordaba al entrar). */
export const pendientesDe = (pid) => copia(datos.tareas.filter((t) => t.responsable === pid && t.estado !== "Completado"));
/* Tareas que usted asignó y ya se completaron, de las que todavía no se le ha avisado. */
export const porAvisar = (pid) => copia(datos.tareas.filter((t) => t.asigna === pid && t.estado === "Completado" && !t.avisada));
export async function marcarAvisadas(pid) {
  let n = 0;
  datos.tareas.forEach((t) => {
    if (t.asigna === pid && t.estado === "Completado" && !t.avisada) {
      t.avisada = true;
      n++;
    }
  });
  if (n) {
    await persistir();
    avisar();
  }
  return n;
}

/*
 * Responde una tarea (solo su responsable). Reglas del original: el avance no puede bajar ni quedar igual;
 * «Completado» exige 100 % y 100 % exige «Completado». «evidencia» reemplaza al archivo adjunto del VBA (ver nota de backend).
 */
export async function responder(no, campos, { por } = {}) {
  const t = datos.tareas.find((x) => x.no === no);
  if (!t) return { ok: false, error: "No se encontró la tarea." };
  const quien = flujo.persona(por);
  if (!quien || quien.activo === false) return { ok: false, error: "Su usuario no está activo." };
  if (t.responsable !== por) return { ok: false, error: "Solo el responsable de la tarea puede responderla." };
  if (t.estado === "Completado") return { ok: false, error: "Esta tarea ya está completada." };
  const c = campos || {};
  const estado = c.estado;
  const prog = Number(c.progreso);
  if (!ESTADOS.includes(estado)) return { ok: false, error: "Elija el estado de la tarea." };
  if (c.progreso === "" || c.progreso == null || !PROGRESOS_RESPUESTA.includes(prog)) return { ok: false, error: "Elija el porcentaje de avance." };
  if (prog < t.progreso) return { ok: false, error: "No puede colocar un porcentaje de avance inferior al anterior. Por favor verifique." };
  const comentarios = String(c.comentarios == null ? t.comentarios : c.comentarios).trim();
  const evidencia = String(c.evidencia == null ? t.adjunto : c.evidencia).trim();
  if (estado === "Completado" && prog !== 100) return { ok: false, error: "Si la tarea está completada, el avance debe corresponder al 100%. Por favor verifique." };
  if (estado !== "Completado" && prog === 100) return { ok: false, error: "Si el avance es del 100%, el estado de la tarea debe marcarse como completada. Por favor verifique." };
  if (comentarios.length > LARGO_COMENTARIO) return { ok: false, error: "El comentario es muy largo (máximo " + LARGO_COMENTARIO + " caracteres)." };
  if (evidencia.length > 500) return { ok: false, error: "La referencia de la evidencia es muy larga (máximo 500 caracteres)." };
  if (prog === t.progreso && estado === t.estado && comentarios === t.comentarios && evidencia === t.adjunto)
    return { ok: false, error: "El porcentaje de avance de la actividad no fue modificado." };
  t.estado = estado;
  t.progreso = prog;
  t.comentarios = comentarios;
  t.adjunto = evidencia;
  t.actualizada = new Date().toISOString();
  if (estado === "Completado") t.avisada = false;
  await persistir();
  avisar();
  return { ok: true, tarea: copia(t) };
}

/* Retira del registro las tareas completadas cuyo vencimiento fue hace 15 días o más (el original lo hacía al abrir la hoja). */
export async function retirarCompletadas({ por, todas = false } = {}) {
  const quien = flujo.persona(por);
  if (!quien || quien.activo === false) return { ok: false, error: "Su usuario no está activo." };
  const admin = flujo.puedeAdministrar(por);
  if (todas && !admin) return { ok: false, error: "Solo quien aprueba puede retirar las tareas de todos." };
  const hoy = flujo.hoyISO();
  const sale = (t) => t.estado === "Completado" && diasEntre(t.vencimiento, hoy) >= DIAS_PARA_RETIRAR && (todas || t.asigna === por);
  const n = datos.tareas.filter(sale).length;
  if (!n) return { ok: true, retiradas: 0 };
  datos.tareas = datos.tareas.filter((t) => !sale(t));
  await persistir();
  avisar();
  return { ok: true, retiradas: n };
}
export const retirables = (pid, todas = false) => {
  const hoy = flujo.hoyISO();
  return datos.tareas.filter((t) => t.estado === "Completado" && diasEntre(t.vencimiento, hoy) >= DIAS_PARA_RETIRAR && (todas || t.asigna === pid)).length;
};

export default { iniciar, lista, asignadasPor, deUsuario, crear, responder, pendientesDe, porAvisar, marcarAvisadas, retirarCompletadas, retirables, esVencida, PROGRESOS_RESPUESTA, responsables, vencimientoSugerido, sumarDias, PRIORIDADES, ESTADOS, ESTADOS_AL_ASIGNAR, PROGRESOS, PROCESOS, MAX_TAREAS };
