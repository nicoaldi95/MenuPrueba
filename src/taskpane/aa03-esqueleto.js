/* HTML del papel AA-03 (esqueleto y plantillas). */
export default `<!--
      Vista del papel AA-03. Se muestra dentro del task pane (≈320–420 px) y también funciona en
      un diálogo ancho. Los miembros del equipo se generan desde aa03-verificacion-compromisos.js
      (la hoja «AA-03 Verif. Compromisos Equipo» tiene una tabla de hasta 10 personas); aquí solo
      vive el esqueleto y los textos fijos.
    -->
    <div class="aa" id="aa03" data-estado="borrador">

        <!-- ENCABEZADO FIJO -->
        <header class="aa-top">
            <div class="aa-top-row">
                <button type="button" class="aa-back" id="a3-btnVolver" aria-label="Volver al menú de Pre-Planificación">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div class="aa-heading">
                    <span class="aa-ref">AA-03 · Pre-Planificación</span>
                    <h1 class="aa-title">Verificación de compromisos del equipo de auditoría</h1>
                </div>
                <span class="aa-chip aa-chip-estado" id="a3-chipEstado" role="status" aria-live="polite">En borrador</span>
            </div>

            <div class="aa-progress" aria-label="Avance de las declaraciones">
                <div class="aa-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="a3-barraAvance">
                    <span class="aa-progress-fill" id="a3-rellenoAvance"></span>
                </div>
                <div class="aa-progress-text">
                    <span id="a3-textoAvance">0 de 0 declaraciones</span>
                    <span class="aa-chip aa-chip-riesgo" id="a3-chipIncumpl" data-nivel="">Sin evaluar</span>
                </div>
            </div>
        </header>

        <!-- CONTENIDO -->
        <main class="aa-main" id="a3-contenido">

            <!-- Ayuda: descripción, objetivo, alcance e instrucciones de la hoja original -->
            <section class="aa-card aa-card-ayuda" aria-labelledby="a3-ayudaTitulo">
                <button type="button" class="aa-card-toggle" id="a3-ayudaToggle" aria-expanded="false" aria-controls="a3-ayudaCuerpo">
                    <span class="aa-card-title" id="a3-ayudaTitulo">Descripción, objetivo e instrucciones</span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="a3-ayudaCuerpo" hidden>
                    <h3 class="aa-h3">Descripción</h3>
                    <p>Este documento constituye un registro formal que consolida las validaciones individuales de los miembros del equipo de auditoría antes de iniciar el trabajo. Incluye los compromisos explícitos en tres áreas críticas: independencia, confidencialidad y conflicto de interés. A través de este formato, se garantiza que cada profesional ha firmado las declaraciones correspondientes y que cualquier situación identificada ha sido evaluada antes de asignar responsabilidades en el encargo.</p>

                    <h3 class="aa-h3">Objetivo</h3>
                    <p>Asegurar que todos los miembros del equipo asignado al encargo de auditoría cumplen con los requisitos establecidos para su participación, verificando si existe algún incumplimiento que deba ser evaluado antes del inicio del trabajo.</p>

                    <h3 class="aa-h3">Alcance</h3>
                    <p>Este formulario se utiliza para evaluar el cumplimiento, por parte del equipo de auditoría, de aspectos fundamentales como la independencia, los posibles conflictos de interés y la confidencialidad del encargo, como condición previa al inicio de los trabajos.</p>

                    <h3 class="aa-h3">Cómo diligenciarlo</h3>
                    <ol class="aa-list">
                        <li>Identifique a todos los miembros del equipo asignado al encargo. Registre el cargo y el nombre, desde el socio hasta asistentes, especialistas internos y personal de apoyo técnico o administrativo que participará directamente.</li>
                        <li>Para cada miembro, elija <strong>Cumple</strong> o <strong>No cumple</strong> en la confirmación anual de independencia, en la declaración de confidencialidad y en la declaración de conflicto de interés. Como respaldo, indique la referencia del papel de trabajo o documento que evidencia la respuesta.</li>
                        <li>Si desea agregar observaciones o comentarios, use el campo de observaciones del miembro o los comentarios finales.</li>
                    </ol>
                    <p class="aa-hint">Este registro debe completarse antes del inicio del encargo. Toda excepción o comentario relevante debe quedar consignado y ser revisado por el socio del encargo, conforme a la NIA 220 (Revisada) y al Código de Ética del IESBA.</p>

                    <h3 class="aa-h3">Preguntas frecuentes</h3>
                    <details class="aa-faq">
                        <summary>¿Se puede adaptar este documento a clientes de distintos sectores o tamaños?</summary>
                        <p>Sí. El documento está diseñado con flexibilidad para ser adaptado por materialidad, complejidad o riesgos específicos del cliente. Si bien debe completarse en todas las auditorías, algunos requerimientos pueden marcarse como «No aplica» siempre que exista una justificación técnica clara.</p>
                    </details>
                </div>
            </section>

            <!-- Datos del encargo y del equipo -->
            <section class="aa-card" aria-labelledby="a3-datosTitulo">
                <button type="button" class="aa-card-toggle" id="a3-datosToggle" aria-expanded="true" aria-controls="a3-datosCuerpo">
                    <span class="aa-card-title" id="a3-datosTitulo">Datos del encargo</span>
                    <span class="aa-count" id="a3-contadorDatos"></span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="a3-datosCuerpo">
                    <div class="aa-grid">
                        <label class="aa-field aa-span-2">
                            <span class="aa-label">Entidad (o cliente) <abbr class="aa-req" title="Obligatorio">*</abbr></span>
                            <input type="text" class="aa-input" data-bind="meta.entidad" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">ID / NIT</span>
                            <input type="text" class="aa-input" data-bind="meta.nit" autocomplete="off" />
                        </label>
                        <label class="aa-field">
                            <span class="aa-label">Referencia</span>
                            <input type="text" class="aa-input" value="AA-03" readonly tabindex="-1" data-siempre-activo />
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
                    </div>
                    <p class="aa-hint">Los datos del encargo se completan solos cuando el papel se abre desde un encargo creado en «Información del proyecto».</p>
                </div>
            </section>

            <!-- Equipo de auditoría -->
            <div class="aa-block-title">
                <h2>Equipo de auditoría</h2>
                <span class="aa-hint" id="a3-resumenEquipo"></span>
            </div>
            <div class="aa-stack" id="a3-listaEquipo" aria-live="polite"></div>
            <button type="button" class="aa-btn aa-btn-ghost" id="a3-btnAgregarMiembro">+ Agregar miembro del equipo</button>
            <p class="aa-hint" id="a3-notaMax"></p>

            <!-- Riesgos identificados -->
            <section class="aa-card" aria-labelledby="a3-regTitulo">
                <button type="button" class="aa-card-toggle" id="a3-regToggle" aria-expanded="false" aria-controls="a3-regCuerpo">
                    <span class="aa-card-title" id="a3-regTitulo">Riesgos identificados y controles</span>
                    <span class="aa-count" id="a3-contadorRegistro"></span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="a3-regCuerpo" hidden>
                    <div id="a3-listaRegistro" class="aa-stack"></div>
                    <button type="button" class="aa-btn aa-btn-ghost" id="a3-btnAgregarRegistro">+ Agregar riesgo identificado</button>
                    <p class="aa-hint">Hasta 12 riesgos, como en el papel original. En el Add-in estos riesgos alimentan la matriz central de riesgos del encargo.</p>
                </div>
            </section>

            <!-- Resumen, comentarios finales y firma -->
            <section class="aa-card aa-card-conclusion" aria-labelledby="a3-concTitulo">
                <button type="button" class="aa-card-toggle" id="a3-concToggle" aria-expanded="true" aria-controls="a3-concCuerpo">
                    <span class="aa-card-title" id="a3-concTitulo">Resumen, comentarios finales y firma</span>
                    <svg class="aa-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="aa-card-body" id="a3-concCuerpo">

                    <h3 class="aa-h3">Resumen de las declaraciones</h3>
                    <table class="aa-resumen" id="a3-tablaResumen">
                        <thead><tr><th scope="col">Declaración</th><th scope="col">Cumple</th><th scope="col">No cumple</th><th scope="col">Pendiente</th></tr></thead>
                        <tbody></tbody>
                    </table>
                    <p class="aa-notice aa-notice-warn" id="a3-avisoIncumpl" hidden></p>

                    <h3 class="aa-h3">Comentarios y observaciones finales</h3>
                    <label class="aa-field">
                        <span class="aa-label aa-sr">Comentarios y observaciones finales</span>
                        <textarea class="aa-textarea" rows="4" data-bind="final.comentarios" placeholder="Escriba aquí los comentarios finales"></textarea>
                    </label>
                    <p class="aa-hint">Este registro debe completarse antes del inicio del encargo. Toda excepción debe quedar consignada y ser revisada por el socio del encargo.</p>

                    <!-- Firma -->
                    <div class="aa-firma" id="a3-bloqueFirma">
                        <div class="aa-firma-estado" id="a3-firmaEstado">Sin firmar.</div>
                        <div class="aa-firma-confirma" id="a3-firmaConfirma" hidden>
                            <p>Va a firmar como <strong id="a3-firmaNombre"></strong>. Al firmar, el papel queda bloqueado; si luego se modifica, la firma se invalida.</p>
                            <div class="aa-row-btns">
                                <button type="button" class="aa-btn aa-btn-primary" id="a3-btnConfirmarFirma">Confirmar firma</button>
                                <button type="button" class="aa-btn aa-btn-ghost" id="a3-btnCancelarFirma">Cancelar</button>
                            </div>
                        </div>
                        <div class="aa-firma-reabrir" id="a3-firmaReabrirConfirma" hidden>
                            <p>Reabrir el papel invalida la firma actual y deja constancia en el historial.</p>
                            <div class="aa-row-btns">
                                <button type="button" class="aa-btn aa-btn-danger" id="a3-btnConfirmarReabrir" data-siempre-activo>Reabrir y editar</button>
                                <button type="button" class="aa-btn aa-btn-ghost" id="a3-btnCancelarReabrir" data-siempre-activo>Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Panel de pendientes -->
            <section class="aa-card aa-pendientes" id="a3-panelPendientes" aria-labelledby="a3-pendTitulo" hidden>
                <div class="aa-pend-head">
                    <h2 class="aa-card-title" id="a3-pendTitulo">Pendientes</h2>
                    <button type="button" class="aa-btn aa-btn-ghost aa-btn-sm" id="a3-btnCerrarPendientes" data-siempre-activo>Cerrar</button>
                </div>
                <div id="a3-pendCuerpo"></div>
            </section>

        </main>

        <!-- BARRA DE ACCIONES FIJA -->
        <footer class="aa-bar">
            <span class="aa-save" id="a3-estadoGuardado" role="status" aria-live="polite">Sin cambios</span>
            <div class="aa-bar-btns">
                <button type="button" class="aa-btn aa-btn-ghost" id="a3-btnPendientes" data-siempre-activo>
                    Verificar pendientes <span class="aa-badge" id="a3-badgePendientes" hidden>0</span>
                </button>
                <button type="button" class="aa-btn aa-btn-primary" id="a3-btnFirmar" disabled>Firmar</button>
            </div>
        </footer>
    </div>

    <!-- PLANTILLAS -->

    <template id="a3-tpl-miembro">
        <fieldset class="aa-miembro" data-i="">
            <legend class="aa-reg-legend">
                <span class="aa-miembro-num"></span>
                <span class="aa-miembro-estado" data-estado=""></span>
                <button type="button" class="aa-icon-btn" aria-label="Quitar este miembro">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </legend>
            <div class="aa-grid">
                <label class="aa-field">
                    <span class="aa-label">Cargo / categoría</span>
                    <input type="text" class="aa-input" data-campo="cargo" autocomplete="off" placeholder="Socio, gerente, asistente…" />
                </label>
                <label class="aa-field">
                    <span class="aa-label">Nombre</span>
                    <input type="text" class="aa-input" data-campo="nombre" autocomplete="off" />
                </label>
            </div>
            <div class="aa-decls"></div>
            <label class="aa-field">
                <span class="aa-label">Observaciones y/o comentarios</span>
                <textarea class="aa-textarea" rows="2" data-campo="obs"></textarea>
            </label>
        </fieldset>
    </template>

    <template id="a3-tpl-decl">
        <div class="aa-decl-fila" data-decl="">
            <span class="aa-decl-titulo"></span>
            <div class="aa-decl-ctrls">
                <div class="aa-seg" role="radiogroup">
                    <label class="aa-seg-opt aa-opt-si"><input type="radio" value="CUMPLE" data-campo="" /><span>Cumple</span></label>
                    <label class="aa-seg-opt aa-opt-no"><input type="radio" value="NO CUMPLE" data-campo="" /><span>No cumple</span></label>
                </div>
                <label class="aa-field aa-decl-ref">
                    <span class="aa-label">Ver P/T</span>
                    <input type="text" class="aa-input" data-campo="" autocomplete="off" placeholder="Referencia" />
                </label>
            </div>
        </div>
    </template>

    <template id="a3-tpl-registro">
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
