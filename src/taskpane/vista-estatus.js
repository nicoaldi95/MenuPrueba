/*
 * AuditX — Estatus de firmas de los papeles de trabajo
 *   estatus-firmas     Resumen por sección (como la hoja «Estatus PT Auditoria»)
 *   pendientes-firma   Papeles que aún no están firmados
 *   firmados           Papeles firmados, con quién y cuándo
 *
 * Los números salen del flujo: «Preparó / Revisó / Supervisó / Aprobó» cuentan los pasos cumplidos hoy.
 * Un papel que todavía no participa del flujo cuenta como pendiente.
 */

import { botonHoja } from "./informes.js";
import flujo, { ESTADO } from "./flujo.js";
import { CATALOGO, SECCIONES } from "./catalogo.js";
import { montarIndice } from "./vista-indice.js";
import docsCliente from "./docs-cliente.js";
import { el, selectorUsuario, enCambios, fmtFecha, campo } from "./ui.js";

/* global window, document */

const abrirPapel = (id) => window.AuditX.panel.abrirPapel(id);
const seccionDe = (id) => (CATALOGO.find((c) => c.codigo === id) || { seccion: "Pre-Planificación" }).seccion;

export function resumen() {
  const roles = flujo.rolesActivos().map((r) => r.id);
  const filas = SECCIONES.map((s) => ({ seccion: s, total: 0, prepara: 0, revisa: 0, supervisa: 0, aprueba: 0, vencidos: 0 }));
  const por = new Map(filas.map((f) => [f.seccion, f]));
  const enFlujo = new Map(flujo.papeles().map((p) => [p.id, flujo.ficha(p.id)]));
  const contar = (sec, f) => {
    const fila = por.get(sec);
    fila.total++;
    if (!f) return;
    roles.forEach((r) => f.pasos[r] && fila[r]++);
    if (f.vencido) fila.vencidos++;
  };
  CATALOGO.forEach((c) => contar(c.seccion, enFlujo.get(c.codigo)));
  enFlujo.forEach((f, id) => {
    if (!CATALOGO.some((c) => c.codigo === id)) contar("Pre-Planificación", f);
  });
  const total = filas.reduce((a, f) => a + f.total, 0);
  const aprobados = filas.reduce((a, f) => a + f.aprueba, 0);
  return { roles, filas, total, aprobados, pendientes: total - aprobados, vencidos: filas.reduce((a, f) => a + f.vencidos, 0), avance: total ? aprobados / total : 0, enFlujo: enFlujo.size };
}

/* ===================================================================== Estatus de firmas */

export function montarEstatus(c) {
  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-02"), el("span", "fl-nombre", "Estatus de Firmas PT"));
    c.append(h, selectorUsuario());
    c.append(botonHoja("estatus", "Llevar a la hoja «Estatus PT Auditoria»"));

    const r = resumen();
    const grid = el("div", "es-kpis");
    [
      ["Papeles", r.total],
      ["Aprobados", r.aprobados],
      ["Pendientes", r.pendientes],
      ["Avance", (r.avance * 100 < 10 ? (r.avance * 100).toFixed(1) : Math.round(r.avance * 100)) + "%"],
    ].forEach(([t, v]) => {
      const k = el("div", "es-kpi");
      k.append(el("strong", null, String(v)), el("span", null, t));
      grid.append(k);
    });
    c.append(grid);
    const barra = el("div", "es-barra");
    const rel = el("div", "es-barra-rel");
    rel.style.width = Math.max(r.avance * 100, r.aprobados ? 2 : 0) + "%";
    barra.append(rel);
    c.append(barra);
    if (r.vencidos) {
      const m = el("p", "fl-msg", r.vencidos + (r.vencidos === 1 ? " papel vencido sin firmar." : " papeles vencidos sin firmar."));
      m.dataset.tipo = "error";
      c.append(m);
    }

    const tabla = el("table", "es-tabla");
    const cab = el("tr");
    const nombres = { prepara: "Prep.", revisa: "Rev.", supervisa: "Sup.", aprueba: "Aprob." };
    ["Sección", "Total", ...r.roles.map((x) => nombres[x]), "Pend."].forEach((t, i) => {
      const th = el("th", i ? "num" : "", t);
      cab.append(th);
    });
    tabla.append(cab);
    r.filas.forEach((f) => {
      const tr = el("tr", "es-fila");
      tr.tabIndex = 0;
      tr.dataset.seccion = f.seccion;
      tr.append(el("td", null, f.seccion), el("td", "num", String(f.total)));
      r.roles.forEach((x) => tr.append(el("td", "num", String(f[x]))));
      tr.append(el("td", "num", String(f.total - f.aprueba)));
      const abrir = () => window.AuditX.panel.abrirVista("indice", montarIndice({ seccion: f.seccion }), { apilar: true });
      tr.addEventListener("click", abrir);
      tr.addEventListener("keydown", (e) => e.key === "Enter" && abrir());
      tabla.append(tr);
    });
    c.append(tabla);
    const ult = flujo.listar().filter((f) => f.estado === ESTADO.FIRMADO).map((f) => ({ id: f.id, q: flujo.quienYComo(f.id).firmo })).filter((x) => x.q && x.q.fecha).sort((a, b) => b.q.fecha.localeCompare(a.q.fecha))[0];
    const pu = el("p", "fm-ayuda", ult ? "Última firma: " + ult.id + " · " + ult.q.nombre + " · " + fmtFecha(ult.q.fecha) : "Todavía no hay firmas registradas.");
    pu.dataset.seccion = "ultima-firma";
    c.append(pu);
    c.append(seccionDocs());
    c.append(el("p", "fm-ayuda", "Toque una sección para ver sus papeles. Hoy " + r.enFlujo + " de " + r.total + " papeles participan del flujo; el resto cuenta como pendiente hasta que se incorporen."));
  };
  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio", "auditx:docs-cliente-cambio"]);
  pintar();
  return h;
}


/* ===================================================================== Documentos del cliente */

function seccionDocs() {
  const s = el("div", "es-docs");
  s.dataset.seccion = "docs-cliente";
  const r = docsCliente.resumenDocs();
  s.append(el("h4", "es-docs-t", "Documentos del cliente"));
  s.append(el("p", "fm-ayuda", "Usados " + r.usados + " · Cargados " + r.cargados + " · Faltantes " + r.faltantes + " (" + Math.round(r.porcentaje * 100) + "% cargado)"));
  const msg = el("p", "fl-msg");
  msg.hidden = true;
  const det = el("details", "es-docs-det");
  det.append(el("summary", null, "Ver y marcar los " + r.usados + " documentos"));
  docsCliente.lista().forEach((d) => {
    const fila = el("div", "es-doc");
    fila.dataset.doc = d.nombre;
    const l = el("label", "fm-check");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = d.aplica;
    cb.dataset.campo = "aplica";
    l.append(cb, el("span", null, d.nombre + (d.cargado ? " ✓" : "")));
    const t = el("input");
    t.type = "text";
    t.placeholder = "Enlace o nombre del archivo";
    t.value = d.enlace;
    t.disabled = !d.aplica;
    t.dataset.campo = "enlace";
    const guardar = async (cambio) => {
      const res = await docsCliente.actualizar(d.nombre, cambio);
      if (!res.ok && res.error !== "No hay cambios que guardar.") {
        msg.hidden = false;
        msg.dataset.tipo = "error";
        msg.textContent = res.error;
      }
    };
    cb.addEventListener("change", () => guardar({ aplica: cb.checked }));
    t.addEventListener("change", () => guardar({ enlace: t.value }));
    fila.append(l, t);
    det.append(fila);
  });
  s.append(det, msg);
  return s;
}

/* ===================================================================== Listados */

function lineaRol(f, rol, hist) {
  const x = flujo.rolesActivos().find((r) => r.id === rol);
  const quien = f.asignados[rol] ? flujo.persona(f.asignados[rol]) : null;
  const hecho = f.pasos[rol];
  const l = el("div", "es-rol");
  l.dataset.hecho = hecho ? "1" : "";
  l.append(el("span", "es-rol-t", (hecho ? "✓ " : "· ") + x.nombre), el("span", null, quien ? quien.nombre : "Sin asignar"));
  void hist;
  return l;
}

function montarListado(modo) {
  const titulo = modo === "firmados" ? "Papeles firmados" : "Papeles pendientes de firma";
  const codigo = modo === "firmados" ? "M2-02" : "M2-02 / M8-04";
  return (c) => {
    const filtros = { texto: "", estado: "", persona: "", mios: true, vencidos: false };
    const pintar = () => {
      c.textContent = "";
      c.classList.add("fl");
      const h = el("div", "fl-tit");
      h.append(el("span", "fl-codigo", codigo), el("span", "fl-nombre", titulo));
      c.append(h, selectorUsuario());
      const yo = flujo.usuarioActual();

      const base = flujo.listar().filter((f) => (modo === "firmados" ? f.estado === ESTADO.FIRMADO : f.estado !== ESTADO.FIRMADO));
      const barra = el("div", "es-filtros");
      const txt = campo({ id: "f-texto", etiqueta: "Buscar", valor: filtros.texto });
      txt.ctrl.type = "search";
      txt.ctrl.addEventListener("input", () => {
        filtros.texto = txt.valor();
        lista();
      });
      barra.append(txt.nodo);
      const fila2 = el("div", "es-fila2");
      if (modo === "pendientes") {
        const estados = [ESTADO.PENDIENTE, ESTADO.ELABORACION, ESTADO.REVISION, ESTADO.DEVUELTO, ESTADO.REVISADO];
        const e = campo({ id: "f-estado", etiqueta: "Estado", tipo: "select", opciones: ["Todos", ...estados], valor: filtros.estado || "Todos" });
        e.ctrl.addEventListener("change", () => {
          filtros.estado = e.valor() === "Todos" ? "" : e.valor();
          lista();
        });
        fila2.append(e.nodo);
      }
      const nombres = ["Todas", ...new Set(base.flatMap((f) => Object.values(f.asignados)).map((pid) => (flujo.persona(pid) || { nombre: "" }).nombre).filter(Boolean))];
      const p = campo({ id: "f-persona", etiqueta: "Responsable", tipo: "select", opciones: nombres, valor: filtros.persona || "Todas" });
      p.ctrl.addEventListener("change", () => {
        filtros.persona = p.valor() === "Todas" ? "" : p.valor();
        lista();
      });
      fila2.append(p.nodo);
      barra.append(fila2);
      const checks = el("div", "es-checks");
      const mk = (id, txt2, key) => {
        const l = el("label", "fm-check");
        const cb = el("input");
        cb.type = "checkbox";
        cb.dataset.campo = id;
        cb.checked = filtros[key];
        cb.addEventListener("change", () => {
          filtros[key] = cb.checked;
          lista();
        });
        l.append(cb, el("span", null, txt2));
        checks.append(l);
      };
      mk("f-mios", modo === "pendientes" ? "Solo lo que me toca a mí" : "Solo los papeles en que participé yo", "mios");
      if (modo === "pendientes") mk("f-vencidos", "Solo vencidos", "vencidos");
      barra.append(checks);
      c.append(barra);

      if (modo === "pendientes") {
        const por = { prepara: 0, revisa: 0, supervisa: 0, aprueba: 0 };
        flujo.pendientesDe(yo.id).forEach((f) => {
          const a = flujo.acciones(f.id, yo.id).find((x) => x.disponible);
          if (a && a.rol in por) por[a.rol]++;
        });
        const txt3 = { prepara: "por preparar", revisa: "por revisar", supervisa: "por supervisar", aprueba: "por aprobar" };
        const partes = Object.keys(por).filter((r) => por[r]).map((r) => por[r] + " " + txt3[r]);
        const res = el("p", "fl-msg", partes.length ? "Le toca a usted: " + partes.join(" · ") + "." : "No tiene papeles pendientes por su parte.");
        res.dataset.seccion = "mis-pendientes";
        c.append(res);
      }
      const part = (f) => {
        const q = flujo.quienYComo(f.id);
        const r = [];
        if (q.elaboro && q.elaboro.id === yo.id) r.push("elaboró");
        if (q.reviso.some((x) => x.persona && x.persona.id === yo.id)) r.push("revisó");
        if (q.firmo && q.firmo.id === yo.id) r.push("firmó");
        return r;
      };
      if (modo === "firmados") {
        const n = { elaboró: 0, revisó: 0, firmó: 0 };
        base.forEach((f) => part(f).forEach((x) => n[x]++));
        const partes = Object.keys(n).filter((k) => n[k]).map((k) => k + " " + n[k]);
        const res = el("p", "fl-msg", partes.length ? "Usted: " + partes.join(" · ") + "." : "Usted no ha participado en papeles firmados.");
        res.dataset.seccion = "mis-firmados";
        c.append(res);
      }
      const cuenta = el("p", "fm-ayuda");
      const cont = el("div", "es-lista");
      c.append(cuenta, cont);

      function lista() {
        const t = filtros.texto.trim().toLowerCase();
        const mios = new Set(flujo.pendientesDe(yo.id).map((f) => f.id));
        let items = base.filter((f) => {
          if (t && !(f.id + " " + f.etiqueta).toLowerCase().includes(t)) return false;
          if (filtros.estado && f.estado !== filtros.estado) return false;
          if (filtros.persona && !Object.values(f.asignados).some((pid) => (flujo.persona(pid) || {}).nombre === filtros.persona)) return false;
          if (filtros.mios && (modo === "firmados" ? !part(f).length : !mios.has(f.id))) return false;
          if (filtros.vencidos && !f.vencido) return false;
          return true;
        });
        if (modo === "firmados") items.sort((a, b) => ((flujo.quienYComo(b.id).firmo || {}).fecha || "").localeCompare((flujo.quienYComo(a.id).firmo || {}).fecha || ""));
        else items.sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.fechas.vence || "9999").localeCompare(b.fechas.vence || "9999") || a.id.localeCompare(b.id));
        cuenta.textContent = items.length + " de " + base.length + " papeles" + (modo === "pendientes" ? " · se muestran los que ya participan del flujo" : "");
        cont.textContent = "";
        if (!items.length) cont.append(el("p", "fl-vacio", modo === "firmados" ? "Todavía no hay papeles firmados." : "No hay papeles con esos filtros."));
        items.forEach((f) => {
          const t2 = el("button", "fm-tarjeta es-papel");
          t2.type = "button";
          t2.dataset.papel = f.id;
          const l1 = el("div", "fm-tarjeta-t");
          const nom = el("span", "es-nom");
          nom.append(el("strong", null, f.id + " "), document.createTextNode(f.etiqueta.replace(/^AA-\S+\s*/, "")));
          const pill = el("span", "fl-estado", f.vencido ? "Vencido" : f.estado);
          pill.dataset.estado = f.vencido ? "vencido" : f.estado === ESTADO.FIRMADO ? "firmado" : f.estado === ESTADO.REVISION ? "revision" : f.estado === ESTADO.DEVUELTO ? "devuelto" : "";
          l1.append(nom, pill);
          t2.append(l1);
          if (modo === "firmados") {
            const q = flujo.quienYComo(f.id);
            const pp = part(f);
            if (pp.length) t2.append(el("div", "fl-hist-l2", "Usted " + pp.join(", ")));
            t2.append(el("div", "fl-hist-l2", q.firmo ? "Firmó " + q.firmo.nombre + " · " + q.firmo.cargo + " · " + fmtFecha(q.firmo.fecha) : ""));
          }
          flujo.rolesActivos().forEach((r) => t2.append(lineaRol(f, r.id)));
          if (f.fechas.vence) t2.append(el("div", "fl-hist-l2", "Vence " + f.fechas.vence));
          t2.addEventListener("click", () => abrirPapel(f.id));
          cont.append(t2);
        });
      }
      lista();
    };
    const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio"]);
    pintar();
    return h;
  };
}

export const montarPendientes = montarListado("pendientes");
export const montarFirmados = montarListado("firmados");
