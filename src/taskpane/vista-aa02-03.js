/*
 * AuditX — AA-02 y AA-03 conectados al flujo (M3-01, M3-02)
 * Igual que AA-01: arriba la ficha del flujo; debajo, el papel.
 */

import { montarFicha } from "./flujo-ficha.js";
import aa02 from "./aa02.js";
import aa03 from "./aa03.js";
import { el } from "./ui.js";

const fabrica = (id, modulo) => (c) => {
  c.textContent = "";
  const arriba = el("div");
  const abajo = el("div", "aa-contenedor");
  c.append(arriba, abajo);
  const f = montarFicha(arriba, id, { simularContenido: false });
  const q = modulo.montar(abajo);
  return { destruir: () => (f.destruir && f.destruir(), q.destruir()) };
};

export const montarAA02 = fabrica("AA-02", aa02);
export const montarAA03 = fabrica("AA-03", aa03);
export const cargarCuestionarios = () => Promise.all([aa02.cargar(), aa03.cargar()]);
export { aa02, aa03 };
