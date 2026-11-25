/*
 * AuditX — Consultar y Responder Tareas (M8-03)
 * «Mis tareas»: las que le asignaron y no ha completado, con su formulario de respuesta (avance, estado, comentario, evidencia).
 * «Todas las tareas»: consulta con filtros (en el original era la hoja completa, visible para todos).
 */

import flujo from "./flujo.js";
import tareas from "./tareas.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

export function montarConsultarTareas(c) {
  let aviso = null;
  let abierta = null; // número de la tarea cuyo formulario está abierto
  let borrador = null;
  let filtroEstado = "Todas";
  let filtroResp = "";
  let confirmarRetiro = false;

  const nombreDe = (pid) => (flujo.persona(pid) ? flujo.persona(pid).nombre : "—");
  const resumen = (t) => [nombreDe(t.responsable), t.prioridad, "vence " + fmtFecha(t.vencimiento) + (tareas.esVencida(t) ? " (vencida)" : ""), t.estado + " " + t.progreso + "%"].join(" · ");

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M8-03"), el("span", "fl-nombre", "Consultar y Responder Tareas"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    /* --- avisos de tareas completadas por otros --- */
    const nuevas = tareas.porAvisar(yo.id);
    if (nuevas.length) {
      const sec = el("section", "fl-hist");
      sec.append(el("h3", null, "Se completaron tareas que usted asignó (" + nuevas.length + ")"));
      nuevas.forEach((t) => sec.append(el("div", "fl-hist-nota", "Tarea completada: " + t.nombre + " · Responsable: " + nombreDe(t.responsable))));
      const b = el("button", "fl-btn fl-btn-sec", "Entendido");
      b.type = "button";
      b.dataset.accion = "avisadas";
      b.addEventListener("click", async () => {
        await tareas.marcarAvisadas(yo.id);
      });
      sec.append(b);
      c.append(sec);
    }

    /* --- mis tareas --- */
    const mias = tareas.pendientesDe(yo.id);
    const sm = el("section", "fl-hist");
    sm.append(el("h3", null, "Mis tareas pendientes (" + mias.length + ")"));
    if (!mias.length) sm.append(el("p", "fl-vacio", "No tiene tareas pendientes."));
    mias.forEach((t) => {
      const it = el("div", "fl-hist-item");
      it.dataset.tarea = String(t.no);
      it.append(el("div", "fl-hist-l2", "N.º " + t.no + " · " + t.nombre));
      it.append(el("div", "fl-hist-nota", "Proceso: " + t.proceso + " · Asigna: " + nombreDe(t.asigna)));
      it.append(el("div", "fl-hist-nota", t.detalle));
      it.append(el("div", "fl-hist-nota", resumen(t)));
      if (t.comentarios) it.append(el("div", "fl-hist-nota", "Comentarios: " + t.comentarios));
      if (abierta === t.no) it.append(formulario(t, yo));
      else {
        const b = el("button", "fl-btn fl-btn-sec", "Responder");
        b.type = "button";
        b.dataset.accion = "responder-" + t.no;
        b.addEventListener("click", () => {
          abierta = t.no;
          borrador = null;
          aviso = null;
          pintar();
        });
        it.append(b);
      }
      sm.append(it);
    });
    c.append(sm);

    /* --- todas las tareas --- */
    const todas = tareas.lista();
    const st = el("section", "fl-hist");
    st.append(el("h3", null, "Todas las tareas (" + todas.length + ")"));
    const fe = campo({ id: "filtro-estado", etiqueta: "Ver", tipo: "select", opciones: ["Todas", ...tareas.ESTADOS, "Vencidas"], valor: filtroEstado });
    const fr = campo({ id: "filtro-resp", etiqueta: "Responsable", tipo: "select", opciones: ["", ...flujo.personas().map((p) => p.nombre)], valor: filtroResp });
    fe.ctrl.addEventListener("change", () => {
      filtroEstado = fe.valor();
      pintar();
    });
    fr.ctrl.addEventListener("change", () => {
      filtroResp = fr.valor();
      pintar();
    });
    st.append(fe.nodo, fr.nodo);
    const vistas = todas
      .filter((t) => (filtroEstado === "Todas" ? true : filtroEstado === "Vencidas" ? tareas.esVencida(t) : t.estado === filtroEstado))
      .filter((t) => !filtroResp || nombreDe(t.responsable) === filtroResp)
      .reverse();
    if (!vistas.length) st.append(el("p", "fl-vacio", todas.length ? "Ninguna tarea cumple el filtro." : "Todavía no hay tareas. Se asignan en «Asignar Tareas»."));
    vistas.slice(0, 30).forEach((t) => {
      const it = el("div", "fl-hist-item");
      it.dataset.fila = String(t.no);
      it.append(el("div", "fl-hist-l2", "N.º " + t.no + " · " + t.nombre));
      it.append(el("div", "fl-hist-nota", "Asigna: " + nombreDe(t.asigna) + " · " + resumen(t)));
      if (t.adjunto) it.append(el("div", "fl-hist-nota", "Evidencia: " + t.adjunto));
      st.append(it);
    });
    if (vistas.length > 30) st.append(el("p", "fm-ayuda", "Se muestran 30 de " + vistas.length + "; use los filtros para acotar."));
    c.append(st);

    /* --- retirar completadas viejas --- */
    const admin = flujo.puedeAdministrar(yo.id);
    const n = tareas.retirables(yo.id, admin);
    if (n) {
      const sr = el("section", "fl-hist");
      sr.append(el("p", "fm-ayuda", n + " tarea(s) " + (admin ? "" : "asignada(s) por usted ") + "completada(s) hace " + tareas.DIAS_PARA_RETIRAR + " días o más se pueden retirar del registro."));
      if (confirmarRetiro) sr.append(mensaje("Se quitarán " + n + " tarea(s) del registro. No se pueden recuperar.", "aviso"));
      const b = el("button", "fl-btn fl-btn-sec", confirmarRetiro ? "Confirmar retiro" : "Retirar completadas antiguas");
      b.type = "button";
      b.dataset.accion = confirmarRetiro ? "confirmar-retiro" : "retirar";
      b.addEventListener("click", async () => {
        if (!confirmarRetiro) {
          confirmarRetiro = true;
          return pintar();
        }
        confirmarRetiro = false;
        const r = await tareas.retirarCompletadas({ por: yo.id, todas: admin });
        aviso = r.ok ? { texto: "Se retiraron " + r.retiradas + " tarea(s) del registro.", tipo: "ok" } : { texto: r.error, tipo: "error" };
        pintar();
      });
      sr.append(b);
      c.append(sr);
    }
    const a = el("a", "fm-ayuda", "Ver el video de ayuda");
    a.href = "https://www.auditool.org/blog/webinars1/video/n-gestor-de-tareas";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    c.append(a);
  };

  const formulario = (t, yo) => {
    const b = borrador || { estado: t.estado, progreso: t.progreso + "%", comentarios: t.comentarios, evidencia: t.adjunto };
    const f = el("form", "fm-form");
    const fEst = campo({ id: "estado", etiqueta: "Estado", tipo: "select", opciones: tareas.ESTADOS, valor: b.estado, requerido: true });
    const fProg = campo({ id: "progreso", etiqueta: "Avance (no puede bajar de " + t.progreso + "%)", tipo: "select", opciones: tareas.PROGRESOS_RESPUESTA.map((n) => n + "%"), valor: b.progreso, requerido: true });
    const fCom = campo({ id: "comentarios", etiqueta: "Comentarios", tipo: "textarea", valor: b.comentarios });
    const fEv = campo({ id: "evidencia", etiqueta: "Evidencia (nombre, ruta o enlace del archivo)", valor: b.evidencia, ayuda: "Solo se guarda la referencia; el archivo no se copia." });
    [fEst, fProg, fCom, fEv].forEach((x) => f.append(x.nodo));
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", "Guardar respuesta");
    g.type = "submit";
    g.dataset.accion = "guardar-respuesta";
    const x = el("button", "fl-btn fl-btn-sec", "Cancelar");
    x.type = "button";
    x.dataset.accion = "cancelar-respuesta";
    x.addEventListener("click", () => {
      abierta = null;
      borrador = null;
      pintar();
    });
    acc.append(g, x);
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const dato = { estado: fEst.valor(), progreso: fProg.valor(), comentarios: fCom.valor(), evidencia: fEv.valor() };
      const r = await tareas.responder(t.no, { ...dato, progreso: parseInt(dato.progreso, 10) }, { por: yo.id });
      if (r.ok) {
        abierta = null;
        borrador = null;
        aviso = { texto: "Se actualizó la tarea con éxito.", tipo: "ok" };
      } else {
        borrador = dato;
        aviso = { texto: r.error, tipo: "error" };
      }
      pintar();
    });
    return f;
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:tareas-cambio"]);
  pintar();
  return h;
}
