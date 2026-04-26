import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Agents' };

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Agent Studio</h1>
      <p className="text-muted-foreground">Configure and monitor your AI trading agents.</p>
    </div>
  );
}
