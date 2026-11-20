/* HTML del cuestionario AA-01 (esqueleto y plantillas). Las secciones y requerimientos los dibuja aa01.js. */
export default `<!--
      Vista del papel AA-01. Se muestra dentro del task pane (≈320–420 px) y también
      funciona en un diálogo ancho. Las secciones y los 36 requerimientos se generan desde
      los datos de aa01-cuestionario.js (extraídos de la hoja «AA-01 Cuestionario Acept.»);
      aquí solo vive el esqueleto y los textos fijos.
    -->
    <div class="aa" id="aa01" data-estado="borrador">

        <!-- ENCABEZADO FIJO -->
        <header class="aa-top">
            <div class="aa-top-row">
                <button type="button" class="aa-back" id="btnVolver" aria-label="Volver al menú de Pre-Planificación">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div class="aa-heading">
                    <span class="aa-ref">AA-01 · Pre-Planificación</span>
                    <h1 class="aa-title">Cuestionario de aceptación del cliente</h1>
                </div>
                <span class="aa-chip aa-chip-estado" id="chipEstado" role="status" aria-live="polite">En borrador</span>
            </div>

            <div class="aa-progress" aria-label="Avance del cuestionario">
                <div class="aa-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="barraAvance">
                    <span class="aa-progress-fill" id="rellenoAvance"></span>
                </div>
                <div class="aa-progress-text">
                    <span id="textoAvance">0 de 0 respondidas</span>
                    <span class="aa-chip aa-chip-riesgo" id="chipRiesgoTop" data-nivel="">Riesgo: sin calificar</span>
                </div>
            </div>
        </header>

        <!-- CONTENIDO -->
        <main class="aa-main" id="contenido">

            <!-- Ayuda: descripción, objetivo, alcance, instrucciones y preguntas frecuentes de la hoja original -->
            <section class="aa-card aa-card-ayuda" aria-labelledby="ayudaTitulo">
                <button type="button" class="aa-card-toggle" id="ayudaToggle" aria-expanded="false" aria-controls="ayudaCuerpo">
                    <span class="aa-card-title" id="ayudaTitulo">Descripción, objetivo e instrucciones</span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="ayudaCuerpo" hidden>
                    <h3 class="aa-h3">Descripción</h3>
                    <p>Este documento denominado: Cuestionario de Aceptación del Cliente está diseñado para documentar la evaluación de posibles condiciones que podrían limitar el desarrollo adecuado del trabajo de auditoría. Este papel de trabajo recopila las consideraciones que el equipo de auditoría debe tener en cuenta respecto a restricciones operativas, normativas o logísticas impuestas por el cliente que puedan afectar el alcance del encargo.</p>

                    <h3 class="aa-h3">Objetivo</h3>
                    <p>Obtener información suficiente y adecuada del cliente potencial que permita a la firma evaluar si existen condiciones apropiadas para aceptar el encargo. Esta evaluación debe considerar la competencia y disponibilidad de recursos por parte de la firma, así como verificar el cumplimiento de los principios éticos fundamentales, en especial la integridad del cliente y de su administración.</p>

                    <h3 class="aa-h3">Alcance</h3>
                    <p>Este cuestionario debe aplicarse a todos los clientes nuevos antes de aceptar un encargo de auditoría, revisión u otros servicios relacionados. La evaluación se extiende también a encargos recurrentes si se han producido cambios sustanciales en el entorno del cliente, su administración, estructura financiera o comportamiento ético.</p>

                    <h3 class="aa-h3">Procedimiento</h3>
                    <p>Para realizar una adecuada evaluación de aceptación, el equipo debe recopilar y analizar información considerando los siguientes factores:</p>
                    <ol class="aa-list">
                        <li>Capacidad técnica y operativa de la firma para ejecutar el encargo con calidad y cumplimiento normativo.</li>
                        <li>Antecedentes relevantes del cliente, incluyendo reputación pública, historial financiero, cumplimiento normativo y antecedentes judiciales o regulatorios.</li>
                        <li>Consultas con terceros confiables, como bancos, abogados o proveedores.</li>
                        <li>Verificaciones externas mediante fuentes independientes, incluyendo análisis de riesgo reputacional.</li>
                        <li>Interacción con auditores antecesores, si corresponde, para identificar posibles objeciones, conflictos o temas contables relevantes.</li>
                    </ol>

                    <h3 class="aa-h3">Cómo diligenciarlo</h3>
                    <ol class="aa-list">
                        <li>Lea y analice cada requerimiento y considere si aplica al encargo.</li>
                        <li>En cada requerimiento elija una respuesta:
                            <ul class="aa-list aa-list-inner">
                                <li><strong>Sí:</strong> se verificó el cumplimiento del requerimiento.</li>
                                <li><strong>No:</strong> no se cumplió o existe un hallazgo que requiere acción.</li>
                                <li><strong>N/A:</strong> el requerimiento no es relevante para el cliente o el encargo.</li>
                            </ul>
                        </li>
                        <li><strong>Nivel de riesgo:</strong> elija el nivel según el estado del requerimiento. La escala se personaliza desde «Información del proyecto», en Monitoreo y Control.</li>
                        <li><strong>Ref. de P/T:</strong> indique los papeles o archivos que respaldan la evaluación (entrevistas, bases de datos, informes públicos).</li>
                        <li><strong>Hecho por y fecha:</strong> el equipo registra su nombre y la fecha de diligenciamiento. Se completa solo al responder y puede editarse.</li>
                        <li><strong>Comentarios:</strong> explique situaciones particulares, observaciones o la justificación de las respuestas «No» o «N/A».</li>
                    </ol>

                    <h3 class="aa-h3">Preguntas frecuentes</h3>
                    <details class="aa-faq">
                        <summary>¿Por qué es importante evaluar la aceptación de un nuevo cliente antes de iniciar un trabajo de auditoría?</summary>
                        <p>La evaluación de aceptación de un nuevo cliente es fundamental porque permite a la firma de auditoría asegurarse de que está tomando un encargo que no represente riesgos indebidos para su reputación, independencia, cumplimiento ético o capacidad operativa. Además, facilita la identificación de situaciones que podrían limitar el alcance del encargo o afectar la calidad de la auditoría.</p>
                    </details>
                    <details class="aa-faq">
                        <summary>¿Cómo influye la independencia del auditor en la decisión de aceptar un encargo?</summary>
                        <p>La independencia es un principio esencial que debe ser salvaguardado antes de aceptar un encargo. Si existen amenazas a la independencia, como relaciones financieras, familiares o comerciales con el cliente, o si el auditor ha prestado servicios que comprometan su objetividad, se deben identificar y documentar, así como las salvaguardas aplicadas.</p>
                    </details>
                    <details class="aa-faq">
                        <summary>¿Qué tipo de riesgos deben evaluarse antes de aceptar un nuevo cliente?</summary>
                        <p>Antes de aceptar un nuevo cliente, deben evaluarse riesgos relacionados con la industria, el entorno regulatorio, la complejidad operativa, la estabilidad financiera, la calidad de la información contable y el comportamiento de la dirección.</p>
                    </details>
                    <details class="aa-faq">
                        <summary>¿Qué rol cumple la revisión del auditor anterior en la evaluación de aceptación?</summary>
                        <p>La revisión del trabajo del auditor anterior permite obtener una perspectiva objetiva sobre el comportamiento del cliente, la calidad de la información financiera y la actitud de la dirección frente a la auditoría. Si el auditor predecesor identificó errores frecuentes, propuso ajustes no corregidos, o enfrentó dificultades en el acceso a la información, esto puede indicar riesgos relevantes que deben ser considerados antes de aceptar el encargo.</p>
                    </details>
                    <details class="aa-faq">
                        <summary>¿Se puede adaptar este documento a clientes de distintos sectores o tamaños?</summary>
                        <p>Sí. El documento está diseñado con flexibilidad para ser adaptado por materialidad, complejidad o riesgos específicos del cliente. Si bien debe completarse en todas las auditorías, algunos requerimientos pueden marcarse como «No aplica» siempre que exista una justificación técnica clara.</p>
                    </details>
                </div>
            </section>

            <!-- Datos del encargo y del equipo -->
            <section class="aa-card" aria-labelledby="datosTitulo">
                <button type="button" class="aa-card-toggle" id="datosToggle" aria-expanded="true" aria-controls="datosCuerpo">
                    <span class="aa-card-title" id="datosTitulo">Datos del encargo y del equipo</span>
                    <span class="aa-count" id="contadorDatos"></span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="datosCuerpo">
                    <div class="aa-grid">
                        <label class="aa-field aa-span-2">
                            <span class="aa-label">Entidad (o cliente)</span>
                            <input type="text" class="aa-input" data-bind="meta.entidad" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">ID / NIT</span>
                            <input type="text" class="aa-input" data-bind="meta.nit" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Referencia</span>
                            <input type="text" class="aa-input" value="AA-01" readonly tabindex="-1" data-siempre-activo />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Período de auditoría desde</span>
                            <input type="date" class="aa-input" data-bind="meta.desde" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Hasta</span>
                            <input type="date" class="aa-input" data-bind="meta.hasta" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Preparado por</span>
                            <input type="text" class="aa-input" data-bind="meta.preparadoPor" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Revisado por</span>
                            <input type="text" class="aa-input" data-bind="meta.revisadoPor" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Supervisado por</span>
                            <input type="text" class="aa-input" data-bind="meta.supervisadoPor" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Aprobado por</span>
                            <input type="text" class="aa-input" data-bind="meta.aprobadoPor" autocomplete="off" />
                        </label>
                        <label class="aa-field aa-span-2">
                            <span class="aa-label">Socio responsable de la evaluación (nombre y cargo) <abbr class="aa-req" title="Obligatorio">*</abbr></span>
                            <input type="text" class="aa-input" data-bind="meta.socio" autocomplete="off" data-obligatorio />
                        </label>
                        <fieldset class="aa-field aa-span-2 aa-fieldset-inline">
                            <legend class="aa-label">¿Es una entidad de interés público? <abbr class="aa-req" title="Obligatorio">*</abbr></legend>
                            <div class="aa-seg" role="radiogroup">
                                <label class="aa-seg-opt"><input type="radio" name="interesPublico" value="SI" data-bind="meta.interesPublico" /><span>Sí</span></label>
                                <label class="aa-seg-opt"><input type="radio" name="interesPublico" value="NO" data-bind="meta.interesPublico" /><span>No</span></label>
                                <label class="aa-seg-opt"><input type="radio" name="interesPublico" value="NA" data-bind="meta.interesPublico" /><span>N/A</span></label>
                            </div>
                        </fieldset>
                    </div>
                    <p class="aa-hint">Los datos del encargo se completan solos cuando el papel se abre desde un encargo creado en «Información del proyecto».</p>
                </div>
            </section>

            <!-- Las 10 secciones de requerimientos se generan aquí (acordeón) -->
            <div class="aa-block-title" id="tituloRequerimientos">
                <h2>Requerimientos</h2>
                <span class="aa-hint" id="resumenRequerimientos"></span>
            </div>
            <div class="aa-sections" id="secciones" aria-live="polite"></div>

            <!-- Riesgos a nivel de estados financieros -->
            <section class="aa-card" aria-labelledby="eeffTitulo">
                <button type="button" class="aa-card-toggle" id="eeffToggle" aria-expanded="false" aria-controls="eeffCuerpo">
                    <span class="aa-card-title" id="eeffTitulo">Riesgos a nivel de los estados financieros</span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="eeffCuerpo" hidden>
                    <h3 class="aa-h3">Descripción del riesgo</h3>
                    <div id="listaRiesgosEEFF" class="aa-stack"></div>
                    <button type="button" class="aa-btn aa-btn-ghost" id="btnAgregarRiesgoEEFF">+ Agregar riesgo</button>

                    <h3 class="aa-h3">Efecto de los controles a nivel de entidad y de los riesgos a nivel de los estados financieros en nuestra auditoría</h3>
                    <label class="aa-field">
                        <span class="aa-label">Efecto en nuestra estrategia de auditoría</span>
                        <textarea class="aa-textarea" rows="3" data-bind="eeff.estrategia"></textarea>
                    </label>
                    <label class="aa-field">
                        <span class="aa-label">Efecto en nuestro enfoque de auditoría planificado para cuentas y divulgaciones significativas</span>
                        <textarea class="aa-textarea" rows="3" data-bind="eeff.enfoque"></textarea>
                    </label>
                </div>
            </section>

            <!-- Riesgos identificados -->
            <section class="aa-card" aria-labelledby="regTitulo">
                <button type="button" class="aa-card-toggle" id="regToggle" aria-expanded="false" aria-controls="regCuerpo">
                    <span class="aa-card-title" id="regTitulo">Riesgos identificados y controles</span>
                    <span class="aa-count" id="contadorRegistro"></span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="regCuerpo" hidden>
                    <div id="listaRegistro" class="aa-stack"></div>
                    <button type="button" class="aa-btn aa-btn-ghost" id="btnAgregarRegistro">+ Agregar riesgo identificado</button>
                    <p class="aa-hint">Hasta 12 riesgos, como en el papel original. En el Add-in estos riesgos alimentan la matriz central de riesgos del encargo.</p>
                </div>
            </section>

            <!-- Conclusión -->
            <section class="aa-card aa-card-conclusion" aria-labelledby="concTitulo">
                <button type="button" class="aa-card-toggle" id="concToggle" aria-expanded="true" aria-controls="concCuerpo">
                    <span class="aa-card-title" id="concTitulo">Conclusión y firma del socio</span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="concCuerpo">

                    <h3 class="aa-h3">Clasificación del riesgo del cliente</h3>
                    <p class="aa-p-small">Con base en el conocimiento preliminar del posible cliente y de los factores señalados, el cliente se clasifica en el nivel de riesgo:</p>
                    <div class="aa-riesgo-box" id="cajaRiesgo">
                        <div class="aa-riesgo-main">
                            <span class="aa-chip aa-chip-riesgo aa-chip-lg" id="chipRiesgo" data-nivel="">Sin calificar</span>
                            <span class="aa-riesgo-detalle" id="detalleRiesgo">Califique el nivel de riesgo de los requerimientos para obtener la clasificación.</span>
                        </div>
                        <div class="aa-dist" id="distribucionRiesgo" role="img" aria-label="Distribución de requerimientos por nivel de riesgo"></div>
                        <ul class="aa-dist-legend" id="leyendaRiesgo"></ul>
                    </div>

                    <h3 class="aa-h3">Comentarios finales del socio</h3>
                    <label class="aa-field">
                        <span class="aa-label aa-sr">Comentarios finales del socio</span>
                        <textarea class="aa-textarea" rows="4" data-bind="conclusion.comentarios" placeholder="Escriba aquí sus comentarios finales"></textarea>
                    </label>

                    <fieldset class="aa-decl">
                        <legend class="aa-label">Declaraciones del socio <span class="aa-hint">(se exigen si decide aceptar)</span></legend>
                        <label class="aa-check"><input type="checkbox" data-bind="conclusion.decl.0" /><span>Estoy satisfecho de que no hay prohibiciones que impidan a la firma de auditoría o a algún miembro del equipo del encargo realizar este encargo.</span></label>
                        <label class="aa-check"><input type="checkbox" data-bind="conclusion.decl.1" /><span>En los casos en que se identificaron amenazas relevantes a nuestra independencia, existen salvaguardas para eliminarlas o reducirlas a un nivel aceptable.</span></label>
                        <label class="aa-check"><input type="checkbox" data-bind="conclusion.decl.2" /><span>No tengo conocimiento de que existan factores que puedan afectar nuestra independencia o apariencia de independencia.</span></label>
                        <label class="aa-check"><input type="checkbox" data-bind="conclusion.decl.3" /><span>Estoy satisfecho de que hemos obtenido suficiente información para determinar si aceptar o no este encargo.</span></label>
                    </fieldset>

                    <fieldset class="aa-field aa-fieldset-inline">
                        <legend class="aa-label">En mi opinión, debemos… <abbr class="aa-req" title="Obligatorio">*</abbr></legend>
                        <div class="aa-seg aa-seg-decision" role="radiogroup">
                            <label class="aa-seg-opt"><input type="radio" name="decision" value="Aceptar" data-bind="conclusion.decision" /><span>Aceptar este encargo</span></label>
                            <label class="aa-seg-opt"><input type="radio" name="decision" value="Declinar" data-bind="conclusion.decision" /><span>Declinar este encargo</span></label>
                        </div>
                    </fieldset>

                    <p class="aa-notice" id="avisoSeguimiento" hidden>Deberá establecer si las condiciones previas para una auditoría están presentes y confirmar un entendimiento común entre el auditor y la administración (y, en su caso, los encargados del gobierno) de los términos del trabajo de auditoría.</p>
                    <p class="aa-notice aa-notice-warn" id="avisoRiesgoAlto" hidden>La clasificación del cliente es alta o crítica. Documente en los comentarios del socio por qué se acepta el encargo.</p>

                    <!-- Firma -->
                    <div class="aa-firma" id="bloqueFirma">
                        <div class="aa-firma-estado" id="firmaEstado">Sin firmar.</div>
                        <div class="aa-firma-confirma" id="firmaConfirma" hidden>
                            <p>Va a firmar como <strong id="firmaNombre"></strong>. Al firmar, el papel queda bloqueado; si luego se modifica, la firma se invalida.</p>
                            <div class="aa-row-btns">
                                <button type="button" class="aa-btn aa-btn-primary" id="btnConfirmarFirma">Confirmar firma</button>
                                <button type="button" class="aa-btn aa-btn-ghost" id="btnCancelarFirma">Cancelar</button>
                            </div>
                        </div>
                        <div class="aa-firma-reabrir" id="firmaReabrirConfirma" hidden>
                            <p>Reabrir el papel invalida la firma actual y deja constancia en el historial.</p>
                            <div class="aa-row-btns">
                                <button type="button" class="aa-btn aa-btn-danger" id="btnConfirmarReabrir" data-siempre-activo>Reabrir y editar</button>
                                <button type="button" class="aa-btn aa-btn-ghost" id="btnCancelarReabrir" data-siempre-activo>Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Panel de pendientes (se abre con «Verificar pendientes») -->
            <section class="aa-card aa-pendientes" id="panelPendientes" aria-labelledby="pendTitulo" hidden>
                <div class="aa-pend-head">
                    <h2 class="aa-card-title" id="pendTitulo">Pendientes</h2>
                    <button type="button" class="aa-btn aa-btn-ghost aa-btn-sm" id="btnCerrarPendientes" data-siempre-activo>Cerrar</button>
                </div>
                <div id="pendCuerpo"></div>
            </section>

        </main>

        <!-- BARRA DE ACCIONES FIJA -->
        <footer class="aa-bar">
            <span class="aa-save" id="estadoGuardado" role="status" aria-live="polite">Sin cambios</span>
            <div class="aa-bar-btns">
                <button type="button" class="aa-btn aa-btn-ghost" id="btnPendientes" data-siempre-activo>
                    Verificar pendientes <span class="aa-badge" id="badgePendientes" hidden>0</span>
                </button>
                <button type="button" class="aa-btn aa-btn-primary" id="btnFirmar" disabled>Firmar</button>
            </div>
        </footer>
    </div>

    <!-- PLANTILLAS -->

    <template id="tpl-seccion">
        <section class="aa-sec">
            <h2 class="aa-sec-h">
                <button type="button" class="aa-sec-toggle" aria-expanded="false">
                    <span class="aa-sec-num"></span>
                    <span class="aa-sec-title"></span>
                    <span class="aa-count"></span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
            </h2>
            <div class="aa-sec-body" hidden></div>
        </section>
    </template>

    <!-- Requerimiento que se responde -->
    <template id="tpl-item">
        <fieldset class="aa-item" data-id="">
            <legend class="aa-item-legend">
                <span class="aa-item-num"></span>
                <span class="aa-item-text"></span>
            </legend>
            <p class="aa-item-nota" hidden></p>
            <p class="aa-item-ayuda" hidden></p>

            <div class="aa-item-ctrls">
                <div class="aa-seg aa-seg-resp" role="radiogroup" aria-label="Respuesta">
                    <label class="aa-seg-opt aa-opt-si"><input type="radio" value="SI" data-campo="r" /><span>Sí</span></label>
                    <label class="aa-seg-opt aa-opt-no"><input type="radio" value="NO" data-campo="r" /><span>No</span></label>
                    <label class="aa-seg-opt aa-opt-na"><input type="radio" value="NA" data-campo="r" /><span>N/A</span></label>
                </div>
                <label class="aa-field aa-field-inline aa-riesgo-sel" data-tipo="riesgo">
                    <span class="aa-label">Riesgo</span>
                    <select class="aa-select" data-campo="riesgo"></select>
                </label>
                <label class="aa-field aa-field-inline aa-riesgo-sel" data-tipo="amenaza" hidden>
                    <span class="aa-label">Nivel de la amenaza</span>
                    <select class="aa-select" data-campo="amenaza"></select>
                </label>
            </div>

            <button type="button" class="aa-detalle-toggle" aria-expanded="false">
                <span>Detalle</span>
                <span class="aa-dot" hidden aria-label="Con información"></span>
            </button>
            <div class="aa-detalle" hidden>
                <label class="aa-field">
                    <span class="aa-label">Ref. de P/T</span>
                    <input type="text" class="aa-input" data-campo="ref" autocomplete="off" />
                </label>
                <label class="aa-field">
                    <span class="aa-label">Hecho por y fecha</span>
                    <input type="text" class="aa-input" data-campo="hecho" autocomplete="off" />
                </label>
                <label class="aa-field">
                    <span class="aa-label">Comentarios</span>
                    <textarea class="aa-textarea" rows="2" data-campo="com"></textarea>
                </label>
            </div>
        </fieldset>
    </template>

    <!-- Texto sin respuesta (encabezado de grupo o nota) -->
    <template id="tpl-info">
        <div class="aa-info">
            <span class="aa-item-num"></span>
            <span class="aa-item-text"></span>
        </div>
    </template>

    <template id="tpl-riesgo-eeff">
        <div class="aa-row-item">
            <label class="aa-field">
                <span class="aa-label aa-sr">Descripción del riesgo</span>
                <textarea class="aa-textarea" rows="2" placeholder="Describa el riesgo"></textarea>
            </label>
            <button type="button" class="aa-icon-btn" aria-label="Quitar este riesgo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    </template>

    <template id="tpl-registro">
        <fieldset class="aa-reg">
            <legend class="aa-reg-legend">
                <span class="aa-reg-num"></span>
                <button type="button" class="aa-icon-btn" aria-label="Quitar este riesgo identificado">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </legend>
            <label class="aa-field">
                <span class="aa-label">Descripción del riesgo</span>
                <textarea class="aa-textarea" rows="2" data-campo="descripcion"></textarea>
            </label>
            <div class="aa-grid">
                <label class="aa-field">
                    <span class="aa-label">Tipo de riesgo</span>
                    <select class="aa-select" data-campo="tipo"></select>
                </label>
                <label class="aa-field">
                    <span class="aa-label">Nivel de riesgo</span>
                    <select class="aa-select" data-campo="nivel"></select>
                </label>
                <label class="aa-field aa-span-2">
                    <span class="aa-label">Control identificado</span>
                    <input type="text" class="aa-input" data-campo="control" autocomplete="off" />
                </label>
                <label class="aa-field">
                    <span class="aa-label">Frecuencia del control</span>
                    <select class="aa-select" data-campo="frecuencia"></select>
                </label>
                <label class="aa-field">
                    <span class="aa-label">Ref. P/T</span>
                    <input type="text" class="aa-input" data-campo="refPT" autocomplete="off" />
                </label>
            </div>
        </fieldset>
    </template>`;
