import { Separator } from '@/components/ui/separator';
import { SidebarNav } from '@/components/layout/Sidebar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UserMenu } from '@/components/layout/UserMenu';
import { MobileSidebarToggle } from '@/components/layout/MobileSidebarToggle';
import { QueryProvider } from '@/providers/QueryProvider';

export default function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div className="p-4">
            <h2 className="text-lg font-bold tracking-tight text-sidebar-foreground">Doppler</h2>
            <p className="text-xs text-muted-foreground">CS2 Market Intelligence</p>
          </div>
          <Separator />
          <div className="flex-1 p-3">
            <SidebarNav />
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border px-4">
            <MobileSidebarToggle>
              <div className="mb-6">
                <h2 className="text-lg font-bold tracking-tight">Doppler</h2>
              </div>
              <SidebarNav />
            </MobileSidebarToggle>
            <div className="flex-1" />
            <ThemeToggle />
            <UserMenu />
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
