/*
 * AuditX — Listado y documentación de alertas (M10-03)
 *   alertas        Listado de Alertas (todas, con filtros)
 *   alertas-doc    Documentación de Alertas (abiertas que le corresponden, listas para responder)
 */

/* global window */

import flujo from "./flujo.js";
import alertas, { TIPOS, RESPUESTAS } from "./alertas.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

function montar(modoDoc) {
  return (c) => {
    const filtros = { estado: modoDoc ? "Abierta" : "", tipo: "", mias: !!modoDoc };
    let abierta = null; // id de la alerta que se está documentando
    let aviso = null;
    let borrador = null;

    const pintar = () => {
      c.textContent = "";
      c.classList.add("fl");
      const h = el("div", "fl-tit");
      h.append(el("span", "fl-codigo", "M10-03"), el("span", "fl-nombre", modoDoc ? "Documentación de Alertas" : "Listado de Alertas"));
      c.append(h, selectorUsuario());
      const yo = flujo.usuarioActual();

      const barra = el("div", "es-fila2");
      const e = campo({ id: "al-estado", etiqueta: "Estado", tipo: "select", opciones: ["Todas", "Abierta", "Atendida"], valor: filtros.estado || "Todas" });
      e.ctrl.addEventListener("change", () => {
        filtros.estado = e.valor() === "Todas" ? "" : e.valor();
        lista();
      });
      const t = campo({ id: "al-tipo", etiqueta: "Tipo", tipo: "select", opciones: ["Todos", ...TIPOS], valor: filtros.tipo || "Todos" });
      t.ctrl.addEventListener("change", () => {
        filtros.tipo = t.valor() === "Todos" ? "" : t.valor();
        lista();
      });
      barra.append(e.nodo, t.nodo);
      c.append(barra);
      const l = el("label", "fm-check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = filtros.mias;
      cb.dataset.campo = "al-mias";
      cb.addEventListener("change", () => {
        filtros.mias = cb.checked;
        lista();
      });
      l.append(cb, el("span", null, "Solo las dirigidas a mí"));
      c.append(l);
      const zona = el("div");
      const cuenta = el("p", "fm-ayuda");
      const cont = el("div", "es-lista");
      c.append(zona, cuenta, cont);
      if (aviso) zona.append(mensaje(aviso.t, aviso.k));

      function lista() {
        const items = alertas.listar({ estado: filtros.estado, tipo: filtros.tipo, para: filtros.mias ? yo.id : "" });
        cuenta.textContent = items.length + " de " + alertas.total() + " alertas";
        cont.textContent = "";
        if (!items.length) cont.append(el("p", "fl-vacio", "No hay alertas con esos filtros."));
        items.forEach((a) => {
          const t2 = el("div", "fm-tarjeta");
          t2.dataset.alerta = a.id;
          const l1 = el("div", "fm-tarjeta-t");
          l1.append(el("span", "fm-chip", a.tipo), el("span", "fl-estado", a.estado));
          l1.lastChild.dataset.estado = a.estado === "Abierta" ? "vencido" : "firmado";
          t2.append(l1, el("div", "es-nom", a.descripcion));
          const para = a.para.map((p) => (flujo.persona(p) || { nombre: "" }).nombre).filter(Boolean).join(", ");
          t2.append(el("div", "fl-hist-l2", [fmtFecha(a.fecha), para ? "Para: " + para : ""].filter(Boolean).join(" · ")));
          if (a.estado === "Atendida") {
            const q = a.respondidaPor ? a.respondidaPor.nombre : "";
            t2.append(el("div", "fl-hist-nota", a.respuesta + (a.comentarios ? " — " + a.comentarios : "")), el("div", "fl-hist-l2", [q, fmtFecha(a.fechaRespuesta)].filter(Boolean).join(" · ")));
          } else if (alertas.puedeDocumentar(a, yo.id)) {
            if (abierta === a.id) t2.append(formulario(a, yo));
            else {
              const b = el("button", "fl-btn fl-btn-sec", "Documentar respuesta");
              b.type = "button";
              b.dataset.accion = "documentar";
              b.addEventListener("click", () => {
                abierta = a.id;
                borrador = null;
                aviso = null;
                pintar();
              });
              t2.append(b);
            }
          } else t2.append(el("div", "fl-hist-l2", flujo.puede(yo.id, "documentar-alertas") ? "Solo quien recibió la alerta, un supervisor o el socio pueden documentarla." : "Su perfil no puede documentar alertas."));
          if (a.papel) {
            const ver = el("button", "fl-link", "Ver papel " + a.papel);
            ver.type = "button";
            ver.addEventListener("click", () => window.AuditX.panel.abrirPapel(a.papel));
            t2.append(ver);
          }
          cont.append(t2);
        });
      }
      lista();
    };

    const formulario = (a, yo) => {
      const f = el("form", "fm-form");
      const r = campo({ id: "al-respuesta", etiqueta: "Respuesta", tipo: "select", opciones: RESPUESTAS, valor: (borrador || {}).respuesta || RESPUESTAS[0] });
      const k = campo({ id: "al-comentarios", etiqueta: "Comentarios adicionales", tipo: "textarea", valor: (borrador || {}).comentarios || "", ayuda: "Obligatorio si la respuesta es «Justificada» o «No procede»." });
      f.append(r.nodo, k.nodo);
      const acc = el("div", "fm-acciones");
      const g = el("button", "fl-btn", "Guardar respuesta");
      g.type = "submit";
      const x = el("button", "fl-btn fl-btn-sec", "Cancelar");
      x.type = "button";
      x.addEventListener("click", () => {
        abierta = null;
        borrador = null;
        pintar();
      });
      acc.append(g, x);
      f.append(acc);
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const dato = { respuesta: r.valor(), comentarios: k.valor() };
        const res = await alertas.responder(a.id, dato, { por: yo.id });
        if (res.ok) {
          abierta = null;
          borrador = null;
          aviso = { t: "Respuesta guardada.", k: "ok" };
        } else {
          borrador = dato;
          aviso = { t: res.error, k: "error" };
        }
        pintar();
      });
      return f;
    };

    const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:alertas-cambio"]);
    pintar();
    return h;
  };
}

export const montarAlertas = montar(false);
export const montarDocumentarAlertas = montar(true);
