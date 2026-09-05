import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { complaintService, authService, type Complaint } from "@/lib/api";
import { Shield, Users, Inbox, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/superadmin/")({
  component: SuperadminDashboard,
});

function SuperadminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [recentCases, setRecentCases] = useState<Complaint[]>([]);
  
  useEffect(() => {
    // Fetch basic stats
    complaintService.getStats().then(setStats).catch(console.error);
    
    // Fetch total users (we just need the count, so limit 1 is fine if supported, otherwise it returns all and we take length)
    authService.getUsers({ limit: 1 }).then((data) => {
      setTotalUsers(data?.pagination?.total || data?.users?.length || 0);
    }).catch(console.error);

    // Fetch recent cases for activity feed
    complaintService.getAll({ limit: 5 }).then((data) => {
      setRecentCases(Array.isArray(data) ? data : data?.complaints || []);
    }).catch(console.error);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">System Dashboard</h1>
        <p className="text-muted-foreground">Global overview of the LASUSTECH Resolve platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Users</p>
            <h2 className="text-2xl font-bold">{totalUsers.toLocaleString()}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Active Cases</p>
            <h2 className="text-2xl font-bold">
              {(stats?.statusCounts?.pending || 0) + (stats?.statusCounts?.in_review || 0)}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Resolution Rate</p>
            <h2 className="text-2xl font-bold text-success">
              {(() => {
                const sc = stats?.statusCounts || {};
                const t = Object.values(sc).reduce((a: number, b: any) => a + (b || 0), 0);
                const r = (sc.resolved || 0) + (sc.fixed || 0);
                return t > 0 ? `${Math.round((r / t) * 100)}%` : "—";
              })()}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Rejected Cases</p>
            <h2 className="text-2xl font-bold">{stats?.statusCounts?.rejected || 0}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-8">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate({ to: "/superadmin/users" })}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-4 hover:bg-accent/5 hover:border-accent/40 transition-colors"
            >
              <Users className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Manage Users</span>
            </button>
            <button
              onClick={() => navigate({ to: "/superadmin/audit" })}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-4 hover:bg-accent/5 hover:border-accent/40 transition-colors"
            >
              <Shield className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Review Audit Log</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4">Recent Case Submissions</h3>
          <div className="space-y-4">
            {recentCases.length > 0 ? (
              recentCases.slice(0, 4).map((c) => (
                <div key={c._id} className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${c.priority === 'high' || c.priority === 'critical' ? 'bg-destructive' : 'bg-success'}`}></div>
                  <p className="text-sm truncate flex-1">{c.title}</p>
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(c.created_at || new Date()), { addSuffix: true })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent cases.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
