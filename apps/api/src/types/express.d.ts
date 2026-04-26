import type { Plan } from '@doppler/types';

declare global {
  namespace Express {
    interface Request {
      user: {
        readonly id: string;
        readonly steamId: string;
        readonly plan: Plan;
      };
    }
  }
}
