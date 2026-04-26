'use client';

import { useState, useCallback } from 'react';
import { api } from '../lib/api-client';

interface AuthUser {
  readonly id: string;
  readonly steamId: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    window.location.href = `${apiUrl}/api/auth/steam`;
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.post('/api/auth/logout', {});
      setUser(null);
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { user, isLoading, login, logout } as const;
}
