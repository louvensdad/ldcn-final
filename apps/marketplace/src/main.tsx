import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design/theme.css";
import "./design/global.css";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
