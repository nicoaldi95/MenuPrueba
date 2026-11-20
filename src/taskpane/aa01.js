/*
 * AuditX — AA-01 Cuestionario de aceptación del cliente (vista del papel)
 *
 * Qué hace:
 *  - Dibuja las 10 secciones y los 36 requerimientos de la hoja «AA-01 Cuestionario Acept.»
 *    (Respuesta Sí/No/N/A, Riesgo, Ref. P/T, Hecho por y fecha, Comentarios).
 *  - Calcula el avance y la clasificación de riesgo del cliente con la misma regla de la hoja.
 *  - Verifica pendientes, bloquea y firma el papel (la firma se invalida si el contenido cambia).
 *  - Guarda dentro del libro (parte XML personalizada) y, fuera de Excel, en localStorage.
 *
 * Punto de integración con el menú de Pre-Planificación (taskpane.js):
 *  - Escucha  «auditx:navigate»  con detail.id === "AA-01" para mostrarse.
 *  - Emite    «auditx:estado-papel»  con el estado, el avance y el riesgo (alimenta el índice vivo, M2-02).
 *  - Emite    «auditx:volver»  al pulsar la flecha de regreso.
 *
 * Códigos del documento maestro: M3-01 (cuestionario digital con conclusión y firma),
 * M2-04 (firma) y M1-02 (escala de riesgo configurable).
 */

/* global Office, Excel, document, window, console */

import flujo from "./flujo.js";
import proyecto from "./proyecto.js";
import ESQUELETO from "./aa01-esqueleto.js";

var ID_FLUJO = "AA-01";

  /* =====================================================================
   * 1. CONFIGURACIÓN (lo que Auditool puede ajustar sin tocar la lógica)
   * ===================================================================== */
  var CONFIG = {
    ID_PAPEL: "AA-01",
    VERSION_ESQUEMA: 1,
    NAMESPACE_XML: "http://auditool.org/auditx/aa01/v1",
    CLAVE_LOCAL: "auditx.aa01.v1",
    AUTOGUARDADO_MS: 600,

    // Escala de riesgo de la firma, de menor a mayor (hoy: hoja de control, celdas L351:L355).
    // El puntaje de cada nivel es su posición: 1 = primero … 5 = último. Se personaliza en M1-02.
    NIVELES_RIESGO: ["MÍNIMO", "BAJO", "MEDIO", "ALTO", "CRÍTICO"],

    // Escala propia de las amenazas a la independencia (no entra en la clasificación del cliente).
    NIVELES_AMENAZA: ["Aceptable", "Tolerable", "Alto", "Extremo"],
    TIPOS_RIESGO: ["Negocio", "Fraude", "Procesos"],
    FRECUENCIAS: ["Anual", "Mensual", "Trimestral", "Diario", "Por evento"],
    MAX_RIESGOS_EEFF: 5,
    MAX_REGISTRO: 12,

    // Reglas de completitud. Los «bloqueos» impiden firmar; los «avisos» solo advierten.
    EXIGIR_RIESGO_EN_TODAS: false,   // false: solo se exige nivel de riesgo cuando la respuesta es «No»
    EXIGIR_JUSTIFICACION: false,     // true: «No» y «N/A» deben llevar comentario para poder firmar

    // Ganchos de integración. Reemplácelos cuando existan (SSO de Microsoft 365, creación de encargo).
    // Conectados al flujo (quién actúa) y a la información del proyecto (datos del encargo).
    obtenerUsuario: function () { return Promise.resolve(usuarioAhora()); },
    obtenerEncargo: function () { return Promise.resolve(proyecto.encabezado()); }
  };

  /* =====================================================================
   * 2. DATOS DEL CUESTIONARIO (extraídos de la hoja original)
   *    fila  = fila de la hoja «AA-01 Cuestionario Acept.» (sirve para migrar datos antiguos)
   *    resp  = se contesta Sí / No / N/A
   *    riesgo= lleva nivel de riesgo y entra en la clasificación del cliente
   *    amenaza = lleva nivel de amenaza (escala propia)
   * ===================================================================== */
  var SECCIONES = [
    { n: 1, titulo: "Preliminares", reqs: [
      {id: "1", fila: 25, num: 1, texto: "¿Se obtuvo información suficiente mediante entrevistas y revisión documental con el personal clave del cliente, que permita entender su estructura organizacional, sector, desempeño financiero reciente y riesgos asociados?", resp: true, riesgo: true},
    ] },
    { n: 2, titulo: "Carácter e integridad del cliente prospecto", reqs: [
      {id: "2", fila: 29, num: 2, texto: "¿Se ha evaluado la reputación del cliente prospecto a través de referencias externas o conocimiento previo, y se considera favorable?", resp: true, riesgo: true},
      {id: "3", fila: 30, num: 3, texto: "¿Existen indicios, antecedentes o condiciones que puedan limitar el alcance del trabajo o dificultar la obtención de evidencia suficiente, tales como informes anteriores con salvedades?", resp: true, riesgo: true},
      {id: "4", fila: 31, num: 4, texto: "¿Existe evidencia objetiva o razonable para confiar en la integridad de los accionistas, consejo de administración y alta dirección, sin antecedentes que generen dudas éticas o legales?", resp: true, riesgo: true},
      {id: "5", fila: 33, num: 5, texto: "Estamos razonablemente satisfechos de que no existe alguna de las siguientes situaciones:", resp: false, hijos: [
        {id: "5.1", fila: 34, etq: "a)", texto: "Condena y sanciones regulatorias", resp: true, riesgo: true},
        {id: "5.2", fila: 35, etq: "b)", texto: "Sospecha de actos ilícitos o fraude", resp: true, riesgo: true},
        {id: "5.3", fila: 36, etq: "c)", texto: "Investigaciones en curso por parte de las entidades de control.", resp: true, riesgo: true},
        {id: "5.4", fila: 37, etq: "d)", texto: "Miembros de la dirección que pertenezcan a organizaciones profesionales de dudosa reputación", resp: true, riesgo: true},
        {id: "5.5", fila: 38, etq: "e)", texto: "Noticias publicadas que deterioren la imagen de la entidad y de los integrantes de la misma", resp: true, riesgo: true},
        {id: "5.6", fila: 39, etq: "f)", texto: "Cambios frecuentes en los ejecutivos", resp: true, riesgo: true},
        {id: "5.7", fila: 40, etq: "g)", texto: "Asociación cercana con personas o compañías cuya ética es cuestionable o ha sido cuestionada", resp: true, riesgo: true},
        {id: "5.8", fila: 41, texto: "Además, ¿Se han realizado búsquedas abiertas y en bases especializadas para corroborar la información disponible sobre el cliente?", ayuda: "Cualquier hallazgo se documenta en el anexo o se incluye en el expediente de evaluación. Ver AA-06: Consulta base de datos.", resp: true, riesgo: true}
      ]},
    ] },
    { n: 3, titulo: "Sector y naturaleza del negocio", reqs: [
      {id: "6", fila: 45, num: 6, texto: "¿El cliente opera en una industria catalogada por la firma como de alto riesgo, ya sea por factores regulatorios, fiscales, legales, reputacionales o de cumplimiento?", resp: true, riesgo: true},
      {id: "7", fila: 46, num: 7, texto: "¿Existe evidencia o se ha manifestado la intención de vender total o parcialmente el negocio en el corto o mediano plazo? Evaluar su impacto en los estados financieros.", resp: true, riesgo: true},
      {id: "8", fila: 47, num: 8, texto: "¿Se tiene conocimiento de que el cliente ha sido rechazado por otros profesionales, ha cambiado repetidamente de auditor, o busca activamente opiniones contables favorables?", nota: "Documentar y considerar cuidadosamente su impacto en el riesgo y la aceptación.", resp: true, riesgo: true},
    ] },
    { n: 4, titulo: "Auditor o profesional de la contabilidad predecesor", reqs: [
      {id: "9", fila: 51, num: 9, texto: "Nos comunicamos con el auditor o profesional de la contabilidad predecesor (Esta comunicación debe realizarse antes de aceptar el encargo, siempre que las normas locales lo permitan) para indagar acerca de:", resp: false, hijos: [
        {id: "9.1", fila: 52, etq: "a)", texto: "Acceso a los papeles de trabajo del posible cliente.", resp: true, riesgo: true},
        {id: "9.2", fila: 53, etq: "b)", texto: "Honorarios impagos.", resp: true, riesgo: true},
        {id: "9.3", fila: 54, etq: "c)", texto: "Diferencias de opinión o desacuerdos.", resp: true, riesgo: true},
        {id: "9.4", fila: 55, etq: "d)", texto: "Integridad de la dirección y del consejo.", resp: true, riesgo: true},
        {id: "9.5", fila: 56, etq: "e)", texto: "Exigencias poco razonables o falta de cooperación.", resp: true, riesgo: true}
      ]},
      {id: "10", fila: 57, num: 10, texto: "Obtuvimos permiso de la firma de auditoría predecesora para revisar los papeles de trabajo del año pasado (si está permitido). De ser así, revisamos la documentación de planificación del período anterior elaborada por dicha firma de auditoría, y determinamos si la firma de auditoría predecesora:", resp: true, riesgo: true, hijos: [
        {id: "10.1", fila: 58, etq: "a)", texto: "¿Confirmó su independencia del cliente?", resp: true, riesgo: true},
        {id: "10.2", fila: 59, etq: "b)", texto: "¿En caso de una auditoría, la condujo conforme a las NIA?", resp: true, riesgo: true}
      ]},
      {id: "11", fila: 60, num: 11, texto: "¿Se revisaron los siguientes documentos del auditor anterior como parte del proceso de aceptación del cliente?", resp: false, hijos: [
        {id: "11.1", fila: 61, etq: "a)", texto: "Informe de auditoría del ejercicio anterior", resp: true, riesgo: true},
        {id: "11.2", fila: 62, etq: "b)", texto: "Carta de manifestaciones de la gerencia", resp: true, riesgo: true},
        {id: "11.3", fila: 63, etq: "c)", texto: "Papeles de trabajo de planeación (evaluación de riesgos, estrategia global)", resp: true, riesgo: true},
        {id: "11.4", fila: 64, etq: "d)", texto: "Documentación sobre la evaluación de materialidad y ajustes propuestos", resp: true, riesgo: true},
        {id: "11.5", fila: 65, etq: "e)", texto: "Evidencia de cumplimiento con las Normas Internacionales de Auditoría (NIA)", resp: true, riesgo: true}
      ]},
    ] },
    { n: 5, titulo: "Estados financieros anteriores", reqs: [
      {id: "12", fila: 69, num: 12, texto: "Obtuvimos y revisamos las copias de:", resp: false, hijos: [
        {id: "12.1", fila: 70, etq: "a)", texto: "Estados financieros de los dos últimos años, como mínimo.", resp: true, riesgo: true},
        {id: "12.2", fila: 71, etq: "b)", texto: "Declaraciones de impuestos y documentos relacionados de los últimos dos años.", resp: true, riesgo: true},
        {id: "12.3", fila: 72, etq: "c)", texto: "Clase de opinión emitida por el auditor, sobre los estados financieros", resp: true, riesgo: true},
        {id: "12.4", fila: 73, etq: "d)", texto: "Informe de auditoría del ejercicio anterior, incluyendo cualquier salvedad, énfasis o limitación expresada", resp: true, riesgo: true},
        {id: "12.5", fila: 74, etq: "e)", texto: "Cartas de representación de los últimos dos años.", resp: true, riesgo: true}
      ]},
      {id: "13", fila: 75, num: 13, texto: "Suponiendo que tengamos acceso, revisamos los papeles de trabajo del período anterior elaborados por el auditor o profesional de la contabilidad predecesor, para:", resp: false, hijos: [
        {id: "13.1", fila: 76, etq: "a)", texto: "Determinar la razonabilidad de los saldos de cierre de períodos anteriores, poniendo particular atención a las cuentas significativas, y decidir si alguna de ellas debe reformularse.", resp: true, riesgo: true},
        {id: "13.2", fila: 77, etq: "b)", texto: "Determinar si el auditor/profesional de la contabilidad predecesor identificó errores materiales.", resp: true, riesgo: true},
        {id: "13.3", fila: 78, etq: "c)", texto: "Determinar el efecto en el año actual, de cualquier error inmaterial no ajustados en el año anterior.", resp: true, riesgo: true},
        {id: "13.4", fila: 79, etq: "d)", texto: "Determine el adecuado sistema de contabilidad de la dirección, revisando los ajustes del auditor/profesional de la contabilidad predecesor, cartas de representación y cambios relevantes en la política contable entre períodos.", resp: true, riesgo: true}
      ]},
      {id: "14", fila: 80, num: 14, texto: "Determinamos cuáles fueron las principales políticas y métodos contables usados en los estados financieros del año anterior y consideramos si eran adecuados y si se aplicaron de manera uniforme. Por ejemplo:", resp: false, hijos: [
        {id: "14.1", fila: 81, etq: "a)", texto: "Valoraciones significativas, como la provisión para cuentas dudosas, inventarios e inversiones.", resp: true, riesgo: true},
        {id: "14.2", fila: 82, etq: "b)", texto: "Políticas y tasas de amortización.", resp: true, riesgo: true},
        {id: "14.3", fila: 83, etq: "c)", texto: "Estimaciones significativas.", resp: true, riesgo: true},
        {id: "14.4", fila: 84, etq: "d)", texto: "Otros (Por ejemplo, criterios para activos biológicos, intangibles o inversiones mantenidas a largo plazo).", resp: true, riesgo: true}
      ]},
      {id: "15", fila: 85, num: 15, texto: "En caso de una auditoría, ¿es necesario aplicar procedimientos de auditoría adicionales en relación con las principales transacciones y/o saldos del año anterior para reducir el riesgo de error en los saldos iniciales de las cuentas?", nota: "En caso afirmativo, indicar la referencia a los papeles de trabajo con tales procedimientos.", resp: true, riesgo: true, hijos: [
        {id: "15.1", fila: 86, texto: "¿Existe evidencia suficiente de la aplicación adecuada de controles en el período anterior?", resp: true, riesgo: true}
      ]},
      {id: "16", fila: 87, num: 16, texto: "Se determinó si es necesario establecer una limitación al alcance de nuestra opinión debido a la imposibilidad de obtener suficiente seguridad en cuanto a los saldos iniciales.", resp: true, riesgo: true},
    ] },
    { n: 6, titulo: "Aspectos financieros", reqs: [
      {id: "17", fila: 91, num: 17, texto: "¿Se ha identificado alguna de las siguientes condiciones que puedan afectar la viabilidad financiera o la continuidad del negocio?", resp: false, hijos: [
        {id: "17.1", fila: 92, texto: "Dificultades financieras presentes o previsibles.", resp: true, riesgo: true},
        {id: "17.2", fila: 93, texto: "Inadecuado flujo de tesorería.", resp: true, riesgo: true},
        {id: "17.3", fila: 94, texto: "Falta de flexibilidad en la política de préstamos.", resp: true, riesgo: true},
        {id: "17.4", fila: 95, texto: "Falta de financiación propia.", resp: true, riesgo: true},
        {id: "17.5", fila: 96, texto: "En caso afirmativo, documentar brevemente las fuentes de la información o adjuntar soporte financiero disponible.", resp: false}
      ]},
    ] },
    { n: 7, titulo: "Conocimiento específico", reqs: [
      {id: "18", fila: 100, num: 18, texto: "¿Se ha documentado un conocimiento general del negocio y operaciones del cliente, incluyendo su estructura legal, sector económico, procesos clave, sistemas contables y fuentes principales de ingresos y riesgos?", nota: "(Redacte un memorando de conocimiento del cliente o use un listado de verificación estándar para proporcionar esta información)", resp: true, riesgo: true},
      {id: "19", fila: 101, num: 19, texto: "¿Los socios y el equipo asignado al encargo poseen suficiente conocimiento sobre las prácticas contables aplicables al sector del cliente?", nota: "En caso negativo, ¿se ha determinado cómo y de dónde se obtendrá dicho conocimiento? Identificar y documentar las fuentes utilizadas.", resp: true, riesgo: true},
      {id: "20", fila: 102, num: 20, texto: "¿Se han identificado áreas del encargo que requieran conocimientos especializados (por ejemplo: valuaciones, impuestos complejos, derivados financieros)?", nota: "En caso afirmativo, ¿se cuenta con acceso a los conocimientos necesarios? Identificar la fuente de especialización o experto externo si aplica.", resp: true, riesgo: true},
    ] },
    { n: 8, titulo: "Evaluación de la independencia", reqs: [
      {id: "21", fila: 106, num: 21, texto: "Existen prohibiciones adicionales que no tratamos aquí y que se aplican a encargos para entidades de interés público. Debe consultarse la Sección 290 y la Sección 291 del Código del IESBA para todos los requerimientos y orientaciones pertinentes.", resp: false},
      {id: "22", fila: 107, num: 22, texto: "Identificar y documentar las prohibiciones que existan (las amenazas a la independencia para las que no existen salvaguardas adecuadas), tales como:", resp: false, hijos: [
        {id: "22.1", fila: 108, etq: "a)", texto: "Aceptar regalos de valor o invitaciones del cliente.", resp: true, riesgo: true},
        {id: "22.2", fila: 109, etq: "b)", texto: "Tener relaciones de negocio estrechas con el cliente.", resp: true, riesgo: true},
        {id: "22.3", fila: 110, etq: "c)", texto: "Tener relaciones familiares y personales con el cliente.", resp: true, riesgo: true},
        {id: "22.4", fila: 111, etq: "d)", texto: "Presentar una cotización de honorarios considerablemente menor a los precios del mercado (a menos que la documentación aporte evidencia de que se cumplieron todas las normas aplicables).", resp: true, riesgo: true},
        {id: "22.5", fila: 112, etq: "e)", texto: "Tener intereses financieros con el cliente.", resp: true, riesgo: true},
        {id: "22.6", fila: 113, etq: "f)", texto: "Contratación de personal reciente con el cliente dentro del período prescrito (o una contratación que se espere en el futuro), para ocupar un puesto administrativo, director o empleado con influencia significativa.", resp: true, riesgo: true},
        {id: "22.7", fila: 114, etq: "g)", texto: "Préstamos y avales al/del cliente.", resp: true, riesgo: true},
        {id: "22.8", fila: 115, etq: "h)", texto: "Elaborar asientos o clasificaciones contables sin la aprobación previa de la dirección.", resp: true, riesgo: true},
        {id: "22.9", fila: 116, etq: "i)", texto: "Realizar funciones de dirección para el cliente.", resp: true, riesgo: true},
        {id: "22.10", fila: 117, etq: "j)", texto: "Prestar servicios distintos al de auditoría (servicios que proporcionan un grado de seguridad) como finanzas corporativas, servicios legales que conlleven la resolución de disputas o servicios de valoración que impliquen la valoración de elementos materiales para los estados financieros.", resp: true, riesgo: true}
      ]},
      {id: "23", fila: 118, num: 23, texto: "¿Todos los miembros del equipo han firmado declaración de cumplimiento con los requisitos de ética, incluyendo independencia?", resp: true, riesgo: true},
      {id: "24", fila: 119, num: 24, texto: "¿Existen restricciones legales o contractuales que impidan asumir el encargo?", resp: true, riesgo: true},
      {id: "25", fila: 120, num: 25, texto: "¿Algún miembro del equipo está impedido por relaciones, vínculos o conflictos de interés?", resp: true, riesgo: true},
      {id: "26", fila: 121, num: 26, texto: "Consultar la Parte B del Código del IESBA para mayor orientación sobre la identificación de amenazas y salvaguardas relativas a la independencia.", resp: false, hijos: [
        {id: "26.1", fila: 122, etq: "a)", texto: "¿Se identificaron amenazas a la independencia respecto de las que pueda haber salvaguardas?. ¿Estas fueron documentadas?", nota: "Atender cada una de las siguientes amenazas con relación con la firma de auditoría y los miembros del equipo del encargo.", resp: true, riesgo: true},
        {id: "26.2", fila: 123, etq: "•", texto: "Amenazas de interés propio: pueden presentarse como resultado de intereses financieros de un profesional de la contabilidad o de un familiar inmediato o cercano (es decir, en los casos en los que la pérdida de los honorarios del cliente pueda ser significativa).", resp: true, amenaza: true},
        {id: "26.3", fila: 124, etq: "•", texto: "Amenazas de auto revisión: pueden presentarse cuando el mismo profesional de la contabilidad que lo emitió, deba reevaluar un juicio hecho con anterioridad.", resp: true, amenaza: true},
        {id: "26.4", fila: 125, etq: "•", texto: "Amenazas de abogacía: pueden presentarse cuando un profesional de la contabilidad promueve una posición u opinión hasta el punto en que quede comprometida la objetividad (es decir, cuando actúa como defensor, en nombre del cliente, en un litigio o en una promoción de acciones).", resp: true, amenaza: true},
        {id: "26.5", fila: 126, etq: "•", texto: "Amenazas de familiaridad: pueden presentarse cuando, debido a una relación cercana, un profesional de la contabilidad se comporta demasiado comprensivo con los intereses de otros.", resp: true, amenaza: true},
        {id: "26.6", fila: 127, etq: "•", texto: "Amenazas de intimidación: pueden presentarse cuando se disuade a un profesional de la contabilidad para que no actúe objetivamente mediante amenazas, reales o veladas.", resp: true, amenaza: true},
        {id: "26.7", fila: 128, etq: "b)", texto: "¿Se evalúa y documenta si estas amenazas, individuales o colectivamente, son poco significativas?", resp: true, riesgo: true},
        {id: "26.8", fila: 129, etq: "c)", texto: "Respecto a cada amenaza, que no sea significativa, ¿Se documentaron las salvaguardas que existan en la entidad o en la firma de auditoría? y ¿estas se reducen a un nivel aceptable? ¿Cómo?", resp: true, riesgo: true},
        {id: "26.9", fila: 130, texto: "Las salvaguardas pueden incluir normas profesionales y de seguimiento, políticas de la firma de auditoría sobre la formación continua, inspección de la firma de auditoría, gestión de calidad, aprobación de asientos de diario y clasificaciones por parte del cliente, y salvaguardas del cliente tales como un sólido entorno de control y contratación de personal competente.", resp: false},
        {id: "26.10", fila: 131, etq: "d)", texto: "¿Estamos satisfechos de que existen suficientes salvaguardas y que las amenazas a la independencia se eliminan o reducen a un nivel aceptable?", resp: true, riesgo: true}
      ]},
    ] },
    { n: 9, titulo: "Evaluación del riesgo del encargo", reqs: [
      {id: "27", fila: 135, num: 27, texto: "Hemos determinado si la firma de auditoría juzga como aceptables los riesgos asociados a esta industria y al probable cliente. Describir cualesquiera riesgos conocidos o supuestos y el efecto que tengan en el encargo propuesto, incluyendo:", resp: false, hijos: [
        {id: "27.1", fila: 136, etq: "a)", texto: "Un propietario dominante.", resp: true, riesgo: true},
        {id: "27.2", fila: 137, etq: "b)", texto: "Incumplimientos de las disposiciones legales/reglamentarias de la industria que puedan resultar en multas o sanciones significativas.", resp: true, riesgo: true},
        {id: "27.3", fila: 138, etq: "c)", texto: "Problemas financieros o de solvencia.", resp: true, riesgo: true},
        {id: "27.4", fila: 139, etq: "d)", texto: "Gran interés de los medios en la entidad o en su dirección.", resp: true, riesgo: true},
        {id: "27.5", fila: 140, etq: "e)", texto: "Tendencias y comportamiento de la industria.", resp: true, riesgo: true},
        {id: "27.6", fila: 141, etq: "f)", texto: "Dirección excesivamente conservadora u optimista.", resp: true, riesgo: true},
        {id: "27.7", fila: 142, etq: "g)", texto: "Participación en negocios de alto riesgo.", resp: true, riesgo: true},
        {id: "27.8", fila: 143, etq: "h)", texto: "Naturaleza del negocio particularmente arriesgada.", resp: true, riesgo: true},
        {id: "27.9", fila: 144, etq: "i)", texto: "Sistemas y registros contables deficientes.", resp: true, riesgo: true},
        {id: "27.10", fila: 145, etq: "j)", texto: "Número significativo de transacciones poco usuales o con partes vinculadas.", resp: true, riesgo: true},
        {id: "27.11", fila: 146, etq: "k)", texto: "Estructuras corporativas / operativas poco usuales o complejas.", resp: true, riesgo: true},
        {id: "27.12", fila: 147, etq: "l)", texto: "Dirección y controles débiles.", resp: true, riesgo: true},
        {id: "27.13", fila: 148, etq: "m)", texto: "Falta de políticas claras para el reconocimiento de ingresos.", resp: true, riesgo: true},
        {id: "27.14", fila: 149, etq: "n)", texto: "Cambios tecnológicos que tengan un fuerte impacto en la industria o en el negocio.", resp: true, riesgo: true},
        {id: "27.15", fila: 150, etq: "o)", texto: "Posibilidad de ganancias significativas para la dirección que dependan de resultados financieros favorables o de un buen desempeño.", resp: true, riesgo: true},
        {id: "27.16", fila: 151, etq: "p)", texto: "Problemas con la competencia o la credibilidad de la dirección.", resp: true, riesgo: true},
        {id: "27.17", fila: 152, etq: "q)", texto: "Cambios recientes en la dirección, el personal clave, los contables o los abogados.", resp: true, riesgo: true},
        {id: "27.18", fila: 153, etq: "r)", texto: "Litigios existentes o previsibles contra la empresa.", resp: true, riesgo: true},
        {id: "27.19", fila: 154, etq: "s)", texto: "Requerimientos de información para las entidades públicas.", resp: true, riesgo: true},
        {id: "27.20", fila: 155, etq: "t)", texto: "Alto nivel de escrutinio público y el interés de los medios", resp: true, riesgo: true}
      ]},
      {id: "28", fila: 156, num: 28, texto: "¿Quiénes son los usuarios probables de los estados financieros?", resp: false, hijos: [
        {id: "28.1", fila: 157, etq: "•", texto: "Bancos", resp: true, riesgo: true},
        {id: "28.2", fila: 158, etq: "•", texto: "Autoridades fiscales", resp: true, riesgo: true},
        {id: "28.3", fila: 159, etq: "•", texto: "Organismos reguladores", resp: true, riesgo: true},
        {id: "28.4", fila: 160, etq: "•", texto: "Dirección", resp: true, riesgo: true},
        {id: "28.5", fila: 161, etq: "•", texto: "Acreedores", resp: true, riesgo: true},
        {id: "28.6", fila: 162, etq: "•", texto: "Posibles inversores/compradores", resp: true, riesgo: true},
        {id: "28.7", fila: 163, etq: "•", texto: "Accionistas/socios", resp: true, riesgo: true},
        {id: "28.8", fila: 164, etq: "•", texto: "Otros/Especificar", resp: true, riesgo: true}
      ]},
      {id: "29", fila: 165, num: 29, texto: "¿Existen disputas entre accionistas u otras disputas que se puedan ver afectadas por los resultados del encargo? ¿Representa un riesgo razonable en la confianza anticipada de estos usuarios en el informe que se emita?", resp: true, riesgo: true},
      {id: "30", fila: 166, num: 30, texto: "¿Hay áreas específicas de los estados financieros o cuentas específicas que merezcan mayor atención? De ser así afirmativo, documentarlas detalladamente.", resp: true, riesgo: true},
      {id: "31", fila: 167, num: 31, texto: "¿El auditor/profesional de la contabilidad predecesor propuso muchos ajustes y/o identificó muchos errores menores no corregidos?", nota: "De ser así, documentar la razón probable y sus efectos en el riesgo del encargo.", resp: true, riesgo: true},
      {id: "32", fila: 168, num: 32, texto: "¿Estamos satisfechos de que no haya una razón significativa para dudar de que el posible cliente pueda seguir operando como negocio en funcionamiento en el futuro (como mínimo, un año)?", resp: true, riesgo: true},
      {id: "33", fila: 169, num: 33, texto: "¿Estamos satisfechos de que el posible cliente esta dispuesto a pagar honorarios aceptables y cuenta con los recursos para hacerlo?", resp: true, riesgo: true},
    ] },
    { n: 10, titulo: "Limitaciones al alcance", reqs: [
      {id: "34", fila: 173, num: 34, texto: "Estamos satisfechos de que la dirección del cliente no impondrá limitaciones al alcance de nuestro trabajo.", resp: true, riesgo: true},
      {id: "35", fila: 174, num: 35, texto: "Existen criterios adecuados (por ejemplo, las NIIF) contra los cuales evaluar el asunto relevante del encargo.", resp: true, riesgo: true},
      {id: "36", fila: 175, num: 36, texto: "Los tiempos establecidos son razonables para terminar el trabajo.", resp: true, riesgo: true},
    ] },
  ];

  /* =====================================================================
   * 3. UTILIDADES
   * ===================================================================== */
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
  function nuevoEstado() {
    return {
      esquema: CONFIG.VERSION_ESQUEMA,
      meta: {
        entidad: "", nit: "", desde: "", hasta: "",
        preparadoPor: "", revisadoPor: "", supervisadoPor: "", aprobadoPor: "",
        socio: "", interesPublico: ""
      },
      r: {},                                   // respuestas por id de requerimiento
      eeff: { riesgos: [""], estrategia: "", enfoque: "" },
      registro: [],                            // riesgos identificados y controles
      conclusion: { comentarios: "", decl: [false, false, false, false], decision: "" },
      firma: null,                             // { por, fecha, hash, invalida? }
      historial: [],
      actualizado: null
    };
  }

  var estado = nuevoEstado();
  var itemsPorId = {};          // id → definición del requerimiento
  var itemsRespondibles = [];   // lista plana de los que se contestan
  var seccionDeItem = {};       // id → número de sección
  var raiz = null;
  function usuarioAhora() {
    var u = flujo.usuarioActual();
    return u ? { id: u.id, nombre: u.nombre, correo: u.correo || "" } : null;
  }
  var cargado = false;          // el estado ya se leyó del libro
  var escuchando = false;

  function indexarDatos() {
    itemsPorId = {}; itemsRespondibles = []; seccionDeItem = {};
    SECCIONES.forEach(function (sec) {
      sec.reqs.forEach(function (rq) {
        var todos = [rq].concat(rq.hijos || []);
        todos.forEach(function (it) {
          itemsPorId[it.id] = it; seccionDeItem[it.id] = sec.n;
          if (it.resp) itemsRespondibles.push(it);
        });
      });
    });
  }

  function respuesta(id) {
    if (!estado.r[id]) estado.r[id] = { r: "", riesgo: "", amenaza: "", ref: "", hecho: "", com: "" };
    return estado.r[id];
  }

  /* =====================================================================
   * 5. CÁLCULOS (misma regla de la hoja original)
   * ===================================================================== */

  // Clasificación del cliente. En la hoja: puntaje = suma de los niveles elegidos (1…5) y el cliente
  // queda en el nivel cuyo tope (N × nivel) alcanza esa suma, es decir, el promedio redondeado hacia
  // arriba. Las preguntas sin nivel no cuentan (en la hoja quedaban como celdas vacías).
  function calcularRiesgo() {
    var niveles = CONFIG.NIVELES_RIESGO, conteo = niveles.map(function () { return 0; }), suma = 0, n = 0;
    itemsRespondibles.forEach(function (it) {
      if (!it.riesgo) return;
      var idx = niveles.indexOf(respuesta(it.id).riesgo);
      if (idx < 0) return;
      conteo[idx]++; suma += idx + 1; n++;
    });
    if (!n) return { n: 0, suma: 0, promedio: 0, nivel: 0, etiqueta: "", conteo: conteo };
    var promedio = suma / n;
    var nivel = Math.min(niveles.length, Math.max(1, Math.ceil(promedio - 1e-9)));
    return { n: n, suma: suma, promedio: promedio, nivel: nivel, etiqueta: niveles[nivel - 1], conteo: conteo };
  }

  function calcularAvance() {
    var total = itemsRespondibles.length, hechas = 0, porSeccion = {};
    SECCIONES.forEach(function (s) { porSeccion[s.n] = { total: 0, hechas: 0 }; });
    itemsRespondibles.forEach(function (it) {
      var s = porSeccion[seccionDeItem[it.id]], ok = !!respuesta(it.id).r;
      s.total++; if (ok) { s.hechas++; hechas++; }
    });
    return { total: total, hechas: hechas, porSeccion: porSeccion };
  }

  // Devuelve { bloqueos: [...], avisos: [...] }. Cada pendiente indica dónde está para poder ir a él.
  function evaluar() {
    var bloqueos = [], avisos = [], m = estado.meta, c = estado.conclusion;
    function b(grupo, texto, destino) { bloqueos.push({ grupo: grupo, texto: texto, destino: destino }); }

    if (!m.entidad.trim()) b("Datos del encargo", "Falta el nombre de la entidad.", { campo: "meta.entidad" });
    if (!m.socio.trim()) b("Datos del encargo", "Falta el nombre y cargo del socio responsable.", { campo: "meta.socio" });
    if (!m.interesPublico) b("Datos del encargo", "Indique si es una entidad de interés público.", { campo: "meta.interesPublico" });

    var sinResponder = 0, noSinRiesgo = 0, sinRiesgoSi = 0, sinJustificar = 0;
    itemsRespondibles.forEach(function (it) {
      var r = respuesta(it.id), etiqueta = (it.etq ? it.etq + " " : "") + resumen(it.texto, 70), sec = seccionDeItem[it.id];
      var grupo = "Sección " + sec + ". " + tituloSeccion(sec);
      if (!r.r) { b(grupo, "Sin responder: " + (it.num ? it.num + " · " : "") + etiqueta, { id: it.id }); sinResponder++; return; }
      if (it.riesgo && !r.riesgo) {
        if (r.r === "NO" || CONFIG.EXIGIR_RIESGO_EN_TODAS) {
          b(grupo, "Falta el nivel de riesgo: " + (it.num ? it.num + " · " : "") + etiqueta, { id: it.id, campo: "riesgo" }); noSinRiesgo++;
        } else if (r.r === "SI") { sinRiesgoSi++; }
      }
      if ((r.r === "NO" || r.r === "NA") && !r.com.trim()) {
        if (CONFIG.EXIGIR_JUSTIFICACION) b(grupo, "Falta justificar la respuesta " + (r.r === "NO" ? "«No»" : "«N/A»") + ": " + etiqueta, { id: it.id, campo: "com" });
        sinJustificar++;
      }
    });
    if (sinRiesgoSi) avisos.push(sinRiesgoSi + " respuestas «Sí» no tienen nivel de riesgo; no entran en la clasificación del cliente.");
    if (sinJustificar && !CONFIG.EXIGIR_JUSTIFICACION) avisos.push(sinJustificar + " respuestas «No» o «N/A» no tienen comentario que las justifique.");

    if (!c.decision) b("Conclusión", "Falta elegir si se acepta o se declina el encargo.", { campo: "conclusion.decision" });
    if (c.decision === "Aceptar") {
      c.decl.forEach(function (v, i) { if (!v) b("Conclusión", "Falta confirmar la declaración " + (i + 1) + " del socio.", { campo: "conclusion.decl." + i }); });
    }
    if (estado.registro.some(function (x) { return x.descripcion.trim() && !x.nivel; })) {
      avisos.push("Hay riesgos identificados sin nivel de riesgo.");
    }
    return { bloqueos: bloqueos, avisos: avisos };
  }

  function resumen(t, max) { t = String(t).replace(/\s+/g, " ").trim(); return t.length > max ? t.slice(0, max - 1) + "…" : t; }
  function tituloSeccion(n) { for (var i = 0; i < SECCIONES.length; i++) if (SECCIONES[i].n === n) return SECCIONES[i].titulo; return ""; }

  /* =====================================================================
   * 6. FIRMA
   *    El hash cubre todo el contenido del papel. Si cambia algo después de firmar,
   *    el hash deja de coincidir y la firma se marca como inválida.
   * ===================================================================== */
  function contenidoFirmable() {
    var m = copiar(estado.meta); ["preparadoPor", "revisadoPor", "supervisadoPor", "aprobadoPor"].forEach(function (k) { delete m[k]; });
    return JSON.stringify({ meta: m, r: estado.r, eeff: estado.eeff, registro: estado.registro, conclusion: estado.conclusion });
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
    $("#firmaNombre", raiz).textContent = nombreFirmante();
    $("#firmaConfirma", raiz).hidden = false;
    $("#btnFirmar", raiz).disabled = true;
  }
  function nombreFirmante() { return (usuarioAhora() && usuarioAhora().nombre) || estado.meta.socio.trim() || "el socio responsable"; }

  function confirmarFirma() {
    hashTexto(contenidoFirmable()).then(function (h) {
      estado.firma = { por: nombreFirmante(), correo: (usuarioAhora() && usuarioAhora().correo) || "", fecha: ahoraISO(), hash: h, decision: estado.conclusion.decision, riesgo: calcularRiesgo().etiqueta };
      registrarHistorial("firma");
      $("#firmaConfirma", raiz).hidden = true;
      refrescarTodo(); guardarYa();
    });
  }
  function reabrir() {
    registrarHistorial(estado.firma && estado.firma.invalida ? "reapertura-firma-invalida" : "reapertura");
    estado.firma = null;
    $("#firmaReabrirConfirma", raiz).hidden = true;
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
        }).catch(function (e) { console.warn("AA-01: no se pudo leer del libro", e); return Almacen._local(); });
      }
      return Promise.resolve(Almacen._local());
    },
    guardar: function (datos) {
      var json = JSON.stringify(datos);
      if (dentroDeExcel()) {
        var xml = '<aa01 xmlns="' + CONFIG.NAMESPACE_XML + '">' + escXml(json) + "</aa01>";
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
      console.error("AA-01: error al guardar", e);
      setGuardado("No se pudo guardar. Se reintentará al próximo cambio.", "error");
    });
  }
  function setGuardado(texto, tipo) { if (!raiz) return; var el = $("#estadoGuardado", raiz); el.textContent = texto; el.setAttribute("data-estado", tipo); }

  function estadoPapel() {
    if (estado.firma) return estado.firma.invalida ? "invalida" : "firmado";
    var av = calcularAvance(), ev = evaluar();
    if (!ev.bloqueos.length) return "completo";
    var algo = av.hechas > 0 || estado.meta.entidad.trim();
    return algo ? "borrador" : "sin-iniciar";
  }
  function notificarEstado() {
    var av = calcularAvance(), rg = calcularRiesgo();
    document.dispatchEvent(new CustomEvent("auditx:estado-papel", {
      detail: { id: CONFIG.ID_PAPEL, estado: estadoPapel(), avance: av.total ? av.hechas / av.total : 0, riesgo: rg.etiqueta, decision: estado.conclusion.decision || null }
    }));
  }

  /* =====================================================================
   * 8. DIBUJO
   * ===================================================================== */
  function plantilla(id) { return document.getElementById(id).content.firstElementChild.cloneNode(true); }

  function llenarSelect(sel, opciones, vacio) {
    sel.innerHTML = "";
    var o = document.createElement("option"); o.value = ""; o.textContent = vacio || "Seleccione"; sel.appendChild(o);
    opciones.forEach(function (t) { var op = document.createElement("option"); op.value = t; op.textContent = t; sel.appendChild(op); });
  }

  function crearItem(it) {
    var nodo = plantilla("tpl-item"), r = respuesta(it.id);
    nodo.setAttribute("data-id", it.id);
    $(".aa-item-num", nodo).textContent = it.num ? String(it.num) : (it.etq || "");
    $(".aa-item-text", nodo).textContent = it.texto;
    if (it.nota) { var n = $(".aa-item-nota", nodo); n.textContent = it.nota; n.hidden = false; }
    if (it.ayuda) { var a = $(".aa-item-ayuda", nodo); a.textContent = it.ayuda; a.hidden = false; }
    $$('input[type="radio"]', nodo).forEach(function (rd) { rd.name = "r-" + it.id; });
    var selR = $('[data-tipo="riesgo"] select', nodo), selA = $('[data-tipo="amenaza"] select', nodo);
    llenarSelect(selR, CONFIG.NIVELES_RIESGO, "Nivel");
    llenarSelect(selA, CONFIG.NIVELES_AMENAZA, "Nivel");
    $('[data-tipo="riesgo"]', nodo).hidden = !it.riesgo;
    $('[data-tipo="amenaza"]', nodo).hidden = !it.amenaza;
    pintarItem(nodo, r);
    return nodo;
  }

  function pintarItem(nodo, r) {
    nodo.setAttribute("data-resp", r.r || "");
    $$('input[type="radio"]', nodo).forEach(function (rd) { rd.checked = (rd.value === r.r); });
    var selR = $('[data-campo="riesgo"]', nodo), selA = $('[data-campo="amenaza"]', nodo);
    selR.value = r.riesgo || ""; selA.value = r.amenaza || "";
    var cont = $('[data-tipo="riesgo"]', nodo), idx = CONFIG.NIVELES_RIESGO.indexOf(r.riesgo) + 1;
    cont.setAttribute("data-nivel", idx > 0 ? String(Math.min(idx, 5)) : "");
    $('[data-campo="ref"]', nodo).value = r.ref || "";
    $('[data-campo="hecho"]', nodo).value = r.hecho || "";
    $('[data-campo="com"]', nodo).value = r.com || "";
    $(".aa-dot", nodo).hidden = !(r.ref || r.hecho || r.com);
  }

  function crearInfo(it, esNota) {
    var nodo = plantilla("tpl-info");
    $(".aa-item-num", nodo).textContent = it.num ? String(it.num) : (it.etq || "");
    $(".aa-item-text", nodo).textContent = it.texto;
    if (esNota) nodo.classList.add("is-nota");
    return nodo;
  }

  function dibujarSecciones() {
    var cont = $("#secciones", raiz); cont.innerHTML = "";
    SECCIONES.forEach(function (sec) {
      var s = plantilla("tpl-seccion"), cuerpo = $(".aa-sec-body", s), btn = $(".aa-sec-toggle", s);
      s.setAttribute("data-sec", sec.n);
      $(".aa-sec-num", s).textContent = sec.n;
      $(".aa-sec-title", s).textContent = sec.titulo;
      var idc = "sec-" + sec.n; cuerpo.id = idc; btn.setAttribute("aria-controls", idc);
      sec.reqs.forEach(function (rq) {
        var hijos = rq.hijos || [], grupo = document.createElement("div"); grupo.className = "aa-grupo";
        grupo.appendChild(rq.resp ? crearItem(rq) : crearInfo(rq, !rq.num));
        if (hijos.length) {
          var h = document.createElement("div"); h.className = "aa-grupo-hijos";
          hijos.forEach(function (k) { h.appendChild(k.resp ? crearItem(k) : crearInfo(k, true)); });
          grupo.appendChild(h);
        }
        cuerpo.appendChild(grupo);
      });
      cont.appendChild(s);
    });
  }

  function dibujarListaEEFF() {
    var cont = $("#listaRiesgosEEFF", raiz); cont.innerHTML = "";
    estado.eeff.riesgos.forEach(function (txt, i) {
      var f = plantilla("tpl-riesgo-eeff"), ta = $("textarea", f);
      ta.value = txt; ta.setAttribute("data-bind", "eeff.riesgos." + i);
      var q = $("button", f); q.setAttribute("data-quitar-eeff", i);
      q.hidden = estado.eeff.riesgos.length <= 1;
      cont.appendChild(f);
    });
    $("#btnAgregarRiesgoEEFF", raiz).hidden = estado.eeff.riesgos.length >= CONFIG.MAX_RIESGOS_EEFF;
  }

  function dibujarRegistro() {
    var cont = $("#listaRegistro", raiz); cont.innerHTML = "";
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
    $("#btnAgregarRegistro", raiz).hidden = estado.registro.length >= CONFIG.MAX_REGISTRO;
    $("#contadorRegistro", raiz).textContent = estado.registro.length ? String(estado.registro.length) : "";
  }

  // Sincroniza todos los campos con data-bind (datos del encargo, conclusión, textos largos).
  function pintarBinds() {
    $$("[data-bind]", raiz).forEach(function (el) {
      var v = getPath(estado, el.getAttribute("data-bind"));
      if (el.type === "radio") el.checked = (el.value === v);
      else if (el.type === "checkbox") el.checked = !!v;
      else if (document.activeElement !== el) el.value = v == null ? "" : v;
    });
  }

  function pintarAvance() {
    var av = calcularAvance(), pct = av.total ? Math.round((av.hechas / av.total) * 100) : 0;
    $("#rellenoAvance", raiz).style.width = pct + "%";
    $("#barraAvance", raiz).setAttribute("aria-valuenow", String(pct));
    $("#textoAvance", raiz).textContent = av.hechas + " de " + av.total + " respondidas (" + pct + " %)";
    $("#resumenRequerimientos", raiz).textContent = av.total - av.hechas ? (av.total - av.hechas) + " por responder" : "Todas respondidas";
    $$(".aa-sec", raiz).forEach(function (s) {
      var d = av.porSeccion[s.getAttribute("data-sec")], c = $(".aa-count", s);
      c.textContent = d.hechas + "/" + d.total; c.setAttribute("data-completo", String(d.total > 0 && d.hechas === d.total));
    });
    var m = estado.meta, faltan = ["entidad", "socio"].filter(function (k) { return !m[k].trim(); }).length + (m.interesPublico ? 0 : 1);
    var cd = $("#contadorDatos", raiz); cd.textContent = faltan ? faltan + " por completar" : "Completo"; cd.setAttribute("data-completo", String(!faltan));
  }

  function pintarRiesgo() {
    var rg = calcularRiesgo(), tope = $("#chipRiesgoTop", raiz), chip = $("#chipRiesgo", raiz), det = $("#detalleRiesgo", raiz);
    var nivel = rg.nivel ? String(rg.nivel) : "";
    tope.setAttribute("data-nivel", nivel); chip.setAttribute("data-nivel", nivel);
    tope.textContent = rg.nivel ? "Riesgo: " + rg.etiqueta : "Riesgo: sin calificar";
    chip.textContent = rg.nivel ? rg.etiqueta : "Sin calificar";
    det.textContent = rg.nivel
      ? "Promedio de " + rg.promedio.toFixed(2).replace(".", ",") + " sobre 5, calculado con " + rg.n + " requerimientos que tienen nivel de riesgo."
      : "Califique el nivel de riesgo de los requerimientos para obtener la clasificación.";
    var dist = $("#distribucionRiesgo", raiz), ley = $("#leyendaRiesgo", raiz);
    dist.innerHTML = ""; ley.innerHTML = "";
    CONFIG.NIVELES_RIESGO.forEach(function (nom, i) {
      var cant = rg.conteo[i], sp = document.createElement("span");
      sp.className = "d" + Math.min(i + 1, 5); sp.style.width = (rg.n ? (cant / rg.n) * 100 : 0) + "%"; dist.appendChild(sp);
      var li = document.createElement("li"), sw = document.createElement("i");
      sw.className = "d" + Math.min(i + 1, 5); sw.style.background = "var(--r" + Math.min(i + 1, 5) + ")";
      li.appendChild(sw); li.appendChild(document.createTextNode(nom + ": " + cant)); ley.appendChild(li);
    });
    dist.setAttribute("aria-label", "Distribución por nivel de riesgo: " + CONFIG.NIVELES_RIESGO.map(function (n, i) { return n + " " + rg.conteo[i]; }).join(", "));
    $("#avisoSeguimiento", raiz).hidden = estado.conclusion.decision !== "Aceptar";
    $("#avisoRiesgoAlto", raiz).hidden = !(estado.conclusion.decision === "Aceptar" && rg.nivel >= 4);
  }

  function pintarEstadoYFirma() {
    var est = estadoPapel(), chip = $("#chipEstado", raiz);
    var textos = { "sin-iniciar": "Sin iniciar", borrador: "En borrador", completo: "Completo, sin firmar", firmado: "Firmado", invalida: "Firma inválida" };
    chip.textContent = textos[est]; chip.setAttribute("data-estado", est); raiz.setAttribute("data-estado", est);

    var ev = evaluar(), bloque = $("#bloqueFirma", raiz), txt = $("#firmaEstado", raiz);
    bloque.setAttribute("data-firma", est === "firmado" ? "firmado" : est === "invalida" ? "invalida" : "");
    var badge = $("#badgePendientes", raiz); badge.textContent = ev.bloqueos.length; badge.hidden = !ev.bloqueos.length;

    var btnF = $("#btnFirmar", raiz);
    btnF.hidden = true; // la firma se hace desde la ficha del flujo
    if (estado.firma) {
      var f = estado.firma, cuando = new Date(f.fecha).toLocaleString("es-CO");
      txt.textContent = est === "invalida"
        ? "La firma de " + f.por + " (" + cuando + ") ya no es válida: el contenido cambió después de firmar."
        : "Firmado por " + f.por + " el " + cuando + " · Decisión: " + (f.decision === "Aceptar" ? "aceptar" : "declinar") + " el encargo.";
      btnF.textContent = est === "invalida" ? "Reabrir" : "Reabrir para editar";
      btnF.disabled = false; btnF.setAttribute("data-modo", "reabrir");
    } else {
      txt.textContent = ev.bloqueos.length ? "Sin firmar. Faltan " + ev.bloqueos.length + " pendientes para poder firmar." : "Completo. Se firma desde el flujo, en la parte de arriba.";
      btnF.textContent = "Firmar"; btnF.setAttribute("data-modo", "firmar");
      btnF.disabled = !!ev.bloqueos.length || !$("#firmaConfirma", raiz).hidden;
    }
    aplicarBloqueo(!!estado.firma && est === "firmado");
  }

  function aplicarBloqueo(bloqueado) {
    $$("input, select, textarea, .aa-icon-btn, #btnAgregarRiesgoEEFF, #btnAgregarRegistro", raiz).forEach(function (el) {
      if (el.closest("[data-siempre-activo]") || el.hasAttribute("data-siempre-activo") || el.readOnly) return;
      el.disabled = bloqueado;
    });
  }

  function refrescarTodo() {
    if (!raiz) return;
    pintarAvance(); pintarRiesgo(); pintarEstadoYFirma();
    $("#panelPendientes", raiz).hidden ? null : dibujarPendientes();
  }

  /* =====================================================================
   * 9. PENDIENTES
   * ===================================================================== */
  function abrirPendientes() { $("#panelPendientes", raiz).hidden = false; dibujarPendientes(); $("#panelPendientes", raiz).scrollIntoView({ behavior: "smooth", block: "start" }); }
  function dibujarPendientes() {
    var ev = evaluar(), cuerpo = $("#pendCuerpo", raiz); cuerpo.innerHTML = "";
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
    if (dest.id) {
      var nodo = $('.aa-item[data-id="' + dest.id + '"]', raiz);
      var sec = nodo && nodo.closest(".aa-sec");
      if (sec) alternar($(".aa-sec-toggle", sec), $(".aa-sec-body", sec), true);
      if (nodo && dest.campo === "com") { alternar($(".aa-detalle-toggle", nodo), $(".aa-detalle", nodo), true); }
      el = nodo && (dest.campo ? $('[data-campo="' + dest.campo + '"]', nodo) : $('input[type="radio"]', nodo));
      if (nodo) { nodo.classList.add("is-pendiente-foco"); setTimeout(function () { nodo.classList.remove("is-pendiente-foco"); }, 1800); }
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

  function alEditarItem(e) {
    var el = e.target, nodo = el.closest(".aa-item");
    if (!nodo) return false;
    var campo = el.getAttribute("data-campo"); if (!campo) return true;
    var id = nodo.getAttribute("data-id"), r = respuesta(id), antes = r.r;
    r[campo] = el.value;
    if (campo === "r") {
      // Al responder por primera vez se sella «quién y cuándo» (editable).
      if (!antes && !r.hecho) r.hecho = ((usuarioAhora() && usuarioAhora().nombre) || estado.meta.preparadoPor.trim() || "Equipo") + " · " + hoy();
      if (r.r === "NO") { alternar($(".aa-detalle-toggle", nodo), $(".aa-detalle", nodo), true); }
    }
    pintarItem(nodo, r);
    return true;
  }

  function alEditarBind(el) {
    var ruta = el.getAttribute("data-bind"), v;
    if (el.type === "checkbox") v = el.checked;
    else if (el.type === "radio") { if (!el.checked) return; v = el.value; }
    else v = el.value;
    setPath(estado, ruta, v);
  }

  function conectarEventos() {
    var cambio = function (e) {
      var el = e.target;
      if (alEditarItem(e)) { alCambiar(); return; }
      var reg = el.closest(".aa-reg");
      if (reg && el.getAttribute("data-campo")) {
        var i = +reg.getAttribute("data-reg"); estado.registro[i][el.getAttribute("data-campo")] = el.value; alCambiar(); return;
      }
      if (el.hasAttribute("data-bind")) { alEditarBind(el); alCambiar(); }
    };
    raiz.addEventListener("input", function (e) { if (e.target.matches('input[type="text"], input[type="date"], textarea')) cambio(e); });
    raiz.addEventListener("change", function (e) { if (!e.target.matches('input[type="text"], input[type="date"], textarea')) cambio(e); });

    raiz.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.classList.contains("aa-sec-toggle")) { alternar(t, $(".aa-sec-body", t.closest(".aa-sec"))); return; }
      if (t.classList.contains("aa-detalle-toggle")) { alternar(t, $(".aa-detalle", t.closest(".aa-item"))); return; }
      if (t.classList.contains("aa-card-toggle")) { alternar(t, document.getElementById(t.getAttribute("aria-controls"))); return; }
      if (t.hasAttribute("data-quitar-eeff")) { estado.eeff.riesgos.splice(+t.getAttribute("data-quitar-eeff"), 1); if (!estado.eeff.riesgos.length) estado.eeff.riesgos.push(""); dibujarListaEEFF(); alCambiar(); return; }
      if (t.hasAttribute("data-quitar-reg")) { estado.registro.splice(+t.getAttribute("data-quitar-reg"), 1); dibujarRegistro(); alCambiar(); return; }
    });

    $("#btnAgregarRiesgoEEFF", raiz).addEventListener("click", function () {
      if (estado.eeff.riesgos.length < CONFIG.MAX_RIESGOS_EEFF) { estado.eeff.riesgos.push(""); dibujarListaEEFF(); alCambiar(); }
    });
    $("#btnAgregarRegistro", raiz).addEventListener("click", function () {
      if (estado.registro.length < CONFIG.MAX_REGISTRO) {
        estado.registro.push({ descripcion: "", tipo: "", nivel: "", control: "", frecuencia: "", refPT: "" });
        dibujarRegistro(); alCambiar();
        var ult = $$(".aa-reg", raiz).pop(); if (ult) { alternar($("#regToggle", raiz), $("#regCuerpo", raiz), true); $("textarea", ult).focus(); }
      }
    });

    $("#btnPendientes", raiz).addEventListener("click", function () { var p = $("#panelPendientes", raiz); if (p.hidden) abrirPendientes(); else p.hidden = true; });
    $("#btnCerrarPendientes", raiz).addEventListener("click", function () { $("#panelPendientes", raiz).hidden = true; });

    $("#btnFirmar", raiz).addEventListener("click", function () {
      if (this.getAttribute("data-modo") === "reabrir") { $("#firmaReabrirConfirma", raiz).hidden = false; $("#bloqueFirma", raiz).scrollIntoView({ behavior: "smooth", block: "center" }); }
      else iniciarFirma();
    });
    $("#btnConfirmarFirma", raiz).addEventListener("click", confirmarFirma);
    $("#btnCancelarFirma", raiz).addEventListener("click", function () { $("#firmaConfirma", raiz).hidden = true; pintarEstadoYFirma(); });
    $("#btnConfirmarReabrir", raiz).addEventListener("click", reabrir);
    $("#btnCancelarReabrir", raiz).addEventListener("click", function () { $("#firmaReabrirConfirma", raiz).hidden = true; });

    $("#btnVolver", raiz).addEventListener("click", function () { guardarYa(); document.dispatchEvent(new CustomEvent("auditx:volver", { detail: { desde: CONFIG.ID_PAPEL } })); });

  }

  /* =====================================================================
   * 11. ARRANQUE
   * ===================================================================== */
  function fusionar(base, guardado) {
    // Tolera datos de versiones anteriores: completa lo que falte sin perder lo guardado.
    var out = copiar(base);
    if (!guardado || typeof guardado !== "object") return out;
    ["meta", "eeff", "conclusion"].forEach(function (k) { if (guardado[k]) Object.keys(guardado[k]).forEach(function (c) { out[k][c] = guardado[k][c]; }); });
    out.r = guardado.r || {}; out.registro = guardado.registro || []; out.firma = guardado.firma || null;
    out.historial = guardado.historial || []; out.actualizado = guardado.actualizado || null;
    if (!out.eeff.riesgos || !out.eeff.riesgos.length) out.eeff.riesgos = [""];
    while (out.conclusion.decl.length < 4) out.conclusion.decl.push(false);
    return out;
  }

  /* Responsables: los fija el flujo; aquí solo se muestran. */
  function sincronizarResponsables() {
    var f = flujo.ficha(ID_FLUJO), nom = function (id) { var p = id && flujo.persona(id); return p ? p.nombre : ""; };
    estado.meta.preparadoPor = nom(f.asignados.prepara);
    estado.meta.revisadoPor = nom(f.asignados.revisa);
    estado.meta.supervisadoPor = nom(f.asignados.supervisa);
    estado.meta.aprobadoPor = nom(f.asignados.aprueba);
    var enc = proyecto.encabezado();
    Object.keys(enc).forEach(function (k) { if (k in estado.meta && !String(estado.meta[k]).trim()) estado.meta[k] = enc[k]; });
    if (!estado.meta.socio.trim() && !estado.firma) {
      var s = flujo.persona(f.asignados.aprueba) || flujo.personas(true).filter(function (p) { return p.roles.indexOf("aprueba") >= 0; })[0];
      if (s) estado.meta.socio = s.nombre + " · " + s.cargo;
    }
    if (raiz) {
      pintarBinds();
      ["preparadoPor", "revisadoPor", "supervisadoPor", "aprobadoPor"].forEach(function (k) {
        var el = $('[data-bind="meta.' + k + '"]', raiz); if (el) { el.readOnly = true; el.title = "Lo define el flujo de trabajo"; }
      });
    }
  }

  /* El flujo firmó o reabrió el papel: se sella (o se libera) el contenido. */
  function sellar(por, correo) {
    return hashTexto(contenidoFirmable()).then(function (h) {
      estado.firma = { por: por, correo: correo || "", fecha: ahoraISO(), hash: h, decision: estado.conclusion.decision, riesgo: calcularRiesgo().etiqueta };
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

  /* Lee el estado del libro sin dibujar nada (lo usa el flujo para saber si el papel está completo). */
  function cargar() {
    if (cargado) return Promise.resolve();
    indexarDatos();
    return Promise.all([Almacen.cargar(), CONFIG.obtenerEncargo()]).then(function (res) {
      estado = fusionar(nuevoEstado(), res[0]);
      var enc = res[1] || {};
      Object.keys(enc).forEach(function (k) { if (k in estado.meta && !String(estado.meta[k]).trim()) estado.meta[k] = enc[k]; });
      return verificarFirma();
    }).catch(function (e) { console.error("AA-01: error al leer", e); }).then(function () {
      cargado = true;
      sincronizarResponsables();
      if (!escuchando) {
        escuchando = true;
        document.addEventListener("auditx:flujo-cambio", alFlujo);
        flujo.registrarBloqueo(function (id, accion) {
          if (id !== ID_FLUJO || accion !== "firmar") return null;
          var n = evaluar().bloqueos.length;
          return n ? "El cuestionario tiene " + n + (n === 1 ? " pendiente." : " pendientes.") + " Ábralo y complételos antes de firmar." : null;
        });
      }
      notificarEstado();
    });
  }

  /* Dibuja el cuestionario dentro de `cont` (la vista del panel). */
  function montar(cont) {
    cont.innerHTML = ESQUELETO;
    raiz = cont.querySelector("#aa01");
    raiz.classList.add("aa-embebido");
    var propia = raiz;
    conectarEventos();
    cargar().then(function () {
      if (raiz !== propia) return;
      sincronizarResponsables();
      dibujarSecciones(); dibujarListaEEFF(); dibujarRegistro(); pintarBinds();
      sincronizarResponsables();
      var av = calcularAvance(), primera = SECCIONES.filter(function (s) { return av.porSeccion[s.n].hechas < av.porSeccion[s.n].total; })[0] || SECCIONES[0];
      var secEl = $('.aa-sec[data-sec="' + primera.n + '"]', raiz); alternar($(".aa-sec-toggle", secEl), $(".aa-sec-body", secEl), true);
      refrescarTodo(); notificarEstado();
      setGuardado(estado.actualizado ? "Guardado" : "Sin cambios", "");
    });
    return {
      destruir: function () { if (raiz === propia) { guardarYa(); raiz = null; } }
    };
  }

  var api = {
    cargar: cargar,
    montar: montar,
    config: CONFIG,
    obtenerEstado: function () { return copiar(estado); },
    evaluar: evaluar,
    calcularRiesgo: calcularRiesgo,
    exportarJSON: function () { return JSON.stringify(estado, null, 2); }
  };
export default api;
