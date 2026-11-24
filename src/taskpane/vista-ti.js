/*
 * AuditX — TI · Tiempo Invertido (M2-10)
 * No hay formulario en el panel: el papel se trabaja en su hoja de Excel. El panel solo lleva el flujo
 * (quién elabora, revisa y firma) y crea la hoja con la plantilla original si todavía no existe.
 */

import flujo from "./flujo.js";
import { montarFicha } from "./flujo-ficha.js";
import { el, mensaje } from "./ui.js";
import ti, { HOJA_TI, MAX_USUARIOS } from "./hoja-ti.js";

export const montarTI = (c) => {
  c.textContent = "";
  const arriba = el("div");
  const abajo = el("div", "hj");
  c.append(arriba, abajo);
  const f = montarFicha(arriba, "ti-tiempo", { simularContenido: false, cambioManual: true });
  let aviso = null;
  let existe = null;

  const pintar = () => {
    abajo.textContent = "";
    abajo.append(el("h3", "cm-tit", "Hoja de Excel"));
    abajo.append(el("p", "fm-ayuda", "Este papel se trabaja en la hoja «" + HOJA_TI + "»: horas por mes de cada auditor y registro de actividades con inicio y fin. " + (existe === false ? "Todavía no existe en este libro; se crea con la plantilla original." : "")));
    const b = el("button", "fl-btn", existe === false ? "Crear y abrir hoja" : "Abrir hoja");
    b.type = "button";
    b.dataset.accion = "abrir-hoja";
    b.addEventListener("click", async () => {
      b.disabled = true;
      const r = await ti.abrirOCrear();
      if (r.ok) {
        existe = true;
        aviso = { t: r.creada ? "Hoja «" + HOJA_TI + "» creada con la plantilla y abierta." + (r.aviso ? " " + r.aviso : "") : "Se abrió la hoja «" + HOJA_TI + "».", k: "ok" };
      } else aviso = { t: r.motivo === "fuera-de-excel" ? "Fuera de Excel no se puede crear la hoja." : "No se pudo crear o abrir la hoja. Revise la consola.", k: "aviso" };
      pintar();
    });
    abajo.append(b);
    if (existe) {
      const s = el("button", "fl-btn fl-btn-sec", "Actualizar encabezado y usuarios");
      s.type = "button";
      s.dataset.accion = "sincronizar";
      s.title = "Pone al día entidad, período y responsables, y agrega a la tabla los usuarios nuevos. No toca horas ni actividades.";
      s.addEventListener("click", async () => {
        const r = await ti.sincronizar();
        aviso = r.ok
          ? { t: "Encabezado actualizado" + (r.agregados ? " y " + r.agregados + " usuario(s) agregado(s)" : "") + "." + (r.sinLugar ? " La plantilla solo tiene " + MAX_USUARIOS + " filas; " + r.sinLugar + " usuario(s) no cupieron." : ""), k: r.sinLugar ? "aviso" : "ok" }
          : { t: "No se pudo actualizar la hoja.", k: "aviso" };
        pintar();
      });
      abajo.append(s);
    }
    abajo.append(el("p", "fm-ayuda", "Como el complemento no ve lo que se escribe en la hoja, quien la modifica lo registra con «Modifiqué la hoja» en la ficha de arriba."));
    if (aviso) abajo.append(mensaje(aviso.t, aviso.k));
  };
  pintar();
  ti.existeHoja().then((e) => {
    existe = e;
    pintar();
  }).catch(() => {});
  return { destruir: () => f.destruir && f.destruir() };
};
