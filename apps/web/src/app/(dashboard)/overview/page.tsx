import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InventoryClient } from '@/components/inventory/InventoryClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Dashboard' };

function InventorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded" />
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
        <p className="mt-1 text-muted-foreground">Your CS2 inventory and market intelligence.</p>
      </div>
      <Suspense fallback={<InventorySkeleton />}>
        <InventoryClient />
      </Suspense>
    </div>
  );
}
