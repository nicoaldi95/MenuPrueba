/*
 * AuditX — AA-01 Cuestionario de aceptación del cliente, conectado al flujo (M3-01)
 * Arriba la ficha del flujo (quién elabora / revisa / firma, cuándo y cómo); debajo, el cuestionario.
 */

import { montarFicha } from "./flujo-ficha.js";
import aa01 from "./aa01.js";
import { el } from "./ui.js";

export function montarAA01(c) {
  c.textContent = "";
  const arriba = el("div");
  const abajo = el("div", "aa-contenedor");
  c.append(arriba, abajo);
  const f = montarFicha(arriba, "AA-01", { simularContenido: false });
  const q = aa01.montar(abajo);
  return { destruir: () => (f.destruir && f.destruir(), q.destruir()) };
}
