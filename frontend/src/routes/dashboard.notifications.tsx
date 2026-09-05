import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { notificationService } from "@/lib/api";
import { Bell, CheckCircle2, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const {
    data: notifications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.getMine(),
  });

  const filteredNotifications =
    filterRead === "all"
      ? notifications
      : filterRead === "unread"
        ? notifications.filter((n) => !n.is_read)
        : notifications.filter((n) => n.is_read);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="mt-3 font-semibold text-destructive">Failed to load notifications</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 sm:py-24 text-center">
        <div className="flex h-16 sm:h-20 w-16 sm:w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground/30">
          <Bell className="h-8 sm:h-10 w-8 sm:w-10" />
        </div>
        <h2 className="mt-6 font-display text-xl sm:text-2xl font-semibold">All caught up</h2>
        <p className="mt-2 max-w-sm text-sm sm:text-base text-muted-foreground">
          You have no notifications yet. We'll alert you here when your case status changes.
        </p>

        <div className="mt-12 flex items-center gap-2 rounded-full border border-success/20 bg-success/5 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-success">
          <CheckCircle2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> Notifications synced
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Notifications
        </h1>

        {/* Filter pills - responsive */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setFilterRead("all")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              filterRead === "all"
                ? "bg-accent text-primary-foreground"
                : "border border-border bg-card hover:bg-muted"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilterRead("unread")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              filterRead === "unread"
                ? "bg-accent text-primary-foreground"
                : "border border-border bg-card hover:bg-muted"
            }`}
          >
            Unread{" "}
            {unreadCount > 0 && (
              <span className="ml-1 inline text-[10px] font-bold">({unreadCount})</span>
            )}
          </button>
          <button
            onClick={() => setFilterRead("read")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              filterRead === "read"
                ? "bg-accent text-primary-foreground"
                : "border border-border bg-card hover:bg-muted"
            }`}
          >
            Read ({notifications.filter((n) => n.is_read).length})
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 sm:p-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              No {filterRead !== "all" ? filterRead : ""} notifications
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification._id || notification.id}
              className={`rounded-2xl border p-4 sm:p-5 transition ${
                !notification.is_read
                  ? "border-accent/30 bg-accent/5 hover:bg-accent/10"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg ${
                    !notification.is_read
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {notification.type?.includes("status") ? (
                    <AlertCircle className="h-4 sm:h-5 w-4 sm:w-5" />
                  ) : (
                    <Bell className="h-4 sm:h-5 w-4 sm:w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground">
                        {notification.title || "Notification"}
                      </h3>
                      <p className="text-xs sm:text-sm mt-1 text-muted-foreground line-clamp-2">
                        {notification.message ||
                          notification.description ||
                          "No additional details"}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="flex-shrink-0 h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs font-mono text-muted-foreground mt-2">
                    {format(
                      new Date(notification.created_at || notification.createdAt || Date.now()),
                      "MMM dd, yyyy HH:mm",
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
