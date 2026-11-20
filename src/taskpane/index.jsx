import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import "./panel.css";

/* global document, Office, module, require */

const container = document.getElementById("container");
const root = createRoot(container);

const render = (Component) => root.render(<Component />);

Office.onReady(() => {
  render(App);
});

if (module.hot) {
  module.hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    render(NextApp);
  });
}
