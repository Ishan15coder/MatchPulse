/**
 * Shared parameter validation helpers.
 * All helpers return the parsed, safe value or throw an Error whose
 * message is safe to send directly to the client (no internal detail).
 */

const COMPETITION_RE = /^[A-Z]{2,4}$/;
const LEAGUE_ONLY = ['PD', 'SA'];

/**
 * Validate and normalise a competition code query parameter.
 * @param raw - raw string from req.query
 * @param leagueOnly - if true, reject codes other than PD / SA
 */
export function parseCompetition(raw: unknown, leagueOnly = false): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('Missing or invalid "competition" query parameter. Expected 2-4 uppercase letters, e.g. PD or SA.');
  }
  const code = raw.trim().toUpperCase();
  if (!COMPETITION_RE.test(code)) {
    throw new Error('Parameter "competition" must match ^[A-Z]{2,4}$ (e.g. PD, SA, CL).');
  }
  if (leagueOnly && !LEAGUE_ONLY.includes(code)) {
    throw new Error(`Parameter "competition" must be one of: ${LEAGUE_ONLY.join(', ')} for this endpoint.`);
  }
  return code;
}

/**
 * Validate and normalise a season query parameter.
 * @param raw - raw string from req.query
 */
export function parseSeason(raw: unknown): number {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('Missing or invalid "season" query parameter. Expected a 4-digit year, e.g. 2025.');
  }
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1000 || n > 9999) {
    throw new Error('Parameter "season" must be a 4-digit integer year, e.g. 2025.');
  }
  return n;
}

/**
 * Validate and normalise a positive-integer team id query parameter.
 * @param raw - raw string from req.query
 * @param name - param name used in the error message
 */
export function parseTeamId(raw: unknown, name: string): number {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`Missing or invalid "${name}" query parameter. Expected a positive integer team id.`);
  }
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Parameter "${name}" must be a positive integer.`);
  }
  return n;
}

/**
 * Validate and normalise the optional "last" (form window) parameter.
 * Defaults to 5, capped at 10.
 */
export function parseLast(raw: unknown): number {
  if (raw === undefined) return 5;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('Parameter "last" must be a positive integer between 1 and 10.');
  }
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('Parameter "last" must be a positive integer between 1 and 10.');
  }
  if (n > 10) {
    throw new Error('Parameter "last" must not exceed 10.');
  }
  return n;
}
