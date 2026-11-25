/*
 * AuditX — Dashboard del proyecto (M10-01)
 * Avance por fase, pendientes de preparación o revisión, vencimientos y alertas, en tiempo real.
 * «Fase» = sección del índice (Pre-Planificación, Planificación, Sustantivas…).
 */

import flujo, { ESTADO } from "./flujo.js";
import proyecto from "./proyecto.js";
import alertas from "./alertas.js";
import { resumen, montarPendientes } from "./vista-estatus.js";
import { montarAlertas } from "./vista-alertas.js";
import { montarCronograma } from "./vista-cronograma.js";
import tareas from "./tareas.js";
import { el, selectorUsuario, enCambios } from "./ui.js";
import { montarDashboardTareas } from "./vista-tareas-dashboard.js";

/* global window */

const pct = (x) => (x * 100 < 10 && x > 0 ? (x * 100).toFixed(1) : String(Math.round(x * 100))) + "%";

export function montarDashboard(c) {
  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    const p = proyecto.proyecto();
    h.append(el("span", "fl-codigo", "M10-01"), el("span", "fl-nombre", "Dashboard del proyecto"));
    c.append(h);
    if (p.entidad) c.append(el("p", "fm-ayuda", p.entidad + (p.desde && p.hasta ? " · " + p.desde + " a " + p.hasta : "")));
    c.append(selectorUsuario());
    const yo = flujo.usuarioActual();
    const r = resumen();
    const todos = flujo.listar();

    /* --- indicadores --- */
    const kp = el("div", "es-kpis");
    [
      ["Avance", pct(r.avance)],
      ["Papeles en flujo", r.enFlujo],
      ["Me tocan", flujo.pendientesDe(yo.id).length],
      ["Alertas", alertas.abiertas(yo.id)],
    ].forEach(([t, v]) => {
      const k = el("div", "es-kpi");
      k.append(el("strong", null, String(v)), el("span", null, t));
      kp.append(k);
    });
    c.append(kp);

    /* --- estatus de los papeles (preparados, revisados, supervisados, aprobados) --- */
    const est = el("section", "fl-hist");
    est.dataset.seccion = "estatus-papeles";
    est.append(el("h3", null, "Estatus de los papeles de trabajo"));
    flujo.rolesActivos().forEach((rol) => {
      const n = r.filas.reduce((a, f) => a + (f[rol.id] || 0), 0);
      const f = el("div", "es-rol db-estado");
      f.dataset.rol = rol.id;
      f.append(el("span", "es-rol-t", { prepara: "Preparados", revisa: "Revisados", supervisa: "Supervisados", aprueba: "Aprobados" }[rol.id] || rol.nombre), el("strong", null, n + " de " + r.total));
      est.append(f);
    });
    c.append(est);

    /* --- equipo --- */
    const equipo = flujo.personas(true);
    const eq = el("section", "fl-hist");
    eq.dataset.seccion = "equipo";
    eq.append(el("h3", null, "Equipo (" + equipo.length + ")"));
    equipo.forEach((x) => {
      const f = el("div", "es-rol db-estado");
      f.append(el("span", "es-rol-t", x.nombre), el("span", null, flujo.nombrePerfil(x.perfil)));
      eq.append(f);
    });
    c.append(eq);

    /* --- tareas por estado --- */
    const ts = tareas.lista();
    const tr = el("section", "fl-hist");
    tr.dataset.seccion = "tareas";
    tr.append(el("h3", null, "Tareas por estado (" + ts.length + ")"));
    if (!ts.length) tr.append(el("p", "fl-vacio", "Aún no hay tareas registradas."));
    else
      tareas.ESTADOS.forEach((e) => {
        const f = el("div", "es-rol db-estado");
        f.append(el("span", "es-rol-t", e), el("strong", null, String(ts.filter((t) => t.estado === e).length)));
        tr.append(f);
      });
    const verT = el("button", "fl-btn fl-btn-sec", "Ver dashboard de tareas");
    verT.type = "button";
    verT.dataset.accion = "ver-tareas";
    verT.addEventListener("click", () => window.AuditX.panel.abrirVista("tareas-dashboard", montarDashboardTareas, { apilar: true }));
    tr.append(verT);
    c.append(tr);

    /* --- avance por fase --- */
    const fases = el("section", "fl-hist");
    fases.append(el("h3", null, "Avance por fase"));
    r.filas.forEach((f) => {
      const fila = el("div", "db-fase");
      fila.dataset.fase = f.seccion;
      const t = el("div", "es-rol");
      t.append(el("span", "es-rol-t", f.seccion), el("span", null, f.aprueba + " de " + f.total + " aprobados"));
      const barra = el("div", "es-barra");
      const prep = el("div", "db-prep");
      prep.style.width = (f.total ? (f.prepara / f.total) * 100 : 0) + "%";
      const apr = el("div", "db-apr");
      apr.style.width = (f.total ? (f.aprueba / f.total) * 100 : 0) + "%";
      barra.append(prep, apr);
      fila.append(t, barra);
      fases.append(fila);
    });
    fases.append(el("p", "fm-ayuda", "Verde: aprobado. Claro: ya preparado, falta revisar o firmar."));
    c.append(fases);

    /* --- pendientes de preparación o revisión --- */
    const cuentas = (...estados) => todos.filter((f) => estados.includes(f.estado)).length;
    const pen = el("section", "fl-hist");
    pen.append(el("h3", null, "Pendientes de preparación o revisión"));
    [
      ["Por preparar", cuentas(ESTADO.PENDIENTE, ESTADO.ELABORACION)],
      ["Devueltos", cuentas(ESTADO.DEVUELTO)],
      ["En revisión", cuentas(ESTADO.REVISION)],
      ["Por firmar", cuentas(ESTADO.REVISADO)],
      ["Firmados", cuentas(ESTADO.FIRMADO)],
    ].forEach(([t, n]) => {
      const f = el("div", "es-rol db-estado");
      f.dataset.estado = t;
      f.append(el("span", "es-rol-t", t), el("strong", null, String(n)));
      pen.append(f);
    });
    const verP = el("button", "fl-btn fl-btn-sec", "Ver papeles pendientes");
    verP.type = "button";
    verP.dataset.accion = "ver-pendientes";
    verP.addEventListener("click", () => window.AuditX.panel.abrirVista("pendientes-firma", montarPendientes, { apilar: true }));
    pen.append(verP);
    c.append(pen);

    /* --- vencimientos --- */
    const hoy = proyecto.hoyISO();
    const prox = proyecto
      .agenda()
      .filter((x) => (x.fecha >= hoy && alertas.diasHasta(x.fecha) <= 14) || (x.origen === "papel" && x.vencido))
      .slice(0, 6);
    const ven = el("section", "fl-hist");
    ven.append(el("h3", null, "Vencimientos y próximas fechas"));
    if (!prox.length) ven.append(el("p", "fl-vacio", "Nada vence en los próximos 14 días."));
    prox.forEach((x) => {
      const f = el("div", "es-rol db-venc");
      f.append(el("span", x.vencido ? "es-rol-t db-rojo" : "es-rol-t", x.titulo), el("span", null, x.fecha));
      ven.append(f);
    });
    const verC = el("button", "fl-btn fl-btn-sec", "Ver cronograma");
    verC.type = "button";
    verC.dataset.accion = "ver-cronograma";
    verC.addEventListener("click", () => window.AuditX.panel.abrirVista("cronograma", montarCronograma, { apilar: true }));
    ven.append(verC);
    c.append(ven);

    /* --- alertas --- */
    const abiertas = alertas.listar({ estado: "Abierta" });
    const al = el("section", "fl-hist");
    al.append(el("h3", null, "Alertas abiertas (" + abiertas.length + ")"));
    abiertas.slice(0, 3).forEach((a) => al.append(el("div", "fl-hist-item", a.tipo + ": " + a.descripcion)));
    const verA = el("button", "fl-btn fl-btn-sec", "Ver alertas");
    verA.type = "button";
    verA.dataset.accion = "ver-alertas";
    verA.addEventListener("click", () => window.AuditX.panel.abrirVista("alertas", montarAlertas, { apilar: true }));
    al.append(verA);
    c.append(al);
  };
  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio", "auditx:alertas-cambio", "auditx:proyecto-cambio", "auditx:tareas-cambio"]);
  pintar();
  return h;
}
