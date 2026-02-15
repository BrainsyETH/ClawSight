export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser.");
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "Service worker registered with scope:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
