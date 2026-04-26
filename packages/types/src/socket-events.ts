export interface ServerToClientEvents {
  'deal:new': (payload: DealNewEvent) => void;
  'deal:expired': (payload: DealExpiredEvent) => void;
  'alert:new': (payload: AlertEvent) => void;
  'agent:run:start': (payload: AgentRunStartEvent) => void;
  'agent:run:finish': (payload: AgentRunFinishEvent) => void;
  'agent:step': (payload: AgentStepEvent) => void;
  'action:pending': (payload: ActionPendingEvent) => void;
  'price:update': (payload: PriceUpdateEvent) => void;
}

export interface ClientToServerEvents {
  'subscribe:watchlist': (itemNames: readonly string[]) => void;
  'unsubscribe:watchlist': (itemNames: readonly string[]) => void;
}

export interface DealNewEvent {
  readonly dealId: string;
  readonly itemName: string;
  readonly platform: 'STEAM' | 'CSFLOAT';
  readonly listedPrice: number;
  readonly steamPrice: number;
  readonly discountPct: number;
  readonly floatValue: number | null;
  readonly dealScore: number;
  readonly expiresAt: string | null;
  readonly listingUrl: string;
}

export interface DealExpiredEvent {
  readonly dealId: string;
}

export interface AgentRunStartEvent {
  readonly agentId: string;
  readonly runId: string;
  readonly agentName: string;
}

export interface AgentRunFinishEvent {
  readonly agentId: string;
  readonly runId: string;
  readonly status: 'COMPLETED' | 'FAILED';
  readonly summary: string;
  readonly dealsFound: number;
  readonly actionsCount: number;
}

export interface AgentStepEvent {
  readonly runId: string;
  readonly step: number;
  readonly toolName: string | null;
  readonly reasoning: string;
}

export interface ActionPendingEvent {
  readonly actionId: string;
  readonly actionType: 'BUY' | 'SELL';
  readonly itemName: string;
  readonly valueUsd: number;
  readonly platform: string;
  readonly reasoning: string;
  readonly expiresAt: string;
}

export interface AlertEvent {
  readonly alertId: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly payload: Record<string, unknown> | null;
}

export interface PriceUpdateEvent {
  readonly itemName: string;
  readonly platform: string;
  readonly priceUsd: number;
  readonly changePercent: number;
}
