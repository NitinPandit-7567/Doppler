'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { SteamInventoryItem } from '@doppler/types';
import { InventoryTable } from './InventoryTable';
import { PortfolioValueCard } from './PortfolioValueCard';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Lock, Gamepad2 } from 'lucide-react';

interface InventoryValueResponse {
  readonly totalValueUsd: number;
  readonly itemCount: number;
  readonly lastSyncedAt: string;
}

function InventoryError({ message }: { readonly message: string }) {
  const isProfilePrivate = message.includes('profile is set to private') || message.includes('PROFILE_PRIVATE');
  const isInventoryPrivate = message.includes('inventory is set to private') || message.includes('INVENTORY_PRIVATE');
  const isPrivate = isProfilePrivate || isInventoryPrivate;
  const isNoCS2 = message.includes('No CS2') || message.includes('NO_CS2_INVENTORY');

  if (isPrivate) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-4 pt-6">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-2">
            <h3 className="font-semibold">
              {isProfilePrivate ? 'Your Steam profile is private' : 'Your Steam inventory is private'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isProfilePrivate
                ? 'Doppler needs your Steam profile to be public to access your inventory and track prices.'
                : 'Your Steam profile is public, but your inventory visibility is set to private or friends-only.'}
            </p>
            <p className="text-sm font-medium text-muted-foreground">To fix this:</p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Open the Steam app or website</li>
              <li>Click your profile name, then &quot;Edit Profile&quot;</li>
              <li>Go to &quot;Privacy Settings&quot;</li>
              {isProfilePrivate ? (
                <>
                  <li>Set &quot;My profile&quot; to <strong>Public</strong></li>
                  <li>Set &quot;Game details&quot; to <strong>Public</strong></li>
                </>
              ) : null}
              <li>Set &quot;Inventory&quot; to <strong>Public</strong></li>
              <li>Come back here and refresh the page</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isNoCS2) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="flex items-start gap-4 pt-6">
          <Gamepad2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <div className="space-y-2">
            <h3 className="font-semibold">No CS2 inventory found</h3>
            <p className="text-sm text-muted-foreground">
              Make sure you own Counter-Strike 2 and have launched it at least once.
              Your CS2 inventory will appear here after your first game.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-start gap-4 pt-6">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <h3 className="font-semibold">Could not load inventory</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function InventoryClient() {
  const inventory = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<readonly SteamInventoryItem[]>('/api/inventory'),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error.message.includes('private') || error.message.includes('No CS2')) return false;
      return failureCount < 2;
    },
  });

  const value = useQuery({
    queryKey: ['inventory-value'],
    queryFn: () => api.get<InventoryValueResponse>('/api/inventory/value'),
    staleTime: 5 * 60 * 1000,
    enabled: inventory.isSuccess,
  });

  if (inventory.error) {
    return <InventoryError message={inventory.error.message} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <PortfolioValueCard
          totalValue={value.data?.totalValueUsd}
          itemCount={inventory.data?.length}
          isLoading={value.isLoading || inventory.isLoading}
        />
      </div>

      <InventoryTable items={inventory.data ?? []} isLoading={inventory.isLoading} />
    </div>
  );
}
