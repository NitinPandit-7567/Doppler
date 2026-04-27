'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { SteamInventoryItem } from '@doppler/types';
import { InventoryTable } from './InventoryTable';
import { PortfolioValueCard } from './PortfolioValueCard';

interface InventoryValueResponse {
  readonly totalValueUsd: number;
  readonly itemCount: number;
  readonly lastSyncedAt: string;
}

export function InventoryClient() {
  const inventory = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<readonly SteamInventoryItem[]>('/api/inventory'),
    staleTime: 5 * 60 * 1000,
  });

  const value = useQuery({
    queryKey: ['inventory-value'],
    queryFn: () => api.get<InventoryValueResponse>('/api/inventory/value'),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <PortfolioValueCard
          totalValue={value.data?.totalValueUsd}
          itemCount={inventory.data?.length}
          isLoading={value.isLoading}
        />
      </div>

      <InventoryTable items={inventory.data ?? []} isLoading={inventory.isLoading} />
    </div>
  );
}
