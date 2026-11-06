import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ChunkLoadBoundary } from "./components/ChunkLoadBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChunkLoadBoundary>
      <App />
    </ChunkLoadBoundary>
  </React.StrictMode>
);
