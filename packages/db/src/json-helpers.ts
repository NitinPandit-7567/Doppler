import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

export function parseJsonField<T>(
  schema: z.ZodType<T>,
  value: Prisma.JsonValue,
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
): Prisma.InputJsonValue {
  schema.parse(value);
  return value as unknown as Prisma.InputJsonValue;
}
