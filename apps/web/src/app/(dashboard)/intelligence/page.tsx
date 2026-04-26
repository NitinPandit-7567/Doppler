import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Intelligence' };

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Patch Intelligence</h1>
      <p className="text-muted-foreground">AI-generated patch impact reports and market analysis.</p>
    </div>
  );
}
