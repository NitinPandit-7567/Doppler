import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Deals' };

export default function DealsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Deal Feed</h1>
      <p className="text-muted-foreground">Real-time CS2 skin deals across Steam and CSFloat.</p>
    </div>
  );
}
