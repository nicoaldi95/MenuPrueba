/*
 * AuditX — Ficha de flujo de un papel
 *
 * Muestra, para un papel: estado, responsables, fechas, acciones disponibles e historial.
 * Es un componente reutilizable: cada cuestionario (AA-01, AA-02, AA-03…) la monta en la
 * parte superior de su propia vista con   window.AuditX.flujo.montarFicha(contenedor, id)
 */

import flujo, { ESTADO } from "./flujo.js";
import { montarComentarios } from "./vista-comentarios.js";

/* global document, window */

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

const fmtFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};

export function montarFicha(contenedor, id, opciones = {}) {
  contenedor.textContent = "";
  contenedor.classList.add("fl");
  let mensaje = null; // { texto, tipo }
  let notaAbierta = null; // accion que espera motivo

  const pintar = () => {
    const f = flujo.ficha(id);
    const usuario = flujo.usuarioActual();
    contenedor.textContent = "";

    /* --- encabezado --- */
    const cab = el("div", "fl-cab");
    const tit = el("div", "fl-tit");
    tit.append(el("span", "fl-codigo", f.codigo), el("span", "fl-nombre", f.etiqueta));
    const pill = el("span", "fl-estado", f.vencido ? f.estado + " · vencido" : f.estado);
    pill.dataset.estado = f.vencido ? "vencido" : f.estado === ESTADO.FIRMADO ? "firmado" : f.estado === ESTADO.REVISION ? "revision" : f.estado === ESTADO.DEVUELTO ? "devuelto" : "";
    cab.append(tit, pill);
    contenedor.append(cab);

    /* --- quién actúa --- */
    const act = el("label", "fl-actua");
    act.append(el("span", null, "Actuando como"));
    const sel = el("select", "fl-select");
    flujo.personas(true).forEach((p) => {
      const o = el("option", null, p.nombre + " · " + p.cargo);
      o.value = p.id;
      if (usuario && p.id === usuario.id) o.selected = true;
      sel.append(o);
    });
    sel.addEventListener("change", () => flujo.cambiarUsuario(sel.value));
    act.append(sel);
    contenedor.append(act);

    /* --- etapas --- */
    const etapas = el("ol", "fl-etapas");
    const pasos = [{ rol: "prepara", titulo: "Elaboración" }].concat(
      flujo.rolesActivos().filter((r) => r.id !== "prepara" && r.id !== "aprueba").map((r) => ({ rol: r.id, titulo: r.accion })),
      [{ rol: "aprueba", titulo: "Firma" }]
    );
    const orden = ["prepara", ...flujo.rolesActivos().filter((r) => r.id !== "prepara" && r.id !== "aprueba").map((r) => r.id), "aprueba"];
    const actual =
      f.estado === ESTADO.PENDIENTE ? -1
      : f.estado === ESTADO.ELABORACION || f.estado === ESTADO.DEVUELTO ? 0
      : f.estado === ESTADO.REVISION ? orden.indexOf(f.etapa)
      : f.estado === ESTADO.REVISADO ? orden.length - 1
      : orden.length; // firmado: todo completo
    pasos.forEach((p, i) => {
      const li = el("li", "fl-etapa");
      li.dataset.estado = i < actual ? "hecho" : i === actual ? "actual" : "";
      li.append(el("span", "fl-etapa-t", p.titulo));
      const quien = f.asignados[p.rol];
      li.append(el("span", "fl-etapa-p", quien ? flujo.persona(quien).nombre : "Sin asignar"));
      etapas.append(li);
    });
    contenedor.append(etapas);

    /* --- responsables --- */
    const resp = el("details", "fl-bloque");
    resp.append(el("summary", null, "Responsables y fechas"));
    flujo.rolesActivos().forEach((r) => {
      const fila = el("label", "fl-fila");
      fila.append(el("span", null, r.nombre));
      const s = el("select", "fl-select");
      const v = el("option", null, "Sin asignar");
      v.value = "";
      s.append(v);
      flujo.personas(true).filter((p) => p.roles.includes(r.id)).forEach((p) => {
        const o = el("option", null, p.nombre);
        o.value = p.id;
        if (f.asignados[r.id] === p.id) o.selected = true;
        s.append(o);
      });
      s.addEventListener("change", async () => {
        const res = await flujo.asignar(id, r.id, s.value, { por: usuario.id });
        if (!res.ok) mensaje = { texto: res.error, tipo: "error" };
        else mensaje = null;
        pintar();
      });
      fila.append(s);
      resp.append(fila);
    });
    [["programada", "Fecha programada"], ["vence", "Vence"]].forEach(([k, t]) => {
      const fila = el("label", "fl-fila");
      fila.append(el("span", null, t));
      const i = el("input", "fl-fecha");
      i.type = "date";
      i.value = f.fechas[k] || "";
      i.addEventListener("change", async () => {
        const res = await flujo.fijarFechas(id, { [k]: i.value }, { por: usuario.id });
        mensaje = res.ok ? null : { texto: res.error, tipo: "error" };
        pintar();
      });
      fila.append(i);
      resp.append(fila);
    });
    contenedor.append(resp);

    /* --- acciones --- */
    const acciones = flujo.acciones(id, usuario.id);
    const zona = el("div", "fl-acciones");
    const disponibles = acciones.filter((a) => a.disponible);
    disponibles.forEach((a) => {
      const b = el("button", "fl-btn" + (a.peligro ? " fl-btn-sec" : ""), a.etiqueta);
      b.type = "button";
      b.dataset.accion = a.accion;
      b.addEventListener("click", async () => {
        if (a.requiereNota && notaAbierta !== a.accion) {
          notaAbierta = a.accion;
          mensaje = null;
          return pintar();
        }
        const nota = contenedor.querySelector(".fl-nota") ? contenedor.querySelector(".fl-nota").value : "";
        const res = await flujo.ejecutar(id, a.accion, { por: usuario.id, nota });
        if (res.ok) {
          notaAbierta = null;
          mensaje = { texto: flujo.etiquetaAccion(a.accion) + ".", tipo: "ok" };
        } else mensaje = { texto: res.error, tipo: "error" };
        pintar();
      });
      zona.append(b);
    });
    if (notaAbierta && disponibles.some((a) => a.accion === notaAbierta)) {
      const t = el("textarea", "fl-nota");
      t.rows = 3;
      t.placeholder = "Motivo (queda en el historial)";
      zona.append(t);
    }
    if (!disponibles.length) {
      const motivo = acciones.find((a) => a.motivo);
      zona.append(el("p", "fl-espera", motivo ? motivo.motivo : "No hay acciones disponibles."));
    } else {
      acciones.filter((a) => !a.disponible && a.motivo).slice(0, 1).forEach((a) => zona.append(el("p", "fl-espera", a.motivo)));
    }
    contenedor.append(zona);

    if (mensaje) {
      const m = el("p", "fl-msg", mensaje.texto);
      m.dataset.tipo = mensaje.tipo;
      m.setAttribute("role", "status");
      contenedor.append(m);
    }

    /* --- prueba de contenido (solo mientras los cuestionarios no estén conectados) --- */
    if (opciones.cambioManual) {
      const man = el("button", "fl-link", "Modifiqué la hoja: registrar el cambio");
      man.type = "button";
      man.dataset.accion = "cambio-manual";
      man.addEventListener("click", async () => {
        const res = await flujo.registrarCambio(id, { por: usuario.id, resumen: "Se modificó la hoja de Excel." });
        mensaje = res.cambio ? { texto: "Cambio registrado: el papel volvió a elaboración.", tipo: "aviso" } : { texto: "Cambio registrado; el estado no se altera.", tipo: "ok" };
        pintar();
      });
      contenedor.append(man);
    }
    if (opciones.simularContenido !== false) {
      const demo = el("button", "fl-link", "Simular que se modificó el contenido del papel");
      demo.type = "button";
      demo.addEventListener("click", async () => {
        const res = await flujo.registrarCambio(id, { por: usuario.id, resumen: "Se editó el contenido." });
        mensaje = res.cambio ? { texto: "El papel volvió a elaboración.", tipo: "aviso" } : { texto: "El contenido cambió; el estado no se altera.", tipo: "ok" };
        pintar();
      });
      contenedor.append(demo);
    }

    /* --- comentarios del papel --- */
    const zc = el("section");
    contenedor.append(zc);
    montarComentarios(zc, id);

    /* --- historial --- */
    const hist = el("section", "fl-hist");
    hist.append(el("h3", null, "Historial · quién y cómo"));
    if (!f.historial.length) hist.append(el("p", "fl-vacio", "Todavía no hay movimientos."));
    f.historial.forEach((h) => {
      const it = el("div", "fl-hist-item");
      const linea = el("div", "fl-hist-l1");
      linea.append(el("strong", null, h.por.nombre), el("span", null, " " + flujo.etiquetaAccion(h.accion).toLowerCase()));
      it.append(linea);
      const l2 = el("div", "fl-hist-l2", [h.por.cargo, fmtFecha(h.fecha), h.de !== h.a ? h.de + " → " + h.a : ""].filter(Boolean).join(" · "));
      it.append(l2);
      if (h.nota) it.append(el("div", "fl-hist-nota", h.nota));
      hist.append(it);
    });
    contenedor.append(hist);
  };

  const alCambiar = () => {
    if (contenedor.isConnected) pintar();
    else limpiar();
  };
  const escuchar = ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:comentarios-cambio", "auditx:flujo-cambio"];
  const limpiar = () => escuchar.forEach((e) => document.removeEventListener(e, alCambiar));
  escuchar.forEach((e) => document.addEventListener(e, alCambiar));

  pintar();
  return { actualizar: pintar, destruir: limpiar };
}
