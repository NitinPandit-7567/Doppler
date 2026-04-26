export default function MarketingLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-xl font-bold tracking-tight">Doppler</span>
          <a
            href="/login"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign In
          </a>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
