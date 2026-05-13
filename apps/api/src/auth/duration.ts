// Parses short duration strings like "15m", "7d", "1h", "30s" into seconds.
// Used to convert JWT/cookie TTLs from .env values into numbers that
// jsonwebtoken and res.cookie() both accept.

const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export function parseDurationToSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${input} (expected e.g. "15m", "7d")`);
  }
  const value = Number(match[1]);
  const unit = match[2] as string;
  const multiplier = UNIT_TO_SECONDS[unit];
  if (multiplier === undefined) {
    throw new Error(`Invalid duration unit in: ${input}`);
  }
  return value * multiplier;
}
