/*
 * AuditX — Generar PDF (M2-11, propuesto)
 * Ficha de firmas de un papel o de todos los que están en el flujo.
 * El PDF del libro completo con la API de Office queda como prueba experimental.
 */

import flujo from "./flujo.js";
import { pdfDeFichas } from "./historial.js";
import { descargarPdf, pdfDelLibro } from "./pdf.js";
import { el, campo, mensaje, selectorUsuario, enCambios } from "./ui.js";

export function montarPdf(c) {
  let aviso = null;
  const pintar = () => {
    c.textContent = "";
    c.classList.add("fl");
    const h = el("div", "fl-tit");
    h.append(el("span", "fl-codigo", "M2-11 (propuesto)"), el("span", "fl-nombre", "Generar PDF"));
    c.append(h, selectorUsuario());
    const papeles = flujo.papeles();
    const sel = campo({ id: "pdf-papel", etiqueta: "Papel", tipo: "select", opciones: ["Todos los papeles del flujo", ...papeles.map((p) => p.id + " " + p.etiqueta.replace(/^AA-\S+\s*/, ""))] });
    c.append(sel.nodo);
    c.append(el("p", "fm-ayuda", "La ficha trae el estado, los responsables y el historial completo: quién elaboró, revisó y firmó, con fecha y comentarios."));
    const b = el("button", "fl-btn", "Generar y descargar PDF");
    b.type = "button";
    b.dataset.accion = "generar";
    b.addEventListener("click", () => {
      const v = sel.valor();
      const ids = v.startsWith("Todos") ? papeles.map((p) => p.id) : [v.split(" ")[0]];
      const ok = descargarPdf(pdfDeFichas(ids), ids.length === 1 ? "ficha-" + ids[0] + ".pdf" : "fichas-de-firmas.pdf");
      aviso = ok ? { t: "Se generó el PDF. Si no ve la descarga, revise el bloqueo de descargas.", k: "ok" } : { t: "No se pudo generar el PDF.", k: "error" };
      pintar();
    });
    c.append(b);
    if (aviso) c.append(mensaje(aviso.t, aviso.k));

    const exp = el("details", "fl-bloque");
    exp.append(el("summary", null, "Libro completo (experimental)"));
    exp.append(el("p", "fm-ayuda", "Usa la función de Office que exporta todo el libro a PDF. No permite elegir hojas y con 295 hojas puede tardar mucho. Solo funciona dentro de Excel."));
    const e = el("button", "fl-btn fl-btn-sec", "Probar PDF del libro");
    e.type = "button";
    e.dataset.accion = "libro";
    e.addEventListener("click", async () => {
      e.disabled = true;
      e.textContent = "Generando…";
      try {
        const bytes = await pdfDelLibro();
        descargarPdf(bytes, "libro-auditx.pdf");
        aviso = { t: "PDF del libro generado (" + Math.round(bytes.length / 1024) + " KB).", k: "ok" };
      } catch (err) {
        aviso = { t: err.message === "fuera-de-excel" ? "Fuera de Excel no se puede generar el PDF del libro." : "No se pudo generar el PDF del libro: " + err.message, k: err.message === "fuera-de-excel" ? "aviso" : "error" };
      }
      pintar();
    });
    exp.append(e);
    c.append(exp);
  };
  const h = enCambios(c, pintar, ["auditx:flujo-usuario"]);
  pintar();
  return h;
}
