import { createHash } from 'crypto';
import { DegreeLevel } from '../../common/enums';

/**
 * Projects raw CRICOS register rows onto our `university` / `course` shapes.
 *
 * Shared by the data-sync jobs and `src/seed/cricos-import.ts` so seeding and a
 * UI-driven sync can never drift into producing different rows from the same
 * source file.
 */

export const LEVEL_MAP: Record<string, DegreeLevel> = {
  'Bachelor Degree': 'Bachelor',
  'Bachelor Honours Degree': 'Bachelor',
  'Graduate Certificate': 'PG Diploma',
  'Graduate Diploma': 'PG Diploma',
  'Masters Degree (Coursework)': 'Master',
  'Masters Degree (Research)': 'Master',
  'Masters Degree (Extended)': 'Master',
  'Doctoral Degree': 'PhD',
};

/** Matches the `world_rank` column default; read by the engine as "no ranking signal". */
export const UNRANKED = 999;

/**
 * world_rank isn't in CRICOS data. These are the values the original curated
 * seed carried, verified against the snapshot's provider codes.
 *
 * Deliberately NOT extended to the other ranked Australian universities (ANU,
 * Adelaide, UTS, Macquarie, ...): QS/THE tables aren't open data, and typing
 * half-remembered rank numbers in would be the invented precision this pipeline
 * exists to stop. Everything else is UNRANKED — not ranked last.
 */
export const QS_RANK: Record<string, number> = {
  '00116K': 13, // The University of Melbourne (UniMelb)
  '00026A': 19, // The University of Sydney
  '00098G': 19, // The University of New South Wales (UNSW)
  '00008C': 37, // Monash University (Monash)
  '00025B': 40, // The University of Queensland
  '00126G': 77, // The University of Western Australia (UWA)
  '00122A': 140, // Royal Melbourne Institute of Technology (RMIT)
  '00113B': 233, // Deakin University (Deakin)
};

/**
 * Links real CRICOS providers to the already-reviewed `admission_policy`
 * briefings, which predate the full-register import and were keyed by hand.
 * Without this the real courses and the real policy for the same institution
 * would both exist without either finding the other.
 * Codes verified by name against the register's institutions file.
 */
export const POLICY_KEY_BY_CODE: Record<string, string> = {
  '00586B': 'utas', // University of Tasmania (UTas)
  '00109J': 'newcastle', // The University of Newcastle (UoN)
  '03389E': 'torrens-blue-mountains', // Torrens University Australia (incl. Blue Mountains IHMS)
  '01241G': 'scu', // Southern Cross University (SCU)
  '02664K': 'excelsia', // Excelsia University College
  '00219C': 'cqu', // Central Queensland University
  '01328A': 'acap-navitas', // ACAP University College
  '03906M': 'sydney-met', // Sydney Metropolitan Institute of Technology ("Sydney Met, formerly MIT Sydney")
  // This briefing is a Curtin COLLEGE document — its own `institution` is
  // "Curtin College" and it also covers Griffith College and Eynesbury College,
  // all three Navitas pathway providers. It was previously mapped onto Curtin
  // University (00301J) and Griffith University (00233E), which handed 643
  // degree courses at two universities the GS, sponsor and income rules of the
  // pathway colleges that feed them — and, because the document carries no
  // academic bands at all, made those 643 courses the single largest
  // "no requirement on file" gap in the catalogue. Neither university is in
  // scope, so neither is mapped.
  //
  // 00561M is Educational Enterprises Australia Pty Ltd, which is Eynesbury's
  // own registered entity, so that one is a genuine match. Curtin College is
  // carried as its own catalogue row (no provider code of its own in the
  // register) and is linked there. Griffith College has no row yet; when one is
  // added, it belongs here.
  '00561M': 'curtin-griffith-eynesbury', // Educational Enterprises Australia (Eynesbury)
};

/**
 * CRICOS gives a campus *locality* ("CLAYTON", "KENSINGTON"), not a metro label.
 * The matching engine compares `city` literally against a student's
 * preferred_cities and its big-city list, so a suburb would stop a
 * Sydney-preferring student from matching UNSW at Kensington. Australia Post's
 * published capital-city postcode ranges resolve locality -> metro; anything
 * outside them keeps its real locality, because a regional campus genuinely is
 * in Armidale, not a capital.
 */
const METRO_BY_POSTCODE: { city: string; ranges: [number, number][] }[] = [
  { city: 'Sydney', ranges: [[1000, 2234], [2555, 2574], [2740, 2786]] },
  { city: 'Canberra', ranges: [[200, 299], [2600, 2618], [2900, 2914]] },
  { city: 'Melbourne', ranges: [[3000, 3207], [8000, 8499]] },
  { city: 'Brisbane', ranges: [[4000, 4207], [9000, 9499]] },
  { city: 'Gold Coast', ranges: [[4209, 4229]] },
  { city: 'Adelaide', ranges: [[5000, 5199], [5900, 5999]] },
  { city: 'Perth', ranges: [[6000, 6199], [6800, 6999]] },
  { city: 'Hobart', ranges: [[7000, 7099]] },
  { city: 'Darwin', ranges: [[800, 899]] },
];

export function titleCase(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

/** The capital-city label for a postcode, or null when it is outside every range. */
export function metroByPostcode(postcode: string | null | undefined): string | null {
  const pc = parseInt(String(postcode ?? '').trim(), 10);
  if (!Number.isFinite(pc)) return null;
  for (const { city, ranges } of METRO_BY_POSTCODE) {
    if (ranges.some(([lo, hi]) => pc >= lo && pc <= hi)) return city;
  }
  return null;
}

export function metroFor(postcode: string | undefined, locality: string | undefined): string {
  const pc = parseInt(String(postcode ?? '').trim(), 10);
  if (Number.isFinite(pc)) {
    for (const { city, ranges } of METRO_BY_POSTCODE) {
      if (ranges.some(([lo, hi]) => pc >= lo && pc <= hi)) return city;
    }
  }
  return titleCase(locality ?? '') || 'Unknown';
}

/** Stable hue per provider so the UI is consistent across re-imports. */
export function logoHue(code: string): number {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function parseMoney(s: string | undefined): number {
  return Math.round(parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')) || 0);
}

/** "0905 - Human Welfare Studies and Services" -> "Human Welfare Studies and Services" */
export function cleanField(s: string | undefined): string {
  return String(s ?? '').replace(/^\d+\s*-\s*/, '').trim();
}

export function hashRecord(values: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 32);
}

export interface CampusLocation {
  city: string;
  state: string;
  postcode: string;
}

export interface MappedCampus {
  location_name: string;
  /** Metro label, derived the same way as `university.city` so the two compare. */
  city: string;
  locality: string | null;
  state: string | null;
  postcode: string | null;
  address: string | null;
  is_primary: boolean;
}

/** Campus location names per CRICOS course code, from the course-locations export. */
export function campusNamesByCourse(
  courseLocations: Record<string, string>[],
): Map<string, string[]> {
  const byCourse = new Map<string, string[]>();
  for (const row of courseLocations) {
    const code = row['CRICOS Course Code'];
    const name = row['Location Name'];
    if (!code || !name) continue;
    const list = byCourse.get(code) ?? [];
    if (!list.includes(name)) list.push(name);
    byCourse.set(code, list);
  }
  return byCourse;
}

/** Every registered location, grouped by provider code. */
export function locationsByCode(
  locations: Record<string, string>[],
): Map<string, Record<string, string>[]> {
  const byCode = new Map<string, Record<string, string>[]>();
  for (const loc of locations) {
    const code = loc['CRICOS Provider Code'];
    if (!code || !loc['City']) continue;
    const list = byCode.get(code) ?? [];
    list.push(loc);
    byCode.set(code, list);
  }
  return byCode;
}

/**
 * Maps a provider's registered locations, marking the primary one.
 *
 * "Primary" is the campus whose postcode matches the institution's own
 * registered postal postcode — the only non-arbitrary signal the register
 * offers, and it resolves 513 of 663 providers. The previous behaviour took
 * whichever location appeared first in the file, which gave CQU "Brisbane"
 * (a Boronia Rd address) when its registered home is Rockhampton.
 */
export function mapCampuses(
  inst: Record<string, string>,
  locations: Record<string, string>[],
): MappedCampus[] {
  const postalPostcode = String(inst['Postal Address Postcode'] ?? '').trim();
  let primaryChosen = false;

  // A regional campus's locality is often an obscure suburb ("NORMAN GARDENS")
  // while its own location name carries the town ("Rockhampton C.Q.U. Campus").
  // Build a vocabulary of this provider's other localities and prefer one that
  // the location name actually mentions — data-driven, not guessed.
  const localities = new Set(
    locations.map((l) => titleCase(l['City'] ?? '')).filter((x) => x.length > 2),
  );
  const townFromName = (locationName: string): string | null => {
    const name = String(locationName ?? '');
    for (const town of localities) {
      if (town && new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name)) {
        return town;
      }
    }
    return null;
  };

  const mapped = locations.map((loc) => {
    const postcode = String(loc['Postcode'] ?? '').trim() || null;
    const isPrimary = !primaryChosen && !!postalPostcode && postcode === postalPostcode;
    if (isPrimary) primaryChosen = true;
    return {
      location_name: (loc['Location Name'] || loc['City'] || 'Campus').slice(0, 250),
      // Metro label wins; otherwise a town named in the location name; otherwise
      // the raw locality.
      city:
        metroByPostcode(postcode) ??
        townFromName(loc['Location Name']) ??
        metroFor(postcode ?? undefined, loc['City']),
      locality: loc['City'] ? titleCase(loc['City']) : null,
      state: (loc['State'] || '').trim() || null,
      postcode,
      address:
        [loc['Address Line 1'], loc['Address Line 2'], loc['City'], loc['State'], postcode]
          .filter(Boolean)
          .join(', ') || null,
      is_primary: isPrimary,
    };
  });

  // No postcode match (150 of 663 providers) — fall back to the first location
  // so every institution still has exactly one primary.
  if (!primaryChosen && mapped.length) mapped[0].is_primary = true;

  // The register itself repeats a row occasionally (provider 03742D lists
  // "Adelaide Campus / 5000" twice), so dedupe on the same key the table is
  // unique on rather than letting the insert fail.
  const seen = new Set<string>();
  return mapped.filter((c) => {
    const key = `${c.location_name}|${c.postcode ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The campus `university.city` should be taken from. */
export function primaryCampus(campuses: MappedCampus[]): MappedCampus | undefined {
  return campuses.find((c) => c.is_primary) ?? campuses[0];
}

export interface MappedUniversity {
  cricos_provider_code: string;
  name: string;
  country: 'AU';
  city: string;
  world_rank: number;
  logo_hue: number;
  policy_key: string | null;
  institution_type: string | null;
  student_capacity: number | null;
  website: string | null;
  address: string | null;
  /**
   * Carried on the mapped row so the live sync can persist campuses at apply
   * time without re-downloading the register. Included in `content_hash`, so a
   * provider opening or closing a campus shows up as a change to review rather
   * than silently going stale.
   */
  campuses: MappedCampus[];
  content_hash: string;
}

export function mapUniversity(
  inst: Record<string, string>,
  campuses: MappedCampus[] = [],
): MappedUniversity {
  const code = inst['CRICOS Provider Code'];
  const primary = primaryCampus(campuses);
  // Primary campus first; the postal address is the fallback, since for some
  // providers it is a PO box or the institution's own name.
  const city =
    primary?.city ?? metroFor(inst['Postal Address Postcode'], inst['Postal Address City']);
  const address =
    [
      inst['Postal Address Line 1'],
      inst['Postal Address City'],
      inst['Postal Address State'],
      inst['Postal Address Postcode'],
    ]
      .filter(Boolean)
      .join(', ') || null;
  const student_capacity =
    parseInt(String(inst['Institution Capacity']).replace(/[^0-9]/g, ''), 10) || null;

  return {
    cricos_provider_code: code,
    name: inst['Institution Name'],
    country: 'AU',
    city,
    world_rank: QS_RANK[code] ?? UNRANKED,
    logo_hue: logoHue(code),
    policy_key: POLICY_KEY_BY_CODE[code] ?? null,
    institution_type: inst['Institution Type'] || null,
    student_capacity,
    website: inst['Website'] || null,
    address,
    campuses,
    content_hash: hashRecord([
      inst['Institution Name'],
      city,
      inst['Institution Type'],
      student_capacity,
      inst['Website'],
      address,
      campuses.map((c) => `${c.location_name}|${c.city}|${c.postcode ?? ''}`).sort(),
    ]),
  };
}

export interface MappedCourse {
  cricos: string;
  provider_code: string;
  university_name: string;
  title: string;
  degree_level: DegreeLevel;
  field: string;
  duration_months: number;
  /** Register publishes a whole-of-course fee; the catalogue stores per year. */
  tuition_fee: number;
  /**
   * Location names of the campuses that teach this course, from the register's
   * course-locations export. Resolved to campus ids at apply time; in the hash so
   * a course gaining or losing a campus is a reviewable change.
   */
  campus_location_names: string[];
  content_hash: string;
}

/**
 * Returns null when the row can't be represented (unmapped level, no fee/duration).
 * `campusLocationNames` comes from the register's course-locations export — the
 * campuses that actually teach this course, which is not the same as everywhere
 * its provider operates.
 */
export function mapCourse(
  row: Record<string, string>,
  campusLocationNames: string[] = [],
): MappedCourse | null {
  const level = LEVEL_MAP[row['Course Level']];
  const weeks = parseFloat(row['Duration (Weeks)']);
  const totalFee = parseMoney(row['Tuition Fee']);
  if (!level || !weeks || totalFee < 3000) return null;

  const years = weeks / 52;
  const tuitionPerYear = Math.round(totalFee / Math.max(years, 0.25));
  const field =
    cleanField(row['Field of Education 1 Detailed Field']) ||
    cleanField(row['Field of Education 1 Narrow Field']) ||
    cleanField(row['Field of Education 1 Broad Field']) ||
    'General';

  return {
    cricos: row['CRICOS Course Code'],
    provider_code: row['CRICOS Provider Code'],
    university_name: row['Institution Name'],
    title: row['Course Name'],
    degree_level: level,
    field,
    duration_months: Math.max(1, Math.round(weeks / 4.345)),
    tuition_fee: tuitionPerYear,
    campus_location_names: [...campusLocationNames].sort(),
    content_hash: hashRecord([
      row['Course Name'],
      level,
      field,
      Math.round(weeks),
      tuitionPerYear,
      [...campusLocationNames].sort(),
    ]),
  };
}
