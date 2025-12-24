import { SidebarToggle } from "@/widgets/AppSidebar/ui/SidebarToggle";
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import { AppSidebar } from "@/widgets/AppSidebar";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="transition-all duration-300">
        <div className="p-4 flex flex-col gap-4">
          <SidebarToggle />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
