/*
 * AuditX — Piezas de pantalla compartidas por las vistas (formularios, selector de usuario, mensajes)
 */

import flujo from "./flujo.js";

/* global document */

export function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

/* Campo de formulario: devuelve { nodo, valor() }. tipo: text | date | select | textarea */
export function campo({ id, etiqueta, tipo = "text", valor = "", opciones = [], ayuda = "", requerido = false, deshabilitado = false }) {
  const fila = el("label", "fm-campo");
  fila.append(el("span", "fm-etiqueta", etiqueta + (requerido ? " *" : "")));
  let ctrl;
  if (tipo === "select") {
    ctrl = el("select", "fl-select");
    opciones.forEach((o) => {
      const op = el("option", null, o);
      op.value = o;
      if (o === valor) op.selected = true;
      ctrl.append(op);
    });
  } else if (tipo === "textarea") {
    ctrl = el("textarea", "fl-nota");
    ctrl.rows = 2;
    ctrl.value = valor;
  } else {
    ctrl = el("input", tipo === "date" ? "fl-fecha" : "fm-texto");
    ctrl.type = tipo;
    ctrl.value = valor;
    ctrl.autocomplete = "off";
  }
  ctrl.disabled = deshabilitado;
  ctrl.dataset.campo = id;
  fila.append(ctrl);
  if (ayuda) fila.append(el("span", "fm-ayuda", ayuda));
  return { nodo: fila, valor: () => ctrl.value, ctrl };
}

export function mensaje(texto, tipo) {
  const m = el("p", "fl-msg", texto);
  m.dataset.tipo = tipo;
  m.setAttribute("role", "status");
  return m;
}

/* «Actuando como»: mientras no haya inicio de sesión de Microsoft 365 se elige entre las personas activas. */
export function selectorUsuario() {
  const act = el("label", "fl-actua");
  act.append(el("span", null, "Actuando como"));
  const sel = el("select", "fl-select");
  const u = flujo.usuarioActual();
  flujo.personas(true).forEach((p) => {
    const o = el("option", null, p.nombre + " · " + p.cargo);
    o.value = p.id;
    if (u && p.id === u.id) o.selected = true;
    sel.append(o);
  });
  sel.addEventListener("change", () => flujo.cambiarUsuario(sel.value));
  act.append(sel);
  return act;
}

/* Vuelve a dibujar la vista cuando cambia el usuario o la configuración. Devuelve destruir(). */
export function enCambios(contenedor, pintar, eventos = ["auditx:flujo-usuario", "auditx:flujo-config"]) {
  const alCambiar = () => (contenedor.isConnected ? pintar() : limpiar());
  const limpiar = () => eventos.forEach((e) => document.removeEventListener(e, alCambiar));
  eventos.forEach((e) => document.addEventListener(e, alCambiar));
  return { actualizar: pintar, destruir: limpiar };
}

export const fmtFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};
