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
          <div className="tp-logo" aria-hidden="true"></div>
          <span className="tp-title">AuditX</span>
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
