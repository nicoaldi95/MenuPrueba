/*
 * AuditX — Índice de papeles de trabajo
 *
 * Reemplaza la hoja «Indice» (nombre, sección y ruta de acceso de cada papel). Se puede buscar,
 * filtrar por sección y abrir la hoja del papel con un toque. Los papeles que ya participan del
 * flujo muestran su estado y abren su ficha.
 */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import { CATALOGO, SECCIONES } from "./catalogo.js";
import { PAQUETES } from "./botones.config.js";
import { el, campo, selectorUsuario, enCambios, mensaje } from "./ui.js";

/* global window, document */

const POR_PAGINA = 40;

/* Las hojas que el menú ya conoce (AA-01…) mandan sobre la coincidencia automática del catálogo. */
function hojasDelMenu() {
  const m = new Map();
  const rec = (es) =>
    es.forEach((e) => {
      if (e.tipo === "menu") rec(e.hijos);
      else if (e.hoja && e.enFlujo) m.set(e.id, e.hoja);
    });
  PAQUETES.forEach((p) => rec(p.entradas));
  return m;
}

export function montarIndice(inicial = {}) {
  return (c) => {
    const filtros = { texto: "", seccion: inicial.seccion || "", flujo: false };
    let mostrar = POR_PAGINA;
    let aviso = null;
    const menu = hojasDelMenu();
    const items = CATALOGO.map((x) => ({ ...x, hoja: menu.get(x.codigo) || x.hoja, enFlujo: menu.has(x.codigo) }));

    const pintar = () => {
      c.textContent = "";
      c.classList.add("fl");
      const h = el("div", "fl-tit");
      h.append(el("span", "fl-codigo", "M2-02"), el("span", "fl-nombre", "Índice de papeles de trabajo"));
      c.append(h);
      const py = proyecto.proyecto();
      if (py.entidad) c.append(el("p", "fm-ayuda", py.entidad + (py.nit ? " · NIT " + py.nit : "") + (py.desde && py.hasta ? " · " + py.desde + " a " + py.hasta : "")));
      c.append(selectorUsuario());

      const txt = campo({ id: "i-texto", etiqueta: "Buscar papel de trabajo", valor: filtros.texto });
      txt.ctrl.type = "search";
      txt.ctrl.addEventListener("input", () => {
        filtros.texto = txt.valor();
        mostrar = POR_PAGINA;
        lista();
      });
      const sec = campo({ id: "i-seccion", etiqueta: "Sección", tipo: "select", opciones: ["Todas", ...SECCIONES], valor: filtros.seccion || "Todas" });
      sec.ctrl.addEventListener("change", () => {
        filtros.seccion = sec.valor() === "Todas" ? "" : sec.valor();
        mostrar = POR_PAGINA;
        lista();
      });
      const l = el("label", "fm-check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.dataset.campo = "i-flujo";
      cb.checked = filtros.flujo;
      cb.addEventListener("change", () => {
        filtros.flujo = cb.checked;
        mostrar = POR_PAGINA;
        lista();
      });
      l.append(cb, el("span", null, "Solo los que participan del flujo"));
      const barra = el("div", "es-filtros");
      barra.append(txt.nodo, sec.nodo, l);
      c.append(barra);

      const zonaAviso = el("div");
      const cuenta = el("p", "fm-ayuda");
      const cont = el("div", "es-lista");
      c.append(zonaAviso, cuenta, cont);

      async function abrirHoja(x) {
        const r = await window.AuditX.panel.abrirHoja(x.hoja);
        aviso =
          r.ok ? { t: "Se abrió la hoja «" + x.hoja + "».", k: "ok" }
          : r.motivo === "no-existe" ? { t: "La hoja «" + x.hoja + "» no existe en este libro.", k: "error" }
          : r.motivo === "fuera-de-excel" ? { t: "Fuera de Excel no se puede abrir la hoja «" + x.hoja + "».", k: "aviso" }
          : { t: "No se pudo abrir la hoja. Revise la consola.", k: "error" };
        zonaAviso.textContent = "";
        zonaAviso.append(mensaje(aviso.t, aviso.k));
      }

      function lista() {
        const t = filtros.texto.trim().toLowerCase();
        const res = items.filter(
          (x) => (!filtros.seccion || x.seccion === filtros.seccion) && (!filtros.flujo || x.enFlujo) && (!t || (x.nombre + " " + x.ruta + " " + x.seccion).toLowerCase().includes(t))
        );
        cuenta.textContent = res.length + " de " + items.length + " papeles · " + items.filter((x) => x.hoja).length + " con hoja enlazada";
        cont.textContent = "";
        if (!res.length) cont.append(el("p", "fl-vacio", "No hay papeles con esos filtros."));
        res.slice(0, mostrar).forEach((x) => {
          const fila = el("div", "fm-tarjeta es-papel");
          fila.dataset.codigo = x.codigo;
          const l1 = el("div", "fm-tarjeta-t");
          const nom = el("span", "es-nom");
          nom.append(el("strong", null, x.codigo + " "), document.createTextNode(x.nombre.slice(x.codigo.length).trim()));
          l1.append(nom);
          if (x.enFlujo) {
            const f = flujo.ficha(x.codigo);
            const pill = el("span", "fl-estado", f.vencido ? "Vencido" : f.estado);
            pill.dataset.estado = f.vencido ? "vencido" : f.estado === "Firmado" ? "firmado" : f.estado === "En revisión" ? "revision" : "";
            l1.append(pill);
          }
          fila.append(l1, el("div", "fl-hist-l2", [x.seccion, x.ruta].filter(Boolean).join(" · ")));
          const acc = el("div", "fm-acciones");
          const b = el("button", "fl-btn fl-btn-sec", x.hoja ? "Abrir hoja" : "Hoja por confirmar");
          b.type = "button";
          b.disabled = !x.hoja;
          b.dataset.accion = "hoja";
          b.addEventListener("click", () => abrirHoja(x));
          acc.append(b);
          if (x.enFlujo) {
            const f = el("button", "fl-btn fl-btn-sec", "Ver flujo");
            f.type = "button";
            f.dataset.accion = "flujo";
            f.addEventListener("click", () => window.AuditX.panel.abrirPapel(x.codigo));
            acc.append(f);
          }
          fila.append(acc);
          cont.append(fila);
        });
        if (res.length > mostrar) {
          const mas = el("button", "fl-btn fl-btn-sec", "Mostrar más (" + (res.length - mostrar) + ")");
          mas.type = "button";
          mas.dataset.accion = "mas";
          mas.addEventListener("click", () => {
            mostrar += POR_PAGINA;
            lista();
          });
          cont.append(mas);
        }
      }
      if (aviso) zonaAviso.append(mensaje(aviso.t, aviso.k));
      lista();
    };
    const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-cambio"]);
    pintar();
    return h;
  };
}

export const montarIndiceGeneral = montarIndice({});
