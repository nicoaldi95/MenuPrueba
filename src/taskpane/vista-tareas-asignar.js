/*
 * AuditX — Asignar Tareas (M8-02)
 * Formulario para asignar una tarea a otro usuario del proyecto. Las tareas quedan en el registro del complemento.
 */

import flujo from "./flujo.js";
import tareas from "./tareas.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

export function montarAsignarTareas(c) {
  let aviso = null;
  let borrador = null; // se conserva lo escrito si hay un error

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M8-02"), el("span", "fl-nombre", "Asignar Tareas"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    const otros = tareas.responsables().filter((p) => p.id !== yo.id);
    c.append(el("p", "fm-ayuda", "Asigne una tarea a otro usuario del proyecto. Quien la recibe la verá en «Consultar y Responder Tareas»."));
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));
    if (!otros.length) {
      c.append(mensaje("No hay otros usuarios activos a quienes asignar tareas. Cree usuarios en «Usuarios y Perfiles».", "aviso"));
    } else {
      const b = borrador || {};
      const hoy = flujo.hoyISO();
      const inicio0 = b.inicio || hoy;
      const f = el("form", "fm-form");
      const fProceso = campo({ id: "proceso", etiqueta: "Proceso", tipo: "select", opciones: ["", ...tareas.PROCESOS], valor: b.proceso || "", requerido: true });
      const fNombre = campo({ id: "nombre", etiqueta: "Nombre de la tarea", valor: b.nombre || "", requerido: true });
      const fDetalle = campo({ id: "detalle", etiqueta: "Detalle de la tarea", tipo: "textarea", valor: b.detalle || "", requerido: true });
      const fResp = campo({ id: "responsable", etiqueta: "Responsable", tipo: "select", opciones: ["", ...otros.map((p) => p.nombre)], valor: b.responsableNombre || "", requerido: true });
      const fPrio = campo({ id: "prioridad", etiqueta: "Prioridad", tipo: "select", opciones: ["", ...tareas.PRIORIDADES], valor: b.prioridad || "", requerido: true });
      const fInicio = campo({ id: "inicio", etiqueta: "Fecha de inicio", tipo: "date", valor: inicio0, requerido: true });
      const fVence = campo({ id: "vencimiento", etiqueta: "Vencimiento", tipo: "date", valor: b.vencimiento || tareas.vencimientoSugerido(inicio0), requerido: true, ayuda: "Por defecto, una semana después del inicio." });
      const fEstado = campo({ id: "estado", etiqueta: "Estado", tipo: "select", opciones: ["", ...tareas.ESTADOS_AL_ASIGNAR], valor: b.estado || "", requerido: true });
      const fProg = campo({ id: "progreso", etiqueta: "Avance", tipo: "select", opciones: ["", ...tareas.PROGRESOS.map((n) => n + "%")], valor: b.progreso || "", requerido: true });
      fInicio.ctrl.addEventListener("change", () => {
        const v = tareas.vencimientoSugerido(fInicio.valor());
        if (v) fVence.ctrl.value = v;
      });
      [fProceso, fNombre, fDetalle, fResp, fPrio, fInicio, fVence, fEstado, fProg].forEach((x) => f.append(x.nodo));
      const acc = el("div", "fm-acciones");
      const g = el("button", "fl-btn", "Asignar tarea");
      g.type = "submit";
      g.dataset.accion = "asignar";
      const l = el("button", "fl-btn fl-btn-sec", "Limpiar");
      l.type = "button";
      l.dataset.accion = "limpiar";
      l.addEventListener("click", () => {
        borrador = null;
        aviso = null;
        pintar();
      });
      acc.append(g, l);
      f.append(acc);
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const nombreResp = fResp.valor();
        const p = otros.find((x) => x.nombre === nombreResp);
        const dato = {
          proceso: fProceso.valor(),
          nombre: fNombre.valor(),
          detalle: fDetalle.valor(),
          responsable: p ? p.id : "",
          responsableNombre: nombreResp,
          prioridad: fPrio.valor(),
          inicio: fInicio.valor(),
          vencimiento: fVence.valor(),
          estado: fEstado.valor(),
          progreso: fProg.valor(),
        };
        const r = await tareas.crear({ ...dato, progreso: dato.progreso === "" ? "" : parseInt(dato.progreso, 10) }, { por: yo.id });
        if (r.ok) {
          borrador = null;
          aviso = { texto: "Se agregó la tarea con éxito: «" + r.tarea.nombre + "» para " + nombreResp + ".", tipo: "ok" };
        } else {
          borrador = dato;
          aviso = { texto: r.error, tipo: "error" };
        }
        pintar();
      });
      c.append(f);
    }

    /* --- tareas que usted ha asignado --- */
    const mias = tareas.asignadasPor(yo.id).reverse();
    const sec = el("section", "fl-hist");
    sec.append(el("h3", null, "Tareas que usted asignó (" + mias.length + ")"));
    if (!mias.length) sec.append(el("p", "fl-vacio", "Todavía no ha asignado tareas."));
    mias.slice(0, 8).forEach((t) => {
      const it = el("div", "fl-hist-item");
      const r = flujo.persona(t.responsable);
      it.append(el("div", "fl-hist-l2", "N.º " + t.no + " · " + t.nombre));
      it.append(el("div", "fl-hist-nota", [r ? r.nombre : "—", t.prioridad, "vence " + fmtFecha(t.vencimiento), t.estado + " " + t.progreso + "%"].join(" · ")));
      sec.append(it);
    });
    if (mias.length > 8) sec.append(el("p", "fm-ayuda", "Se muestran las 8 más recientes."));
    c.append(sec);
    const a = el("a", "fm-ayuda", "Ver el video de ayuda");
    a.href = "https://www.auditool.org/blog/webinars1/video/n-gestor-de-tareas";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    c.append(a);
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:tareas-cambio"]);
  pintar();
  return h;
}
