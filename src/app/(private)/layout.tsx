import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import { AppSidebar } from "@/widgets/AppSidebar";
import { SidebarToggle } from "@/widgets/AppSidebar/ui/SidebarToggle";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="transition-all duration-300">
        <div className="flex flex-col gap-4 p-4">
          <SidebarToggle />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
