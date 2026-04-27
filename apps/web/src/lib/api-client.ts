import type { z } from 'zod';
import type { ApiResponse, ApiError, RouteContract } from '@doppler/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ApiResult<T> = ApiResponse<T> | ApiError;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const json: unknown = await response.json();
  const result = json as ApiResult<T>;

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}

export function apiGet<T extends RouteContract>(
  path: string,
  contract: T,
  query?: Record<string, string>,
): Promise<z.infer<T['response']>> {
  const url = new URL(path, API_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return apiFetch(url.pathname + url.search);
}

export function apiPost<T extends RouteContract>(
  path: string,
  _contract: T,
  body: z.infer<T['body']>,
): Promise<z.infer<T['response']>> {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
} as const;
