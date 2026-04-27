import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Package } from 'lucide-react';

interface PortfolioValueCardProps {
  readonly totalValue: number | undefined;
  readonly itemCount: number | undefined;
  readonly isLoading: boolean;
}

export function PortfolioValueCard({ totalValue, itemCount, isLoading }: PortfolioValueCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          ${totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Package className="h-3 w-3" />
          {itemCount ?? 0} items
        </p>
      </CardContent>
    </Card>
  );
}
