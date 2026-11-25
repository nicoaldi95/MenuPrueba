/*
 * AuditX — Registro de comunicaciones (M2-11)
 * Registrar comunicaciones con el cliente o entre el equipo (fecha, remitente, destinatario, asunto, observaciones y enlace),
 * buscarlas y llevarlas a la hoja «Registro Comunicaciones» (papel RC) para imprimir o firmar.
 */

import flujo from "./flujo.js";
import comunicaciones, { HOJA_RC } from "./comunicaciones.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

export function montarComunicaciones(c) {
  let aviso = null;
  let edicion = null; // null | "nueva" | número de la comunicación en edición
  let borrador = null;
  let confirmarBorrar = null;
  const filtros = { texto: "", desde: "", hasta: "" };
  const fecha = (iso) => iso.split("-").reverse().join("/");

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-11"), el("span", "fl-nombre", "Registro de comunicaciones"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    c.append(el("p", "fm-ayuda", "Registre aquí las comunicaciones del encargo. Del archivo (carta, correo, acta) se guarda su enlace o nombre; el archivo no se copia desde el complemento."));
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    if (edicion === null) {
      const b = el("button", "fl-btn", "Registrar comunicación");
      b.type = "button";
      b.dataset.accion = "nueva";
      b.addEventListener("click", () => {
        edicion = "nueva";
        borrador = null;
        aviso = null;
        pintar();
      });
      c.append(b);
    } else c.append(formulario(yo));

    /* --- búsqueda y lista --- */
    const sec = el("section", "fl-hist");
    sec.dataset.seccion = "lista-com";
    const todas = comunicaciones.total();
    const ft = campo({ id: "f-texto", etiqueta: "Buscar", valor: filtros.texto });
    ft.ctrl.type = "search";
    const fd = campo({ id: "f-desde", etiqueta: "Desde", tipo: "date", valor: filtros.desde });
    const fh = campo({ id: "f-hasta", etiqueta: "Hasta", tipo: "date", valor: filtros.hasta });
    ft.ctrl.addEventListener("input", () => {
      filtros.texto = ft.valor();
      pintarLista();
    });
    fd.ctrl.addEventListener("change", () => ((filtros.desde = fd.valor()), pintar()));
    fh.ctrl.addEventListener("change", () => ((filtros.hasta = fh.valor()), pintar()));
    sec.append(el("h3", null, "Comunicaciones registradas (" + todas + ")"), ft.nodo, fd.nodo, fh.nodo);
    const zona = el("div");
    sec.append(zona);
    const pintarLista = () => {
      zona.textContent = "";
      const items = comunicaciones.lista(filtros);
      if (!items.length) zona.append(el("p", "fl-vacio", todas ? "Ninguna comunicación cumple los filtros." : "Todavía no hay comunicaciones registradas."));
      items.forEach((x) => {
        const it = el("div", "fl-hist-item");
        it.dataset.com = String(x.no);
        it.append(el("div", "fl-hist-l2", fecha(x.fecha) + " · " + x.asunto));
        it.append(el("div", "fl-hist-nota", "De: " + x.remitente + " → Para: " + x.destinatario));
        if (x.observaciones) it.append(el("div", "fl-hist-nota", x.observaciones));
        if (x.enlace) {
          if (/^https?:\/\//i.test(x.enlace)) {
            const a = el("a", "fm-ayuda", x.enlace);
            a.href = x.enlace;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            it.append(a);
          } else it.append(el("div", "fm-ayuda", "Archivo: " + x.enlace));
        }
        it.append(el("div", "fl-hist-l2", "Registró " + x.registro.por.nombre + " · " + fmtFecha(x.registro.fecha) + (x.modificaciones.length ? " · corregida " + x.modificaciones.length + " vez(ces)" : "")));
        const acc = el("div", "fm-acciones");
        if (comunicaciones.puedeEditar(x, yo.id)) {
          const e = el("button", "fl-btn fl-btn-sec", "Corregir");
          e.type = "button";
          e.dataset.accion = "editar-" + x.no;
          e.addEventListener("click", () => {
            edicion = x.no;
            borrador = null;
            aviso = null;
            pintar();
          });
          acc.append(e);
        }
        if (comunicaciones.puedeEliminar(yo.id)) {
          const d = el("button", "fl-btn fl-btn-sec", confirmarBorrar === x.no ? "Confirmar eliminación" : "Eliminar");
          d.type = "button";
          d.dataset.accion = (confirmarBorrar === x.no ? "confirmar-eliminar-" : "eliminar-") + x.no;
          d.addEventListener("click", async () => {
            if (confirmarBorrar !== x.no) {
              confirmarBorrar = x.no;
              return pintar();
            }
            confirmarBorrar = null;
            const r = await comunicaciones.eliminar(x.no, { por: yo.id });
            aviso = r.ok ? { texto: "Comunicación eliminada del registro.", tipo: "ok" } : { texto: r.error, tipo: "error" };
            pintar();
          });
          acc.append(d);
        }
        if (acc.children.length) it.append(acc);
        zona.append(it);
      });
    };
    pintarLista();
    c.append(sec);

    /* --- hoja de Excel --- */
    const hj = el("section", "fl-hist");
    hj.append(el("h3", null, "Hoja de Excel (papel RC)"));
    hj.append(el("p", "fm-ayuda", "Lleva el registro a la hoja «" + HOJA_RC + "» para imprimirla o firmarla. Cada vez reemplaza las filas de la hoja con el registro actual; lo que se escriba directamente en ella no se conserva."));
    const bh = el("button", "fl-btn fl-btn-sec", "Actualizar hoja");
    bh.type = "button";
    bh.dataset.accion = "actualizar-hoja";
    bh.addEventListener("click", async () => {
      bh.disabled = true;
      const r = await comunicaciones.actualizarHoja();
      aviso = r.ok
        ? { texto: (r.creada ? "Hoja «" + HOJA_RC + "» creada y " : "Hoja «" + HOJA_RC + "» ") + "actualizada con " + r.filas + " comunicación(es).", tipo: "ok" }
        : { texto: r.motivo === "fuera-de-excel" ? "Fuera de Excel no se puede actualizar la hoja." : "No se pudo actualizar la hoja. " + (r.error || ""), tipo: "aviso" };
      pintar();
    });
    hj.append(bh);
    c.append(hj);
  };

  const formulario = (yo) => {
    const nueva = edicion === "nueva";
    const base = nueva ? {} : comunicaciones.lista().find((x) => x.no === edicion) || {};
    const b = borrador || { fecha: base.fecha || flujo.hoyISO(), remitente: base.remitente || "", destinatario: base.destinatario || "", asunto: base.asunto || "", observaciones: base.observaciones || "", enlace: base.enlace || "" };
    const f = el("form", "fm-form");
    f.append(el("strong", null, nueva ? "Nueva comunicación" : "Corregir comunicación N.º " + edicion));
    const nombres = flujo.personas(true).map((p) => p.nombre);
    const lista = el("datalist");
    lista.id = "com-nombres";
    nombres.forEach((n) => {
      const o = el("option");
      o.value = n;
      lista.append(o);
    });
    f.append(lista);
    const fF = campo({ id: "fecha", etiqueta: "Fecha de la comunicación", tipo: "date", valor: b.fecha, requerido: true });
    const fR = campo({ id: "remitente", etiqueta: "Remitente", valor: b.remitente, requerido: true });
    const fD = campo({ id: "destinatario", etiqueta: "Destinatario", valor: b.destinatario, requerido: true });
    fR.ctrl.setAttribute("list", "com-nombres");
    fD.ctrl.setAttribute("list", "com-nombres");
    const fA = campo({ id: "asunto", etiqueta: "Asunto", valor: b.asunto, requerido: true });
    const fO = campo({ id: "observaciones", etiqueta: "Observaciones", tipo: "textarea", valor: b.observaciones });
    const fE = campo({ id: "enlace", etiqueta: "Enlace o nombre del archivo", valor: b.enlace, ayuda: "Dirección web, ruta de la carpeta del encargo o nombre del archivo. Es opcional." });
    [fF, fR, fD, fA, fO, fE].forEach((x) => f.append(x.nodo));
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", nueva ? "Registrar" : "Guardar corrección");
    g.type = "submit";
    g.dataset.accion = "guardar";
    const x = el("button", "fl-btn fl-btn-sec", "Cancelar");
    x.type = "button";
    x.dataset.accion = "cancelar";
    x.addEventListener("click", () => {
      edicion = null;
      borrador = null;
      pintar();
    });
    acc.append(g, x);
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const dato = { fecha: fF.valor(), remitente: fR.valor(), destinatario: fD.valor(), asunto: fA.valor(), observaciones: fO.valor(), enlace: fE.valor() };
      const r = nueva ? await comunicaciones.crear(dato, { por: yo.id }) : await comunicaciones.editar(edicion, dato, { por: yo.id });
      if (r.ok) {
        edicion = null;
        borrador = null;
        aviso = { texto: nueva ? "Se registró la comunicación." : "Se guardó la corrección.", tipo: "ok" };
      } else {
        borrador = dato;
        aviso = { texto: r.error, tipo: "error" };
      }
      pintar();
    });
    return f;
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:comunicaciones-cambio"]);
  pintar();
  return h;
}
