/*
 * AuditX — Equipo del encargo (AA-08 Estructura del equipo y asignación de responsabilidades)
 *
 * Une lo que dice la hoja AA-08 (roles y responsabilidades por cargo) con lo que ya sabe el flujo:
 * quién es cada persona, qué papeles le tocan ahora y qué comentarios tiene abiertos.
 * El plan de capacitación de la hoja AA-08 no se migra en este paquete.
 */

import flujo, { ESTADO } from "./flujo.js";
import comentarios from "./comentarios.js";
import { montarFicha } from "./flujo-ficha.js";
import { el, enCambios } from "./ui.js";

export const CARGOS = [{"cargo": "Socio de Auditoría", "resp": ["Responsable final del encargo de auditoría.", "Asegurar el cumplimiento de la NIA 220 y estándares de calidad.", "Firma del informe de auditoría."], "sup": ["Supervisa el trabajo del gerente y revisa los hallazgos clave.", "Evalúa riesgos críticos y toma decisiones estratégicas."], "dec": ["Aprobación de la estrategia de auditoría.", "Resolución de asuntos complejos.", "Validación de ajustes significativos en los estados financieros."]}, {"cargo": "Gerente de Auditoría", "resp": ["Coordina la ejecución del plan de auditoría.", "Gestiona la comunicación con el cliente.", "Revisa la documentación de auditoría y su calidad."], "sup": ["Supervisa el trabajo de auditores senior.", "Revisa procedimientos aplicados y ajustes.", "Reporta avances al socio."], "dec": ["Identificación de riesgos significativos.", "Aprobación de ajustes menores antes de la revisión del socio."]}, {"cargo": "Auditor Senior/Supervisor", "resp": ["Dirige al equipo junior en la ejecución de pruebas.", "Asegura el cumplimiento de procedimientos clave.", "Analiza riesgos y hallazgos relevantes."], "sup": ["Revisa los papeles de trabajo elaborados por auditores junior.", "Brinda soporte técnico y orientación al equipo."], "dec": ["Escalamiento de hallazgos importantes al gerente.", "Decisiones operativas sobre ejecución de pruebas."]}, {"cargo": "Auditor Junior/Asistente", "resp": ["Realiza pruebas de auditoría conforme al programa establecido.", "Documenta hallazgos y evidencia de auditoría.", "Ejecuta pruebas de detalle y controles."], "sup": ["Reporta dudas o inconsistencias al auditor senior.", "Sigue instrucciones y aplica procedimientos bajo supervisión."], "dec": ["Identificación de inconsistencias en la información revisada."]}];

function cargoDe(p) {
  const c = (p.cargo || "").toLowerCase();
  if (c.includes("socio")) return 0;
  if (c.includes("gerente")) return 1;
  if (c.includes("senior") || c.includes("supervisor")) return 2;
  return 3;
}

export function carga(pid) {
  const fichas = flujo.listar();
  const mios = fichas.filter((f) => Object.values(f.asignados).includes(pid));
  return {
    asignados: mios.length,
    aTurno: flujo.pendientesDe(pid).length,
    firmados: mios.filter((f) => f.estado === ESTADO.FIRMADO).length,
    comentarios: comentarios.listar({ estado: "abierto", para: pid }).length,
  };
}

function lista(titulo, items) {
  const d = el("div", "eq-lista");
  d.append(el("strong", null, titulo));
  const ul = el("ul");
  items.forEach((t) => ul.append(el("li", null, t)));
  d.append(ul);
  return d;
}

export function montarEquipoBloque(cont) {
  const pintar = () => {
    cont.textContent = "";
    cont.append(el("h3", "cm-tit", "Equipo del encargo"));
    const personas = flujo.personas(true);
    CARGOS.forEach((cg, i) => {
      const caja = el("details", "fl-bloque eq-cargo");
      caja.dataset.cargo = cg.cargo;
      const gente = personas.filter((p) => cargoDe(p) === i);
      caja.open = gente.length > 0;
      caja.append(el("summary", null, cg.cargo + " · " + (gente.length ? gente.map((p) => p.nombre).join(", ") : "sin asignar")));
      gente.forEach((p) => {
        const k = carga(p.id);
        const fila = el("div", "eq-persona");
        fila.dataset.persona = p.id;
        fila.append(el("strong", null, p.nombre));
        fila.append(el("span", "fm-ayuda", p.roles.map((r) => flujo.nombreRol(r)).join(" · ")));
        fila.append(el("span", "eq-carga", "A su turno: " + k.aTurno + " · Asignados: " + k.asignados + " · Firmados: " + k.firmados + " · Comentarios abiertos: " + k.comentarios));
        caja.append(fila);
      });
      caja.append(lista("Responsabilidades principales", cg.resp), lista("Supervisión y revisión del trabajo", cg.sup), lista("Toma de decisiones clave", cg.dec));
      cont.append(caja);
    });
    const huerfanas = personas.filter((p) => cargoDe(p) === 3 && !/junior|asistente/i.test(p.cargo));
    if (huerfanas.length) cont.append(el("p", "fm-ayuda", "Sin cargo reconocido en AA-08: " + huerfanas.map((p) => p.nombre + " (" + p.cargo + ")").join(", ") + ". Se ubican como auditor junior/asistente."));
  };
  pintar();
  return enCambios(cont, pintar, ["auditx:flujo-usuario", "auditx:flujo-config", "auditx:flujo-cambio", "auditx:comentarios-cambio"]);
}

/* Vista de AA-08: ficha del flujo arriba y, debajo, el equipo. */
export function montarEquipo(c) {
  const arriba = el("div");
  const abajo = el("div", "eq");
  c.textContent = "";
  c.append(arriba, abajo);
  const f = montarFicha(arriba, "AA-08");
  const e = montarEquipoBloque(abajo);
  return { destruir: () => (f.destruir && f.destruir(), e.destruir()) };
}
