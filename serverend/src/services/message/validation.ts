const SNOWFLAKE_RE = /^\d{17,20}$/;

export function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
