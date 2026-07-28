import { registerSW } from "virtual:pwa-register";

export function registerAppServiceWorker(): void {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      window.dispatchEvent(
        new CustomEvent("interest-manager:pwa-error", {
          detail: { message: "Offline cache unavailable" },
        }),
      );
      console.warn("Service worker registration failed", error);
    },
  });
}
