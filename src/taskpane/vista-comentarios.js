/*
 * AuditX — Comentarios PT (M2-05)
 *   montarComentarios(contenedor, papelId)   bloque que se incrusta en la ficha de cada papel
 *   montarComentariosPT(contenedor)          vista general con filtros (como la hoja «Comentarios PT»)
 */

import flujo from "./flujo.js";
import comentarios, { GENERAL } from "./comentarios.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

/* global document */

function tarjeta(c, yo, alAccion, mostrarPapel) {
  const t = el("div", "cm-item");
  t.dataset.estado = c.cerrado ? "cerrado" : "abierto";
  t.dataset.id = c.id;
  const l1 = el("div", "cm-l1");
  l1.append(el("strong", null, c.id), el("span", "cm-pill", c.cerrado ? "Cerrado" : "Abierto"));
  if (mostrarPapel) l1.append(el("span", "cm-papel", c.papel));
  t.append(l1);
  t.append(el("div", "cm-l2", c.de.nombre + " → " + c.para.nombre + " · " + fmtFecha(c.fecha)));
  t.append(el("div", "cm-texto", c.texto));
  if (c.cerrado) {
    t.append(el("div", "cm-l2", "Cerrado por " + c.cerradoPor.nombre + " · " + fmtFecha(c.fechaCierre) + (c.respuesta ? " — «" + c.respuesta + "»" : "")));
  } else if (comentarios.puedeCerrar(c, yo.id)) {
    const r = el("input", "fm-texto");
    r.placeholder = "Respuesta (opcional)";
    r.dataset.campo = "cm-resp";
    const b = el("button", "fl-btn fl-btn-sec", "Cerrar comentario");
    b.type = "button";
    b.dataset.accion = "cerrar-comentario";
    b.addEventListener("click", () => alAccion(c.id, r.value));
    t.append(r, b);
  }
  return t;
}

/* Lista + formulario. Si `papel` viene fijo, el comentario siempre es de ese papel. */
function bloque(cont, { papel, titulo }) {
  let aviso = null;
  let borrador = { texto: "", para: "", papel: papel || GENERAL };
  const filtros = { estado: papel ? "" : "abierto", papel: "", mios: false };

  const pintar = () => {
    cont.textContent = "";
    const yo = flujo.usuarioActual();
    const todos = comentarios.listar({ papel: papel || filtros.papel, estado: filtros.estado, para: filtros.mios ? yo.id : "" });
    const abiertos = comentarios.listar({ papel: papel || undefined, estado: "abierto" }).length;

    if (titulo) {
      const h = el("h3", "cm-tit", titulo + (abiertos ? " · " + abiertos + (abiertos === 1 ? " abierto" : " abiertos") : ""));
      cont.append(h);
    }

    if (!papel) {
      const barra = el("div", "es-fila2");
      const e = campo({ id: "cm-estado", etiqueta: "Estado", tipo: "select", opciones: ["Abiertos", "Cerrados", "Todos"], valor: { abierto: "Abiertos", cerrado: "Cerrados", "": "Todos" }[filtros.estado] });
      e.ctrl.addEventListener("change", () => {
        filtros.estado = { Abiertos: "abierto", Cerrados: "cerrado", Todos: "" }[e.valor()];
        pintar();
      });
      const opP = ["Todos los papeles", GENERAL, ...flujo.papeles().map((p) => p.id)];
      const p = campo({ id: "cm-filtro-papel", etiqueta: "Papel", tipo: "select", opciones: opP, valor: filtros.papel || "Todos los papeles" });
      p.ctrl.addEventListener("change", () => {
        filtros.papel = p.valor() === "Todos los papeles" ? "" : p.valor();
        pintar();
      });
      barra.append(e.nodo, p.nodo);
      cont.append(barra);
      const l = el("label", "fm-check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = filtros.mios;
      cb.dataset.campo = "cm-mios";
      cb.addEventListener("change", () => {
        filtros.mios = cb.checked;
        pintar();
      });
      l.append(cb, el("span", null, "Solo los dirigidos a mí"));
      cont.append(l);
    }

    cont.append(el("p", "fm-ayuda", todos.length + (todos.length === 1 ? " comentario" : " comentarios")));
    if (!todos.length) cont.append(el("p", "fl-vacio", "No hay comentarios para mostrar."));
    todos.forEach((c) =>
      cont.append(
        tarjeta(c, yo, async (id, respuesta) => {
          const res = await comentarios.cerrar(id, { por: yo.id, respuesta });
          aviso = res.ok ? null : { t: res.error, k: "error" };
          pintar();
        }, !papel)
      )
    );

    /* --- nuevo comentario --- */
    const form = el("form", "cm-form");
    form.append(el("h4", null, "Nuevo comentario"));
    let cP = null;
    if (!papel) {
      cP = campo({ id: "cm-papel", etiqueta: "Papel", tipo: "select", opciones: [GENERAL, ...flujo.papeles().map((p) => p.id)], valor: borrador.papel });
      form.append(cP.nodo);
    }
    const personas = flujo.personas(true).filter((p) => p.id !== yo.id);
    const cD = campo({ id: "cm-para", etiqueta: "Para", tipo: "select", opciones: ["Elija…", ...personas.map((p) => p.nombre)], valor: (personas.find((p) => p.id === borrador.para) || { nombre: "Elija…" }).nombre });
    const cT = campo({ id: "cm-texto", etiqueta: "Comentario", tipo: "textarea", valor: borrador.texto });
    form.append(cD.nodo, cT.nodo);
    if (aviso) form.append(mensaje(aviso.t, aviso.k));
    const b = el("button", "fl-btn", "Enviar comentario");
    b.type = "submit";
    form.append(b);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const dest = personas.find((p) => p.nombre === cD.valor());
      borrador = { texto: cT.valor(), para: dest ? dest.id : "", papel: cP ? cP.valor() : papel };
      const res = await comentarios.agregar({ papel: borrador.papel, para: borrador.para, texto: borrador.texto }, { por: yo.id });
      if (res.ok) {
        borrador = { texto: "", para: "", papel: borrador.papel };
        aviso = { t: "Comentario enviado a " + res.comentario.para.nombre + ".", k: "ok" };
      } else aviso = { t: res.error, k: "error" };
      pintar();
    });
    cont.append(form);
  };

  pintar();
  return enCambios(cont, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:comentarios-cambio"]);
}

export function montarComentarios(cont, papelId) {
  cont.classList.add("cm");
  return bloque(cont, { papel: papelId, titulo: "Comentarios" });
}

export function montarComentariosPT(c) {
  c.textContent = "";
  c.classList.add("fl");
  const h = el("div", "fl-tit");
  h.append(el("span", "fl-codigo", "M2-05"), el("span", "fl-nombre", "Comentarios PT"));
  c.append(h, selectorUsuario());
  const zona = el("div", "cm");
  c.append(zona);
  return bloque(zona, { papel: null, titulo: "" });
}
