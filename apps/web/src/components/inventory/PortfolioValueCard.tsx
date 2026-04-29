import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Package, TrendingUp } from 'lucide-react';

interface StatCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly isLoading: boolean;
}

function StatCard({ title, value, subtitle, icon, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="mt-1.5 h-3.5 w-20" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface PortfolioCardsProps {
  readonly totalValue: number | undefined;
  readonly itemCount: number | undefined;
  readonly isLoading: boolean;
}

export function PortfolioCards({ totalValue, itemCount, isLoading }: PortfolioCardsProps) {
  const formattedValue =
    totalValue !== undefined
      ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$0.00';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Portfolio Value"
        value={formattedValue}
        subtitle="Steam Market prices"
        icon={<DollarSign className="size-4 text-muted-foreground" />}
        isLoading={isLoading}
      />
      <StatCard
        title="Total Items"
        value={String(itemCount ?? 0)}
        subtitle="Tradable items"
        icon={<Package className="size-4 text-muted-foreground" />}
        isLoading={isLoading}
      />
      <StatCard
        title="Avg Item Value"
        value={
          totalValue !== undefined && itemCount && itemCount > 0
            ? `$${(totalValue / itemCount).toFixed(2)}`
            : '$0.00'
        }
        subtitle="Per item"
        icon={<TrendingUp className="size-4 text-muted-foreground" />}
        isLoading={isLoading}
      />
    </div>
  );
}
