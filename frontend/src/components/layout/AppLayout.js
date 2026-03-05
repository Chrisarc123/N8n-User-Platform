import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard, Users, GitBranch, History,
  Settings, LogOut, Menu, Zap, ChevronRight
} from 'lucide-react';

const adminNav = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Clients', path: '/admin/clients', icon: Users },
  { label: 'Workflows', path: '/admin/workflows', icon: GitBranch },
  { label: 'Executions', path: '/admin/executions', icon: History },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const clientNav = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Executions', path: '/executions', icon: History },
];

function isActive(itemPath, currentPath) {
  if (itemPath === '/admin' || itemPath === '/dashboard') {
    return currentPath === itemPath;
  }
  return currentPath.startsWith(itemPath);
}

function SidebarContent({ items, location }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-heading font-bold tracking-tight">FlowPortal</span>
        </Link>
      </div>
      <Separator className="opacity-40" />
      <nav className="flex-1 p-4 space-y-1">
        {items.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path, location.pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${active ? 'active' : ''}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const navItems = user?.role === 'admin' ? adminNav : clientNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const currentLabel = navItems.find(i => isActive(i.path, location.pathname))?.label
    || (location.pathname.startsWith('/workflows/') ? 'Workflow' : 'Page');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card shrink-0">
        <SidebarContent items={navItems} location={location} />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="glass-header h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="mobile-menu-btn">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent items={navItems} location={location} />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="hidden sm:inline capitalize">{user?.role}</span>
              <ChevronRight className="w-3 h-3 hidden sm:inline" />
              <span className="text-foreground font-medium">{currentLabel}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9" data-testid="user-menu-btn">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <ScrollArea className="flex-1">
          <main className="p-6 md:p-8 max-w-7xl">
            <Outlet />
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
