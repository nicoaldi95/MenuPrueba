/*
 * AuditX — Personalizar Botones (M1-02)
 * Cambia cómo se llama cada papel en el menú. El código (AA-01) y el funcionamiento no cambian.
 * Solo la ven y la usan los perfiles con el permiso «Personalizar botones» de la matriz.
 */

import flujo from "./flujo.js";
import nombres from "./nombres.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

export function montarPersonalizar(c) {
  let aviso = null;
  let confirmarTodos = false;
  let borrador = {}; // lo escrito, para no perderlo si hay un error

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M1-02"), el("span", "fl-nombre", "Personalizar Botones"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    if (!flujo.puede(yo.id, "personalizar-botones")) {
      c.append(mensaje("Su perfil no puede personalizar los botones.", "aviso"));
      return;
    }
    const lista = nombres.lista();
    const hechos = lista.filter((b) => b.personalizado).length;
    c.append(el("p", "fm-ayuda", "Cambie cómo se llama cada papel en el menú. El código (por ejemplo AA-01) y el funcionamiento no cambian, así que el historial, las firmas y los avisos siguen igual."));
    c.append(el("p", "fm-ayuda", lista.length + " papeles · " + hechos + (hechos === 1 ? " con nombre personalizado" : " con nombre personalizado")));
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    const f = el("form", "fm-form");
    const refs = [];
    let seccion = null;
    lista.forEach((b) => {
      if (b.seccion !== seccion) {
        seccion = b.seccion;
        f.append(el("strong", null, seccion));
      }
      const fila = el("div", "fm-papel");
      fila.dataset.papel = b.id;
      const x = campo({ id: b.id, etiqueta: b.codigo, valor: borrador[b.id] != null ? borrador[b.id] : b.actual, ayuda: b.personalizado ? "Original: " + b.original : "" });
      refs.push([b.id, x]);
      fila.append(x.nodo);
      if (b.personalizado) {
        const r = el("button", "fl-btn fl-btn-sec", "Restablecer");
        r.type = "button";
        r.dataset.accion = "restablecer";
        r.addEventListener("click", async () => {
          const res = await nombres.restablecer(b.id, { por: yo.id });
          delete borrador[b.id];
          aviso = res.ok ? { texto: b.codigo + " volvió a su nombre original.", tipo: "ok" } : { texto: res.error, tipo: "error" };
          pintar();
        });
        fila.append(r);
      }
      f.append(fila);
    });
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", "Guardar nombres");
    g.type = "submit";
    acc.append(g);
    if (hechos) {
      const t = el("button", "fl-btn fl-btn-sec", confirmarTodos ? "Confirmar: restablecer todos" : "Restablecer todos");
      t.type = "button";
      t.dataset.accion = confirmarTodos ? "confirmar-restablecer-todos" : "restablecer-todos";
      t.addEventListener("click", async () => {
        if (!confirmarTodos) {
          confirmarTodos = true;
          pintar();
          return;
        }
        const res = await nombres.restablecerTodos({ por: yo.id });
        confirmarTodos = false;
        borrador = {};
        aviso = res.ok ? { texto: "Todos los botones volvieron a sus nombres originales.", tipo: "ok" } : { texto: res.error, tipo: "error" };
        pintar();
      });
      acc.append(t);
    }
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      confirmarTodos = false;
      const cambios = {};
      refs.forEach(([id, x]) => (cambios[id] = x.valor()));
      const res = await nombres.guardar(cambios, { por: yo.id });
      if (res.ok) {
        borrador = {};
        aviso = { texto: res.cambiados ? "Nombres actualizados (" + res.cambiados + ")." : "No hay cambios que guardar.", tipo: "ok" };
      } else {
        borrador = cambios;
        aviso = { texto: res.error, tipo: "error" };
      }
      pintar();
    });
    c.append(f);

    const hist = nombres.historial();
    const sec = el("section", "fl-hist");
    sec.append(el("h3", null, "Cambios registrados"));
    if (!hist.length) sec.append(el("p", "fl-vacio", "Todavía no hay cambios."));
    hist.slice(0, 8).forEach((x) => {
      const it = el("div", "fl-hist-item");
      const l1 = el("div", "fl-hist-l1");
      l1.append(el("strong", null, x.por.nombre), el("span", null, " modificó"));
      it.append(l1, el("div", "fl-hist-l2", [x.por.cargo, fmtFecha(x.fecha)].filter(Boolean).join(" · ")));
      x.cambios.forEach((t) => it.append(el("div", "fl-hist-nota", t)));
      sec.append(it);
    });
    c.append(sec);
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:nombres-cambio"]);
  pintar();
  return h;
}
