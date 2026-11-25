/*
 * AuditX — Cambiar logo de los papeles de trabajo (M1-02)
 * Elegir la forma y la imagen; el logo se guarda en el libro y se coloca en la esquina A1 de cada papel.
 * Solo lo usan los perfiles con el permiso «Personalizar botones» de la matriz.
 */

import flujo from "./flujo.js";
import logo from "./logo.js";
import { el, mensaje, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

export function montarLogo(c) {
  let aviso = null;
  let forma = "";
  let archivo = null;
  let vistaNueva = ""; // vista previa del archivo elegido
  let confirmar = ""; // "" | "cambiar" | "quitar"
  let conteo = null; // hojas que recibirían el logo (se calcula antes de confirmar)
  let trabajando = false;

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M1-02"), el("span", "fl-nombre", "Cambiar logo de los papeles"));
    c.append(h, selectorUsuario());
    const yo = flujo.usuarioActual();
    if (!flujo.puede(yo.id, "personalizar-botones")) {
      c.append(mensaje("Su perfil no puede cambiar el logo de los papeles.", "aviso"));
      return;
    }
    c.append(el("p", "fm-ayuda", "El logo aparece en la esquina superior izquierda (A1) de cada papel de trabajo. Se guarda en este libro y se ajusta a la forma elegida sin deformarse."));

    /* --- logo actual --- */
    const actual = logo.logo();
    const ap = logo.aplicado();
    const bloque = el("section", "fl-hist");
    bloque.append(el("h3", null, "Logo actual"));
    if (actual) {
      const img = el("img", "lg-vista");
      img.src = actual.vista;
      img.alt = "Logo actual de los papeles";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "70px";
      bloque.append(img, el("p", "fm-ayuda", actual.nombreArchivo));
      bloque.append(el("p", "fm-ayuda", ap ? "Aplicado a " + ap.hojas + " hojas · " + fmtFecha(ap.fecha) : "Guardado, todavía no aplicado a las hojas."));
      if (ap && ap.fallos && ap.fallos.length) bloque.append(mensaje(ap.fallos.length + " hojas no se pudieron cambiar (¿protegidas?): " + ap.fallos.slice(0, 5).join(", ") + (ap.fallos.length > 5 ? "…" : ""), "aviso"));
    } else bloque.append(el("p", "fl-vacio", "Todavía no se ha elegido un logo para este proyecto."));
    c.append(bloque);
    if (aviso) c.append(mensaje(aviso.texto, aviso.tipo));

    /* --- elegir forma e imagen --- */
    const f = el("form", "fm-form");
    f.append(el("strong", null, actual ? "Cambiar el logo" : "Elegir el logo"));
    const grupo = el("fieldset", "fm-grupo");
    grupo.append(el("legend", null, "Forma del logo *"));
    logo.FORMAS.forEach((o) => {
      const l = el("label", "fm-check");
      const r = el("input");
      r.type = "radio";
      r.name = "forma-logo";
      r.value = o.id;
      r.checked = forma === o.id;
      r.dataset.campo = "forma-" + o.id;
      r.disabled = trabajando;
      r.addEventListener("change", () => (forma = o.id));
      l.append(r, el("span", null, o.nombre));
      grupo.append(l);
    });
    f.append(grupo);
    const fila = el("label", "fm-campo");
    fila.append(el("span", "fm-etiqueta", "Imagen (PNG, JPG o GIF, máximo 3 MB) *"));
    const inp = el("input", "fm-texto");
    inp.type = "file";
    inp.accept = ".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif";
    inp.dataset.campo = "archivo";
    inp.disabled = trabajando;
    inp.addEventListener("change", async () => {
      archivo = inp.files && inp.files[0] ? inp.files[0] : null;
      vistaNueva = "";
      aviso = null;
      confirmar = "";
      if (archivo && forma) {
        const p = await logo.procesarImagen(archivo, forma);
        if (p.ok) vistaNueva = p.vista;
        else aviso = { texto: p.error, tipo: "error" };
      }
      pintar();
    });
    fila.append(inp);
    f.append(fila);
    if (archivo) f.append(el("p", "fm-ayuda", "Elegida: " + archivo.name));
    if (vistaNueva) {
      const pv = el("img", "lg-previa");
      pv.src = vistaNueva;
      pv.alt = "Vista previa";
      pv.style.maxWidth = "100%";
      pv.style.maxHeight = "70px";
      f.append(pv);
    }
    const prog = el("p", "fm-ayuda");
    prog.dataset.progreso = "1";
    prog.setAttribute("role", "status");
    f.append(prog);
    if (confirmar === "cambiar") f.append(mensaje("Se reemplazará la imagen de la esquina A1 en " + (conteo ? conteo.aplican + " hojas de este libro (" + conteo.excluidas + " de configuración no se tocan)" : "las hojas de los papeles de trabajo") + ". Gráficos, botones y demás objetos no se tocan. ¿Continuar?", "aviso"));
    const acc = el("div", "fm-acciones");
    const g = el("button", "fl-btn", confirmar === "cambiar" ? "Confirmar cambio de logo" : "Cambiar logo");
    g.type = "submit";
    g.dataset.accion = confirmar === "cambiar" ? "confirmar-cambiar" : "cambiar";
    g.disabled = trabajando;
    acc.append(g);
    f.append(acc);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!forma) {
        aviso = { texto: "Debe seleccionar una opción sobre la forma del logo.", tipo: "error" };
        return pintar();
      }
      if (!archivo) {
        aviso = { texto: "Elija el archivo de la imagen.", tipo: "error" };
        return pintar();
      }
      if (confirmar !== "cambiar") {
        conteo = await logo.contar();
        if (conteo && !conteo.aplican) {
          aviso = { texto: "Este libro no tiene hojas de papeles a las que aplicar el logo (solo tiene hojas de configuración).", tipo: "error" };
          return pintar();
        }
        confirmar = "cambiar";
        return pintar();
      }
      confirmar = "";
      await ejecutar(() => logo.cambiar({ archivo, forma }, { por: yo.id, alAvanzar: avance }), "Logo cambiado.");
    });
    c.append(f);

    /* --- volver a aplicar / quitar --- */
    if (actual) {
      const a2 = el("div", "fm-acciones");
      const v = el("button", "fl-btn fl-btn-sec", "Volver a aplicar a las hojas");
      v.type = "button";
      v.dataset.accion = "reaplicar";
      v.disabled = trabajando;
      v.addEventListener("click", () => ejecutar(() => logo.volverAAplicar({ por: yo.id, alAvanzar: avance }), "Logo aplicado de nuevo."));
      const q = el("button", "fl-btn fl-btn-sec", confirmar === "quitar" ? "Confirmar: quitar el logo" : "Quitar el logo");
      q.type = "button";
      q.dataset.accion = confirmar === "quitar" ? "confirmar-quitar" : "quitar";
      q.disabled = trabajando;
      q.addEventListener("click", () => {
        if (confirmar !== "quitar") {
          confirmar = "quitar";
          return pintar();
        }
        confirmar = "";
        ejecutar(() => logo.quitar({ por: yo.id, alAvanzar: avance }), "Logo quitado de los papeles.");
      });
      a2.append(v, q);
      c.append(a2);
      if (confirmar === "quitar") c.append(mensaje("Las hojas quedarán sin logo. El logo que traía cada hoja antes no se puede recuperar desde aquí.", "aviso"));
    }

    /* --- historial y ayuda --- */
    const hist = logo.historial();
    const sec = el("section", "fl-hist");
    sec.append(el("h3", null, "Cambios registrados"));
    if (!hist.length) sec.append(el("p", "fl-vacio", "Todavía no hay cambios."));
    hist.slice(0, 6).forEach((x) => {
      const it = el("div", "fl-hist-item");
      it.append(el("div", "fl-hist-l2", [x.por.nombre, fmtFecha(x.fecha)].join(" · ")));
      x.cambios.forEach((t) => it.append(el("div", "fl-hist-nota", t)));
      sec.append(it);
    });
    c.append(sec);
    const a = el("a", "fm-ayuda", "Ver el video de ayuda");
    a.href = "https://www.auditool.org/blog/webinars1/video/m-cambiar-logo-pt";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    c.append(a);
  };

  const avance = (n, total) => {
    const p = c.querySelector("[data-progreso]");
    if (p) p.textContent = "Procesando… " + n + " de " + total + " hojas";
  };

  const ejecutar = async (fn, exito) => {
    trabajando = true;
    aviso = null;
    pintar();
    const r = await fn();
    trabajando = false;
    if (r.ok) {
      const extra = r.hojas != null ? " " + r.hojas + " hojas actualizadas" + (r.excluidas ? " (" + r.excluidas + " hojas de configuración sin tocar)" : "") + (r.fallos && r.fallos.length ? "; " + r.fallos.length + " con error." : ".") : "";
      aviso = { texto: exito + extra, tipo: r.fallos && r.fallos.length ? "aviso" : "ok" };
      archivo = null;
      vistaNueva = "";
    } else if (r.guardado) aviso = { texto: r.error, tipo: "aviso" };
    else aviso = { texto: r.error, tipo: "error" };
    pintar();
  };

  const h = enCambios(c, () => !trabajando && pintar(), ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:logo-cambio"]);
  pintar();
  return h;
}
