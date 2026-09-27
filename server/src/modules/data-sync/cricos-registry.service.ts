import { HttpException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

/**
 * Client for the official CRICOS register published as open data by the
 * Department of Education on data.gov.au — the same PRISMS export that backs
 * the CRICOS website, refreshed monthly.
 *
 * Dataset: https://data.gov.au/data/dataset/cricos
 * (CKAN id e5ae7059-bfa8-4fa4-a5c0-c13cf3520193; the `/dataset/cricos` slug
 * resolves to the same package.)
 *
 * This is the authoritative source for which providers and courses legally
 * exist and what they cost. It publishes **no** entry requirements — no English
 * band, no GPA — which is why those are sourced separately per institution and
 * never inferred here.
 */

export const CRICOS_DATASET_ID = 'e5ae7059-bfa8-4fa4-a5c0-c13cf3520193';

/** The current (non-archival) resources we read. */
export const CRICOS_RESOURCES = {
  institutions: '7f6941f3-5327-4db7-b556-5f16d77f63c1',
  courses: '48cacf69-2082-415e-9595-f17d0c3a4af0',
  locations: '45d29535-1360-4486-8242-3850e61b5524',
  'course-locations': '4cd2de02-8ba3-4eb2-bac2-fe272cae3f5f',
} as const;

export type CricosResourceName = keyof typeof CRICOS_RESOURCES;

/**
 * Higher-education levels only. VET/Certificate/Diploma and school-level rows
 * are real CRICOS registrations but out of scope for a degree-matching
 * catalogue, and their providers publish little usable admissions data.
 */
export const HE_LEVELS = [
  'Bachelor Degree',
  'Bachelor Honours Degree',
  'Graduate Certificate',
  'Graduate Diploma',
  'Masters Degree (Coursework)',
  'Masters Degree (Research)',
  'Masters Degree (Extended)',
  'Doctoral Degree',
] as const;

export const VET_LEVELS = [
  'Advanced Diploma',
  'Diploma',
  'Associate Degree',
  'Certificate IV',
  'Certificate III',
] as const;

/**
 * Some joint/partner research degrees report a $0-$1 tuition fee because the
 * partner institution bills tuition — real registrations, but not a real
 * domestic price. `Dual Qualification` doesn't reliably flag them, so a
 * realistic floor catches the artifact instead.
 */
export const MIN_REALISTIC_FEE = 3000;

export interface ResourceMeta {
  id: string;
  name: string;
  /** CKAN's own version marker — what "has the source changed?" is answered from. */
  last_modified: string | null;
  size: number | null;
  format: string;
}

export interface RegisterFilters {
  /** Include Diploma/Advanced Diploma/Certificate levels alongside higher ed. */
  include_vet?: boolean;
  /** Restrict to these `State` values (from the locations file). */
  states?: string[];
  /** Restrict to 'Government' / 'Private' provider types. */
  institution_types?: string[];
}

export interface RegisterSnapshot {
  institutions: Record<string, string>[];
  courses: Record<string, string>[];
  locations: Record<string, string>[];
  /** Which campuses teach which course — per course, not per provider. */
  courseLocations: Record<string, string>[];
  meta: Record<CricosResourceName, ResourceMeta | null>;
}

@Injectable()
export class CricosRegistryService {
  private readonly log = new Logger(CricosRegistryService.name);

  /**
   * Resource metadata via CKAN `package_show`. Read before downloading so a run
   * can stop early when upstream hasn't republished since our last sync —
   * the register only changes monthly, so most checks should be no-ops.
   */
  async getResourceMeta(): Promise<Record<CricosResourceName, ResourceMeta | null>> {
    const url = `https://data.gov.au/data/api/3/action/package_show?id=${CRICOS_DATASET_ID}`;
    const res = await axios.get(url, {
      timeout: 30_000,
      headers: { 'user-agent': 'edu-visa/1.0 (+catalogue sync)' },
    });
    if (!res.data?.success) {
      throw new HttpException('data.gov.au package_show returned an unsuccessful response', 502);
    }
    const byId = new Map<string, any>(
      (res.data.result?.resources ?? []).map((r: any) => [r.id, r]),
    );
    const out = {} as Record<CricosResourceName, ResourceMeta | null>;
    for (const [name, id] of Object.entries(CRICOS_RESOURCES) as [CricosResourceName, string][]) {
      const r = byId.get(id);
      out[name] = r
        ? {
            id,
            name: r.name ?? name,
            // CKAN populates whichever of these the harvester set.
            last_modified: r.last_modified ?? r.metadata_modified ?? r.created ?? null,
            size: typeof r.size === 'number' ? r.size : null,
            format: r.format ?? 'CSV',
          }
        : null;
    }
    return out;
  }

  private async downloadResource(name: CricosResourceName): Promise<Record<string, string>[]> {
    const id = CRICOS_RESOURCES[name];
    const url = `https://data.gov.au/data/dataset/${CRICOS_DATASET_ID}/resource/${id}/download/cricos-${name}.csv`;
    this.log.log(`Downloading CRICOS ${name}...`);
    const res = await axios.get(url, {
      timeout: 180_000,
      responseType: 'arraybuffer',
      // data.gov.au 403s a default axios user-agent.
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; edu-visa/1.0)' },
      maxContentLength: 100 * 1024 * 1024,
    });
    return parse(Buffer.from(res.data), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });
  }

  /** Downloads every resource and applies the catalogue-scope filters. */
  async fetchSnapshot(filters: RegisterFilters = {}): Promise<RegisterSnapshot> {
    const meta = await this.getResourceMeta();
    const [institutions, courses, locations, courseLocations] = await Promise.all([
      this.downloadResource('institutions'),
      this.downloadResource('courses'),
      this.downloadResource('locations'),
      this.downloadResource('course-locations'),
    ]);

    const levels = new Set<string>([
      ...HE_LEVELS,
      ...(filters.include_vet ? VET_LEVELS : []),
    ]);

    const inScopeCourses = courses.filter(
      (r) =>
        levels.has(r['Course Level']) &&
        !this.isExpired(r) &&
        this.parseMoney(r['Tuition Fee']) >= MIN_REALISTIC_FEE &&
        parseFloat(r['Duration (Weeks)']) > 0,
    );

    let keep = new Set(inScopeCourses.map((r) => r['CRICOS Provider Code']));

    if (filters.institution_types?.length) {
      const allowed = new Set(filters.institution_types);
      const byType = new Set(
        institutions
          .filter((i) => allowed.has(i['Institution Type']))
          .map((i) => i['CRICOS Provider Code']),
      );
      keep = new Set([...keep].filter((c) => byType.has(c)));
    }

    if (filters.states?.length) {
      const allowed = new Set(filters.states.map((s) => s.toUpperCase()));
      const byState = new Set(
        locations
          .filter((l) => allowed.has(String(l['State']).toUpperCase()))
          .map((l) => l['CRICOS Provider Code']),
      );
      keep = new Set([...keep].filter((c) => byState.has(c)));
    }

    const inScopeCourseCodes = new Set(inScopeCourses.map((r) => r['CRICOS Course Code']));
    return {
      institutions: institutions.filter((r) => keep.has(r['CRICOS Provider Code'])),
      courses: inScopeCourses.filter((r) => keep.has(r['CRICOS Provider Code'])),
      locations: locations.filter((r) => keep.has(r['CRICOS Provider Code'])),
      courseLocations: courseLocations.filter(
        (r) => inScopeCourseCodes.has(r['CRICOS Course Code']) && keep.has(r['CRICOS Provider Code']),
      ),
      meta,
    };
  }

  isExpired(row: Record<string, string>): boolean {
    return ['yes', 'true', 'y'].includes(String(row.Expired ?? '').trim().toLowerCase());
  }

  parseMoney(s: string | undefined): number {
    return parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')) || 0;
  }
}
