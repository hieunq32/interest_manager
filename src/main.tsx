import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { registerAppServiceWorker } from "./pwa/registerServiceWorker";
import "./styles/global.css";

registerAppServiceWorker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
