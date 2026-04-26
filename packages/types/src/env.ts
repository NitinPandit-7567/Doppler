import { z } from 'zod';

const BaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
});

export const ApiEnvSchema = BaseEnvSchema.extend({
  STEAM_API_KEY: z.string().min(1),
  CSFLOAT_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_WEB_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export const WorkerEnvSchema = BaseEnvSchema.extend({
  UPSTASH_REDIS_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  STEAM_API_KEY: z.string().min(1),
  CSFLOAT_API_KEY: z.string().min(1).optional(),
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function parseEnv<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  return result.data as z.infer<T>;
}
