import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bell,
  Search,
  Plus,
  ChevronDown,
  LogOut,
  Check,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
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

export function AdminShell({
  nav,
  primaryAction,
  children,
  title,
}: {
  nav: NavItem[];
  primaryAction?: { to: string; label: string };
  children: ReactNode;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const nav_ = useNavigate();

  // Redirect logic moved to beforeLoad in routes

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

  // Lock body scroll on mobile navigation open
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (open) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
    return () => {
      if (typeof window !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [open]);

  // Accessible keyboard close on dropdowns and drawer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setNotifOpen(false);
        setOpen(false);
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

  const displayName =
    user?.role === "admin" && user?.name === "Super Admin" ? "Admin" : user?.name || "User";

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-stone-200 bg-stone-50 text-stone-900 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-border/50 px-5">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {nav.map((n) => {
            const active = ["/superadmin", "/admin", "/dashboard", "/staff"].includes(n.to)
              ? path === n.to
              : path === n.to || path.startsWith(n.to + "/");
            return (
              <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.96 }} key={n.to}>
                <Link
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 ${
                    active
                      ? "bg-white font-bold text-stone-900 shadow-sm ring-1 ring-stone-200"
                      : "text-stone-500 hover:bg-stone-200/50 hover:text-stone-900"
                  }`}
                >
                  <n.icon
                    className={`h-4.5 w-4.5 transition-colors ${
                      active ? "text-accent" : "text-stone-400"
                    }`}
                  />
                  {n.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>
        {primaryAction && (
          <div className="absolute bottom-6 left-5 right-5">
            <Link
              to={primaryAction.to}
              className="flex items-center justify-center gap-2 rounded-xl border border-accent/10 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-accent" /> {primaryAction.label}
            </Link>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/40 bg-background/70 px-5 backdrop-blur-lg md:px-8">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted active:scale-95 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <h1 className="font-display text-base font-semibold lg:text-lg">
            {title || "Dashboard"}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 shadow-soft transition-all duration-300 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 md:flex">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search cases, departments..."
                className="w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                ⌘K
              </span>
            </div>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-xl border border-border bg-card p-2.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                aria-label="Notifications"
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
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 transition hover:bg-muted/50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <span className="hidden text-sm font-medium md:inline">{displayName}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 animate-in fade-in slide-in-from-top-2 rounded-xl border border-border bg-card p-1 shadow-lg">
                  <div className="mb-1 border-b border-border px-3 py-2">
                    <p className="truncate text-xs font-bold">{displayName}</p>
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
        </header>
        <main className="px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-background/40 backdrop-blur-sm animate-in fade-in duration-300 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      {dropdownOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
      )}
      {notifOpen && <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />}
    </div>
  );
}
