export interface ApiResponse<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiError {
  readonly success: false;
  readonly error: string;
  readonly code?: string;
}

export interface PaginatedResponse<T> {
  readonly success: true;
  readonly data: readonly T[];
  readonly pagination: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly hasMore: boolean;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
