// ---------------------------------------------------------------------------
// Mock Service Worker setup. Intercepts the axios (XHR) traffic the real
// `_service/dataProvider.ts` + `_service/axious.ts` produce and answers it from
// the in-memory store via `handle()`. Nothing about the data provider or the
// axios instance changes — point BASE_URL at the real API and drop
// `enableMocking()` from src/index.tsx to go live.
// ---------------------------------------------------------------------------

import { http, HttpResponse, type HttpHandler } from "msw";
import { setupWorker } from "msw/browser";
import { BASE_URL } from "@common/options";
import { handle } from "./handlers";

type Method = "get" | "post" | "put" | "patch" | "delete";

async function bridge(method: Method, request: Request) {
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  let body: unknown;
  if (method !== "get" && method !== "delete") {
    body = await request.clone().json().catch(() => undefined);
  }
  const { status, data } = handle(method, path, body);
  return HttpResponse.json(data, { status });
}

const wild = `${BASE_URL}/*`;

const handlers: HttpHandler[] = [
  http.get(wild, ({ request }) => bridge("get", request)),
  http.post(wild, ({ request }) => bridge("post", request)),
  http.put(wild, ({ request }) => bridge("put", request)),
  http.patch(wild, ({ request }) => bridge("patch", request)),
  http.delete(wild, ({ request }) => bridge("delete", request)),
];

export const worker = setupWorker(...handlers);

export async function enableMocking() {
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}
