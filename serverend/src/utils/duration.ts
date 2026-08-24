/**
 * Parse durations like `14d`, `12h`, `30m`, `60s` into milliseconds.
 */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*([dhms])$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };

  return amount * multipliers[unit];
}
