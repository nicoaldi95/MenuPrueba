/*
 * AuditX — Vistas de Monitoreo y Control (Día 2)
 *   usuarios       Usuarios y Perfiles
 *   info-proyecto  Información del proyecto (+ fechas de los papeles)
 *   empresa        Configurar Empresa
 *   onedrive       Carpeta OneDrive (guarda la ruta, igual que el VBA)
 *
 * Cada función recibe el contenedor y devuelve { destruir() }.
 */

import flujo, { ESTADO } from "./flujo.js";
import proyecto, { TIPOS_ENCARGO, MARCOS } from "./proyecto.js";
import { el, campo, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";
import { montarEstatus, montarPendientes, montarFirmados } from "./vista-estatus.js";
import { montarIndiceGeneral } from "./vista-indice.js";
import { montarCronograma } from "./vista-cronograma.js";
import { montarAlertas, montarDocumentarAlertas } from "./vista-alertas.js";
import { montarDashboard } from "./vista-dashboard.js";
import { montarFirmar } from "./vista-firmar.js";
import { montarHistorial } from "./vista-historial.js";
import { montarPdf } from "./vista-pdf.js";
import { montarComentariosPT } from "./vista-comentarios.js";
import { montarEquipo } from "./vista-equipo.js";
import { montarAA01 } from "./vista-aa01.js";
import { montarAA02, montarAA03 } from "./vista-aa02-03.js";
import { montarPapelHoja } from "./vista-hoja.js";
import { montarEmpresas } from "./vista-empresas.js";

/* global document, window */

function cabecera(c, titulo, sub) {
  c.textContent = "";
  c.classList.add("fl");
  const h = el("div", "fl-tit");
  h.append(el("span", "fl-codigo", sub), el("span", "fl-nombre", titulo));
  c.append(h, selectorUsuario());
}

function soloLectura(c, quien) {
  if (!flujo.puedeAdministrar(quien.id)) {
    c.append(mensaje("Solo el perfil «" + flujo.nombreRol("aprueba") + "» puede modificar esta información. Usted puede consultarla.", "aviso"));
    return true;
  }
  return false;
}

/* ===================================================================== Usuarios y Perfiles */

export function montarUsuarios(c) {
  let aviso = null;
  let edicion = null; // null | "nuevo" | id
  let confirmar = null; // id a eliminar
  let borrador = null; // lo escrito, para no perderlo si hay un error

  const pintar = () => {
    cabecera(c, "Usuarios y Perfiles", "M1-01");
    const yo = flujo.usuarioActual();
    const admin = flujo.puedeAdministrar(yo.id);
    const todos = flujo.personas();
    c.append(el("p", "fm-ayuda", todos.length + " usuarios · " + todos.filter((p) => p.activo).length + " activos"));
    if (!admin) c.append(mensaje("Solo el perfil «" + flujo.nombreRol("aprueba") + "» puede administrar usuarios. Usted puede consultarlos.", "aviso"));

    /* --- roles del proyecto --- */
    const roles = el("details", "fl-bloque");
    roles.append(el("summary", null, "Roles del proyecto"));
    flujo.ROLES.forEach((r) => {
      const fila = el("label", "fm-check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = flujo.rolesActivos().some((x) => x.id === r.id);
      cb.disabled = !!r.fijo || !admin;
      cb.addEventListener("change", async () => {
        const nuevos = flujo.ROLES.filter((x) => (x.id === r.id ? cb.checked : flujo.rolesActivos().some((y) => y.id === x.id))).map((x) => x.id);
        const res = await flujo.configurar({ rolesActivos: nuevos });
        aviso = res.ok ? null : { texto: res.error, tipo: "error" };
        pintar();
      });
      fila.append(cb, el("span", null, r.nombre + (r.fijo ? " (obligatorio)" : "")));
      roles.append(fila);
    });
    const sep = el("label", "fm-check");
    const cbs = el("input");
    cbs.type = "checkbox";
    cbs.checked = flujo.separarFunciones();
    cbs.disabled = !admin;
    cbs.addEventListener("change", async () => {
      await flujo.configurar({ separarFunciones: cbs.checked });
      pintar();
    });
    sep.append(cbs, el("span", null, "Quien elabora un papel no puede revisarlo ni firmarlo"));
    roles.append(sep);
    c.append(roles);

    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    /* --- lista --- */
    if (admin && !edicion) {
      const nuevo = el("button", "fl-btn", "Agregar usuario");
      nuevo.type = "button";
      nuevo.addEventListener("click", () => {
        edicion = "nuevo";
        borrador = null;
        aviso = null;
        pintar();
      });
      c.append(nuevo);
    }
    if (edicion) c.append(formulario(borrador || (edicion === "nuevo" ? { nombre: "", cargo: "", correo: "", roles: [], activo: true } : flujo.persona(edicion)), yo));

    todos.forEach((p) => {
      const t = el("div", "fm-tarjeta");
      t.dataset.persona = p.id;
      if (!p.activo) t.classList.add("is-inactiva");
      const l1 = el("div", "fm-tarjeta-t");
      l1.append(el("strong", null, p.nombre), el("span", "fl-estado", p.activo ? "Activo" : "Desactivado"));
      t.append(l1, el("div", "fl-hist-l2", [p.cargo, p.correo].filter(Boolean).join(" · ")));
      const chips = el("div", "fm-chips");
      p.roles.forEach((r) => chips.append(el("span", "fm-chip", flujo.nombreRol(r))));
      t.append(chips);
      if (admin) {
        const acc = el("div", "fm-acciones");
        const b = (txt, fn, sec = true) => {
          const x = el("button", "fl-btn" + (sec ? " fl-btn-sec" : ""), txt);
          x.type = "button";
          x.addEventListener("click", fn);
          acc.append(x);
          return x;
        };
        b("Editar", () => {
          edicion = p.id;
          borrador = null;
          aviso = null;
          pintar();
        }).dataset.accion = "editar";
        b(p.activo ? "Desactivar" : "Activar", async () => {
          const res = await flujo.activarPersona(p.id, !p.activo, { por: yo.id });
          aviso = res.ok ? null : { texto: res.error, tipo: "error" };
          pintar();
        }).dataset.accion = "activar";
        if (confirmar === p.id) {
          b("Confirmar eliminación", async () => {
            const res = await flujo.eliminarPersona(p.id, { por: yo.id });
            confirmar = null;
            aviso = res.ok ? { texto: "Usuario eliminado.", tipo: "ok" } : { texto: res.error, tipo: "error" };
            pintar();
          }, false).dataset.accion = "confirmar-eliminar";
        } else {
          b("Eliminar", () => {
            confirmar = p.id;
            pintar();
          }).dataset.accion = "eliminar";
        }
        t.append(acc);
      }
      c.append(t);
    });
  };

  const formulario = (p, yo) => {
    const f = el("form", "fm-form");
    f.append(el("strong", null, p.id ? "Editar usuario" : "Nuevo usuario"));
    const nombre = campo({ id: "nombre", etiqueta: "Nombre", valor: p.nombre, requerido: true });
    const cargo = campo({ id: "cargo", etiqueta: "Cargo", valor: p.cargo });
    const correo = campo({ id: "correo", etiqueta: "Correo", valor: p.correo });
    f.append(nombre.nodo, cargo.nodo, correo.nodo);
    const grupo = el("fieldset", "fm-grupo");
    grupo.append(el("legend", null, "Perfil (roles)"));
    const cbs = flujo.ROLES.map((r) => {
      const l = el("label", "fm-check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = p.roles.includes(r.id);
      cb.value = r.id;
      l.append(cb, el("span", null, r.nombre + (flujo.rolesActivos().some((x) => x.id === r.id) ? "" : " (no activo en este proyecto)")));
      grupo.append(l);
      return cb;
    });
    f.append(grupo);
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
      const datos = { id: p.id, nombre: nombre.valor(), cargo: cargo.valor(), correo: correo.valor(), roles: cbs.filter((k) => k.checked).map((k) => k.value), activo: p.activo };
      const res = await flujo.guardarPersona(datos, { por: yo.id });
      borrador = res.ok ? null : datos;
      if (res.ok) {
        edicion = null;
        aviso = { texto: "Usuario guardado.", tipo: "ok" };
      } else aviso = { texto: res.error, tipo: "error" };
      pintar();
    });
    return f;
  };

  const h = enCambios(c, pintar);
  pintar();
  return h;
}

/* ===================================================================== formularios de datos */

function vistaFormulario({ titulo, sub, seccion, campos, leer, guardar, extra }) {
  return (c) => {
    let aviso = null;
    let borrador = null;
    const pintar = () => {
      cabecera(c, titulo, sub);
      const yo = flujo.usuarioActual();
      const lectura = soloLectura(c, yo);
      const valores = { ...leer(), ...(borrador || {}) };
      const f = el("form", "fm-form");
      const refs = campos(valores).map((def) => {
        const x = campo({ ...def, valor: valores[def.id] || "", deshabilitado: lectura });
        f.append(x.nodo);
        return [def.id, x];
      });
      if (!lectura) {
        const g = el("button", "fl-btn", "Guardar");
        g.type = "submit";
        f.append(g);
      }
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const nuevo = {};
        refs.forEach(([k, x]) => (nuevo[k] = x.valor()));
        const res = await guardar(nuevo, { por: yo.id });
        borrador = res.ok ? null : nuevo;
        aviso = res.ok ? { texto: "Guardado.", tipo: "ok" } : { texto: res.error, tipo: "error" };
        pintar();
      });
      c.append(f);
      if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));
      if (extra) extra(c, yo, lectura, () => pintar());
      /* quién cambió qué */
      const hist = proyecto.historial().filter((h) => h.seccion === (seccion || titulo));
      const sec = el("section", "fl-hist");
      sec.append(el("h3", null, "Cambios registrados"));
      if (!hist.length) sec.append(el("p", "fl-vacio", "Todavía no hay cambios."));
      hist.slice(0, 8).forEach((h) => {
        const it = el("div", "fl-hist-item");
        const l1 = el("div", "fl-hist-l1");
        l1.append(el("strong", null, h.por.nombre), el("span", null, " modificó"));
        it.append(l1, el("div", "fl-hist-l2", [h.por.cargo, fmtFecha(h.fecha)].filter(Boolean).join(" · ")));
        h.cambios.forEach((x) => it.append(el("div", "fl-hist-nota", x)));
        sec.append(it);
      });
      c.append(sec);
    };
    const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config"]);
    pintar();
    return h;
  };
}

/* ===================================================================== calendario de papeles */

function calendarioPapeles(c, yo, lectura, repintar) {
  const d = el("details", "fl-bloque");
  d.append(el("summary", null, "Fechas de los papeles"));
  d.append(el("p", "fm-ayuda", "Fecha programada y de vencimiento de cada papel que pasa por el flujo. Un papel sin firmar pasada su fecha de vencimiento aparece como vencido."));
  flujo.papeles().forEach((p) => {
    const f = flujo.ficha(p.id);
    const b = el("div", "fm-papel");
    const t = el("div", "fm-tarjeta-t");
    t.append(el("strong", null, p.id), el("span", "fl-estado", f.vencido ? "Vencido" : f.estado));
    t.lastChild.dataset.estado = f.vencido ? "vencido" : f.estado === ESTADO.FIRMADO ? "firmado" : "";
    b.append(t);
    const fila = el("div", "fm-fechas");
    ["programada", "vence"].forEach((k) => {
      const x = campo({ id: p.id + "-" + k, etiqueta: k === "programada" ? "Programada" : "Vence", tipo: "date", valor: f.fechas[k], deshabilitado: lectura });
      x.ctrl.addEventListener("change", async () => {
        const res = await flujo.fijarFechas(p.id, { [k]: x.valor() }, { por: yo.id });
        if (!res.ok) x.nodo.append(mensaje(res.error, "error"));
        else repintar();
      });
      fila.append(x.nodo);
    });
    b.append(fila);
    d.append(b);
  });
  c.append(d);
}

/* ===================================================================== Información del proyecto */

export const montarInfoProyecto = vistaFormulario({
  titulo: "Información del proyecto",
  sub: "M2-01",
  leer: () => proyecto.proyecto(),
  campos: () => [
    { id: "entidad", etiqueta: "Entidad (cliente)", requerido: true },
    { id: "nit", etiqueta: "NIT / ID" },
    { id: "encargo", etiqueta: "Nombre del encargo" },
    { id: "tipo", etiqueta: "Tipo de encargo", tipo: "select", opciones: TIPOS_ENCARGO },
    { id: "marco", etiqueta: "Marco normativo", tipo: "select", opciones: MARCOS },
    { id: "desde", etiqueta: "Período de auditoría desde", tipo: "date" },
    { id: "hasta", etiqueta: "Hasta", tipo: "date" },
    { id: "fechaInforme", etiqueta: "Fecha prevista del informe", tipo: "date" },
  ],
  guardar: (n, o) => proyecto.guardarProyecto(n, o),
  extra: calendarioPapeles,
});

/* ===================================================================== Configurar Empresa */

export const montarEmpresa = vistaFormulario({
  titulo: "Configurar Empresa",
  sub: "M2-01",
  leer: () => proyecto.empresa(),
  campos: () => [
    { id: "razonSocial", etiqueta: "Razón social", requerido: true },
    { id: "nombreComercial", etiqueta: "Nombre comercial" },
    { id: "representante", etiqueta: "Representante legal" },
    { id: "actividad", etiqueta: "Actividad económica" },
    { id: "ciudad", etiqueta: "Ciudad" },
    { id: "direccion", etiqueta: "Dirección" },
    { id: "correo", etiqueta: "Correo de contacto" },
    { id: "telefono", etiqueta: "Teléfono" },
  ],
  guardar: (n, o) => (n.razonSocial.trim() ? proyecto.guardarEmpresa(n, o) : Promise.resolve({ ok: false, error: "Escriba la razón social." })),
});

/* ===================================================================== Carpeta OneDrive */

export const montarOneDrive = vistaFormulario({
  titulo: "Carpeta OneDrive",
  sub: "Configurar Empresa",
  seccion: "Configurar Empresa",
  leer: () => proyecto.empresa(),
  campos: () => [
    {
      id: "rutaOneDrive",
      etiqueta: "Ruta de la carpeta OneDrive sincronizada",
      ayuda: "Igual que en el VBA: aquí se guarda la ruta de la carpeta con los archivos AuditX. El complemento no abre carpetas del equipo; la ruta queda registrada para el proyecto.",
    },
  ],
  guardar: (n, o) => proyecto.guardarEmpresa(n, o),
});

export const VISTAS = {
  usuarios: montarUsuarios,
  "info-proyecto": montarInfoProyecto,
  "crear-empresas": montarEmpresas,
  empresa: montarEmpresa,
  onedrive: montarOneDrive,
  "estatus-firmas": montarEstatus,
  "pendientes-firma": montarPendientes,
  firmados: montarFirmados,
  indice: montarIndiceGeneral,
  cronograma: montarCronograma,
  alertas: montarAlertas,
  "alertas-doc": montarDocumentarAlertas,
  "dashboard-proyecto": montarDashboard,
  "firmar-pt": montarFirmar,
  historial: montarHistorial,
  pdf: montarPdf,
  "comentarios-pt": montarComentariosPT,
  "AA-08": montarEquipo,
  "AA-01": montarAA01,
  "AA-02": montarAA02,
  "AA-03": montarAA03,
  ...Object.fromEntries(["AA-04", "AA-05-1", "AA-05-2", "AA-06", "AA-07", "AA-09"].map((id) => [id, montarPapelHoja(id)])),
};
