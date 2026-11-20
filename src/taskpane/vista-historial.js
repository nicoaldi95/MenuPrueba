/*
 * AuditX — Historial del papel: quién y cómo (M2-02)
 * Consulta de todos los movimientos con filtros; se puede escribir en una hoja o descargar en PDF.
 */

import flujo from "./flujo.js";
import { entradas, ACCIONES_FILTRO, enviarAHoja, pdfDeEntradas, fechaHora, HOJA_HISTORIAL } from "./historial.js";
import { descargarPdf } from "./pdf.js";
import { el, campo, mensaje, selectorUsuario, enCambios } from "./ui.js";

export function montarHistorial(c) {
  const filtros = { papel: "", persona: "", accion: "", desde: "", hasta: "", texto: "" };
  let aviso = null;
  let mostrar = 30;

  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-02"), el("span", "fl-nombre", "Historial del papel (quién y cómo)"));
    c.append(h, selectorUsuario());

    const barra = el("div", "es-filtros");
    const papeles = flujo.papeles();
    const pa = campo({ id: "h-papel", etiqueta: "Papel", tipo: "select", opciones: ["Todos", ...papeles.map((p) => p.id)], valor: filtros.papel || "Todos" });
    const personas = flujo.personas();
    const pe = campo({ id: "h-persona", etiqueta: "Persona", tipo: "select", opciones: ["Todas", ...personas.map((p) => p.nombre)], valor: (personas.find((p) => p.id === filtros.persona) || { nombre: "Todas" }).nombre });
    const ac = campo({ id: "h-accion", etiqueta: "Acción", tipo: "select", opciones: ["Todas", ...ACCIONES_FILTRO.map((a) => flujo.etiquetaAccion(a))], valor: filtros.accion ? flujo.etiquetaAccion(filtros.accion) : "Todas" });
    const de = campo({ id: "h-desde", etiqueta: "Desde", tipo: "date", valor: filtros.desde });
    const ha = campo({ id: "h-hasta", etiqueta: "Hasta", tipo: "date", valor: filtros.hasta });
    const tx = campo({ id: "h-texto", etiqueta: "Buscar en comentarios", valor: filtros.texto });
    tx.ctrl.type = "search";
    const r1 = el("div", "es-fila2");
    r1.append(pa.nodo, pe.nodo);
    const r2 = el("div", "es-fila2");
    r2.append(de.nodo, ha.nodo);
    barra.append(r1, ac.nodo, r2, tx.nodo);
    c.append(barra);

    const leer = () => {
      filtros.papel = pa.valor() === "Todos" ? "" : pa.valor();
      filtros.persona = (personas.find((p) => p.nombre === pe.valor()) || { id: "" }).id;
      filtros.accion = ACCIONES_FILTRO.find((a) => flujo.etiquetaAccion(a) === ac.valor()) || "";
      filtros.desde = de.valor();
      filtros.hasta = ha.valor();
      filtros.texto = tx.valor();
      mostrar = 30;
      lista();
    };
    [pa, pe, ac, de, ha].forEach((x) => x.ctrl.addEventListener("change", leer));
    tx.ctrl.addEventListener("input", leer);

    const resumen = el("div");
    const acc = el("div", "fm-acciones");
    const aviso0 = el("div");
    const cuenta = el("p", "fm-ayuda");
    const cont = el("div", "es-lista");
    c.append(resumen, acc, aviso0, cuenta, cont);
    if (aviso) aviso0.append(mensaje(aviso.t, aviso.k));

    function lista() {
      const items = entradas(filtros);
      /* resumen de un solo papel */
      resumen.textContent = "";
      if (filtros.papel) {
        const q = flujo.quienYComo(filtros.papel);
        const f = flujo.ficha(filtros.papel);
        const b = el("div", "fm-tarjeta");
        b.dataset.resumen = filtros.papel;
        const l1 = el("div", "fm-tarjeta-t");
        l1.append(el("strong", null, filtros.papel), el("span", "fl-estado", f.vencido ? "Vencido" : f.estado));
        b.append(l1);
        const quien = (t, x) => {
          const fila = el("div", "es-rol");
          fila.append(el("span", "es-rol-t", t), el("span", null, x ? x.nombre + " · " + fechaHora(x.fecha).slice(0, 10) : "—"));
          b.append(fila);
        };
        quien("Elaboró", q.elaboro);
        q.reviso.forEach((r) => quien(r.rol, r.persona ? { nombre: r.persona.nombre, fecha: r.fecha } : null));
        quien("Firmó", q.firmo);
        resumen.append(b);
      }
      cuenta.textContent = items.length + (items.length === 1 ? " movimiento" : " movimientos");
      cont.textContent = "";
      if (!items.length) cont.append(el("p", "fl-vacio", "No hay movimientos con esos filtros."));
      items.slice(0, mostrar).forEach((e) => {
        const it = el("div", "fl-hist-item");
        it.dataset.papel = e.papel;
        const l1 = el("div", "fl-hist-l1");
        l1.append(el("strong", null, e.papel + " · " + e.por.nombre), el("span", null, " " + e.etiqueta.toLowerCase()));
        it.append(l1, el("div", "fl-hist-l2", [e.por.cargo, fechaHora(e.fecha), e.de !== e.a ? e.de + " → " + e.a : ""].filter(Boolean).join(" · ")));
        if (e.nota) it.append(el("div", "fl-hist-nota", e.nota));
        cont.append(it);
      });
      if (items.length > mostrar) {
        const mas = el("button", "fl-btn fl-btn-sec", "Mostrar más (" + (items.length - mostrar) + ")");
        mas.type = "button";
        mas.dataset.accion = "mas";
        mas.addEventListener("click", () => {
          mostrar += 30;
          lista();
        });
        cont.append(mas);
      }
      acc.textContent = "";
      const bh = el("button", "fl-btn fl-btn-sec", "Escribir en una hoja");
      bh.type = "button";
      bh.dataset.accion = "a-hoja";
      bh.disabled = !items.length;
      bh.addEventListener("click", async () => {
        const res = await enviarAHoja(items);
        aviso = res.ok ? { t: "Se escribieron " + res.filas + " movimientos en la hoja «" + HOJA_HISTORIAL + "».", k: "ok" } : res.motivo === "fuera-de-excel" ? { t: "Fuera de Excel no se puede escribir en una hoja.", k: "aviso" } : { t: "No se pudo escribir en la hoja. Revise la consola.", k: "error" };
        aviso0.textContent = "";
        aviso0.append(mensaje(aviso.t, aviso.k));
      });
      const bp = el("button", "fl-btn fl-btn-sec", "Descargar PDF");
      bp.type = "button";
      bp.dataset.accion = "pdf";
      bp.disabled = !items.length;
      bp.addEventListener("click", () => {
        const ok = descargarPdf(pdfDeEntradas(items, items.length + " movimientos" + (filtros.papel ? " - papel " + filtros.papel : "")), "historial-auditx.pdf");
        aviso = ok ? { t: "Se generó el PDF. Si no ve la descarga, revise el bloqueo de descargas de su navegador.", k: "ok" } : { t: "No se pudo generar el PDF.", k: "error" };
        aviso0.textContent = "";
        aviso0.append(mensaje(aviso.t, aviso.k));
      });
      acc.append(bh, bp);
    }
    lista();
  };
  const h = enCambios(c, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio"]);
  pintar();
  return h;
}
