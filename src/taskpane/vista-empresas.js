/*
 * AuditX — Crear otras empresas (M2-01)
 * Reemplaza UserForm33: ficha de 9 datos, mismo equipo con los mismos roles, sin tope de empresas.
 */

import flujo from "./flujo.js";
import empresas, { CAMPOS, ESTRUCTURA } from "./empresas.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

/* global document */

export function montarEmpresas(c) {
  let aviso = null;
  let edicion = null; // null | "nuevo" | id
  let confirmar = null;
  let borrador = null;
  let equipoSel = null; // null = todos marcados

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-01"), el("span", "fl-nombre", "Crear otras empresas"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    const admin = flujo.puedeCrearEmpresas(yo.id);
    const lista = empresas.listar();

    c.append(el("p", "fm-ayuda", "Cada empresa adicional es un encargo propio. Elija qué usuarios la atienden; conservan los mismos roles. El equipo debe incluir al menos un Socio, Gerente o Aud. Independiente."));
    c.append(el("p", "fm-ayuda", lista.length + (lista.length === 1 ? " empresa adicional" : " empresas adicionales") + " · sin límite"));
    if (!admin) c.append(mensaje("Solo los perfiles " + flujo.PERFILES_CREAN_EMPRESAS.map(flujo.nombrePerfil).join(", ") + " pueden crear o modificar empresas. Usted puede consultarlas.", "aviso"));
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    if (admin && !edicion) {
      const b = el("button", "fl-btn", "Nueva empresa");
      b.type = "button";
      b.dataset.accion = "nueva";
      b.addEventListener("click", () => {
        edicion = "nuevo";
        borrador = null;
        aviso = null;
        pintar();
      });
      c.append(b);
    }
    if (edicion) c.append(formulario(yo));

    lista.forEach((e) => {
      const t = el("div", "fm-tarjeta");
      t.dataset.empresa = e.id;
      const l1 = el("div", "fm-tarjeta-t");
      l1.append(el("strong", null, e.nombre), el("span", "fl-estado", e.expediente));
      t.append(l1, el("div", "fl-hist-l2", ["NIT " + e.nit, e.lugar, e.gerente && "Gerente: " + e.gerente].filter(Boolean).join(" · ")));
      const d = el("details", "fl-bloque");
      d.append(el("summary", null, "Datos y equipo"));
      CAMPOS.slice(2).forEach((k) => e[k.id] && d.append(el("div", "fl-hist-l2", k.etiqueta + ": " + e[k.id])));
      d.append(el("div", "fl-hist-l2", "Equipo asignado: " + (e.equipo.length ? e.equipo.map((p) => p.nombre + " (" + p.roles.map(flujo.nombreRol).join(", ") + ")").join("; ") : "ninguno")));
      d.append(el("div", "fl-hist-l2", "Creada " + fmtFecha(e.creada) + " por " + e.por.nombre));
      t.append(d);
      if (admin) {
        const acc = el("div", "fm-acciones");
        const b = (txt, fn, ac, sec = true) => {
          const x = el("button", "fl-btn" + (sec ? " fl-btn-sec" : ""), txt);
          x.type = "button";
          x.dataset.accion = ac;
          x.addEventListener("click", fn);
          acc.append(x);
        };
        b("Editar", () => {
          edicion = e.id;
          borrador = null;
          aviso = null;
          pintar();
        }, "editar");
        if (confirmar === e.id)
          b("Confirmar eliminación", async () => {
            const r = await empresas.eliminar(e.id, { por: yo.id });
            confirmar = null;
            aviso = r.ok ? { texto: "Empresa eliminada del registro.", tipo: "ok" } : { texto: r.error, tipo: "error" };
            pintar();
          }, "confirmar-eliminar", false);
        else
          b("Eliminar", () => {
            confirmar = e.id;
            pintar();
          }, "eliminar");
        t.append(acc);
      }
      c.append(t);
    });

    const est = el("details", "fl-bloque");
    est.append(el("summary", null, "Estructura del expediente de cada empresa"));
    ESTRUCTURA.forEach((x) => est.append(el("div", "fl-hist-l2", "• " + x)));
    est.append(el("div", "fm-ayuda", "Se creará en SharePoint junto con el encargo (flujo M2-06). Por ahora queda registrada la empresa y su equipo."));
    c.append(est);
  };

  const formulario = (yo) => {
    const ex = edicion === "nuevo" ? null : empresas.obtener(edicion);
    const base = borrador || ex || {};
    const f = el("form", "fm-form");
    f.append(el("strong", null, ex ? "Editar empresa" : "Nueva empresa"));
    const cs = CAMPOS.map((k) => campo({ id: k.id, etiqueta: k.etiqueta, valor: base[k.id] || "", requerido: !!k.requerido }));
    cs.forEach((x) => f.append(x.nodo));
    let cbs = [];
    if (!ex) {
      const grupo = el("fieldset", "fm-grupo");
      grupo.append(el("legend", null, "Equipo de la empresa"));
      cbs = flujo.personas(true).map((p) => {
        const l = el("label", "fm-check");
        const cb = el("input");
        cb.type = "checkbox";
        cb.value = p.id;
        cb.checked = equipoSel === null || equipoSel.includes(p.id);
        cb.dataset.campo = "equipo-" + p.id;
        l.append(cb, el("span", null, p.nombre + " · " + flujo.nombrePerfil(p.perfil) + " · " + p.roles.map(flujo.nombreRol).join(", ")));
        grupo.append(l);
        return cb;
      });
      f.append(grupo);
    }
    f.append(el("p", "fm-ayuda", "Complete el resto de la información de la empresa desde «Configurar Empresa» al abrir su encargo."));
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", ex ? "Guardar" : "Crear empresa");
    g.type = "submit";
    const x = el("button", "fl-btn fl-btn-sec", "Cancelar");
    x.type = "button";
    x.addEventListener("click", () => {
      edicion = null;
      borrador = null;
      aviso = null;
      pintar();
    });
    acc.append(g, x);
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const n = {};
      cs.forEach((k, i) => (n[CAMPOS[i].id] = k.valor()));
      if (!ex) equipoSel = cbs.filter((k) => k.checked).map((k) => k.value);
      const r = ex ? await empresas.actualizar(ex.id, n, { por: yo.id }) : await empresas.crear(n, { por: yo.id, equipo: equipoSel });
      if (!r.ok) {
        borrador = n;
        aviso = { texto: r.error, tipo: "error" };
      } else {
        aviso = { texto: ex ? "Empresa actualizada." : "Empresa «" + r.empresa.nombre + "» creada" + (r.empresa.equipo.length ? " con " + r.empresa.equipo.length + " usuarios asignados." : "."), tipo: "ok" };
        edicion = null;
        borrador = null;
        equipoSel = null;
      }
      pintar();
    });
    return f;
  };

  pintar();
  return enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config"]);
}
