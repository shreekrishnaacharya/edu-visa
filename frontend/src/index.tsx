import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import App from "./App";
import { routes } from "./routes";
import { enableMocking } from "./mocks/browser";
import { USE_MOCKS } from "./@common/options";
import "./i18n";

dayjs.extend(relativeTime);

const router = createBrowserRouter([
  {
    element: (
      <App>
        <Outlet />
      </App>
    ),
    children: routes,
  },
]);

function render() {
  const container = document.getElementById("root") as HTMLElement;
  createRoot(container).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

// Against the real API (default) render straight away; only spin up the MSW
// worker when VITE_USE_MOCKS=true, and render regardless of whether it starts.
if (USE_MOCKS) {
  enableMocking()
    .catch((err) => console.error("[edu-visa] mock worker failed to start:", err))
    .finally(render);
} else {
  render();
}
