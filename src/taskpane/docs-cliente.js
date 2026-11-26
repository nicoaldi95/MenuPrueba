/*
 * AuditX — Documentos del cliente (bloque «Información del Proyecto» de la hoja «Estatus PT Auditoria»)
 *
 * En el VBA la hoja tenía 19 documentos (Organigrama, Estatutos, RUT…) con «Aplica / No aplica», «¿Se encuentra cargado?»
 * (el formulario de información del proyecto escribía «SI» al adjuntar el archivo) y «Enlace», más el resumen
 * Usados / Cargados / Faltantes.
 * Aquí se lleva la misma lista: se marca si aplica, se registra el enlace o nombre del archivo (cargado = tiene enlace)
 * y el resumen se calcula solo. Copiar el archivo al servidor es parte del backend.
 * Evento: «auditx:docs-cliente-cambio»
 */
import flujo from "./flujo.js";
import { crearAlmacen } from "./almacen.js";

/* global document */

export const DOCUMENTOS = [
  "Organigrama", "Cadena de Valor de la Compañía", "Registro Legal de la Compañía", "Copia identificación RUT / RUP",
  "Estatutos de la Compañía", "Comunicaciones con entes externos y de vigilancia", "Políticas de la Compañía", "Cámara de comercio",
  "Procedimientos de la compañía", "Consulta en listas restrictivas", "Evaluación y aceptación del servicio y cliente",
  "Acta de inicio proyecto", "Propuesta del servicio", "Contrato", "Orden de Compra", "Estados financieros", "Notas a los EEFF",
  "Dictámen del auditor", "Informe de Gestión",
];
export const MAX_ENLACE = 500;

export const Almacen = crearAlmacen({ namespace: "http://auditool.org/auditx/docs-cliente/v1", claveLocal: "auditx.docscliente.v1", raiz: "docsCliente" });

let datos = { docs: {} };
let cola = Promise.resolve();
const persistir = () => {
  const x = JSON.parse(JSON.stringify(datos));
  cola = cola.then(() => Almacen.guardar(x));
  return cola;
};
const avisar = () => document.dispatchEvent(new CustomEvent("auditx:docs-cliente-cambio"));

export async function iniciar() {
  const g = await Almacen.cargar();
  datos = { docs: g && g.docs && typeof g.docs === "object" ? g.docs : {} };
}

export function lista() {
  return DOCUMENTOS.map((nombre) => {
    const d = datos.docs[nombre] || {};
    const aplica = d.aplica !== false;
    const enlace = d.enlace || "";
    return { nombre, aplica, enlace, cargado: aplica && !!enlace, por: d.por || "", fecha: d.fecha || "" };
  });
}

export function resumenDocs() {
  const l = lista();
  const usados = l.filter((x) => x.aplica).length;
  const cargados = l.filter((x) => x.cargado).length;
  return { usados, cargados, faltantes: usados - cargados, porcentaje: usados ? cargados / usados : 0 };
}

export async function actualizar(nombre, { aplica, enlace }, { por } = {}) {
  if (!DOCUMENTOS.includes(nombre)) return { ok: false, error: "Ese documento no está en la lista." };
  const yo = por || flujo.usuarioActual();
  if (!yo || !yo.id) return { ok: false, error: "Elija quién está actuando." };
  const act = datos.docs[nombre] || {};
  const nuevo = { aplica: aplica === undefined ? act.aplica !== false : !!aplica, enlace: enlace === undefined ? act.enlace || "" : String(enlace).trim() };
  if (nuevo.enlace.length > MAX_ENLACE) return { ok: false, error: "El enlace es muy largo (máximo " + MAX_ENLACE + " caracteres)." };
  if ((act.aplica !== false) === nuevo.aplica && (act.enlace || "") === nuevo.enlace) return { ok: false, error: "No hay cambios que guardar." };
  datos.docs[nombre] = { ...nuevo, por: yo.nombre || yo.id, fecha: new Date().toISOString() };
  await persistir();
  avisar();
  return { ok: true };
}

export default { DOCUMENTOS, lista, resumenDocs, actualizar, iniciar, Almacen };
