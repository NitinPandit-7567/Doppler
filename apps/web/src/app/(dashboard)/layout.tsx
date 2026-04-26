const navItems = [
  { href: '/overview', label: 'Dashboard' },
  { href: '/deals', label: 'Deals' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/intelligence', label: 'Intelligence' },
  { href: '/agents', label: 'Agents' },
  { href: '/settings', label: 'Settings' },
] as const;

export default function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-4 md:block">
        <div className="mb-8 text-xl font-bold tracking-tight">Doppler</div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
