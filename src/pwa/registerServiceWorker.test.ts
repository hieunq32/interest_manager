import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAppServiceWorker } from "./registerServiceWorker";

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }));

vi.mock("virtual:pwa-register", () => ({
  registerSW,
}));

describe("registerAppServiceWorker", () => {
  afterEach(() => {
    registerSW.mockReset();
    vi.restoreAllMocks();
  });

  it("registers the app service worker immediately", () => {
    registerAppServiceWorker();

    expect(registerSW).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }));
  });

  it("reports registration failures through the app event", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let registrationError: ((error: unknown) => void) | undefined;
    registerSW.mockImplementation((options: { onRegisterError?: (error: unknown) => void }) => {
      registrationError = options.onRegisterError;
    });
    const eventListener = vi.fn();
    window.addEventListener("interest-manager:pwa-error", eventListener);

    registerAppServiceWorker();
    registrationError?.(new Error("registration failed"));

    expect(eventListener).toHaveBeenCalledTimes(1);
    expect((eventListener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: "Offline cache unavailable",
    });
    expect(warn).toHaveBeenCalledWith("Service worker registration failed", expect.any(Error));
    window.removeEventListener("interest-manager:pwa-error", eventListener);
  });
});
