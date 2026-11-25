/*
 * AuditX — Kanban de Tareas (M10-02)
 * Las tareas por estado (Pendiente · En Progreso · Completado), con filtro por responsable y por fechas de vencimiento.
 * Solo consulta (como en el original): las respuestas se registran en «Consultar y Responder Tareas».
 */

import flujo from "./flujo.js";
import tareas from "./tareas.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

const POR_COLUMNA = 10;

export function montarKanban(c) {
  let resp = "";
  let desde = "";
  let hasta = "";
  let soloVencidas = false;
  const verTodas = {}; // estado -> mostrar todas

  const nombreDe = (pid) => (flujo.persona(pid) ? flujo.persona(pid).nombre : "—");

  const tarjeta = (t) => {
    const k = el("div", "fl-hist-item");
    k.dataset.tarea = String(t.no);
    k.append(el("div", "fl-hist-l2", "N.º " + t.no + " · " + t.nombre));
    k.append(el("div", "fl-hist-nota", nombreDe(t.responsable) + " · " + t.proceso));
    const barra = el("div", "aa-progress-bar");
    const lleno = el("span", "aa-progress-fill");
    lleno.style.width = t.progreso + "%";
    barra.append(lleno);
    k.append(barra);
    k.append(el("div", "fl-hist-nota", t.progreso + "% · Prioridad " + t.prioridad + " · vence " + fmtFecha(t.vencimiento) + (tareas.esVencida(t) ? " · VENCIDA" : "")));
    return k;
  };

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M10-02"), el("span", "fl-nombre", "Kanban de Tareas"));
    c.append(h, selectorUsuario());
    c.append(el("p", "fm-ayuda", "Vea las tareas por estado, por fecha o por usuario. Para responder una tarea use «Consultar y Responder Tareas»."));

    /* filtros */
    const filtros = el("section", "fl-hist");
    const fr = campo({ id: "filtro-resp", etiqueta: "Usuario", tipo: "select", opciones: ["", ...flujo.personas().map((p) => p.nombre)], valor: resp });
    const fd = campo({ id: "filtro-desde", etiqueta: "Vence desde", tipo: "date", valor: desde });
    const fh = campo({ id: "filtro-hasta", etiqueta: "Vence hasta", tipo: "date", valor: hasta });
    const lv = el("label", "fm-check");
    const kv = el("input");
    kv.type = "checkbox";
    kv.checked = soloVencidas;
    kv.dataset.campo = "solo-vencidas";
    lv.append(kv, el("span", null, "Solo vencidas"));
    fr.ctrl.addEventListener("change", () => ((resp = fr.valor()), pintar()));
    fd.ctrl.addEventListener("change", () => ((desde = fd.valor()), pintar()));
    fh.ctrl.addEventListener("change", () => ((hasta = fh.valor()), pintar()));
    kv.addEventListener("change", () => ((soloVencidas = kv.checked), pintar()));
    filtros.append(fr.nodo, fd.nodo, fh.nodo, lv);
    if (desde && hasta && desde > hasta) filtros.append(mensaje("«Desde» es posterior a «Hasta»: no habrá resultados.", "aviso"));
    c.append(filtros);

    const todas = tareas
      .lista()
      .filter((t) => !resp || nombreDe(t.responsable) === resp)
      .filter((t) => !desde || t.vencimiento >= desde)
      .filter((t) => !hasta || t.vencimiento <= hasta)
      .filter((t) => !soloVencidas || tareas.esVencida(t))
      .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.no - b.no);

    if (!tareas.lista().length) c.append(el("p", "fl-vacio", "Todavía no hay tareas. Se asignan en «Asignar Tareas»."));
    tareas.ESTADOS.forEach((estado) => {
      const col = todas.filter((t) => t.estado === estado);
      const sec = el("section", "fl-hist");
      sec.dataset.columna = estado;
      sec.append(el("h3", null, estado + " (" + col.length + ")"));
      if (!col.length) sec.append(el("p", "fl-vacio", "Sin tareas."));
      (verTodas[estado] ? col : col.slice(0, POR_COLUMNA)).forEach((t) => sec.append(tarjeta(t)));
      if (col.length > POR_COLUMNA) {
        const b = el("button", "fl-btn fl-btn-sec", verTodas[estado] ? "Ver menos" : "Ver las " + col.length);
        b.type = "button";
        b.dataset.accion = "ver-" + estado;
        b.addEventListener("click", () => {
          verTodas[estado] = !verTodas[estado];
          pintar();
        });
        sec.append(b);
      }
      c.append(sec);
    });
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:tareas-cambio"]);
  pintar();
  return h;
}
