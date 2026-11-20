/*
 * AuditX — Firmar PT (M2-04)
 * Bandeja de firmas de la persona que actúa: los papeles que le toca firmar como Preparó, Revisó,
 * Supervisó o Aprobó. Firmar exige confirmar; devolver exige explicar el motivo. Se puede firmar varios a la vez.
 * Cada firma queda en el historial del papel con nombre, cargo y fecha.
 */

import flujo from "./flujo.js";
import { el, mensaje, selectorUsuario, enCambios } from "./ui.js";

/* global window, document */

const FIRMAS = ["enviar", "visto-bueno", "firmar"];

function pendientes(yo) {
  return flujo
    .pendientesDe(yo.id)
    .map((f) => {
      const acs = flujo.acciones(f.id, yo.id).filter((a) => a.disponible);
      const firma = acs.find((a) => FIRMAS.includes(a.accion));
      const devolver = acs.find((a) => a.accion === "devolver");
      return firma ? { f, firma, devolver } : null;
    })
    .filter(Boolean);
}

export function montarFirmar(c) {
  let aviso = null;
  let confirmando = null; // id del papel, o "lote"
  let devolviendo = null; // id del papel
  let borradorNota = "";
  const marcados = new Set();

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-04"), el("span", "fl-nombre", "Firmar papeles de trabajo"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    c.append(el("p", "fm-ayuda", "Su firma queda en el historial del papel con su nombre, cargo, fecha y hora."));
    if (aviso) c.append(mensaje(aviso.t, aviso.k));

    const lista = pendientes(yo);
    [...marcados].forEach((id) => !lista.some((x) => x.f.id === id) && marcados.delete(id));
    const rotulo = (x) => "Firmar como " + flujo.nombreRol(x.firma.rol);

    if (!lista.length) {
      c.append(el("p", "fl-vacio", "No tiene papeles por firmar en este momento."));
      c.append(el("p", "fm-ayuda", "Aparecen aquí los papeles que otra persona le envió a revisión o firma, y los que usted ya elaboró y puede firmar como preparó."));
      return;
    }

    /* --- firma por lote --- */
    if (lista.length > 1) {
      const lote = el("div", "fm-form");
      const sel = el("div", "fm-acciones");
      const todos = el("button", "fl-btn fl-btn-sec", marcados.size === lista.length ? "Quitar selección" : "Marcar todos");
      todos.type = "button";
      todos.dataset.accion = "marcar-todos";
      todos.addEventListener("click", () => {
        if (marcados.size === lista.length) marcados.clear();
        else lista.forEach((x) => marcados.add(x.f.id));
        pintar();
      });
      sel.append(todos);
      if (marcados.size) {
        const b = el("button", "fl-btn", "Firmar seleccionados (" + marcados.size + ")");
        b.type = "button";
        b.dataset.accion = "lote";
        b.addEventListener("click", () => {
          confirmando = "lote";
          pintar();
        });
        sel.append(b);
      }
      lote.append(sel);
      if (confirmando === "lote") {
        const q = el("div", "fm-form");
        q.append(el("p", "fl-msg", "Confirmo mi firma, " + yo.nombre + " (" + yo.cargo + "), en " + marcados.size + (marcados.size === 1 ? " papel." : " papeles.")));
        const acc = el("div", "fm-acciones");
        const ok = el("button", "fl-btn", "Confirmar firma");
        ok.type = "button";
        ok.dataset.accion = "confirmar-lote";
        ok.addEventListener("click", async () => {
          let hechos = 0;
          const fallos = [];
          for (const x of lista.filter((y) => marcados.has(y.f.id))) {
            const r = await flujo.ejecutar(x.f.id, x.firma.accion, { por: yo.id });
            if (r.ok) hechos++;
            else fallos.push(x.f.id + ": " + r.error);
          }
          marcados.clear();
          confirmando = null;
          aviso = fallos.length ? { t: "Se firmaron " + hechos + ". No se pudo firmar: " + fallos.join(" · "), k: "error" } : { t: "Se firmaron " + hechos + (hechos === 1 ? " papel." : " papeles."), k: "ok" };
          pintar();
        });
        const no = el("button", "fl-btn fl-btn-sec", "Cancelar");
        no.type = "button";
        no.addEventListener("click", () => {
          confirmando = null;
          pintar();
        });
        acc.append(ok, no);
        q.append(acc);
        lote.append(q);
      }
      c.append(lote);
    }

    /* --- tarjetas --- */
    const cont = el("div", "es-lista");
    lista.forEach((x) => {
      const f = x.f;
      const t = el("div", "fm-tarjeta");
      t.dataset.papel = f.id;
      const l1 = el("div", "fm-tarjeta-t");
      const nom = el("span", "es-nom");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = marcados.has(f.id);
      cb.dataset.campo = "marca-" + f.id;
      cb.setAttribute("aria-label", "Marcar " + f.id);
      cb.addEventListener("change", () => {
        if (cb.checked) marcados.add(f.id);
        else marcados.delete(f.id);
        pintar();
      });
      nom.append(cb, document.createTextNode(" "), el("strong", null, f.id + " "), document.createTextNode(f.etiqueta.replace(/^AA-\S+\s*/, "")));
      const pill = el("span", "fl-estado", f.estado);
      l1.append(nom, pill);
      t.append(l1);
      flujo.rolesActivos().forEach((r) => {
        const fila = el("div", "es-rol");
        fila.dataset.hecho = f.pasos[r.id] ? "1" : "";
        fila.append(el("span", "es-rol-t", (f.pasos[r.id] ? "✓ " : "· ") + r.nombre), el("span", null, f.asignados[r.id] ? flujo.persona(f.asignados[r.id]).nombre : "Sin asignar"));
        t.append(fila);
      });

      if (confirmando === f.id) {
        t.append(el("p", "fl-msg", "Confirmo mi firma como " + flujo.nombreRol(x.firma.rol) + ": " + yo.nombre + " (" + yo.cargo + ")."));
        const acc = el("div", "fm-acciones");
        const ok = el("button", "fl-btn", "Confirmar firma");
        ok.type = "button";
        ok.dataset.accion = "confirmar";
        ok.addEventListener("click", async () => {
          const r = await flujo.ejecutar(f.id, x.firma.accion, { por: yo.id });
          confirmando = null;
          aviso = r.ok ? { t: f.id + ": firmado como " + flujo.nombreRol(x.firma.rol) + ".", k: "ok" } : { t: r.error, k: "error" };
          pintar();
        });
        const no = el("button", "fl-btn fl-btn-sec", "Cancelar");
        no.type = "button";
        no.addEventListener("click", () => {
          confirmando = null;
          pintar();
        });
        acc.append(ok, no);
        t.append(acc);
      } else if (devolviendo === f.id) {
        const nota = el("textarea", "fl-nota");
        nota.rows = 3;
        nota.placeholder = "Motivo de la devolución (queda en el historial)";
        nota.value = borradorNota;
        nota.dataset.campo = "nota-" + f.id;
        nota.addEventListener("input", () => (borradorNota = nota.value));
        t.append(nota);
        const acc = el("div", "fm-acciones");
        const ok = el("button", "fl-btn", "Devolver");
        ok.type = "button";
        ok.dataset.accion = "confirmar-devolver";
        ok.addEventListener("click", async () => {
          const r = await flujo.ejecutar(f.id, "devolver", { por: yo.id, nota: borradorNota });
          if (r.ok) {
            devolviendo = null;
            borradorNota = "";
            aviso = { t: f.id + ": devuelto con comentario.", k: "ok" };
          } else aviso = { t: r.error, k: "error" };
          pintar();
        });
        const no = el("button", "fl-btn fl-btn-sec", "Cancelar");
        no.type = "button";
        no.addEventListener("click", () => {
          devolviendo = null;
          borradorNota = "";
          pintar();
        });
        acc.append(ok, no);
        t.append(acc);
      } else {
        const acc = el("div", "fm-acciones");
        const b = el("button", "fl-btn", rotulo(x));
        b.type = "button";
        b.dataset.accion = "firmar";
        b.addEventListener("click", () => {
          confirmando = f.id;
          devolviendo = null;
          aviso = null;
          pintar();
        });
        acc.append(b);
        if (x.devolver) {
          const d = el("button", "fl-btn fl-btn-sec", "Devolver…");
          d.type = "button";
          d.dataset.accion = "devolver";
          d.addEventListener("click", () => {
            devolviendo = f.id;
            confirmando = null;
            aviso = null;
            pintar();
          });
          acc.append(d);
        }
        const v = el("button", "fl-link", "Ver ficha");
        v.type = "button";
        v.addEventListener("click", () => window.AuditX.panel.abrirPapel(f.id));
        acc.append(v);
        t.append(acc);
      }
      cont.append(t);
    });
    c.append(cont);
  };
  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio"]);
  pintar();
  return h;
}
