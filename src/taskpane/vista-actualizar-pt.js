/*
 * AuditX — Actualizar información de los papeles de trabajo (M2-08)
 * Trae el trabajo hecho en un archivo AuditX anterior, por etapas. No trae usuarios ni datos de la empresa.
 */

import flujo from "./flujo.js";
import actualizar from "./actualizar-pt.js";
import { el, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

export function montarActualizarPT(c) {
  let aviso = null;
  let archivo = null;
  let marcadas = new Set();
  let confirmar = false;
  let trabajando = false;
  let reporte = null;

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-08"), el("span", "fl-nombre", "Actualizar información de los papeles"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    c.append(el("p", "fm-ayuda", "Trae a este libro la información y el desarrollo de los papeles de trabajo que ya había hecho en otro archivo AuditX. Deberá volver a crear los usuarios y la información de la empresa: eso no se trae. El proceso puede tardar unos minutos."));
    c.append(mensaje("Los papeles de las etapas que marque se reemplazarán con lo que tenga el archivo anterior. Lo que ya haya escrito en este libro en esas hojas se perderá.", "aviso"));
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    const f = el("form", "fm-form");
    const grupo = el("fieldset", "fm-grupo");
    grupo.append(el("legend", null, "Etapas a traer *"));
    actualizar.etapas().forEach((e) => {
      const l = el("label", "fm-check");
      const k = el("input");
      k.type = "checkbox";
      k.checked = marcadas.has(e.id);
      k.disabled = trabajando;
      k.dataset.campo = "etapa-" + e.id;
      k.addEventListener("change", () => {
        if (k.checked) marcadas.add(e.id);
        else marcadas.delete(e.id);
        confirmar = false;
      });
      l.append(k, el("span", null, e.nombre + " (" + e.hojas + " papeles)"));
      grupo.append(l);
    });
    f.append(grupo);
    f.append(el("p", "fm-ayuda", "Controles y Sustantivas no se incluyen: tampoco se traían en el programa original."));

    const fila = el("label", "fm-campo");
    fila.append(el("span", "fm-etiqueta", "Archivo AuditX anterior (.xlsx o .xlsm) *"));
    const inp = el("input", "fm-texto");
    inp.type = "file";
    inp.accept = ".xlsx,.xlsm";
    inp.dataset.campo = "archivo";
    inp.disabled = trabajando;
    inp.addEventListener("change", () => {
      archivo = inp.files && inp.files[0] ? inp.files[0] : null;
      aviso = null;
      confirmar = false;
      const m = archivo ? actualizar.validarArchivo(archivo) : null;
      if (m) {
        aviso = { texto: m, tipo: "error" };
        archivo = null;
      }
      pintar();
    });
    fila.append(inp);
    f.append(fila);
    if (archivo) f.append(el("p", "fm-ayuda", "Elegido: " + archivo.name));

    const prog = el("p", "fm-ayuda");
    prog.dataset.progreso = "1";
    prog.setAttribute("role", "status");
    f.append(prog);
    if (confirmar) {
      const n = actualizar.etapas().filter((e) => marcadas.has(e.id)).reduce((s, e) => s + e.hojas, 0);
      f.append(mensaje("Se van a reemplazar hasta " + n + " papeles de este libro con los de «" + archivo.name + "». ¿Continuar?", "aviso"));
    }
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", confirmar ? "Confirmar y traer la información" : "Traer la información");
    g.type = "submit";
    g.dataset.accion = confirmar ? "confirmar" : "traer";
    g.disabled = trabajando;
    acc.append(g);
    if (confirmar) {
      const x = el("button", "fl-btn fl-btn-sec", "Cancelar");
      x.type = "button";
      x.dataset.accion = "cancelar";
      x.addEventListener("click", () => {
        confirmar = false;
        pintar();
      });
      acc.append(x);
    }
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      reporte = null;
      if (!marcadas.size) {
        aviso = { texto: "Marque al menos una etapa para traer.", tipo: "error" };
        confirmar = false;
        return pintar();
      }
      const m = actualizar.validarArchivo(archivo);
      if (m) {
        aviso = { texto: m, tipo: "error" };
        confirmar = false;
        return pintar();
      }
      if (!confirmar) {
        aviso = null;
        confirmar = true;
        return pintar();
      }
      confirmar = false;
      trabajando = true;
      aviso = null;
      pintar();
      const r = await actualizar.actualizar({ archivo, etapasElegidas: [...marcadas] }, { por: yo.id, alAvanzar: avance });
      trabajando = false;
      if (r.ok) {
        reporte = r;
        const dif = r.sinHojaAntes.length + r.sinHojaAqui.length + r.fallos.length;
        aviso = { texto: "Se trasladó la información de " + r.traidas + " papeles." + (dif ? " Hay " + dif + " diferencias (vea abajo)." : ""), tipo: dif ? "aviso" : "ok" };
        archivo = null;
      } else aviso = { texto: r.error, tipo: "error" };
      pintar();
    });
    c.append(f);

    if (reporte) {
      const sec = el("section", "fl-hist");
      sec.append(el("h3", null, "Reporte de diferencias"));
      const lista = (t, a) => {
        if (!a.length) return;
        sec.append(el("p", "fm-ayuda", t + " (" + a.length + ")"));
        a.forEach((n) => sec.append(el("div", "fl-hist-nota", n)));
      };
      lista("No estaban en el archivo anterior (quedaron como estaban)", reporte.sinHojaAntes);
      lista("No existen en este libro", reporte.sinHojaAqui);
      lista("No se pudieron actualizar (¿hoja protegida?)", reporte.fallos);
      if (!reporte.sinHojaAntes.length && !reporte.sinHojaAqui.length && !reporte.fallos.length) sec.append(el("p", "fl-vacio", "Sin diferencias: se trajeron todos los papeles."));
      c.append(sec);
    }

    const hist = actualizar.historial();
    const sec = el("section", "fl-hist");
    sec.append(el("h3", null, "Actualizaciones registradas"));
    if (!hist.length) sec.append(el("p", "fl-vacio", "Todavía no se ha traído información."));
    hist.slice(0, 6).forEach((x) => {
      const it = el("div", "fl-hist-item");
      it.append(el("div", "fl-hist-l2", [x.por.nombre, fmtFecha(x.fecha)].join(" · ")));
      x.cambios.forEach((t) => it.append(el("div", "fl-hist-nota", t)));
      sec.append(it);
    });
    c.append(sec);
    const a = el("a", "fm-ayuda", "Ver el video de ayuda");
    a.href = "https://www.auditool.org/blog/webinars1/video/n-actualizar-info-pt";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    c.append(a);
  };

  const avance = (n, total) => {
    const p = c.querySelector("[data-progreso]");
    if (p) p.textContent = "Procesando… " + n + " de " + total + " papeles";
  };

  const h = enCambios(c, () => !trabajando && pintar(), ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:actualizar-cambio"]);
  pintar();
  return h;
}
