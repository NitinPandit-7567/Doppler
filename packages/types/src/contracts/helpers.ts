import type { z } from 'zod';

export interface RouteContract {
  readonly params: z.ZodTypeAny;
  readonly query: z.ZodTypeAny;
  readonly body: z.ZodTypeAny;
  readonly response: z.ZodTypeAny;
}

export type InferContract<T extends RouteContract> = {
  readonly params: z.infer<T['params']>;
  readonly query: z.infer<T['query']>;
  readonly body: z.infer<T['body']>;
  readonly response: z.infer<T['response']>;
};
