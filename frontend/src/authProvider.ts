import type { AuthProvider } from "@refinedev/core";
import axios from "axios";
import {
  BASE_URL,
  REFRESH_KEY,
  TOKEN_KEY,
  USER_DETAIL,
  USE_MOCKS,
} from "@common/options";

// ---------------------------------------------------------------------------
// Real JWT auth against the NestJS API (server/), gated behind a real sign-in
// screen (src/modules/@auth/login.tsx) — `check()` no longer auto-logs-in.
// The top-bar role switch (MainLayout) re-authenticates as a seeded demo user
// for that role via signIn(), which is fine for this demo deployment but
// should be removed/permission-gated before a real production launch — see
// server/docs/overnight-qa-report-2026-09-02.md. When VITE_USE_MOCKS=true the
// old always-signed-in stub is kept.
// ---------------------------------------------------------------------------

export type Role = "counsellor" | "branch_admin" | "super_admin" | "student";

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  branch: string;
  avatar: string;
}

const DEMO_LOGINS: Record<Role, { email: string; password: string }> = {
  counsellor: { email: "bina.rai@edu-visa.local", password: "password123" },
  branch_admin: { email: "branch.admin@edu-visa.local", password: "password123" },
  super_admin: { email: "admin@edu-visa.local", password: "password123" },
  student: { email: "bina.rai@edu-visa.local", password: "password123" },
};

const DEFAULT_USER: DemoUser = {
  id: "staff-1",
  name: "Bina Rai",
  role: "counsellor",
  branch: "Kathmandu HQ",
  avatar: "https://i.pravatar.cc/128?img=47",
};

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function storedUser(): DemoUser {
  try {
    const raw = localStorage.getItem(USER_DETAIL);
    if (raw) return { ...DEFAULT_USER, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_USER;
}

export function getDemoUser(): DemoUser {
  return storedUser();
}

function tokenValid(): boolean {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) return false;
  const claims = decodeJwt(t);
  const exp = claims?.exp as number | undefined;
  return !!exp && exp * 1000 > Date.now();
}

async function signIn(role: Role): Promise<void> {
  const creds = DEMO_LOGINS[role] ?? DEMO_LOGINS.counsellor;
  const { data } = await axios.post(`${BASE_URL}/auth/login`, creds);
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(
    USER_DETAIL,
    JSON.stringify({
      id: data.user.id,
      name: data.user.full_name || data.user.email,
      role: data.user.role,
      branch: data.user.branch || "",
      avatar: "https://i.pravatar.cc/128?img=47",
    }),
  );
}

export function setDemoRole(role: Role) {
  signIn(role).finally(() => window.location.reload());
}

export const authProvider: AuthProvider = USE_MOCKS
  ? {
      // legacy stub — MSW build
      login: async () => ({ success: true, redirectTo: "/" }),
      logout: async () => ({ success: true, redirectTo: "/" }),
      check: async () => ({ authenticated: true }),
      onError: async () => ({}),
      getPermissions: async () => [storedUser().role],
      getIdentity: async () => storedUser(),
    }
  : {
      login: async ({ email, password }) => {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/login`, { email, password });
          localStorage.setItem(TOKEN_KEY, data.access_token);
          localStorage.setItem(REFRESH_KEY, data.refresh_token);
          localStorage.setItem(
            USER_DETAIL,
            JSON.stringify({
              id: data.user.id,
              name: data.user.full_name || data.user.email,
              role: data.user.role,
              branch: data.user.branch || "",
              avatar: "https://i.pravatar.cc/128?img=47",
            }),
          );
          return { success: true, redirectTo: "/" };
        } catch {
          return { success: false, error: { name: "Login failed", message: "Invalid credentials" } };
        }
      },
      logout: async () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_DETAIL);
        return { success: true, redirectTo: "/login" };
      },
      check: async () => {
        if (tokenValid()) return { authenticated: true };
        return { authenticated: false, redirectTo: "/login" };
      },
      onError: async (error) => {
        if (error?.statusCode === 401 || error?.response?.status === 401) {
          return { logout: true, redirectTo: "/login" };
        }
        return {};
      },
      getPermissions: async () => [storedUser().role],
      getIdentity: async () => storedUser(),
    };
