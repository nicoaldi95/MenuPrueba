/*
 * AuditX — Cronograma del encargo (M8-07)
 * Fechas clave (planificación, pre-cierre, cierre), visitas, hitos y vencimientos de papeles en una sola agenda.
 * Las fechas clave quedan disponibles para todos los papeles: window.AuditX.proyecto.cronograma().
 */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import alertas from "./alertas.js";
import { el, campo, mensaje, selectorUsuario, enCambios } from "./ui.js";

/* global document */

const fmtDia = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" });
};
const fmtMes = (iso) => {
  const [a, m] = iso.split("-").map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function montarCronograma(c) {
  let aviso = null;
  let edicion = null; // null | "nuevo" | id
  let borrador = null;
  let verPasados = false;

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M8-07"), el("span", "fl-nombre", "CR-Cronograma de la auditoría"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    const puede = flujo.puedeAsignar(yo.id);
    if (!puede) c.append(mensaje("Solo supervisores y socios modifican el cronograma. Usted puede consultarlo.", "aviso"));

    /* --- fechas clave --- */
    const cr = proyecto.cronograma();
    const bloque = el("details", "fl-bloque");
    bloque.open = true;
    bloque.append(el("summary", null, "Fechas clave del encargo"));
    const form = el("form", "fm-form");
    const filas = cr.fechasClave.map((x) => {
      const fila = el("div", "cr-clave");
      const l = el("label", "fm-check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = x.aplica;
      cb.disabled = !puede;
      cb.dataset.campo = "aplica-" + x.id;
      l.append(cb, el("span", null, "Aplica"));
      const f = campo({ id: "clave-" + x.id, etiqueta: x.etiqueta, tipo: "date", valor: x.fecha, deshabilitado: !puede });
      cb.addEventListener("change", () => (f.ctrl.disabled = !cb.checked || !puede));
      f.ctrl.disabled = !x.aplica || !puede;
      fila.append(f.nodo, l);
      form.append(fila);
      return { x, cb, f };
    });
    if (cr.cierreAnterior) form.append(el("p", "fm-ayuda", "Cierre del año anterior (calculado): " + cr.cierreAnterior));
    if (puede) {
      const g = el("button", "fl-btn", "Guardar fechas clave");
      g.type = "submit";
      form.append(g);
    }
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const res = await proyecto.guardarFechasClave(filas.map(({ x, cb, f }) => ({ ...x, aplica: cb.checked, fecha: cb.checked ? f.valor() : x.fecha })), { por: yo.id });
      aviso = res.ok ? { t: "Fechas clave guardadas.", k: "ok" } : { t: res.error, k: "error" };
      pintar();
    });
    bloque.append(form);
    c.append(bloque);
    if (aviso) c.append(mensaje(aviso.t, aviso.k));

    /* --- evento --- */
    if (puede && !edicion) {
      const n = el("button", "fl-btn fl-btn-sec", "Agregar visita o hito");
      n.type = "button";
      n.dataset.accion = "nuevo-evento";
      n.addEventListener("click", () => {
        edicion = "nuevo";
        borrador = null;
        aviso = null;
        pintar();
      });
      c.append(n);
    }
    if (edicion) c.append(formularioEvento(yo));

    /* --- agenda --- */
    const hoy = proyecto.hoyISO();
    let items = proyecto.agenda();
    const pasados = items.filter((x) => x.fecha < hoy && !(x.origen === "papel" && x.vencido));
    if (!verPasados) items = items.filter((x) => !(x.fecha < hoy && !(x.origen === "papel" && x.vencido)));
    const sec = el("section", "fl-hist");
    sec.append(el("h3", null, "Agenda"));
    const l = el("label", "fm-check");
    const cbp = el("input");
    cbp.type = "checkbox";
    cbp.checked = verPasados;
    cbp.dataset.campo = "ver-pasados";
    cbp.addEventListener("change", () => {
      verPasados = cbp.checked;
      pintar();
    });
    l.append(cbp, el("span", null, "Incluir fechas pasadas (" + pasados.length + ")"));
    sec.append(l);
    if (!items.length) sec.append(el("p", "fl-vacio", "No hay fechas próximas. Agregue las fechas clave o una visita."));
    let mes = "";
    items.forEach((x) => {
      if (fmtMes(x.fecha) !== mes) {
        mes = fmtMes(x.fecha);
        sec.append(el("div", "cr-mes", mes));
      }
      const it = el("div", "cr-item");
      it.dataset.origen = x.origen;
      const dias = alertas.diasHasta(x.fecha);
      const cuando = dias < 0 ? "Hace " + -dias + (dias === -1 ? " día" : " días") : dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : "En " + dias + " días";
      const l1 = el("div", "fm-tarjeta-t");
      l1.append(el("strong", null, fmtDia(x.fecha)), el("span", "fl-estado", cuando));
      l1.lastChild.dataset.estado = dias < 0 ? "vencido" : dias <= 7 ? "revision" : "";
      it.append(l1, el("div", "es-nom", x.titulo));
      const sub = [x.tipo, x.fechaFin ? "hasta " + fmtDia(x.fechaFin) : "", x.responsable ? (flujo.persona(x.responsable) || { nombre: "" }).nombre : ""].filter(Boolean).join(" · ");
      it.append(el("div", "fl-hist-l2", sub));
      if (x.notas) it.append(el("div", "fl-hist-nota", x.notas));
      if (puede && x.origen === "evento") {
        const acc = el("div", "fm-acciones");
        const b1 = el("button", "fl-btn fl-btn-sec", "Editar");
        b1.type = "button";
        b1.dataset.accion = "editar-evento";
        b1.addEventListener("click", () => {
          edicion = x.id;
          borrador = null;
          aviso = null;
          pintar();
        });
        const b2 = el("button", "fl-btn fl-btn-sec", "Eliminar");
        b2.type = "button";
        b2.dataset.accion = "eliminar-evento";
        b2.addEventListener("click", async () => {
          const res = await proyecto.eliminarEvento(x.id, { por: yo.id });
          aviso = res.ok ? { t: "Evento eliminado.", k: "ok" } : { t: res.error, k: "error" };
          pintar();
        });
        acc.append(b1, b2);
        it.append(acc);
      }
      sec.append(it);
    });
    c.append(sec);
    c.append(el("p", "fm-ayuda", "Los vencimientos de los papeles se toman de la ficha de cada papel. La sincronización con el calendario de Teams y Outlook queda para una fase posterior."));
  };

  const formularioEvento = (yo) => {
    const base = edicion === "nuevo" ? { titulo: "", tipo: proyecto.TIPOS_EVENTO[0], fecha: "", fechaFin: "", responsable: "", notas: "" } : proyecto.cronograma().eventos.find((x) => x.id === edicion);
    const v = borrador || base;
    const f = el("form", "fm-form");
    f.append(el("strong", null, edicion === "nuevo" ? "Nueva visita o hito" : "Editar evento"));
    const t = campo({ id: "ev-titulo", etiqueta: "Título", valor: v.titulo, requerido: true });
    const tp = campo({ id: "ev-tipo", etiqueta: "Tipo", tipo: "select", opciones: proyecto.TIPOS_EVENTO, valor: v.tipo });
    const fe = campo({ id: "ev-fecha", etiqueta: "Fecha", tipo: "date", valor: v.fecha, requerido: true });
    const ff = campo({ id: "ev-fin", etiqueta: "Hasta (opcional)", tipo: "date", valor: v.fechaFin });
    const personas = flujo.personas(true);
    const r = campo({ id: "ev-resp", etiqueta: "Responsable", tipo: "select", opciones: ["Sin responsable", ...personas.map((p) => p.nombre)], valor: (personas.find((p) => p.id === v.responsable) || { nombre: "Sin responsable" }).nombre });
    const n = campo({ id: "ev-notas", etiqueta: "Notas", tipo: "textarea", valor: v.notas });
    f.append(t.nodo, tp.nodo, fe.nodo, ff.nodo, r.nodo, n.nodo);
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", "Guardar");
    g.type = "submit";
    const x = el("button", "fl-btn fl-btn-sec", "Cancelar");
    x.type = "button";
    x.addEventListener("click", () => {
      edicion = null;
      borrador = null;
      pintar();
    });
    acc.append(g, x);
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const dato = { id: edicion === "nuevo" ? "" : edicion, titulo: t.valor(), tipo: tp.valor(), fecha: fe.valor(), fechaFin: ff.valor(), responsable: (personas.find((p) => p.nombre === r.valor()) || { id: "" }).id, notas: n.valor() };
      const res = await proyecto.guardarEvento(dato, { por: yo.id });
      if (res.ok) {
        edicion = null;
        borrador = null;
        aviso = { t: "Evento guardado.", k: "ok" };
      } else {
        borrador = dato;
        aviso = { t: res.error, k: "error" };
      }
      pintar();
    });
    return f;
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio"]);
  pintar();
  return h;
}
