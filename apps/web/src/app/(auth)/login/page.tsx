import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
};

const STEAM_AUTH_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/steam`;

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Doppler</h1>
          <p className="text-lg text-muted-foreground">
            AI-powered CS2 skin market intelligence
          </p>
        </div>
        <div className="space-y-4">
          <a
            href={STEAM_AUTH_URL}
            className="inline-flex w-full items-center justify-center gap-3 rounded-lg bg-[#171a21] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#2a475e]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.04 2 11.03c0 3.87 2.75 7.16 6.52 8.44l2.75-1.1a2.57 2.57 0 0 1 1.86.04l2.04.97A2.56 2.56 0 0 0 18 17.08v-.04a2.56 2.56 0 0 0-2.56-2.56h-.15l-1.52-1.08a2.57 2.57 0 0 1-.96-2v-.32a2.57 2.57 0 0 1 2.57-2.57h.06c.56 0 1.09.18 1.53.51l1.3.97A9.1 9.1 0 0 0 21.1 7 9.96 9.96 0 0 0 12 2z" />
            </svg>
            Sign in with Steam
          </a>
          <p className="text-sm text-muted-foreground">
            We only access your public Steam profile and CS2 inventory.
          </p>
        </div>
      </div>
    </main>
  );
}
