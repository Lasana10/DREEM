import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import RuntimeBoundary from "./components/RuntimeBoundary";
import { LanguageProvider } from "./lib/LanguageProvider";
import "./styles.css";
import "./roleWorkspaces.css";
import "./components/TransportManagerWorkspace.css";
import "./components/TeacherClassroomWorkspace.css";
import "./connectivity.css";
import "./experience-v2.css";
import "./consolidation-v4.css";
import "./experience-grade-v5.css";
import "./hardening-v6.css";
import "./report-output-v7.css";
import "./operating-loop-v11.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RuntimeBoundary>
      <LanguageProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LanguageProvider>
    </RuntimeBoundary>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
