import * as React from "react";
import { iniciarPanel } from "../panel.js";

// El panel (tabs, menús, buscador) lo dibuja panel.js desde botones.config.js.
// React solo entrega el contenedor y arranca el panel una vez.
export default function App() {
  React.useEffect(() => {
    iniciarPanel();
  }, []);

  return (
    <div className="tp" id="taskpane">
      <header className="tp-header">
        <div className="tp-brand-row">
          <img className="tp-logo-img" src="assets/logo-auditx.png" alt="AuditX · Provided by Auditool · Complemento" width="600" height="222" />
          <button type="button" id="tp-tema" className="tp-tema" role="switch" aria-checked="false" aria-label="Modo noche" title="Cambiar a modo noche">
          <span className="tp-tema-pista"><span className="tp-tema-bola">
            <svg className="i-sol" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <svg className="i-luna" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          </span></span>
        </button>
        </div>
        <div className="tp-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input id="search" className="tp-search-input" type="search"
            placeholder="Buscar en los tres paquetes" aria-label="Buscar botón u opción" autoComplete="off" />
        </div>
      </header>

      <div className="tp-tabs" id="tp-tabs" role="tablist" aria-label="Paquetes del Ribbon"></div>

      <div className="tp-meta">
        <span className="tp-meta-name" id="tp-pkg-nombre"></span>
        <span className="tp-meta-count" id="tp-pkg-cuenta"></span>
      </div>

      <p className="tp-aviso" id="tp-aviso" role="status" aria-live="polite" hidden></p>

      <nav className="tp-list" id="list" aria-label="Menú"></nav>
      <div className="tp-list tp-resultados" id="tp-resultados" hidden></div>

      <footer className="tp-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <div>
          <div className="tp-footer-title" id="activeTitle">Ningún papel de trabajo activo</div>
          <div className="tp-footer-sub">Papel de trabajo activo</div>
        </div>
      </footer>
    </div>
  );
}
