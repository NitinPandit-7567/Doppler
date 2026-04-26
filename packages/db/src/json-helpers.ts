import type { z } from 'zod';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function parseJsonField<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fieldName: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join(', ');
    throw new Error(`Invalid JSON in ${fieldName}: ${issues}`);
  }
  return result.data;
}

export function toJsonField<T>(
  schema: z.ZodType<T>,
  value: T,
): JsonValue {
  schema.parse(value);
  return value as unknown as JsonValue;
}
