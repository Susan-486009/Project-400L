import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bell, Search, ChevronDown, LogOut, Check, ExternalLink, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { type User, type Notification, notificationService } from "@/lib/api";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

type DashboardNotification = Notification;

export function StaffShell({
  nav,
  children,
  title,
}: {
  nav: NavItem[];
  children: ReactNode;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nav_ = useNavigate();

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored || stored === "undefined" || stored === "null") {
      setUser(null);
      return;
    }

    try {
      setUser(JSON.parse(stored) as User);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setNotifOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.getMine(),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications?.filter((n: DashboardNotification) => !n.is_read).length || 0;

  const logout = () => {
    localStorage.removeItem("as_access_token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    nav_({ to: "/login" });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="flex h-16 items-center px-4 md:px-8">
          <div className="mr-8 hidden md:block">
            <Logo />
          </div>
          <button
            className="mr-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted active:scale-95 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = ["/superadmin", "/admin", "/dashboard", "/staff"].includes(n.to)
                ? path === n.to
                : path === n.to || path.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    active
                      ? "bg-accent/10 font-bold text-accent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <n.icon
                    className={`h-4 w-4 ${active ? "text-accent" : "text-muted-foreground"}`}
                  />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 lg:flex">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search board..."
                className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-accent" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-xl animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications && notifications.length > 0 ? (
                      notifications.map((n: DashboardNotification) => (
                        <div
                          key={n._id}
                          className={`group relative border-b border-border p-4 transition hover:bg-muted/40 ${
                            !n.is_read ? "bg-accent/5" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold">{n.title}</h4>
                            <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                              {n.created_at
                                ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true })
                                : ""}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {n.message}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            {n.reference_link && (
                              <Link
                                to={n.reference_link}
                                onClick={() => {
                                  setNotifOpen(false);
                                  markReadMutation.mutate(n._id);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-accent hover:underline"
                              >
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                            {!n.is_read && (
                              <button
                                onClick={() => markReadMutation.mutate(n._id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                              >
                                <Check className="h-2.5 w-2.5" /> Read
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center text-xs text-muted-foreground">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-3 transition hover:bg-muted"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                  {initials}
                </div>
                <span className="hidden text-sm font-medium md:inline">
                  {user?.name || "Staff"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 animate-in fade-in slide-in-from-top-2 rounded-xl border border-border bg-card p-1 shadow-lg">
                  <div className="mb-1 border-b border-border px-3 py-2">
                    <p className="truncate text-xs font-bold">{user?.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-border/50 bg-background p-4 md:hidden">
            <nav className="flex flex-col gap-2">
              {nav.map((n) => {
                const active = ["/superadmin", "/admin", "/dashboard", "/staff"].includes(n.to)
                  ? path === n.to
                  : path === n.to || path.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? "bg-accent/10 font-bold text-accent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <n.icon
                      className={`h-5 w-5 ${active ? "text-accent" : "text-muted-foreground"}`}
                    />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8">
        {title && <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">{title}</h1>}
        {children}
      </main>

      {dropdownOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
      )}
      {notifOpen && <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />}
    </div>
  );
}
