/*
 * AuditX — Configuración del flujo de trabajo (elaborar → revisar → firmar)
 *
 * Todo lo que se puede decidir sin tocar el motor (flujo.js) está aquí.
 * Los cambios hechos desde la pantalla (roles activos, personas) se guardan en el libro
 * y tienen prioridad sobre estos valores iniciales.
 */

/* Roles del flujo. «prepara» y «aprueba» no se pueden desactivar. Los dos del medio son opcionales. */
export const ROLES = [
  { id: "prepara", nombre: "Preparó", accion: "Elaboración", activo: true, fijo: true },
  { id: "revisa", nombre: "Revisó", accion: "Revisión", activo: true },
  { id: "supervisa", nombre: "Supervisó", accion: "Supervisión", activo: false },
  { id: "aprueba", nombre: "Aprobó y firmó", accion: "Firma", activo: true, fijo: true },
];

export const REGLAS = {
  /* Quien elaboró un papel no puede revisarlo ni firmarlo. */
  separarFunciones: true,
  /* Devolver un papel o reabrir uno firmado exige explicar el motivo. */
  notaObligatoria: true,
  /* Si el contenido cambia después de revisado o firmado, el papel vuelve a elaboración. */
  cambioReabre: true,
  /* Roles que pueden asignar responsables. */
  puedenAsignar: ["supervisa", "aprueba"],
  /* Roles que pueden administrar usuarios, datos del proyecto y de la empresa. */
  puedenAdministrarUsuarios: ["aprueba"],
};

/* Personas de ejemplo. Se reemplazan por usuarios de Microsoft 365 cuando se conecte el inicio de sesión. */
export const PERSONAS = [
  { id: "p-laura", nombre: "Laura Gómez", cargo: "Auditor junior", roles: ["prepara"] },
  { id: "p-andres", nombre: "Andrés Rojas", cargo: "Auditor senior", roles: ["prepara", "revisa"] },
  { id: "p-marcela", nombre: "Marcela Díaz", cargo: "Gerente de auditoría", roles: ["revisa", "supervisa"] },
  { id: "p-carlos", nombre: "Carlos Mejía", cargo: "Socio", roles: ["revisa", "supervisa", "aprueba"] },
];

export const ALMACEN = {
  namespace: "http://auditool.org/auditx/flujo/v1",
  claveLocal: "auditx.flujo.v1",
  claveUsuario: "auditx.flujo.usuario",
};
