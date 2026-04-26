import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Doppler</h1>
        <p className="text-muted-foreground">AI-powered CS2 skin market intelligence</p>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/steam`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in with Steam
        </a>
      </div>
    </main>
  );
}
