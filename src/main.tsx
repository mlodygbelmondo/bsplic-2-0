import { createRoot } from "react-dom/client";
import { bindMaintenanceModeChecks } from "@/lib/maintenance-mode";
import { bindServiceWorkerUpdateChecks } from "@/lib/pwa-registration";
import { showPwaUpdateModal } from "@/lib/pwa-update";
import App from "./App.tsx";
import "./index.css";

bindMaintenanceModeChecks();

createRoot(document.getElementById("root")!).render(<App />);

const registerServiceWorker = () => {
  const register = () => {
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          showPwaUpdateModal(updateSW);
        },
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            bindServiceWorkerUpdateChecks(registration);
          }
        },
      });
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(register, { timeout: 3000 });
    return;
  }

  window.setTimeout(register, 1500);
};

registerServiceWorker();
