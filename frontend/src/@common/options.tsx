// `VITE_SERVER_URL` points at the real NestJS API (server/). When it is unset
// the app falls back to the virtual origin that the MSW mock layer intercepts
// (enable the mocks with `VITE_USE_MOCKS=true` — see src/index.tsx).
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
export const BASE_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://api.edu-visa.local";

export const UPLOAD_URL = `${BASE_URL}/resources`;
export const RESOURCE_URL = `${BASE_URL}/public/resources`;
export const API_KEY = "";
export const EDITOR_KEY = "";

export const SYSTEM_ADMIN_USER_ID = "1";
export const SYSTEM_ADMIN_ROLE_ID = "1";
export const DEFAULT_SYSTEM_DATE_TYPE = "ad";

export const PROJECT_TITLE = "Edu-Visa";
export const TOKEN_KEY = "ev-auth";
export const REFRESH_KEY = "ev-refresh";
export const USER_DETAIL = "ev-user";
export const ORG_DETAIL = "ev-org";
export const USER_ACCESS = "ev-access";
