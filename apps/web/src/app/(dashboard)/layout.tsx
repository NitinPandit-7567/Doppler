import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { QueryProvider } from '@/providers/QueryProvider';

export default function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <DashboardHeader />
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}
