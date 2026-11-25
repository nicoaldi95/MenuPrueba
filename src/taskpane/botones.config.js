/*
 * AuditX — Tabla de configuración de botones (Monitoreo y Control, Accesos, Pre-Planificación)
 *
 * Esta tabla es lo único que describe el menú: el panel (panel.js) la lee y dibuja todo.
 * Agregar, renombrar o mover un botón es editar una fila; no hay que tocar el HTML.
 * Reemplaza a los 10 manejadores idénticos del VBA y a los getLabel de «Personalizar Botones».
 *
 * Campos de cada entrada
 *   tipo      "boton" | "menu"           (un menu contiene "hijos")
 *   id        identificador estable      (lo usan los eventos y el flujo)
 *   etiqueta  texto que ve el usuario    (los nombres de AA-xx salen de «Personalizar Botones»)
 *   accion    "flujo"     vista propia del complemento (se desarrolla en estos 8 días)
 *             "hoja"      abre la hoja actual del libro desde el panel (la función no cambia todavía)
 *             "enlace"    abre una dirección web
 *             "pendiente" aparece en el panel, sin función; se desarrolla después del 20 de noviembre
 *   hoja      nombre de la hoja del libro (para "hoja", y como referencia en los papeles AA)
 *   codigo    código del documento maestro (M1–M10); los marcados «propuesto» no están en ese documento
 *   previsto  día en que se desarrolla (solo para "flujo")
 *   enFlujo   true: el papel participa en elaborar → revisar → firmar
 *   nuevo     true: opción que no existe en el Ribbon actual
 *   permiso   id de acción de la matriz de permisos: la opción solo se ve si el perfil del usuario la tiene
 */

export const AJUSTES = {
  fechaCorte: "20 de noviembre",
  paqueteInicial: "monitoreo", // el flujo empieza en Monitoreo y Control
};

export const PAQUETES = [
  /* ------------------------------------------------------------------ */
  {
    id: "monitoreo",
    nombre: "Monitoreo y Control",
    corto: "Monitoreo y Control",
    entradas: [
      {
        tipo: "menu", id: "menu1", etiqueta: "Usuarios y Firma de Auditoría",
        hijos: [
          { tipo: "boton", id: "usuarios", etiqueta: "Usuarios y Perfiles", accion: "flujo", codigo: "M1-01", previsto: "Mié 11 nov" },
          { tipo: "boton", id: "info-proyecto", etiqueta: "Información del proyecto", accion: "flujo", codigo: "M2-01", previsto: "Mié 11 nov" },
          { tipo: "boton", id: "crear-empresas", etiqueta: "Crear otras empresas", accion: "flujo", codigo: "M2-01" },
        ],
      },
      {
        tipo: "menu", id: "menu2", etiqueta: "Configurar Empresa",
        hijos: [
          { tipo: "boton", id: "empresa", etiqueta: "Configurar Empresa", accion: "flujo", codigo: "M2-01", previsto: "Mié 11 nov" },
          { tipo: "boton", id: "onedrive", etiqueta: "Carpeta OneDrive", accion: "flujo", codigo: "M2-01", previsto: "Mié 11 nov" },
          { tipo: "boton", id: "personalizar", etiqueta: "Personalizar Botones", accion: "flujo", codigo: "M1-02", previsto: "Mar 10 nov", permiso: "personalizar-botones" },
          { tipo: "boton", id: "logo", etiqueta: "Cambiar logo de los papeles de trabajo", accion: "flujo", codigo: "M1-02", previsto: "Mié 26 nov", permiso: "personalizar-botones" },
          { tipo: "boton", id: "actualizar-pt", etiqueta: "Actualizar Información de los Papeles de Trabajo", accion: "flujo", codigo: "M2-08" },
        ],
      },
      {
        tipo: "menu", id: "menu55", etiqueta: "Tiempo y cronograma",
        hijos: [
          { tipo: "boton", id: "ti-tiempo", etiqueta: "TI-Tiempo Invertido", accion: "flujo", hoja: "TI - Tiempo Invertido", codigo: "M2-10", enFlujo: true },
          { tipo: "boton", id: "cronograma", etiqueta: "CR-Cronograma Auditoría", accion: "flujo", codigo: "M8-07", previsto: "Vie 13 nov" },
        ],
      },
      {
        tipo: "menu", id: "menu3", etiqueta: "Gestión de Tareas",
        hijos: [
          { tipo: "boton", id: "tareas-asignar", etiqueta: "Asignar Tareas", accion: "pendiente", codigo: "M8-02" },
          { tipo: "boton", id: "tareas-consultar", etiqueta: "Consultar y Responder Tareas", accion: "hoja", hoja: "Registro Activ. Ejecucion", codigo: "M8-03" },
          { tipo: "boton", id: "tareas-kanban", etiqueta: "Kanban de Tareas", accion: "pendiente", codigo: "M10-02" },
          { tipo: "boton", id: "tareas-dashboard", etiqueta: "Dashboard de Tareas", accion: "hoja", hoja: "Dashboard Ej", codigo: "M10-01" },
        ],
      },
      { tipo: "boton", id: "indice", etiqueta: "Índice de papeles de trabajo", accion: "flujo", hoja: "Indice", codigo: "M2-02", previsto: "Jue 12 nov" },
      { tipo: "boton", id: "dashboard-proyecto", etiqueta: "Dashboard del Proyecto", accion: "flujo", hoja: "Dashboard Proyecto", codigo: "M10-01", previsto: "Vie 13 nov" },
      {
        tipo: "menu", id: "menu56", etiqueta: "Alertas",
        hijos: [
          { tipo: "boton", id: "alertas", etiqueta: "Listado de Alertas", accion: "flujo", hoja: "Listado Alertas", codigo: "M10-03", previsto: "Vie 13 nov" },
          { tipo: "boton", id: "alertas-doc", etiqueta: "Documentación de Alertas", accion: "flujo", hoja: "Listado Alertas", codigo: "M10-03", previsto: "Vie 13 nov" },
        ],
      },
      { tipo: "boton", id: "comunicaciones", etiqueta: "Registro de comunicaciones", accion: "hoja", hoja: "Registro Comunicaciones", codigo: "M2-11 (propuesto)" },
      {
        tipo: "menu", id: "menu58", etiqueta: "Status PT y control de firmas",
        hijos: [
          { tipo: "boton", id: "estatus-firmas", etiqueta: "Estatus de Firmas PT", accion: "flujo", hoja: "Estatus PT Auditoria", codigo: "M2-02", previsto: "Jue 12 nov" },
          { tipo: "boton", id: "pendientes-firma", etiqueta: "Papeles pendientes de firma", accion: "flujo", hoja: "Estatus PT Auditoria", codigo: "M2-02 / M8-04", previsto: "Jue 12 nov" },
          { tipo: "boton", id: "firmados", etiqueta: "Papeles firmados", accion: "flujo", hoja: "Estatus PT Auditoria", codigo: "M2-02", previsto: "Jue 12 nov" },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "accesos",
    nombre: "Accesos",
    corto: "Accesos",
    entradas: [
      { tipo: "boton", id: "firmar-pt", etiqueta: "Firmar PT", accion: "flujo", codigo: "M2-04", previsto: "Mar 17 nov" },
      { tipo: "boton", id: "historial", etiqueta: "Historial del papel (quién y cómo)", accion: "flujo", codigo: "M2-02", previsto: "Mar 17 nov", nuevo: true },
      { tipo: "boton", id: "comentarios-pt", etiqueta: "Comentarios PT", accion: "flujo", codigo: "M2-05" },
      {
        tipo: "menu", id: "menu5", etiqueta: "Sumarias",
        hijos: [
          { tipo: "boton", id: "sumarias-agregar", etiqueta: "Agregar Sumarias", accion: "hoja", hoja: "Balance para Sumarias", codigo: "M5-01" },
          { tipo: "boton", id: "sumarias-config", etiqueta: "Configuración de Sumarias", accion: "pendiente", codigo: "M5-02" },
        ],
      },
      {
        tipo: "menu", id: "menu57", etiqueta: "Adjuntar Archivos y Crear PDF",
        hijos: [
          { tipo: "boton", id: "adjuntar", etiqueta: "Adjuntar archivo / Registrar comunicación", accion: "pendiente", codigo: "M2-11 (propuesto)" },
          { tipo: "boton", id: "pdf", etiqueta: "Generar PDF", accion: "flujo", codigo: "M2-11 (propuesto)", previsto: "Mar 17 nov" },
        ],
      },
      {
        tipo: "menu", id: "menu6", etiqueta: "Riesgos",
        hijos: [
          { tipo: "boton", id: "riesgo-nuevo", etiqueta: "Asignar Nuevo Riesgo o Transacción Significativa", accion: "pendiente", codigo: "M4-05" },
          { tipo: "boton", id: "riesgo-biblioteca", etiqueta: "Biblioteca de Riesgos", accion: "pendiente", hoja: "Biblioteca de Riesgos", codigo: "M1-03" },
        ],
      },
      {
        tipo: "menu", id: "menu7", etiqueta: "Hallazgos y Planes de acción",
        hijos: [
          { tipo: "boton", id: "hallazgo", etiqueta: "Agregar un nuevo hallazgo", accion: "pendiente", codigo: "M7-01" },
          { tipo: "boton", id: "planes", etiqueta: "Planes de acción", accion: "pendiente", codigo: "M7-03" },
        ],
      },
      { tipo: "boton", id: "marcas", etiqueta: "Marcas de Auditoría", accion: "pendiente", hoja: "Resumen Marcas Auditoría", codigo: "M1-02" },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "preplanificacion",
    nombre: "Pre-Planificación",
    corto: "Pre-Planificación",
    entradas: [
      { tipo: "boton", id: "guia", etiqueta: "Guía Pre-Planificación", accion: "enlace", url: "", codigo: "M1-05" },
      {
        tipo: "menu", id: "menu8", etiqueta: "Programas Pre-Planificación",
        hijos: [
          { tipo: "boton", id: "AA-01", etiqueta: "AA-01 Cuestionario Aceptación del Cliente", accion: "flujo", hoja: "AA-01 Cuestionario Acept.", codigo: "M3-01", previsto: "Mié 18 nov", enFlujo: true },
          { tipo: "boton", id: "AA-02", etiqueta: "AA-02 Cuestionario Continuidad del Cliente", accion: "flujo", hoja: "AA-02 Cuestionario Contin.", codigo: "M3-01", enFlujo: true },
          { tipo: "boton", id: "AA-03", etiqueta: "AA-03 Verificación Compromisos del Equipo de Auditoría", accion: "flujo", hoja: "AA-03 Verif. Compromisos Equipo", codigo: "M3-02", enFlujo: true },
          { tipo: "boton", id: "AA-04", etiqueta: "AA-04 Acuerdo de los términos del encargo de auditoría", accion: "flujo", hoja: "AA-04 Acuerdos de Encargo", codigo: "M3-03", enFlujo: true },
          {
            tipo: "menu", id: "menu9", etiqueta: "AA-05 Saldos de apertura",
            hijos: [
              { tipo: "boton", id: "AA-05-1", etiqueta: "AA-05-1 Encargos Iniciales - Saldos de Apertura (NIA 510)", accion: "flujo", hoja: "AA-05 NIA 510 Saldos Apertura", codigo: "M3-04", enFlujo: true },
              { tipo: "boton", id: "AA-05-2", etiqueta: "AA-05-2 Programa de auditoría para saldos iniciales", accion: "flujo", hoja: "AA-05-2 Programa Saldos Inicial", codigo: "M3-04", enFlujo: true },
            ],
          },
          { tipo: "boton", id: "AA-06", etiqueta: "AA-06 Consulta: Base de Datos", accion: "flujo", hoja: "AA-06 Consulta Bases de Datos", codigo: "M3-06 (propuesto)", enFlujo: true },
          { tipo: "boton", id: "AA-07", etiqueta: "AA-07 Gestión de Calidad", accion: "flujo", hoja: "AA-07 Control de Calidad", codigo: "M3-05", enFlujo: true },
          { tipo: "boton", id: "AA-08", etiqueta: "AA-08 Estructura del equipo y asignación de responsabilidades", accion: "flujo", hoja: "AA-08 Est. Equipo", codigo: "M3-05", enFlujo: true },
          { tipo: "boton", id: "AA-09", etiqueta: "AA-09 Otros Requerimientos", accion: "flujo", hoja: "AA-09 Otros Requerimientos", codigo: "M3-06 (propuesto)", enFlujo: true },
        ],
      },
    ],
  },
];

/*
 * Elementos del Ribbon actual que NO se dibujan en el panel (se eliminan).
 * Se dejan aquí para que quede constancia de qué los reemplaza.
 */
export const RETIRADOS = [
  { paquete: "preplanificacion", id: "adjuntos", etiqueta: "Ver Doc Adjuntos — Preplanificación", reemplazo: "Biblioteca de SharePoint del encargo (M2-11, propuesto)" },
  { paquete: "preplanificacion", id: "modelo-carta", etiqueta: "Modelo Carta de Encargo de Auditoría (ya comentado en el Ribbon)", reemplazo: "La carta de encargo de AA-04 (M3-03)" },
];
