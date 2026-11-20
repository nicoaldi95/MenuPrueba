/*
 * AuditX — Papeles que se trabajan en su hoja de Excel (AA-04, AA-05-1, AA-05-2, AA-06, AA-07, AA-09)
 * Participan del flujo igual que los demás: la ficha dice quién elabora, revisa y firma, cuándo y cómo.
 * La hoja se abre desde aquí. Como el complemento no ve lo que se escribe en la hoja, quien la modifica
 * lo registra con «Modifiqué la hoja» (si el papel estaba revisado o firmado, vuelve a elaboración).
 */

import flujo from "./flujo.js";
import { montarFicha } from "./flujo-ficha.js";
import { el, mensaje } from "./ui.js";

/* global window */

export const montarPapelHoja = (id) => (c) => {
  c.textContent = "";
  const arriba = el("div");
  const abajo = el("div", "hj");
  c.append(arriba, abajo);
  const f = montarFicha(arriba, id, { simularContenido: false, cambioManual: true });
  const reg = flujo.papeles().find((p) => p.id === id);
  let aviso = null;
  const pintar = () => {
    abajo.textContent = "";
    abajo.append(el("h3", "cm-tit", "Hoja de Excel"));
    abajo.append(el("p", "fm-ayuda", "Este papel se trabaja en su hoja del libro. Ábrala para completarlo; el flujo registra quién lo elabora, revisa y firma."));
    const b = el("button", "fl-btn", "Abrir hoja");
    b.type = "button";
    b.dataset.accion = "abrir-hoja";
    b.addEventListener("click", async () => {
      const r = await window.AuditX.panel.abrirHojaDe(id);
      aviso = r && r.ok === false ? { t: r.texto || "No se pudo abrir la hoja.", k: "aviso" } : null;
      pintar();
    });
    abajo.append(b);
    if (aviso) abajo.append(mensaje(aviso.t, aviso.k));
  };
  pintar();
  return { destruir: () => f.destruir && f.destruir(), reg };
};
