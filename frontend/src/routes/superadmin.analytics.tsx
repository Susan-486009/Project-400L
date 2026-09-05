import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Inbox,
  Star,
  Smile,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { complaintService } from "@/lib/api";
import { AnalyticCard } from "@/components/AnalyticCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { formatCategory } from "@/lib/ui-shared";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/superadmin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin" }] }),
  component: AnalyticsPage,
});

// Minimalist theme colors
const COLORS = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
};

function AnalyticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => complaintService.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading operations analytics...</p>
        </div>
      </div>
    );
  }

  const statusCounts = stats?.statusCounts || {};
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const resolved = (statusCounts.resolved || 0) + (statusCounts.fixed || 0);
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Mock data for volume trend (simulating last 7 days)
  const volumeData = [
    { day: "Mon", cases: 12 },
    { day: "Tue", cases: 19 },
    { day: "Wed", cases: 15 },
    { day: "Thu", cases: 22 },
    { day: "Fri", cases: 30 },
    { day: "Sat", cases: 10 },
    { day: "Sun", cases: 8 },
  ];

  const categoryData = (stats?.categoryStats || [])
    .map((cat) => ({
      name: formatCategory(cat._id),
      total: cat.open + cat.resolved,
      resolved: cat.resolved,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const feedbackStats = stats?.feedbackStats || {
    avgRating: 0,
    totalFeedback: 0,
    satisfiedCount: 0,
    ratingsDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };
  const recentFeedbacks = stats?.recentFeedbacks || [];

  const satisfactionRate =
    feedbackStats.totalFeedback > 0
      ? Math.round((feedbackStats.satisfiedCount / feedbackStats.totalFeedback) * 100)
      : 0;

  const distributionData = [
    { stars: "5 Stars", count: feedbackStats.ratingsDistribution[5] },
    { stars: "4 Stars", count: feedbackStats.ratingsDistribution[4] },
    { stars: "3 Stars", count: feedbackStats.ratingsDistribution[3] },
    { stars: "2 Stars", count: feedbackStats.ratingsDistribution[2] },
    { stars: "1 Star", count: feedbackStats.ratingsDistribution[1] },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-12">
      {/* Metric Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticCard
          label="Total Cases"
          value={total.toLocaleString()}
          icon={Inbox}
          description="Lifetime submissions"
        />
        <AnalyticCard
          label="Resolution Rate"
          value={`${resolutionRate}%`}
          icon={CheckCircle2}
          description="Cases successfully closed"
        />
        <AnalyticCard
          label="Avg. Response (Simulated)"
          value="4.2h"
          icon={Clock}
          description="Time to first review — sample figure, no live source"
        />
        <AnalyticCard
          label="Active Issues"
          value={(statusCounts.pending || 0) + (statusCounts.in_review || 0)}
          icon={AlertCircle}
          description="Awaiting action"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Volume Trend Chart */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Submission Volume</h3>
              <p className="text-xs text-muted-foreground">Cases reported over the last 7 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Sample data — not live
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={COLORS.border}
                  opacity={0.5}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.muted }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.muted }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid " + COLORS.border,
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cases"
                  stroke={COLORS.accent}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCases)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Chart */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground">Top Categories</h3>
            <p className="text-xs text-muted-foreground">Highest volume departments</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={COLORS.border}
                  opacity={0.5}
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.muted }}
                  width={100}
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "12px", border: "1px solid " + COLORS.border }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                  {categoryData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? COLORS.accent : COLORS.primary}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Student Satisfaction Intelligence */}
      <div className="border-t border-border/60 pt-6 space-y-6">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Student Satisfaction Intelligence</h2>
          <p className="text-xs text-muted-foreground">
            Aggregate feedback metrics and ratings from resolved complaints.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <AnalyticCard
            label="Avg. Student Rating"
            value={`${feedbackStats.avgRating} / 5.0`}
            icon={Star}
            description="Overall score across surveys"
          />
          <AnalyticCard
            label="Student Satisfaction Rate"
            value={`${satisfactionRate}%`}
            icon={Smile}
            description="Percentage rated as satisfied"
          />
          <AnalyticCard
            label="Total Feedback Reviews"
            value={feedbackStats.totalFeedback.toLocaleString()}
            icon={MessageSquare}
            description="Total responses gathered"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Rating Distribution Chart */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-1">
            <h3 className="text-sm font-semibold text-foreground mb-4">Rating Distribution</h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.border} opacity={0.5} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="stars"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: COLORS.muted }}
                    width={60}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid " + COLORS.border,
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {distributionData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index < 2 ? COLORS.success : index === 2 ? COLORS.warning : COLORS.danger}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Comments Feed */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2 flex flex-col h-[300px]">
            <h3 className="text-sm font-semibold text-foreground mb-4 font-display">
              Recent Feedback & Comments
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar">
              {recentFeedbacks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
                  <MessageSquare className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-xs font-semibold">No feedback reviews submitted yet</p>
                  <p className="text-[10px] mt-1 opacity-70">
                    Student ratings will appear here once resolved complaints are rated.
                  </p>
                </div>
              ) : (
                recentFeedbacks.map((fb: any) => (
                  <div key={fb.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{fb.studentName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
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
                    <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1.5">
                      <span>Category: {formatCategory(fb.category)}</span>
                      <span>•</span>
                      <span>
                        {fb.submittedAt
                          ? formatDistanceToNow(new Date(fb.submittedAt), { addSuffix: true })
                          : ""}
                      </span>
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
      </div>
    </div>
  );
}
