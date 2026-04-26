export type { ApiResponse, ApiError, PaginatedResponse, ApiResult } from './api';

export {
  SteamPriceResponseSchema,
  SteamInventoryItemSchema,
  CSFloatListingSchema,
  DealDataSchema,
} from './market';
export type {
  SteamPriceResponse,
  SteamInventoryItem,
  CSFloatListing,
  DealData,
} from './market';

export {
  PlanSchema,
  PlanValues,
  AgentContextSchema,
  AgentStepSchema,
  AgentRunResultSchema,
  TradeActionSchema,
  AutoApproveConfigSchema,
  ApprovalResultSchema,
  TradeActionPayloadSchema,
  PatchAnalysisSchema,
  AffectedItemSchema,
} from './agents';
export type {
  Plan,
  AgentContext,
  AgentStep,
  AgentRunResult,
  TradeAction,
  AutoApproveConfig,
  ApprovalResult,
  TradeActionPayload,
  PatchAnalysis,
  AffectedItem,
} from './agents';

export type {
  ServerToClientEvents,
  ClientToServerEvents,
  DealNewEvent,
  DealExpiredEvent,
  AgentRunStartEvent,
  AgentRunFinishEvent,
  AgentStepEvent,
  ActionPendingEvent,
  AlertEvent,
  PriceUpdateEvent,
} from './socket-events';

export { ApiEnvSchema, WorkerEnvSchema, parseEnv } from './env';
export type { ApiEnv, WorkerEnv } from './env';

export type { RouteContract, InferContract } from './contracts/helpers';

export {
  GetInventoryContract,
  GetInventoryValueContract,
  SyncInventoryContract,
} from './contracts/inventory.contracts';

export { SteamCallbackContract } from './contracts/auth.contracts';

export { GetPriceContract, GetListingsContract } from './contracts/market.contracts';

export {
  CreateAgentContract,
  GetAgentHistoryContract,
} from './contracts/agents.contracts';
