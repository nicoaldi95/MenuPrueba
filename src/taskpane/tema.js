/*
 * AuditX — Modo día / noche
 * Guarda la elección en el navegador (localStorage, con respaldo si no está disponible);
 * sin elección previa sigue el modo del sistema. Se aplica como html[data-tema="claro|oscuro"].
 */

/* global document, window, localStorage */

const CLAVE = "auditx.tema";
let actual = "claro";

const leer = () => {
  try {
    return localStorage.getItem(CLAVE);
  } catch (e) {
    return null;
  }
};
const guardar = (v) => {
  try {
    localStorage.setItem(CLAVE, v);
  } catch (e) {
    /* sin almacenamiento: vale solo para esta sesión */
  }
};
const delSistema = () => {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  } catch (e) {
    return "claro";
  }
};

function aplicar(t) {
  actual = t === "oscuro" ? "oscuro" : "claro";
  document.documentElement.setAttribute("data-tema", actual);
  const b = document.getElementById("tp-tema");
  if (b) {
    b.setAttribute("aria-checked", String(actual === "oscuro"));
    b.title = actual === "oscuro" ? "Cambiar a modo día" : "Cambiar a modo noche";
  }
  document.dispatchEvent(new CustomEvent("auditx:tema", { detail: actual }));
}

export function iniciarTema() {
  aplicar(leer() || delSistema());
  const b = document.getElementById("tp-tema");
  if (b && !b.dataset.listo) {
    b.dataset.listo = "1";
    b.addEventListener("click", () => {
      const nuevo = actual === "oscuro" ? "claro" : "oscuro";
      guardar(nuevo);
      aplicar(nuevo);
    });
  }
}

export const temaActual = () => actual;
