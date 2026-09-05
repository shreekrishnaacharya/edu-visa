// ---------------------------------------------------------------------------
// Emulates the slice of `@sksharma72000/nestjs-search-page` behaviour that the
// copied `_service/dataProvider.ts` depends on: _start/_end paging,
// _sort/_order (incl. dotted paths), and simple equality / LIKE / IN filters.
// Returns the `{ elements, totalElements, pageable }` envelope.
// ---------------------------------------------------------------------------

import { db, nextId, type Resource } from "./db";
import { runMatch } from "./engine";
import type { MatchRun } from "./types";

const RESOURCES: Resource[] = ["students", "universities", "courses", "match-runs", "follow-ups", "documents"];

const PAGE_PARAMS = new Set(["_start", "_end", "_sort", "_order", "select"]);

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

const SUFFIXES = ["_gte", "_lte", "_gt", "_lt", "_like", "_ne", "_in", "_nin"] as const;

function splitKey(key: string): { field: string; op: string } {
  for (const s of SUFFIXES) {
    if (key.endsWith(s)) return { field: key.slice(0, -s.length), op: s.slice(1) };
  }
  return { field: key, op: "eq" };
}

/**
 * Understands the suffix-encoded filters that `@refinedev/simple-rest`'s
 * `generateFilter` emits (`field`, `field_like`, `field_gte`, `field_lte`,
 * `field_ne`, `field_in`), plus dotted paths and CSV → IN.
 */
function matchesFilters(row: any, params: URLSearchParams): boolean {
  for (const [key, raw] of params.entries()) {
    if (PAGE_PARAMS.has(key)) continue;
    if (raw === "" || raw == null || raw === "undefined") continue;
    if (key === "id") continue; // handled by getMany

    const { field, op } = splitKey(key);
    const actual = getByPath(row, field);

    if (op === "gte" || op === "lte" || op === "gt" || op === "lt") {
      const v = Number(actual);
      const n = Number(raw);
      if (Number.isNaN(v)) return false;
      if (op === "gte" && !(v >= n)) return false;
      if (op === "lte" && !(v <= n)) return false;
      if (op === "gt" && !(v > n)) return false;
      if (op === "lt" && !(v < n)) return false;
      continue;
    }

    if (op === "in" || op === "nin") {
      const set = raw.split(",").map((s) => s.trim());
      const hit = Array.isArray(actual)
        ? actual.some((a) => set.includes(String(a)))
        : set.includes(String(actual));
      if (op === "in" && !hit) return false;
      if (op === "nin" && hit) return false;
      continue;
    }

    if (op === "ne") {
      if (String(actual) === raw) return false;
      continue;
    }

    if (op === "like") {
      if (!String(actual ?? "").toLowerCase().includes(raw.toLowerCase())) return false;
      continue;
    }

    // eq (default). CSV value → membership; arrays → contains; scalars → strict.
    if (raw.includes(",")) {
      const set = raw.split(",").map((s) => s.trim());
      if (Array.isArray(actual)) {
        if (!actual.some((a) => set.includes(String(a)))) return false;
      } else if (!set.includes(String(actual))) return false;
      continue;
    }
    if (Array.isArray(actual)) {
      if (!actual.map(String).includes(raw)) return false;
      continue;
    }
    if (typeof actual === "number") {
      if (Number(raw) !== actual) return false;
      continue;
    }
    if (typeof actual === "boolean") {
      if ((raw === "true") !== actual) return false;
      continue;
    }
    if (String(actual ?? "") !== raw) return false;
  }
  return true;
}

function applySort(rows: any[], params: URLSearchParams): any[] {
  const sort = params.get("_sort");
  if (!sort) return rows;
  const cols = sort.split(",");
  const orders = (params.get("_order") ?? "ASC").split(",");
  return [...rows].sort((a, b) => {
    for (let i = 0; i < cols.length; i++) {
      const dir = (orders[i] ?? orders[0] ?? "ASC").toUpperCase() === "DESC" ? -1 : 1;
      const av = getByPath(a, cols[i]);
      const bv = getByPath(b, cols[i]);
      if (av == null && bv == null) continue;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === "number" && typeof bv === "number") {
        if (av !== bv) return (av - bv) * dir;
      } else if (String(av) !== String(bv)) {
        return String(av).localeCompare(String(bv)) * dir;
      }
    }
    return 0;
  });
}

export interface MockResponse {
  status: number;
  data: any;
}

/** Route a parsed request to the in-memory store. `path` excludes the base URL. */
export function handle(
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  body?: any,
): MockResponse {
  const url = new URL(path, "http://mock.local");
  const segments = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const [resource, id, sub] = segments as [Resource, string?, string?];

  if (!RESOURCES.includes(resource)) {
    return { status: 404, data: { message: `Unknown resource "${resource}"` } };
  }

  // ---- POST /match-runs  { student_id, weights? }  → run the engine --------
  if (resource === "match-runs" && method === "post") {
    const run = runMatch(body.student_id, { weights: body.weights, createdBy: body.created_by });
    return { status: 201, data: run };
  }

  // ---- collection GET ----------------------------------------------------
  if (method === "get" && !id) {
    let rows = [...db[resource]] as any[];

    // ids=... (getMany)
    const ids = url.searchParams.getAll("id");
    if (ids.length) {
      rows = rows.filter((r) => ids.includes(String(r.id)));
      return { status: 200, data: rows };
    }

    rows = rows.filter((r) => matchesFilters(r, url.searchParams));
    rows = applySort(rows, url.searchParams);

    const total = rows.length;
    const start = Number(url.searchParams.get("_start") ?? 0) || 0;
    const endRaw = url.searchParams.get("_end");
    const end = endRaw != null && Number.isFinite(Number(endRaw)) ? Number(endRaw) : start + 25;
    const elements = rows.slice(start, Math.max(start, end));

    return {
      status: 200,
      data: {
        elements,
        totalElements: total,
        pageable: { _start: start, _end: end, _sort: url.searchParams.get("_sort"), _order: url.searchParams.get("_order") },
      },
    };
  }

  // ---- item GET --------------------------------------------------------
  if (method === "get" && id) {
    const row = (db[resource] as any[]).find((r) => String(r.id) === id);
    if (!row) return { status: 404, data: { message: "Not found" } };
    if (resource === "students" && sub === "matches") {
      const latest = (db["match-runs"] as MatchRun[]).find((r) => r.student_id === id);
      return { status: 200, data: latest ?? null };
    }
    return { status: 200, data: row };
  }

  // ---- create --------------------------------------------------------
  if (method === "post") {
    const row = { id: nextId(resource), created_at: new Date().toISOString(), ...body };
    (db[resource] as any[]).unshift(row);
    return { status: 201, data: row };
  }

  // ---- update --------------------------------------------------------
  if ((method === "patch" || method === "put") && id) {
    const list = db[resource] as any[];
    const idx = list.findIndex((r) => String(r.id) === id);
    if (idx === -1) return { status: 404, data: { message: "Not found" } };
    list[idx] = { ...list[idx], ...body, id: list[idx].id };
    return { status: 200, data: list[idx] };
  }

  // ---- delete --------------------------------------------------------
  if (method === "delete" && id) {
    const list = db[resource] as any[];
    const idx = list.findIndex((r) => String(r.id) === id);
    if (idx === -1) return { status: 404, data: { message: "Not found" } };
    const [removed] = list.splice(idx, 1);
    return { status: 200, data: removed };
  }

  return { status: 400, data: { message: "Unhandled mock request" } };
}
