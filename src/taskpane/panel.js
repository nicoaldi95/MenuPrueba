/*
 * AuditX — Panel de paquetes (Monitoreo y Control, Accesos, Pre-Planificación)
 *
 * Dibuja el menú completo a partir de botones.config.js:
 *   · pestañas de paquete, menús desplegables y botones
 *   · búsqueda en los tres paquetes a la vez
 *   · qué pasa al pulsar cada botón, según su "accion" (flujo / hoja / enlace / pendiente)
 *
 * Se invoca una sola vez desde Office.onReady (taskpane.js).
 *
 * Eventos (los mismos que usan los cuestionarios AA-01, AA-02 y AA-03):
 *   emite   «auditx:navigate»  detail: { id, label, paquete, accion, hoja, handled }
 *           Una vista que atiende el botón pone detail.handled = true.
 *   emite   «auditx:panel-listo»
 *
 * API pública (la usará el motor de flujo para pintar el estado de cada papel):
 *   window.AuditX.panel.marcarEstado(id, { estado, texto })
 *   window.AuditX.panel.irA(id)
 */

import { PAQUETES, AJUSTES, RETIRADOS } from "./botones.config.js";
import flujo from "./flujo.js";
import { iniciarTema } from "./tema.js";
import hojaTI from "./hoja-ti.js";
import { montarFicha } from "./flujo-ficha.js";
import proyecto from "./proyecto.js";
import nombres from "./nombres.js";
import logo from "./logo.js";
import actualizarPT from "./actualizar-pt.js";
import empresas from "./empresas.js";
import alertas from "./alertas.js";
import { VISTAS } from "./vistas.js";
import comentarios from "./comentarios.js";
import aa01 from "./aa01.js";
import { cargarCuestionarios, aa02, aa03 } from "./vista-aa02-03.js";

/* global document, window, Excel, localStorage */

const CLAVE_PAQUETE = "auditx.panel.paquete";
let raiz = null;
let paqueteActual = AJUSTES.paqueteInicial;
const indice = new Map(); // id -> { entrada, paquete }

/* ------------------------------------------------------------------ utilidades */

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

function leerPaqueteGuardado() {
  try {
    const p = window.localStorage.getItem(CLAVE_PAQUETE);
    return PAQUETES.some((x) => x.id === p) ? p : null;
  } catch (e) {
    return null;
  }
}
function guardarPaquete(id) {
  try {
    window.localStorage.setItem(CLAVE_PAQUETE, id);
  } catch (e) {
    /* sin almacenamiento: la pestaña simplemente no se recuerda */
  }
}

/* Nombre que se ve (puede estar personalizado); el id interno nunca cambia. */
const rotulo = (e) => nombres.etiqueta(e);

/* Una opción con «permiso» solo se ve si el perfil del usuario actual lo tiene (p. ej. Personalizar Botones). */
function visible(e) {
  if (!e.permiso) return true;
  if (!flujo.listo()) return false; // aún no se cargó quién es el usuario: se vuelve a dibujar al terminar
  const u = flujo.usuarioActual();
  return !!u && flujo.puede(u.id, e.permiso);
}

function contarBotones(entradas) {
  return entradas.filter(visible).reduce((n, e) => n + (e.tipo === "menu" ? contarBotones(e.hijos) : 1), 0);
}

function normalizar(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function indexar() {
  indice.clear();
  PAQUETES.forEach((p) => {
    const recorrer = (lista, ruta) =>
      lista.forEach((e) => {
        if (e.tipo === "menu") recorrer(e.hijos, ruta.concat(e.etiqueta));
        else indice.set(e.id, { entrada: e, paquete: p, ruta });
      });
    recorrer(p.entradas, []);
  });
}

/* ------------------------------------------------------------------ avisos */

let temporizadorAviso = null;
function avisar(texto, tipo) {
  const barra = raiz.querySelector("#tp-aviso");
  barra.textContent = texto;
  barra.setAttribute("data-tipo", tipo || "info");
  barra.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    barra.hidden = true;
  }, 6000);
}

/* ------------------------------------------------------------------ dibujo */

function dibujarBoton(entrada, nivel) {
  const b = el("button", nivel === 0 ? "tp-standalone" : nivel === 1 ? "tp-item" : "tp-item-sub");
  b.type = "button";
  b.dataset.id = entrada.id;
  b.dataset.label = rotulo(entrada);
  b.dataset.accion = entrada.accion;
  const nombre = el("span", "tp-btn-nombre", rotulo(entrada));
  b.appendChild(nombre);

  const marcas = el("span", "tp-marcas");
  if (entrada.nuevo) marcas.appendChild(el("span", "tp-pill tp-pill-nuevo", "Nuevo"));
  if (entrada.accion === "pendiente") marcas.appendChild(el("span", "tp-pill tp-pill-pendiente", "Pendiente"));
  marcas.appendChild(el("span", "tp-estado")); // lo llena marcarEstado()
  b.appendChild(marcas);

  if (entrada.accion === "pendiente") b.setAttribute("aria-description", "Opción pendiente de desarrollo");
  b.addEventListener("click", () => navegar(entrada.id));
  return b;
}

let contadorMenus = 0;
function dibujarMenu(entrada, nivel) {
  const frag = document.createDocumentFragment();
  const idPanel = "tp-menu-" + ++contadorMenus;
  const claseToggle = nivel === 0 ? "tp-row tp-row-toggle" : "tp-item tp-item-sub-toggle";
  const t = el("button", claseToggle);
  t.type = "button";
  t.setAttribute("aria-expanded", nivel === 0 ? "true" : "false");
  t.setAttribute("aria-controls", idPanel);
  t.dataset.menu = entrada.id;

  const nombre = el("span", nivel === 0 ? "tp-row-name" : "tp-btn-nombre", entrada.etiqueta);
  const der = el("span", "tp-row-right");
  der.appendChild(el("span", "tp-row-count", String(contarBotones(entrada.hijos))));
  const chev = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chev.setAttribute("class", "chev");
  chev.setAttribute("width", "11");
  chev.setAttribute("height", "11");
  chev.setAttribute("viewBox", "0 0 24 24");
  chev.setAttribute("fill", "none");
  chev.setAttribute("stroke", "currentColor");
  chev.setAttribute("stroke-width", "2");
  chev.setAttribute("aria-hidden", "true");
  const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  pl.setAttribute("points", "6 9 12 15 18 9");
  chev.appendChild(pl);
  der.appendChild(chev);
  t.appendChild(nombre);
  t.appendChild(der);

  const cuerpo = el("div", nivel === 0 ? "tp-group" : "tp-subgroup");
  cuerpo.id = idPanel;
  cuerpo.hidden = nivel !== 0;
  entrada.hijos.filter(visible).forEach((h) => cuerpo.appendChild(h.tipo === "menu" ? dibujarMenu(h, nivel + 1) : dibujarBoton(h, nivel + 1)));

  t.addEventListener("click", () => {
    const abierto = t.getAttribute("aria-expanded") === "true";
    t.setAttribute("aria-expanded", String(!abierto));
    cuerpo.hidden = abierto;
  });
  frag.appendChild(t);
  frag.appendChild(cuerpo);
  return frag;
}

function dibujarPaquete() {
  const p = PAQUETES.find((x) => x.id === paqueteActual);
  const lista = raiz.querySelector("#list");
  lista.innerHTML = "";
  contadorMenus = 0;
  p.entradas.filter(visible).forEach((e) => lista.appendChild(e.tipo === "menu" ? dibujarMenu(e, 0) : dibujarBoton(e, 0)));

  const n = contarBotones(p.entradas);
  raiz.querySelector("#tp-pkg-nombre").textContent = p.nombre;
  raiz.querySelector("#tp-pkg-cuenta").textContent = n + (n === 1 ? " opción" : " opciones");
  lista.setAttribute("aria-label", "Menú de " + p.nombre);
  raiz.querySelectorAll(".tp-tab").forEach((t) => {
    const activa = t.dataset.paquete === paqueteActual;
    t.classList.toggle("is-active", activa);
    t.setAttribute("aria-selected", String(activa));
    t.tabIndex = activa ? 0 : -1;
  });
  repintarEstados();
}

function dibujarPestanas() {
  const cont = raiz.querySelector("#tp-tabs");
  cont.innerHTML = "";
  PAQUETES.forEach((p) => {
    const t = el("button", "tp-tab", p.corto);
    t.type = "button";
    t.setAttribute("role", "tab");
    t.dataset.paquete = p.id;
    t.addEventListener("click", () => cambiarPaquete(p.id));
    cont.appendChild(t);
  });
  cont.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    const i = PAQUETES.findIndex((x) => x.id === paqueteActual);
    const sig = PAQUETES[(i + (ev.key === "ArrowRight" ? 1 : PAQUETES.length - 1)) % PAQUETES.length];
    cambiarPaquete(sig.id);
    cont.querySelector('[data-paquete="' + sig.id + '"]').focus();
  });
}

function cambiarPaquete(id) {
  paqueteActual = id;
  guardarPaquete(id);
  raiz.querySelector("#search").value = "";
  mostrarBusqueda("");
  dibujarPaquete();
}

/* ------------------------------------------------------------------ búsqueda (en los tres paquetes) */

function mostrarBusqueda(texto) {
  const q = normalizar(texto.trim());
  const lista = raiz.querySelector("#list");
  const res = raiz.querySelector("#tp-resultados");
  if (!q) {
    res.hidden = true;
    res.innerHTML = "";
    lista.hidden = false;
    return;
  }
  lista.hidden = true;
  res.hidden = false;
  res.innerHTML = "";
  let total = 0;
  PAQUETES.forEach((p) => {
    const coincide = [];
    indice.forEach((v, id) => {
      if (v.paquete.id === p.id && visible(v.entrada) && normalizar(rotulo(v.entrada) + " " + v.entrada.etiqueta + " " + v.ruta.join(" ") + " " + (v.entrada.codigo || "")).includes(q))
        coincide.push(v);
    });
    if (!coincide.length) return;
    res.appendChild(el("div", "tp-res-titulo", p.nombre + " (" + coincide.length + ")"));
    coincide.forEach((v) => {
      const b = dibujarBoton(v.entrada, 1);
      if (v.ruta.length) b.querySelector(".tp-btn-nombre").title = v.ruta.join(" › ");
      res.appendChild(b);
      total++;
    });
  });
  if (!total) res.appendChild(el("p", "tp-vacio", "Ninguna opción coincide con «" + texto.trim() + "»."));
  repintarEstados();
}

/* ------------------------------------------------------------------ qué pasa al pulsar */

function marcarActivo(id, etiqueta) {
  raiz.querySelectorAll(".is-active[data-id]").forEach((x) => x.classList.remove("is-active"));
  raiz.querySelectorAll('[data-id="' + id + '"]').forEach((x) => x.classList.add("is-active"));
  raiz.querySelector("#activeTitle").textContent = etiqueta;
}

async function abrirHoja(nombre) {
  if (typeof Excel === "undefined" || !Excel.run) {
    return { ok: false, motivo: "fuera-de-excel" };
  }
  try {
    let existe = true;
    await Excel.run(async (ctx) => {
      const hoja = ctx.workbook.worksheets.getItemOrNullObject(nombre);
      await ctx.sync();
      if (hoja.isNullObject) {
        existe = false;
        return;
      }
      hoja.visibility = "Visible"; // en el VBA muchas hojas se ocultan hasta que se usan
      hoja.activate();
      await ctx.sync();
    });
    return existe ? { ok: true } : { ok: false, motivo: "no-existe" };
  } catch (e) {
    console.error("AuditX: no se pudo abrir la hoja «" + nombre + "»", e);
    return { ok: false, motivo: "error" };
  }
}

/* Abre la hoja de Excel de un papel por su código (AA-04, AA-06…). */
async function abrirHojaDe(id) {
  const reg = indice.get(id);
  const nombre = reg && reg.entrada.hoja;
  if (!nombre) return { ok: false, texto: "Este papel no tiene hoja asociada." };
  const r = await abrirHoja(nombre);
  if (r.ok) return r;
  const texto = r.motivo === "fuera-de-excel" ? "Fuera de Excel no se puede abrir la hoja «" + nombre + "»." : r.motivo === "no-existe" ? "La hoja «" + nombre + "» no existe en este libro." : "No se pudo abrir la hoja «" + nombre + "». Revise la consola.";
  return { ...r, texto };
}

async function navegar(id) {
  const reg = indice.get(id);
  if (!reg) return;
  const e = reg.entrada;

  if (e.accion === "pendiente") {
    marcarActivo(id, rotulo(e));
    avisar("«" + rotulo(e) + "» se desarrolla después del " + AJUSTES.fechaCorte + ". Ya está en su lugar del menú.", "info");
    return;
  }

  if (e.accion === "enlace") {
    if (!e.url) {
      avisar("Falta configurar la dirección web de «" + rotulo(e) + "» en botones.config.js.", "aviso");
      return;
    }
    window.open(e.url, "_blank", "noopener");
    return;
  }

  if (e.accion === "hoja") {
    const r = await abrirHoja(e.hoja);
    if (r.ok) {
      marcarActivo(id, rotulo(e));
      avisar("Se abrió la hoja «" + e.hoja + "».", "ok");
    } else if (r.motivo === "no-existe") {
      avisar("La hoja «" + e.hoja + "» no existe en este libro.", "error");
    } else if (r.motivo === "fuera-de-excel") {
      avisar("Fuera de Excel no se puede abrir la hoja «" + e.hoja + "».", "aviso");
    } else {
      avisar("No se pudo abrir la hoja «" + e.hoja + "». Revise la consola.", "error");
    }
  }

  const detalle = { id, label: rotulo(e), paquete: reg.paquete.id, accion: e.accion, hoja: e.hoja || null, handled: false };
  if (e.accion === "hoja") detalle.handled = true;
  document.dispatchEvent(new CustomEvent("auditx:navigate", { detail: detalle }));

  if (e.accion === "flujo") {
    marcarActivo(id, rotulo(e));
    if (detalle.handled) return;
    if (VISTAS[id]) {
      abrirVista(id, VISTAS[id]);
      return;
    }
    if (e.enFlujo) {
      // Papel que participa del flujo pero aún no tiene su cuestionario: se abre su ficha.
      abrirVista(id, montarFicha);
      return;
    }
    avisar("«" + rotulo(e) + "» aún no está construida. Prevista: " + (e.previsto || "por definir") + ".", "info");
  }
}

/* ------------------------------------------------------------------ vista de un papel (ficha de flujo) */

let vista = null;
let fichaActiva = null;
let actual = null; // { id, montar } de la vista abierta
let pila = []; // vistas desde las que se llegó (para «Volver»)

function quitarVista() {
  if (fichaActiva) fichaActiva.destruir();
  fichaActiva = null;
  if (vista) vista.remove();
  vista = null;
}
function cerrarVista() {
  if (!vista) return;
  quitarVista();
  actual = null;
  pila = [];
  raiz.querySelector("#tp-tabs").hidden = false;
  raiz.querySelector(".tp-meta").hidden = false;
  raiz.querySelector(".tp-search").hidden = false;
  mostrarBusqueda(raiz.querySelector("#search").value);
}
/* apilar: la vista nueva se abre desde otra vista y «Volver» regresa a ella. */
function abrirVista(id, montar, { apilar = false, _restaurar: restaurar = false } = {}) {
  const previa = actual;
  quitarVista();
  if (apilar && previa) pila.push(previa);
  else if (!apilar && !restaurar) pila = [];
  raiz.querySelector("#list").hidden = true;
  raiz.querySelector("#tp-resultados").hidden = true;
  raiz.querySelector("#tp-tabs").hidden = true;
  raiz.querySelector(".tp-meta").hidden = true;
  raiz.querySelector(".tp-search").hidden = true;
  vista = el("section", "tp-vista");
  const atras = el("button", "tp-atras", pila.length ? "← Volver" : "← Volver al menú");
  atras.type = "button";
  atras.addEventListener("click", () => {
    if (pila.length) {
      const p = pila.pop();
      abrirVista(p.id, p.montar, { apilar: false, _restaurar: true });
    } else cerrarVista();
  });
  const cuerpo = el("div");
  vista.append(atras, cuerpo);
  raiz.querySelector("#tp-aviso").after(vista);
  actual = { id, montar };
  fichaActiva = montar(cuerpo, id);
}

/* Abre la ficha de flujo de un papel desde otra vista (estatus, pendientes, índice…). */
function abrirPapel(id) {
  abrirVista(id, VISTAS[id] || montarFicha, { apilar: true });
}

/* ------------------------------------------------------------------ estado de cada papel (lo pinta el flujo) */

const estados = new Map(); // id -> { estado, texto }
function marcarEstado(id, datos) {
  if (datos) estados.set(id, datos);
  else estados.delete(id);
  repintarEstados();
}
function repintarEstados() {
  if (!raiz) return;
  raiz.querySelectorAll("[data-id]").forEach((b) => {
    const slot = b.querySelector(".tp-estado");
    if (!slot) return;
    const d = estados.get(b.dataset.id);
    slot.textContent = d ? d.texto || d.estado : "";
    slot.setAttribute("data-estado", d ? d.estado : "");
    slot.hidden = !d;
  });
}

function irA(id) {
  const reg = indice.get(id);
  if (!reg) return;
  cerrarVista();
  if (reg.paquete.id !== paqueteActual) cambiarPaquete(reg.paquete.id);
  navegar(id);
}

/* Vuelve a dibujar el menú (cambió un nombre o la persona que actúa) sin perder la búsqueda ni la opción abierta. */
function refrescarMenu() {
  if (!raiz) return;
  dibujarPaquete();
  const q = raiz.querySelector("#search");
  if (q && q.value) mostrarBusqueda(q.value);
  const activo = raiz.querySelector(".is-active[data-id]");
  if (activo && indice.has(activo.dataset.id)) raiz.querySelector("#activeTitle").textContent = rotulo(indice.get(activo.dataset.id).entrada);
}

/* ------------------------------------------------------------------ arranque */

export async function iniciarPanel() {
  iniciarTema();
  raiz = document.getElementById("taskpane");
  if (!raiz || raiz.dataset.listo) return; // defensivo: no revienta si el markup cambia
  raiz.dataset.listo = "1";

  indexar();
  paqueteActual = leerPaqueteGuardado() || AJUSTES.paqueteInicial;
  dibujarPestanas();
  dibujarPaquete();

  raiz.querySelector("#search").addEventListener("input", (ev) => mostrarBusqueda(ev.target.value));

  window.AuditX = window.AuditX || {};
  window.AuditX.panel = { marcarEstado, irA, abrirPapel, abrirVista, abrirHoja, abrirHojaDe, paquetes: PAQUETES, retirados: RETIRADOS };
  document.addEventListener("auditx:volver", cerrarVista);
  document.addEventListener("auditx:nombres-cambio", refrescarMenu);
  document.addEventListener("auditx:flujo-usuario", refrescarMenu);
  document.dispatchEvent(new CustomEvent("auditx:panel-listo"));

  // Motor del flujo: lee el historial guardado en el libro y pinta el estado de cada papel.
  window.AuditX.flujo = flujo;
  window.AuditX.flujo.montarFicha = montarFicha;
  window.AuditX.proyecto = proyecto;
  window.AuditX.nombres = nombres;
  window.AuditX.logo = logo;
  window.AuditX.actualizarPT = actualizarPT;
  window.AuditX.empresas = empresas;
  window.AuditX.alertas = alertas;
  window.AuditX.comentarios = comentarios;
  window.AuditX.AA01 = aa01;
  window.AuditX.AA02 = aa02;
  window.AuditX.AA03 = aa03;
  try {
    await flujo.iniciar();
    await proyecto.iniciar();
    await nombres.iniciar();
    await logo.iniciar();
    await actualizarPT.iniciar();
    refrescarMenu();
    await empresas.iniciar();
    await comentarios.iniciar();
    await aa01.cargar();
    await cargarCuestionarios();
    await alertas.iniciar();
    hojaTI.vigilar();
  } catch (err) {
    console.error("AuditX: no se pudo iniciar el flujo", err);
    avisar("No se pudo leer el flujo de trabajo del libro. Revise la consola.", "error");
  }
}
