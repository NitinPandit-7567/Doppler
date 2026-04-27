import type { Request, Response, RequestHandler } from 'express';
import type { z } from 'zod';
import type { RouteContract, ApiResponse, ApiError, Plan } from '@doppler/types';

interface AuthenticatedUser {
  readonly id: string;
  readonly steamId: string;
  readonly plan: Plan;
}

interface ValidatedData<T extends RouteContract> {
  readonly params: z.infer<T['params']>;
  readonly query: z.infer<T['query']>;
  readonly body: z.infer<T['body']>;
  readonly user: AuthenticatedUser;
}

type RouteResponse<T extends RouteContract> = Response<
  ApiResponse<z.infer<T['response']>> | ApiError
>;

type RouteHandler<T extends RouteContract> = (
  data: ValidatedData<T>,
  res: RouteResponse<T>,
) => Promise<void>;

export function createRoute<T extends RouteContract>(
  contract: T,
  handler: RouteHandler<T>,
): RequestHandler {
  return async (req: Request, res: Response) => {
    const paramsResult = contract.params.safeParse(req.params);
    if (!paramsResult.success) {
      const msg = paramsResult.error.issues.map((i) => i.message).join(', ');
      res.status(400).json({ success: false, error: `Invalid params: ${msg}` } satisfies ApiError);
      return;
    }

    const queryResult = contract.query.safeParse(req.query);
    if (!queryResult.success) {
      const msg = queryResult.error.issues.map((i) => i.message).join(', ');
      res.status(400).json({ success: false, error: `Invalid query: ${msg}` } satisfies ApiError);
      return;
    }

    const bodyResult = contract.body.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      const msg = bodyResult.error.issues.map((i) => i.message).join(', ');
      res.status(400).json({ success: false, error: `Invalid body: ${msg}` } satisfies ApiError);
      return;
    }

    try {
      await handler(
        {
          params: paramsResult.data,
          query: queryResult.data,
          body: bodyResult.data,
          user: req.user,
        },
        res as RouteResponse<T>,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, error: message } satisfies ApiError);
    }
  };
}
