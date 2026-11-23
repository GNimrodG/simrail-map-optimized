import "core-js/actual/array/to-sorted";
import "./i18n.ts";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";
import { installChunkReloadHandler } from "./utils/chunk-reload.ts";

installChunkReloadHandler();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
