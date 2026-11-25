/*
 * AuditX — Dashboard de Tareas (M10-01)
 * Indicadores y gráficos de las tareas (por prioridad, proceso y estado) con filtros por usuario, prioridad, estado y plazo.
 * Reemplaza a la hoja «Dashboard Ej» y sus segmentadores; se calcula al instante con las tareas del complemento.
 */

import flujo from "./flujo.js";
import tareas from "./tareas.js";
import { el, campo, selectorUsuario, enCambios, fmtFecha } from "./ui.js";

const DIA = 86400000;
const aFecha = (iso) => new Date(iso + "T00:00:00");

/* Días que faltan para el vencimiento (negativo si ya pasó). «habiles»: solo lunes a viernes (los festivos no se descuentan). */
export function diasHasta(venc, habiles, hoy = flujo.hoyISO()) {
  const a = aFecha(hoy);
  const b = aFecha(venc);
  if (!habiles) return Math.round((b - a) / DIA);
  const signo = b >= a ? 1 : -1;
  let n = 0;
  const d = new Date(signo > 0 ? a : b);
  const fin = signo > 0 ? b : a;
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return signo * n;
}

const contar = (lista, clave) => {
  const m = new Map();
  lista.forEach((t) => m.set(clave(t), (m.get(clave(t)) || 0) + 1));
  return [...m.entries()];
};

export function montarDashboardTareas(c) {
  const f = { asigna: "", resp: "", prioridad: "", estado: "", plazo: "Todos" };
  let plazoDias = 6; // «Días de plazo» del original
  let habiles = false;
  let filasInforme = 10;

  const nombreDe = (pid) => (flujo.persona(pid) ? flujo.persona(pid).nombre : "—");

  const grafico = (titulo, datos, total) => {
    const sec = el("section", "fl-hist");
    sec.dataset.grafico = titulo;
    sec.append(el("h3", null, titulo));
    if (!datos.length) sec.append(el("p", "fl-vacio", "Aún no hay tareas para generar el gráfico."));
    datos.forEach(([nombre, n]) => {
      const fila = el("div", "db-fase");
      const t = el("div", "es-rol");
      t.append(el("span", "es-rol-t", nombre), el("span", null, n + " (" + Math.round((n / total) * 100) + "%)"));
      const barra = el("div", "es-barra");
      const lleno = el("div", "db-apr");
      lleno.style.width = (n / total) * 100 + "%";
      barra.append(lleno);
      fila.append(t, barra);
      sec.append(fila);
    });
    return sec;
  };

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M10-01"), el("span", "fl-nombre", "Dashboard de Tareas"));
    c.append(h, selectorUsuario());
    const personas = flujo.personas().map((p) => p.nombre);

    /* --- filtros (segmentadores del original) --- */
    const filtros = el("section", "fl-hist");
    const mk = (id, etiqueta, opciones, valor, clave) => {
      const x = campo({ id, etiqueta, tipo: "select", opciones, valor });
      x.ctrl.addEventListener("change", () => ((f[clave] = x.valor()), pintar()));
      filtros.append(x.nodo);
    };
    mk("f-asigna", "Usuario que asigna", ["", ...personas], f.asigna, "asigna");
    mk("f-resp", "Responsable", ["", ...personas], f.resp, "resp");
    mk("f-prioridad", "Prioridad", ["", ...tareas.PRIORIDADES], f.prioridad, "prioridad");
    mk("f-estado", "Estado", ["", ...tareas.ESTADOS], f.estado, "estado");
    mk("f-plazo", "Plazo de entrega", ["Todos", "Vencidas", "Por vencer", "Con más plazo"], f.plazo, "plazo");
    const dp = campo({ id: "plazo-dias", etiqueta: "Días de plazo (1 a 30)", tipo: "number", valor: String(plazoDias) });
    dp.ctrl.min = "1";
    dp.ctrl.max = "30";
    dp.ctrl.addEventListener("change", () => {
      const n = parseInt(dp.valor(), 10);
      plazoDias = Number.isFinite(n) ? Math.min(30, Math.max(1, n)) : 6;
      pintar();
    });
    const lh = el("label", "fm-check");
    const kh = el("input");
    kh.type = "checkbox";
    kh.checked = habiles;
    kh.dataset.campo = "habiles";
    kh.addEventListener("change", () => ((habiles = kh.checked), pintar()));
    lh.append(kh, el("span", null, "Contar solo días hábiles (lunes a viernes; no descuenta festivos)"));
    filtros.append(dp.nodo, lh);
    c.append(filtros);

    const estaEnPlazo = (t) => t.estado !== "Completado" && diasHasta(t.vencimiento, habiles) >= 0 && diasHasta(t.vencimiento, habiles) <= plazoDias;
    const todas = tareas.lista();
    const vistas = todas
      .filter((t) => !f.asigna || nombreDe(t.asigna) === f.asigna)
      .filter((t) => !f.resp || nombreDe(t.responsable) === f.resp)
      .filter((t) => !f.prioridad || t.prioridad === f.prioridad)
      .filter((t) => !f.estado || t.estado === f.estado)
      .filter((t) => {
        if (f.plazo === "Vencidas") return tareas.esVencida(t);
        if (f.plazo === "Por vencer") return estaEnPlazo(t);
        if (f.plazo === "Con más plazo") return t.estado !== "Completado" && diasHasta(t.vencimiento, habiles) > plazoDias;
        return true;
      });

    /* --- tarjetas --- */
    const kp = el("div", "es-kpis");
    [
      ["Tareas", String(vistas.length).padStart(2, "0")],
      ["Procesos", String(new Set(vistas.map((t) => t.proceso)).size).padStart(2, "0")],
      ["Vencidas", vistas.filter(tareas.esVencida).length],
      ["Vencen en " + plazoDias + (habiles ? " días hábiles" : " días"), vistas.filter(estaEnPlazo).length],
    ].forEach(([t, v]) => {
      const k = el("div", "es-kpi");
      k.dataset.kpi = t;
      k.append(el("strong", null, String(v)), el("span", null, t));
      kp.append(k);
    });
    c.append(kp);

    if (!vistas.length) {
      c.append(el("p", "fl-vacio", todas.length ? "Ninguna tarea cumple los filtros." : "Aún no hay tareas registradas para generar el informe. Se asignan en «Asignar Tareas»."));
      return;
    }
    const orden = (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]));
    c.append(grafico("Tareas por prioridad", contar(vistas, (t) => t.prioridad).sort((a, b) => tareas.PRIORIDADES.indexOf(b[0]) - tareas.PRIORIDADES.indexOf(a[0])), vistas.length));
    c.append(grafico("Tareas por proceso", contar(vistas, (t) => t.proceso).sort(orden), vistas.length));
    c.append(grafico("Tareas por estado", contar(vistas, (t) => t.estado).sort((a, b) => tareas.ESTADOS.indexOf(a[0]) - tareas.ESTADOS.indexOf(b[0])), vistas.length));

    /* --- informe de tareas --- */
    const inf = el("section", "fl-hist");
    inf.dataset.informe = "1";
    inf.append(el("h3", null, "Informe de tareas"));
    const fi = campo({ id: "filas-informe", etiqueta: "Filas a mostrar (1 a 100)", tipo: "number", valor: String(filasInforme) });
    fi.ctrl.min = "1";
    fi.ctrl.max = "100";
    fi.ctrl.addEventListener("change", () => {
      const n = parseInt(fi.valor(), 10);
      filasInforme = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 10;
      pintar();
    });
    inf.append(fi.nodo);
    [...vistas]
      .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.no - b.no)
      .slice(0, filasInforme)
      .forEach((t) => {
        const it = el("div", "fl-hist-item");
        it.dataset.fila = String(t.no);
        it.append(el("div", "fl-hist-l2", "N.º " + t.no + " · " + t.nombre));
        it.append(el("div", "fl-hist-nota", [t.proceso, "Asigna: " + nombreDe(t.asigna), "Resp.: " + nombreDe(t.responsable), t.prioridad, "vence " + fmtFecha(t.vencimiento) + (tareas.esVencida(t) ? " (vencida)" : ""), t.estado + " " + t.progreso + "%"].join(" · ")));
        inf.append(it);
      });
    if (vistas.length > filasInforme) inf.append(el("p", "fm-ayuda", "Se muestran " + filasInforme + " de " + vistas.length + "; cambie «Filas a mostrar» o use los filtros."));
    c.append(inf);
  };

  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:tareas-cambio"]);
  pintar();
  return h;
}
