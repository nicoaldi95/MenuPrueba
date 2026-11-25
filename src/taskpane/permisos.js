/*
 * AuditX — Matriz de permisos por perfil (entregada por el cliente)
 * 5 perfiles × 10 acciones. Es configuración, no lógica dispersa: para cambiar un permiso se edita esta tabla.
 * El perfil (cargo en la firma) es distinto de los roles del flujo (Preparó / Revisó / Aprobó): el perfil dice
 * qué puede ADMINISTRAR; el rol dice qué hace en CADA PAPEL.
 */

export const PERFILES = [
  { id: "socio", nombre: "Socio/Partner" },
  { id: "gerente", nombre: "Gerente/Manager" },
  { id: "independiente", nombre: "Aud. Independiente" },
  { id: "asistente", nombre: "Asistente/Junior" },
  { id: "senior", nombre: "Senior/Supervisor" },
];

export const ACCIONES = [
  { id: "crear-usuario", nombre: "Crear usuario" },
  { id: "ver-usuarios", nombre: "Ver/consultar usuarios" },
  { id: "eliminar-usuario", nombre: "Eliminar usuario" },
  /* No aplica: el acceso lo da la cuenta de Microsoft 365; AuditX no guarda contraseñas. */
  { id: "cambiar-clave", nombre: "Cambiar contraseña de otro usuario", noAplica: true },
  { id: "habilitar-usuario", nombre: "Habilitar/deshabilitar usuario" },
  { id: "firma-digital", nombre: "Cargar firma digital" },
  { id: "modificar-perfiles", nombre: "Modificar perfiles y niveles de firma" },
  { id: "validar-cierre", nombre: "Validar cierre del proyecto/auditoría" },
  { id: "personalizar-botones", nombre: "Personalizar botones del complemento" },
  { id: "documentar-alertas", nombre: "Documentar y registrar alertas" },
];

/* Perfiles que SÍ tienen cada acción. */
const MATRIZ = {
  "crear-usuario": ["socio", "gerente"],
  "ver-usuarios": ["socio", "gerente", "independiente", "asistente", "senior"],
  "eliminar-usuario": ["socio", "gerente", "independiente", "asistente", "senior"],
  "cambiar-clave": ["socio", "gerente"],
  "habilitar-usuario": ["socio", "gerente", "independiente", "senior"],
  "firma-digital": ["socio", "gerente", "independiente", "asistente", "senior"],
  "modificar-perfiles": ["socio", "gerente", "independiente", "asistente"],
  "validar-cierre": ["socio"],
  "personalizar-botones": ["socio", "gerente", "independiente", "senior"],
  "documentar-alertas": ["socio", "gerente", "independiente", "senior"],
};

export const PERFIL_POR_DEFECTO = "asistente";

export const puedePerfil = (perfil, accion) => !!MATRIZ[accion] && MATRIZ[accion].includes(perfil) && !(ACCIONES.find((a) => a.id === accion) || {}).noAplica;
export const matriz = () => PERFILES.map((p) => ({ ...p, permisos: ACCIONES.map((a) => ({ accion: a.id, tiene: puedePerfil(p.id, a.id), noAplica: !!a.noAplica })) }));
export const nombrePerfil = (id) => (PERFILES.find((p) => p.id === id) || {}).nombre || id;

/* Para datos guardados antes de existir el perfil: se deduce de los roles del flujo. */
export const perfilDesdeRoles = (roles = []) => (roles.includes("aprueba") ? "socio" : roles.includes("supervisa") ? "gerente" : roles.includes("revisa") ? "senior" : "asistente");
