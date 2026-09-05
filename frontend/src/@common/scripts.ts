window.addEventListener(
  "error",
  (event) => {
    const target = event.target;

    // JS or CSS file failed to load
    if (
      target instanceof HTMLScriptElement ||
      target instanceof HTMLLinkElement
    ) {
      forceReload();
    }
  },
  true,
);

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || "";

  if (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError")
  ) {
    console.log("Chunk load failure detected");

    forceReload();
  }
});

function forceReload() {
  const version = import.meta.env.VITE_APP_VERSION;

  const last = localStorage.getItem("app-version-reloaded");

  if (last === version) return;

  localStorage.setItem("app-version-reloaded", version);

  window.location.reload();
}
