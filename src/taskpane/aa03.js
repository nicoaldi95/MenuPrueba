/*
 * AuditX — AA-03 Verificación de compromisos del equipo de auditoría (vista del papel)
 *
 * Qué hace:
 *  - Dibuja la tabla de la hoja «AA-03 Verif. Compromisos Equipo» como una tarjeta por miembro
 *    (hasta 10): cargo, nombre y, para cada una de las tres declaraciones (independencia anual,
 *    confidencialidad y conflicto de interés), Cumple / No cumple con su referencia de P/T,
 *    más observaciones.
 *  - Cuenta cumplimientos e incumplimientos y los resume para el socio.
 *  - Verifica pendientes, bloquea y firma el papel (la firma se invalida si el contenido cambia).
 *  - Guarda dentro del libro (parte XML personalizada) y, fuera de Excel, en localStorage.
 *
 * Punto de integración con el menú de Pre-Planificación (taskpane.js):
 *  - Escucha  «auditx:navigate»  con detail.id === "AA-03" para mostrarse.
 *  - Emite    «auditx:estado-papel»  con el estado, el avance y los incumplimientos (índice vivo, M2-02).
 *  - Emite    «auditx:volver»  al pulsar la flecha de regreso.
 *
 * Códigos del documento maestro (los mismos de AA-01 y AA-03): M3-01 (cuestionario digital con
 * conclusión y firma), M2-04 (firma) y M1-02 (escala de riesgo configurable).
 */

/* global Office, Excel, document, window, console */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import ESQUELETO from "./aa03-esqueleto.js";

var ID_FLUJO = "AA-03";

  /* =====================================================================
   * 1. CONFIGURACIÓN (lo que Auditool puede ajustar sin tocar la lógica)
   * ===================================================================== */
  var CONFIG = {
    ID_PAPEL: "AA-03",
    VERSION_ESQUEMA: 1,
    NAMESPACE_XML: "http://auditool.org/auditx/aa03/v1",
    CLAVE_LOCAL: "auditx.aa03.v1",
    AUTOGUARDADO_MS: 600,

    NIVELES_RIESGO: ["MÍNIMO", "BAJO", "MEDIO", "ALTO", "CRÍTICO"],   // hoja de control, L351:L355 (M1-02)
    TIPOS_RIESGO: ["Negocio", "Fraude", "Procesos"],
    FRECUENCIAS: ["Anual", "Mensual", "Trimestral", "Diario", "Por evento"],
    MAX_MIEMBROS: 10,      // filas 16 a 25 de la hoja
    MAX_REGISTRO: 12,      // filas 32 a 43 de la hoja

    // Reglas de completitud. Los «bloqueos» impiden firmar; los «avisos» solo advierten.
    EXIGIR_OBSERVACION_SI_NO_CUMPLE: true,   // la hoja pide consignar toda excepción para revisión del socio (NIA 220)
    EXIGIR_REFERENCIA_SI_CUMPLE: false,      // true: «Cumple» debe llevar referencia de P/T

    // Ganchos de integración. Reemplácelos cuando existan (SSO de Microsoft 365, creación de encargo).
    obtenerUsuario: function () { return Promise.resolve(usuarioAhora()); },
    obtenerEncargo: function () { return Promise.resolve(proyecto.encabezado()); }
  };

  // Las tres declaraciones de la hoja (columnas D, F y H; sus referencias, E, G e I).
  var DECLARACIONES = [
    { k: "ind",  ref: "indRef",  titulo: "Confirmación anual de independencia" },
    { k: "conf", ref: "confRef", titulo: "Declaración de confidencialidad" },
    { k: "ci",   ref: "ciRef",   titulo: "Declaración de conflicto de interés" }
  ];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function getPath(obj, ruta) {
    var partes = ruta.split("."), cur = obj;
    for (var i = 0; i < partes.length; i++) { if (cur == null) return undefined; cur = cur[partes[i]]; }
    return cur;
  }
  function setPath(obj, ruta, valor) {
    var partes = ruta.split("."), cur = obj;
    for (var i = 0; i < partes.length - 1; i++) {
      if (cur[partes[i]] == null) cur[partes[i]] = /^\d+$/.test(partes[i + 1]) ? [] : {};
      cur = cur[partes[i]];
    }
    cur[partes[partes.length - 1]] = valor;
  }
  function hoy() {
    var d = new Date();
    return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  }
  function ahoraISO() { return new Date().toISOString(); }
  function horaCorta() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function copiar(o) { return JSON.parse(JSON.stringify(o)); }
  function escXml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* =====================================================================
   * 4. ESTADO
   * ===================================================================== */
  function nuevoMiembro() {
    return { cargo: "", nombre: "", ind: "", indRef: "", conf: "", confRef: "", ci: "", ciRef: "", obs: "" };
  }

  function nuevoEstado() {
    return {
      esquema: CONFIG.VERSION_ESQUEMA,
      meta: { entidad: "", nit: "", desde: "", hasta: "", preparadoPor: "", revisadoPor: "", supervisadoPor: "", aprobadoPor: "" },
      equipo: [nuevoMiembro()],
      registro: [],                 // riesgos identificados y controles
      final: { comentarios: "" },   // comentarios y observaciones finales
      firma: null,                  // { por, fecha, hash, invalida? }
      historial: [],
      actualizado: null
    };
  }

  var estado = nuevoEstado();
  var raiz = null;
  function usuarioAhora() {
    var u = flujo.usuarioActual();
    return u ? { id: u.id, nombre: u.nombre, correo: u.correo || "" } : null;
  }
  var cargado = false;
  var escuchando = false;

  /* =====================================================================
   * 5. CÁLCULOS
   * ===================================================================== */

  // Una fila vacía por completo no cuenta como miembro (la hoja trae 10 filas, casi siempre medio vacías).
  function miembroVacio(m) {
    return !(m.cargo.trim() || m.nombre.trim() || m.obs.trim() || DECLARACIONES.some(function (d) { return m[d.k] || m[d.ref].trim(); }));
  }
  function miembrosActivos() {
    var act = [];
    estado.equipo.forEach(function (m, i) { if (!miembroVacio(m)) act.push({ m: m, i: i }); });
    return act;
  }
  function etiquetaMiembro(m, i) { return m.nombre.trim() || m.cargo.trim() || ("Miembro " + (i + 1)); }

  // Cuenta cumplimientos, incumplimientos y pendientes de cada declaración.
  function calcularResumen() {
    var act = miembrosActivos(), por = {}, total = 0, hechas = 0, noCumple = 0, miembrosConNo = 0;
    DECLARACIONES.forEach(function (d) { por[d.k] = { cumple: 0, no: 0, pendiente: 0 }; });
    act.forEach(function (x) {
      var tieneNo = false;
      DECLARACIONES.forEach(function (d) {
        var v = x.m[d.k]; total++;
        if (v === "CUMPLE") { por[d.k].cumple++; hechas++; }
        else if (v === "NO CUMPLE") { por[d.k].no++; hechas++; noCumple++; tieneNo = true; }
        else por[d.k].pendiente++;
      });
      if (tieneNo) miembrosConNo++;
    });
    return { miembros: act.length, total: total, hechas: hechas, noCumple: noCumple, miembrosConNo: miembrosConNo, por: por };
  }

  // Devuelve { bloqueos: [...], avisos: [...] }. Cada pendiente indica dónde está para poder ir a él.
  function evaluar() {
    var bloqueos = [], avisos = [], m = estado.meta;
    function b(grupo, texto, destino) { bloqueos.push({ grupo: grupo, texto: texto, destino: destino }); }

    if (!m.entidad.trim()) b("Datos del encargo", "Falta el nombre de la entidad.", { campo: "meta.entidad" });

    var act = miembrosActivos();
    if (!act.length) b("Equipo de auditoría", "Registre al menos un miembro del equipo.", { miembro: 0, campo: "nombre" });
    var sinRef = 0, noSinObs = 0;
    act.forEach(function (x) {
      var mi = x.m, i = x.i, nom = etiquetaMiembro(mi, i), g = "Equipo de auditoría";
      if (!mi.nombre.trim()) b(g, "Falta el nombre del miembro " + (i + 1) + ".", { miembro: i, campo: "nombre" });
      if (!mi.cargo.trim()) b(g, "Falta el cargo de " + nom + ".", { miembro: i, campo: "cargo" });
      DECLARACIONES.forEach(function (d) {
        var v = mi[d.k];
        if (!v) { b(g, "Falta responder «" + d.titulo + "» de " + nom + ".", { miembro: i, campo: d.k }); return; }
        if (v === "NO CUMPLE" && !mi.obs.trim()) {
          noSinObs++;
          if (CONFIG.EXIGIR_OBSERVACION_SI_NO_CUMPLE) b(g, "«No cumple» sin observación: " + nom + " (" + d.titulo.toLowerCase() + ").", { miembro: i, campo: "obs" });
        }
        if (v === "CUMPLE" && !mi[d.ref].trim()) {
          sinRef++;
          if (CONFIG.EXIGIR_REFERENCIA_SI_CUMPLE) b(g, "Falta la referencia de P/T: " + nom + " (" + d.titulo.toLowerCase() + ").", { miembro: i, campo: d.ref });
        }
      });
    });
    if (sinRef && !CONFIG.EXIGIR_REFERENCIA_SI_CUMPLE) avisos.push(sinRef + " declaraciones «Cumple» no tienen referencia de P/T que las respalde.");
    if (noSinObs && !CONFIG.EXIGIR_OBSERVACION_SI_NO_CUMPLE) avisos.push(noSinObs + " respuestas «No cumple» no tienen observación.");
    var rs = calcularResumen();
    if (rs.noCumple) avisos.push("Incumplimientos detectados: " + rs.noCumple + " (en " + rs.miembrosConNo + " miembro(s)). El socio del encargo debe evaluarlos antes del inicio del trabajo.");
    if (estado.registro.some(function (x) { return x.descripcion.trim() && !x.nivel; })) avisos.push("Hay riesgos identificados sin nivel de riesgo.");
    return { bloqueos: bloqueos, avisos: avisos };
  }

  function resumen(t, max) { t = String(t).replace(/\s+/g, " ").trim(); return t.length > max ? t.slice(0, max - 1) + "…" : t; }

  /* =====================================================================
   * 6. FIRMA
   *    El hash cubre todo el contenido del papel. Si cambia algo después de firmar,
   *    el hash deja de coincidir y la firma se marca como inválida.
   * ===================================================================== */
  function contenidoFirmable() {
    var m = copiar(estado.meta); ["preparadoPor", "revisadoPor", "supervisadoPor", "aprobadoPor"].forEach(function (k) { delete m[k]; });
    return JSON.stringify({ meta: m, equipo: estado.equipo, registro: estado.registro, final: estado.final });
  }
  function hashTexto(texto) {
    var cripto = window.crypto && window.crypto.subtle;
    if (cripto && window.TextEncoder) {
      return cripto.digest("SHA-256", new TextEncoder().encode(texto)).then(function (buf) {
        return "sha256:" + Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
      });
    }
    // Respaldo (contextos sin crypto.subtle): no es criptográfico, solo detecta cambios.
    var h = 5381; for (var i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
    return Promise.resolve("djb2:" + (h >>> 0).toString(16));
  }
  function verificarFirma() {
    if (!estado.firma) return Promise.resolve();
    return hashTexto(contenidoFirmable()).then(function (h) { estado.firma.invalida = (h !== estado.firma.hash); });
  }

  function iniciarFirma() {
    var ev = evaluar();
    if (ev.bloqueos.length) { abrirPendientes(); return; }
    $("#a3-firmaNombre", raiz).textContent = nombreFirmante();
    $("#a3-firmaConfirma", raiz).hidden = false;
    $("#a3-btnFirmar", raiz).disabled = true;
  }
  function nombreFirmante() { return (usuarioAhora() && usuarioAhora().nombre) || estado.meta.aprobadoPor.trim() || estado.meta.revisadoPor.trim() || "el socio del encargo"; }

  function confirmarFirma() {
    hashTexto(contenidoFirmable()).then(function (h) {
      estado.firma = { por: nombreFirmante(), correo: (usuarioAhora() && usuarioAhora().correo) || "", fecha: ahoraISO(), hash: h, incumplimientos: calcularResumen().noCumple };
      registrarHistorial("firma");
      $("#a3-firmaConfirma", raiz).hidden = true;
      refrescarTodo(); guardarYa();
    });
  }
  function reabrir() {
    registrarHistorial(estado.firma && estado.firma.invalida ? "reapertura-firma-invalida" : "reapertura");
    estado.firma = null;
    $("#a3-firmaReabrirConfirma", raiz).hidden = true;
    refrescarTodo(); guardarYa();
  }
  function registrarHistorial(evento) {
    estado.historial.push({ evento: evento, por: nombreFirmante(), fecha: ahoraISO() });
    if (estado.historial.length > 50) estado.historial.shift();
  }

  /* =====================================================================
   * 7. ALMACENAMIENTO
   *    Dentro de Excel: parte XML personalizada del libro (viaja con el archivo).
   *    Fuera de Excel (vista previa en navegador): localStorage.
   *    Para llevarlo a SharePoint/Graph basta con reemplazar estas dos funciones.
   * ===================================================================== */
  function dentroDeExcel() { return typeof Office !== "undefined" && typeof Excel !== "undefined" && Office.context && Office.context.host === Office.HostType.Excel; }

  var Almacen = {
    cargar: function () {
      if (dentroDeExcel()) {
        return Excel.run(function (ctx) {
          var partes = ctx.workbook.customXmlParts.getByNamespace(CONFIG.NAMESPACE_XML);
          partes.load("items"); return ctx.sync().then(function () {
            if (!partes.items.length) return null;
            var xml = partes.items[0].getXml(); return ctx.sync().then(function () {
              var doc = new DOMParser().parseFromString(xml.value, "application/xml");
              var nodo = doc.documentElement; return nodo && nodo.textContent ? JSON.parse(nodo.textContent) : null;
            });
          });
        }).catch(function (e) { console.warn("AA-03: no se pudo leer del libro", e); return Almacen._local(); });
      }
      return Promise.resolve(Almacen._local());
    },
    guardar: function (datos) {
      var json = JSON.stringify(datos);
      if (dentroDeExcel()) {
        var xml = '<aa03 xmlns="' + CONFIG.NAMESPACE_XML + '">' + escXml(json) + "</aa03>";
        return Excel.run(function (ctx) {
          var partes = ctx.workbook.customXmlParts.getByNamespace(CONFIG.NAMESPACE_XML);
          partes.load("items"); return ctx.sync().then(function () {
            if (partes.items.length) partes.items[0].setXml(xml); else ctx.workbook.customXmlParts.add(xml);
            return ctx.sync();
          });
        });
      }
      try { window.localStorage.setItem(CONFIG.CLAVE_LOCAL, json); } catch (e) { return Promise.reject(e); }
      return Promise.resolve();
    },
    _local: function () {
      try { var t = window.localStorage.getItem(CONFIG.CLAVE_LOCAL); return t ? JSON.parse(t) : null; } catch (e) { return null; }
    }
  };

  var guardarConRetraso = debounce(function () { guardarYa(); }, CONFIG.AUTOGUARDADO_MS);

  function guardarYa() {
    setGuardado("Guardando…", "");
    estado.actualizado = ahoraISO();
    return Almacen.guardar(estado).then(function () {
      setGuardado("Guardado a las " + horaCorta(), "");
      notificarEstado();
    }).catch(function (e) {
      console.error("AA-03: error al guardar", e);
      setGuardado("No se pudo guardar. Se reintentará al próximo cambio.", "error");
    });
  }
  function setGuardado(texto, tipo) { if (!raiz) return; var el = $("#a3-estadoGuardado", raiz); el.textContent = texto; el.setAttribute("data-estado", tipo); }

  function estadoPapel() {
    if (estado.firma) return estado.firma.invalida ? "invalida" : "firmado";
    var rs = calcularResumen(), ev = evaluar();
    if (!ev.bloqueos.length) return "completo";
    return (rs.hechas > 0 || estado.meta.entidad.trim() || miembrosActivos().length) ? "borrador" : "sin-iniciar";
  }
  function notificarEstado() {
    var rs = calcularResumen();
    document.dispatchEvent(new CustomEvent("auditx:estado-papel", {
      detail: { id: CONFIG.ID_PAPEL, estado: estadoPapel(), avance: rs.total ? rs.hechas / rs.total : 0, incumplimientos: rs.noCumple }
    }));
  }

  /* =====================================================================
   * 8. DIBUJO
   * ===================================================================== */
  function plantilla(id) { return document.getElementById("a3-" + id).content.firstElementChild.cloneNode(true); }

  function llenarSelect(sel, opciones, vacio) {
    sel.innerHTML = "";
    var o = document.createElement("option"); o.value = ""; o.textContent = vacio || "Seleccione"; sel.appendChild(o);
    opciones.forEach(function (t) { var op = document.createElement("option"); op.value = t; op.textContent = t; sel.appendChild(op); });
  }

  function dibujarEquipo() {
    var cont = $("#a3-listaEquipo", raiz); cont.innerHTML = "";
    estado.equipo.forEach(function (m, i) {
      var f = plantilla("tpl-miembro");
      f.setAttribute("data-i", i);
      $(".aa-miembro-num", f).textContent = "Miembro " + (i + 1);
      var decls = $(".aa-decls", f);
      DECLARACIONES.forEach(function (d) {
        var fila = plantilla("tpl-decl");
        fila.setAttribute("data-decl", d.k);
        $(".aa-decl-titulo", fila).textContent = d.titulo;
        $$('input[type="radio"]', fila).forEach(function (rd) { rd.setAttribute("data-campo", d.k); rd.name = "a3-m" + i + "-" + d.k; });
        $('input[type="text"]', fila).setAttribute("data-campo", d.ref);
        decls.appendChild(fila);
      });
      $("button.aa-icon-btn", f).setAttribute("data-quitar-miembro", i);
      cont.appendChild(f);
      pintarMiembro(f, m);
    });
    $("#a3-btnAgregarMiembro", raiz).hidden = estado.equipo.length >= CONFIG.MAX_MIEMBROS;
    $("#a3-notaMax", raiz).textContent = estado.equipo.length >= CONFIG.MAX_MIEMBROS ? "Llegó al máximo de " + CONFIG.MAX_MIEMBROS + " miembros, como en el papel original." : "";
    var q = $$("[data-quitar-miembro]", raiz); q.forEach(function (b) { b.hidden = estado.equipo.length <= 1; });
  }

  function pintarMiembro(f, m) {
    $$("[data-campo]", f).forEach(function (el) {
      if (el.type === "radio") el.checked = (el.value === m[el.getAttribute("data-campo")]);
      else if (document.activeElement !== el) el.value = m[el.getAttribute("data-campo")] || "";
    });
    var hechas = DECLARACIONES.filter(function (d) { return m[d.k]; }).length;
    var hayNo = DECLARACIONES.some(function (d) { return m[d.k] === "NO CUMPLE"; });
    var est = $(".aa-miembro-estado", f), vacio = miembroVacio(m);
    est.setAttribute("data-estado", vacio ? "" : hayNo ? "no" : hechas === DECLARACIONES.length ? "ok" : "falta");
    est.textContent = vacio ? "" : hayNo ? "Con incumplimiento" : hechas === DECLARACIONES.length ? "Completo" : hechas + "/" + DECLARACIONES.length;
    $$(".aa-decl-fila", f).forEach(function (fila) { fila.setAttribute("data-valor", m[fila.getAttribute("data-decl")] || ""); });
  }

  function dibujarRegistro() {
    var cont = $("#a3-listaRegistro", raiz); cont.innerHTML = "";
    estado.registro.forEach(function (x, i) {
      var f = plantilla("tpl-registro");
      $(".aa-reg-num", f).textContent = "Riesgo " + (i + 1);
      f.setAttribute("data-reg", i);
      llenarSelect($('[data-campo="tipo"]', f), CONFIG.TIPOS_RIESGO, "Tipo");
      llenarSelect($('[data-campo="nivel"]', f), CONFIG.NIVELES_RIESGO, "Nivel");
      llenarSelect($('[data-campo="frecuencia"]', f), CONFIG.FRECUENCIAS, "Frecuencia");
      $$("[data-campo]", f).forEach(function (el) { el.value = x[el.getAttribute("data-campo")] || ""; });
      $("button.aa-icon-btn", f).setAttribute("data-quitar-reg", i);
      cont.appendChild(f);
    });
    $("#a3-btnAgregarRegistro", raiz).hidden = estado.registro.length >= CONFIG.MAX_REGISTRO;
    $("#a3-contadorRegistro", raiz).textContent = estado.registro.length ? String(estado.registro.length) : "";
  }

  // Sincroniza los campos con data-bind (datos del encargo y comentarios finales).
  function pintarBinds() {
    $$("[data-bind]", raiz).forEach(function (el) {
      var v = getPath(estado, el.getAttribute("data-bind"));
      if (document.activeElement !== el) el.value = v == null ? "" : v;
    });
  }

  function pintarAvance() {
    var rs = calcularResumen(), pct = rs.total ? Math.round((rs.hechas / rs.total) * 100) : 0;
    $("#a3-rellenoAvance", raiz).style.width = pct + "%";
    $("#a3-barraAvance", raiz).setAttribute("aria-valuenow", String(pct));
    $("#a3-textoAvance", raiz).textContent = rs.total
      ? rs.hechas + " de " + rs.total + " declaraciones (" + pct + " %)"
      : "Sin miembros registrados";
    $("#a3-resumenEquipo", raiz).textContent = rs.miembros ? rs.miembros + (rs.miembros === 1 ? " miembro" : " miembros") : "";
    var faltan = estado.meta.entidad.trim() ? 0 : 1, cd = $("#a3-contadorDatos", raiz);
    cd.textContent = faltan ? faltan + " por completar" : "Completo"; cd.setAttribute("data-completo", String(!faltan));
  }

  function pintarResumen() {
    var rs = calcularResumen(), chip = $("#a3-chipIncumpl", raiz);
    var pendientes = rs.total - rs.hechas;
    if (!rs.miembros) { chip.setAttribute("data-nivel", ""); chip.textContent = "Sin evaluar"; }
    else if (rs.noCumple) { chip.setAttribute("data-nivel", "4"); chip.textContent = rs.noCumple + (rs.noCumple === 1 ? " incumplimiento" : " incumplimientos"); }
    else if (pendientes) { chip.setAttribute("data-nivel", ""); chip.textContent = "Sin incumplimientos aún"; }
    else { chip.setAttribute("data-nivel", "1"); chip.textContent = "Sin incumplimientos"; }

    var tb = $("#a3-tablaResumen tbody", raiz); tb.innerHTML = "";
    DECLARACIONES.forEach(function (d) {
      var tr = document.createElement("tr"), x = rs.por[d.k];
      [d.titulo, x.cumple, x.no, x.pendiente].forEach(function (v, i) {
        var c = document.createElement(i ? "td" : "th"); if (!i) c.scope = "row"; c.textContent = v;
        if (i === 2 && x.no) c.className = "is-no";
        tr.appendChild(c);
      });
      tb.appendChild(tr);
    });
    var av = $("#a3-avisoIncumpl", raiz);
    av.hidden = !rs.noCumple;
    av.textContent = rs.noCumple ? "Incumplimientos detectados: " + rs.noCumple + " (en " + rs.miembrosConNo + " miembro(s)). Debe consignarse cada excepción y el socio del encargo debe revisarla antes de iniciar el trabajo." : "";
  }

  function pintarEstadoYFirma() {
    var est = estadoPapel(), chip = $("#a3-chipEstado", raiz);
    var textos = { "sin-iniciar": "Sin iniciar", borrador: "En borrador", completo: "Completo, sin firmar", firmado: "Firmado", invalida: "Firma inválida" };
    chip.textContent = textos[est]; chip.setAttribute("data-estado", est); raiz.setAttribute("data-estado", est);

    var ev = evaluar(), bloque = $("#a3-bloqueFirma", raiz), txt = $("#a3-firmaEstado", raiz);
    bloque.setAttribute("data-firma", est === "firmado" ? "firmado" : est === "invalida" ? "invalida" : "");
    var badge = $("#a3-badgePendientes", raiz); badge.textContent = ev.bloqueos.length; badge.hidden = !ev.bloqueos.length;

    var btnF = $("#a3-btnFirmar", raiz);
    btnF.hidden = true; // la firma se hace desde la ficha del flujo
    if (estado.firma) {
      var f = estado.firma, cuando = new Date(f.fecha).toLocaleString("es-CO");
      txt.textContent = est === "invalida"
        ? "La firma de " + f.por + " (" + cuando + ") ya no es válida: el contenido cambió después de firmar."
        : "Firmado por " + f.por + " el " + cuando + " · " + (f.incumplimientos ? "incumplimientos registrados: " + f.incumplimientos : "sin incumplimientos") + ".";
      btnF.textContent = est === "invalida" ? "Reabrir" : "Reabrir para editar";
      btnF.disabled = false; btnF.setAttribute("data-modo", "reabrir");
    } else {
      txt.textContent = ev.bloqueos.length ? "Sin firmar. Faltan " + ev.bloqueos.length + " pendientes para poder firmar." : "Completo. Se firma desde el flujo, en la parte de arriba.";
      btnF.textContent = "Firmar"; btnF.setAttribute("data-modo", "firmar");
      btnF.disabled = !!ev.bloqueos.length || !$("#a3-firmaConfirma", raiz).hidden;
    }
    aplicarBloqueo(!!estado.firma && est === "firmado");
  }

  function aplicarBloqueo(bloqueado) {
    $$("input, select, textarea, .aa-icon-btn, #a3-btnAgregarMiembro, #a3-btnAgregarRegistro", raiz).forEach(function (el) {
      if (el.closest("[data-siempre-activo]") || el.hasAttribute("data-siempre-activo") || el.readOnly) return;
      el.disabled = bloqueado;
    });
  }

  function refrescarTodo() {
    if (!raiz) return;
    pintarAvance(); pintarResumen(); pintarEstadoYFirma();
    $("#a3-panelPendientes", raiz).hidden ? null : dibujarPendientes();
  }

  /* =====================================================================
   * 9. PENDIENTES
   * ===================================================================== */
  function abrirPendientes() { $("#a3-panelPendientes", raiz).hidden = false; dibujarPendientes(); $("#a3-panelPendientes", raiz).scrollIntoView({ behavior: "smooth", block: "start" }); }
  function dibujarPendientes() {
    var ev = evaluar(), cuerpo = $("#a3-pendCuerpo", raiz); cuerpo.innerHTML = "";
    if (!ev.bloqueos.length) {
      var ok = document.createElement("p"); ok.className = "aa-pend-ok"; ok.textContent = "No hay pendientes: el papel está completo y se puede firmar."; cuerpo.appendChild(ok);
    } else {
      var grupos = {}, orden = [];
      ev.bloqueos.forEach(function (p, i) { if (!grupos[p.grupo]) { grupos[p.grupo] = []; orden.push(p.grupo); } grupos[p.grupo].push({ p: p, i: i }); });
      orden.forEach(function (g) {
        var h = document.createElement("p"); h.className = "aa-pend-grupo"; h.textContent = g + " (" + grupos[g].length + ")"; cuerpo.appendChild(h);
        var ul = document.createElement("ul"); ul.className = "aa-pend-lista";
        grupos[g].slice(0, 12).forEach(function (x) {
          var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.textContent = x.p.texto;
          b.addEventListener("click", function () { irA(x.p.destino); }); li.appendChild(b); ul.appendChild(li);
        });
        if (grupos[g].length > 12) { var m = document.createElement("li"); m.className = "aa-hint"; m.textContent = "… y " + (grupos[g].length - 12) + " más en esta sección."; ul.appendChild(m); }
        cuerpo.appendChild(ul);
      });
    }
    if (ev.avisos.length) {
      var ha = document.createElement("p"); ha.className = "aa-pend-grupo"; ha.textContent = "Avisos (no impiden firmar)"; cuerpo.appendChild(ha);
      var ua = document.createElement("ul"); ua.className = "aa-pend-lista";
      ev.avisos.forEach(function (t) { var li = document.createElement("li"); li.className = "aa-hint"; li.textContent = t; ua.appendChild(li); });
      cuerpo.appendChild(ua);
    }
  }

  function alternar(btn, panel, abrir) {
    var v = typeof abrir === "boolean" ? abrir : btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(v)); panel.hidden = !v;
  }

  function irA(dest) {
    var el = null;
    if (dest.miembro != null) {
      var nodo = $('.aa-miembro[data-i="' + dest.miembro + '"]', raiz);
      if (nodo) {
        var campo = dest.campo;
        el = $('[data-campo="' + campo + '"]', nodo);
        nodo.classList.add("is-pendiente-foco"); setTimeout(function () { nodo.classList.remove("is-pendiente-foco"); }, 1800);
      }
    } else if (dest.campo) {
      el = $('[data-bind="' + dest.campo + '"]', raiz);
      var card = el && el.closest(".aa-card-body");
      if (card && card.hidden) alternar($('[aria-controls="' + card.id + '"]', raiz), card, true);
    }
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }

  /* =====================================================================
   * 10. EVENTOS
   * ===================================================================== */
  function alCambiar() {
    // Todo cambio posterior a la firma la invalida (por si el bloqueo visual se saltó).
    if (estado.firma && !estado.firma.invalida) { verificarFirma().then(function () { refrescarTodo(); }); }
    refrescarTodo(); guardarConRetraso(); setGuardado("Cambios sin guardar…", "");
    var u = usuarioAhora();
    flujo.registrarCambio(ID_FLUJO, { por: u && u.id, resumen: "Se editó el cuestionario." });
  }

  function conectarEventos() {
    var cambio = function (e) {
      var el = e.target, mi = el.closest(".aa-miembro"), campo = el.getAttribute("data-campo");
      if (mi && campo) {
        var m = estado.equipo[+mi.getAttribute("data-i")];
        if (el.type === "radio" && !el.checked) return;
        m[campo] = el.value; pintarMiembro(mi, m); alCambiar(); return;
      }
      var reg = el.closest(".aa-reg");
      if (reg && campo) { estado.registro[+reg.getAttribute("data-reg")][campo] = el.value; alCambiar(); return; }
      if (el.hasAttribute("data-bind")) { setPath(estado, el.getAttribute("data-bind"), el.value); alCambiar(); }
    };
    raiz.addEventListener("input", function (e) { if (e.target.matches('input[type="text"], input[type="date"], textarea')) cambio(e); });
    raiz.addEventListener("change", function (e) { if (!e.target.matches('input[type="text"], input[type="date"], textarea')) cambio(e); });

    raiz.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.classList.contains("aa-card-toggle")) { alternar(t, document.getElementById(t.getAttribute("aria-controls"))); return; }
      if (t.hasAttribute("data-quitar-miembro")) {
        estado.equipo.splice(+t.getAttribute("data-quitar-miembro"), 1);
        if (!estado.equipo.length) estado.equipo.push(nuevoMiembro());
        dibujarEquipo(); alCambiar(); return;
      }
      if (t.hasAttribute("data-quitar-reg")) { estado.registro.splice(+t.getAttribute("data-quitar-reg"), 1); dibujarRegistro(); alCambiar(); return; }
    });

    $("#a3-btnAgregarMiembro", raiz).addEventListener("click", function () {
      if (estado.equipo.length < CONFIG.MAX_MIEMBROS) {
        estado.equipo.push(nuevoMiembro()); dibujarEquipo(); alCambiar();
        var ult = $$(".aa-miembro", raiz).pop(); if (ult) $('[data-campo="cargo"]', ult).focus();
      }
    });
    $("#a3-btnAgregarRegistro", raiz).addEventListener("click", function () {
      if (estado.registro.length < CONFIG.MAX_REGISTRO) {
        estado.registro.push({ descripcion: "", tipo: "", nivel: "", control: "", frecuencia: "", refPT: "" });
        dibujarRegistro(); alCambiar();
        var ult = $$(".aa-reg", raiz).pop(); if (ult) { alternar($("#a3-regToggle", raiz), $("#a3-regCuerpo", raiz), true); $("textarea", ult).focus(); }
      }
    });

    $("#a3-btnPendientes", raiz).addEventListener("click", function () { var p = $("#a3-panelPendientes", raiz); if (p.hidden) abrirPendientes(); else p.hidden = true; });
    $("#a3-btnCerrarPendientes", raiz).addEventListener("click", function () { $("#a3-panelPendientes", raiz).hidden = true; });

    $("#a3-btnFirmar", raiz).addEventListener("click", function () {
      if (this.getAttribute("data-modo") === "reabrir") { $("#a3-firmaReabrirConfirma", raiz).hidden = false; $("#a3-bloqueFirma", raiz).scrollIntoView({ behavior: "smooth", block: "center" }); }
      else iniciarFirma();
    });
    $("#a3-btnConfirmarFirma", raiz).addEventListener("click", confirmarFirma);
    $("#a3-btnCancelarFirma", raiz).addEventListener("click", function () { $("#a3-firmaConfirma", raiz).hidden = true; pintarEstadoYFirma(); });
    $("#a3-btnConfirmarReabrir", raiz).addEventListener("click", reabrir);
    $("#a3-btnCancelarReabrir", raiz).addEventListener("click", function () { $("#a3-firmaReabrirConfirma", raiz).hidden = true; });

    $("#a3-btnVolver", raiz).addEventListener("click", function () { guardarYa(); document.dispatchEvent(new CustomEvent("auditx:volver", { detail: { desde: CONFIG.ID_PAPEL } })); });

  }

  /* =====================================================================
   * 11. ARRANQUE
   * ===================================================================== */
  function fusionar(base, guardado) {
    // Tolera datos de versiones anteriores: completa lo que falte sin perder lo guardado.
    var out = copiar(base);
    if (!guardado || typeof guardado !== "object") return out;
    ["meta", "final"].forEach(function (k) { if (guardado[k]) Object.keys(guardado[k]).forEach(function (c) { out[k][c] = guardado[k][c]; }); });
    if (guardado.equipo && guardado.equipo.length) out.equipo = guardado.equipo.map(function (m) { var n = nuevoMiembro(); Object.keys(m).forEach(function (k) { if (k in n) n[k] = m[k]; }); return n; });
    out.registro = guardado.registro || []; out.firma = guardado.firma || null;
    out.historial = guardado.historial || []; out.actualizado = guardado.actualizado || null;
    return out;
  }

  function sincronizarResponsables() {
    var f = flujo.ficha(ID_FLUJO), nom = function (id) { var p = id && flujo.persona(id); return p ? p.nombre : ""; };
    estado.meta.preparadoPor = nom(f.asignados.prepara);
    estado.meta.revisadoPor = nom(f.asignados.revisa);
    estado.meta.supervisadoPor = nom(f.asignados.supervisa);
    estado.meta.aprobadoPor = nom(f.asignados.aprueba);
    var enc = proyecto.encabezado();
    Object.keys(enc).forEach(function (k) { if (k in estado.meta && !String(estado.meta[k]).trim()) estado.meta[k] = enc[k]; });
    if (raiz) {
      pintarBinds();
      ["preparadoPor", "revisadoPor", "supervisadoPor", "aprobadoPor"].forEach(function (k) {
        var el = $('[data-bind="meta.' + k + '"]', raiz); if (el) { el.readOnly = true; el.title = "Lo define el flujo de trabajo"; }
      });
    }
  }

  function sellar(por, correo) {
    return hashTexto(contenidoFirmable()).then(function (h) {
      estado.firma = { por: por, correo: correo || "", fecha: ahoraISO(), hash: h, incumplimientos: calcularResumen().noCumple };
      registrarHistorial("firma");
      refrescarTodo(); return guardarYa();
    });
  }
  function liberar() {
    if (!estado.firma) return Promise.resolve();
    registrarHistorial("reapertura"); estado.firma = null;
    refrescarTodo(); return guardarYa();
  }
  function alFlujo(e) {
    var d = e.detail || {};
    if (d.id !== ID_FLUJO || !cargado) return;
    if (d.accion === "firmar") sellar(d.por.nombre, "").then(sincronizarResponsables);
    else if (d.accion === "reabrir" || d.accion === "contenido-modificado") liberar().then(sincronizarResponsables);
    else sincronizarResponsables();
  }

  function cargar() {
    if (cargado) return Promise.resolve();
    if (typeof indexarDatos === "function") indexarDatos();
    return Promise.all([Almacen.cargar(), CONFIG.obtenerEncargo()]).then(function (res) {
      estado = fusionar(nuevoEstado(), res[0]);
      return verificarFirma();
    }).catch(function (e) { console.error("AA-03: error al leer", e); }).then(function () {
      cargado = true;
      sincronizarResponsables();
      if (!escuchando) {
        escuchando = true;
        document.addEventListener("auditx:flujo-cambio", alFlujo);
        flujo.registrarBloqueo(function (id, accion) {
          if (id !== ID_FLUJO || accion !== "firmar") return null;
          var n = evaluar().bloqueos.length;
          return n ? "El papel tiene " + n + (n === 1 ? " pendiente." : " pendientes.") + " Ábralo y complételos antes de firmar." : null;
        });
      }
      notificarEstado();
    });
  }

  function montar(cont) {
    cont.innerHTML = ESQUELETO;
    raiz = cont.querySelector("#aa03");
    raiz.classList.add("aa-embebido");
    var propia = raiz;
    conectarEventos();
    cargar().then(function () {
      if (raiz !== propia) return;
      sincronizarResponsables();
      dibujarEquipo(); dibujarRegistro(); pintarBinds(); sincronizarResponsables();
      refrescarTodo(); notificarEstado();
      setGuardado(estado.actualizado ? "Guardado" : "Sin cambios", "");
    });
    return { destruir: function () { if (raiz === propia) { guardarYa(); raiz = null; } } };
  }

  var api = {
    cargar: cargar,
    montar: montar,
    config: CONFIG,
    obtenerEstado: function () { return copiar(estado); },
    evaluar: evaluar,
    calcularResumen: calcularResumen,
    exportarJSON: function () { return JSON.stringify(estado, null, 2); }
  };
export default api;
