import { Link, useLocation } from "wouter";
import { Search, Database, Box } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Search", icon: Search },
    { href: "/database", label: "Database", icon: Database },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-sidebar flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Box className="w-6 h-6 text-primary" />
            <span>OpticMatch</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-row md:flex-col gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  location === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
