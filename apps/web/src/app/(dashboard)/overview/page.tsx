import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InventoryClient } from '@/components/inventory/InventoryClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Dashboard' };

function InventorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-40 rounded" />
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your CS2 inventory and market intelligence.
        </p>
      </div>
      <Suspense fallback={<InventorySkeleton />}>
        <InventoryClient />
      </Suspense>
    </div>
  );
}
