import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/lib/api";
import { AnalyticCard } from "@/components/AnalyticCard";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  FileText,
  Calendar,
  Building2,
  ChevronRight,
  Loader2,
  Star,
  Smile,
  MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { formatCategory, StatusBadge } from "@/lib/ui-shared";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Overview — Admin Dashboard" }] }),
  component: AdminDashboardOverview,
});

const COLORS = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
};

function AdminDashboardOverview() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => complaintService.getStats(),
  });

  const { data: recentCases, isLoading: casesLoading } = useQuery({
    queryKey: ["recent-complaints"],
    queryFn: () => complaintService.getAll({ limit: 5 }),
  });

  const statusCounts = stats?.statusCounts || {};
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const resolved = (statusCounts.resolved || 0) + (statusCounts.fixed || 0);
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const activeIssues = (statusCounts.pending || 0) + (statusCounts.in_review || 0);

  const feedbackStats = stats?.feedbackStats || {
    avgRating: 0,
    totalFeedback: 0,
    satisfiedCount: 0,
    ratingsDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  };
  const recentFeedbacks = stats?.recentFeedbacks || [];
  const satisfactionRate = feedbackStats.totalFeedback > 0
    ? Math.round((feedbackStats.satisfiedCount / feedbackStats.totalFeedback) * 100)
    : 0;

  // Fallback / mock volume data for trends chart
  const volumeData = [
    { day: "Mon", cases: 4 },
    { day: "Tue", cases: 7 },
    { day: "Wed", cases: 5 },
    { day: "Thu", cases: 9 },
    { day: "Fri", cases: 12 },
    { day: "Sat", cases: 3 },
    { day: "Sun", cases: 2 },
  ];

  const categoryData = (stats?.categoryStats || [])
    .map((cat) => ({
      name: formatCategory(cat._id),
      total: cat.open + cat.resolved,
      resolved: cat.resolved,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const getStatusTone = (status: string) => {
    switch (status) {
      case "pending": return "warning";
      case "in_review": return "accent";
      case "resolved":
      case "fixed": return "success";
      case "rejected": return "danger";
      default: return "muted";
    }
  };

  const isLoading = statsLoading || casesLoading;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Overview Dashboard</h2>
          <p className="text-muted-foreground">Real-time resolution metrics and student complaints intelligence.</p>
        </div>
        <Link
          to="/admin/reports"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition shadow-sm"
        >
          View Complaints Registry <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Metrics Overview Cards */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticCard
              label="Total Complaints"
              value={total.toLocaleString()}
              icon={Inbox}
              description="Total filed cases"
              trend={{ value: 14, isPositive: true }}
            />
            <AnalyticCard
              label="Resolution Rate"
              value={`${resolutionRate}%`}
              icon={CheckCircle2}
              description="Closed & resolved cases"
              trend={{ value: 4, isPositive: true }}
            />
            <AnalyticCard
              label="Avg. Response"
              value="3.5h"
              icon={Clock}
              description="Average initial response"
              trend={{ value: 12, isPositive: false }}
            />
            <AnalyticCard
              label="Active Operations"
              value={activeIssues.toLocaleString()}
              icon={AlertCircle}
              description="Awaiting action/review"
            />
          </div>

          {/* Charts Section */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Volume Trend */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Submissions Volume</h3>
                  <p className="text-xs text-muted-foreground">Cases registered over the last week</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <TrendingUp className="h-3.5 w-3.5" /> +14% from last week
                </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData}>
                    <defs>
                      <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} opacity={0.5} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.muted }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.muted }} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid " + COLORS.border, background: "hsl(var(--card))" }} />
                    <Area type="monotone" dataKey="cases" stroke={COLORS.accent} strokeWidth={2.5} fillOpacity={1} fill="url(#colorCases)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Categories */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground">Top Complaint Departments</h3>
                <p className="text-xs text-muted-foreground">Highest volume resolution units</p>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.border} opacity={0.5} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: COLORS.muted }} width={120} />
                    <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "12px", border: "1px solid " + COLORS.border, background: "hsl(var(--card))" }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={16}>
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.accent : COLORS.primary} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Submissions Registry */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Recent Submissions</h3>
                <p className="text-xs text-muted-foreground">Latest complaints requiring review or dispatching</p>
              </div>
              <Link
                to="/admin/reports"
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
              >
                Go to complaints registry <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/30 text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 border-b border-border">Reference ID</th>
                    <th className="px-4 py-3 border-b border-border">Title</th>
                    <th className="px-4 py-3 border-b border-border">Category</th>
                    <th className="px-4 py-3 border-b border-border">Status</th>
                    <th className="px-4 py-3 border-b border-border">Urgency</th>
                    <th className="px-4 py-3 border-b border-border">Date Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentCases?.complaints && recentCases.complaints.length > 0 ? (
                    recentCases.complaints.slice(0, 5).map((c: any) => (
                      <tr key={c._id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-semibold text-accent">
                          <Link to="/admin/reports" className="hover:underline">
                            #{c.reference_id || c.referenceId}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 font-medium max-w-[200px] truncate" title={c.title}>
                          {c.title}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded border border-border bg-muted text-[10px]">
                            {formatCategory(c.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge tone={getStatusTone(c.status)}>
                            {c.status.toUpperCase().replace("_", " ")}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3.5 font-semibold capitalize">
                          <span
                            className={
                              c.priority === "critical"
                                ? "text-red-500"
                                : c.priority === "high"
                                  ? "text-amber-500"
                                  : "text-muted-foreground"
                            }
                          >
                            {c.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at || c.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                        No recent complaints found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Feedback & Satisfaction Section */}
          <div className="grid gap-6 lg:grid-cols-3 mt-8">
            {/* Feedback Stats Card */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Student Satisfaction</h3>
                <p className="text-xs text-muted-foreground mb-6">Metrics gathered from student feedback surveys.</p>
                
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <span className="text-xs text-muted-foreground font-medium">Average Rating</span>
                    <span className="text-sm font-bold text-foreground flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      {feedbackStats.avgRating} / 5.0
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <span className="text-xs text-muted-foreground font-medium">Satisfaction Rate</span>
                    <span className="text-sm font-bold text-success flex items-center gap-1">
                      <Smile className="h-4 w-4" />
                      {satisfactionRate}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs text-muted-foreground font-medium">Total Responses</span>
                    <span className="text-sm font-bold text-foreground flex items-center gap-1">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {feedbackStats.totalFeedback}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Comments Feed */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2 flex flex-col h-[280px]">
              <h3 className="text-sm font-semibold text-foreground mb-4 font-display">Recent Feedback Comments</h3>
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar">
                {recentFeedbacks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
                    <MessageSquare className="h-8 w-8 opacity-20 mb-2" />
                    <p className="text-xs font-semibold">No feedback reviews submitted yet</p>
                  </div>
                ) : (
                  recentFeedbacks.slice(0, 5).map((fb: any) => (
                    <div key={fb.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{fb.studentName}</span>
                          <span className="text-[9px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
                            #{fb.referenceId}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < fb.rating
                                  ? "text-amber-500 fill-amber-500"
                                  : "text-muted-foreground/20"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                        <span>{fb.submittedAt ? formatDistanceToNow(new Date(fb.submittedAt), { addSuffix: true }) : ""}</span>
                      </div>
                      {fb.comments ? (
                        <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40 italic">
                          "{fb.comments}"
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic pl-2">No comment left.</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
