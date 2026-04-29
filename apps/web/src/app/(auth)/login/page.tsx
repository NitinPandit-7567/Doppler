import type { Metadata } from 'next';
import { TrendingUp, Zap, Brain, BarChart3, Shield } from 'lucide-react';
import { SteamIcon } from '@/components/icons/SteamIcon';

export const metadata: Metadata = {
  title: 'Sign In',
};

const STEAM_AUTH_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/steam`;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Left panel — branding + social proof */}
      <div className="bg-primary/5 relative hidden flex-col justify-between p-10 lg:flex dark:border-r">
        <div className="bg-primary/5 absolute inset-0" />
        <div className="relative z-20 flex items-center gap-2 text-lg font-medium">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <TrendingUp className="size-4" />
          </div>
          Doppler
        </div>
        <div className="relative z-20 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Zap className="text-primary size-4 shrink-0" />
              <span>Real-time deal detection across Steam and CSFloat</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Brain className="text-primary size-4 shrink-0" />
              <span>AI-powered patch impact analysis and market predictions</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <BarChart3 className="text-primary size-4 shrink-0" />
              <span>Portfolio tracking with multi-platform price intelligence</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="text-primary size-4 shrink-0" />
              <span>Read-only access — we never trade, buy, or sell on your behalf</span>
            </div>
          </div>
          <blockquote className="border-primary/30 space-y-2 border-l-2 pl-4">
            <p className="text-sm leading-relaxed text-balance">
              &ldquo;Doppler found me a Printstream listing at 18% below Steam price while I was
              sleeping. Paid for itself in a single deal.&rdquo;
            </p>
            <footer className="text-muted-foreground text-sm">— CS2 Trader</footer>
          </blockquote>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex items-center justify-center p-8">
        <div className="mx-auto flex w-full max-w-[350px] flex-col justify-center gap-6">
          <div className="flex flex-col gap-2 text-center">
            <div className="bg-primary mx-auto mb-2 flex size-10 items-center justify-center rounded-lg lg:hidden">
              <TrendingUp className="text-primary-foreground size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to Doppler</h1>
            <p className="text-muted-foreground text-sm">
              Sign in with your Steam account to get started
            </p>
          </div>

          {error && (
            <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-center text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <a
              href={STEAM_AUTH_URL}
              className="focus-visible:ring-ring inline-flex h-9 w-full items-center justify-center gap-3 rounded-lg bg-[#171a21] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2a475e] focus-visible:ring-2 focus-visible:outline-none"
            >
              <SteamIcon className="size-5" />
              Sign in with Steam
            </a>
          </div>

          <p className="text-muted-foreground px-2 text-center text-xs leading-relaxed">
            We only access your public Steam profile and CS2 inventory. By continuing, you agree to
            our{' '}
            <a href="#" className="hover:text-primary underline underline-offset-4">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="hover:text-primary underline underline-offset-4">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
