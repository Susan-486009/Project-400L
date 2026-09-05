import { createFileRoute } from "@tanstack/react-router";
import { 
  ScrollText, 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  Calendar, 
  User, 
  Terminal, 
  Laptop, 
  Globe, 
  Info,
  Database
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditService, AuditLogEntry } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/superadmin/audit")({
  head: () => ({ meta: [{ title: "Security Audit Logs — Platform Control" }] }),
  component: AuditPage,
});

// Helper to format timestamps beautifully
function formatDateTime(isoString: string) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// Translate snake_case actions into beautiful readable badges
function getActionLabel(action: string) {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Get action styling
function getActionBadgeStyle(action: string) {
  const act = action.toLowerCase();
  if (act.includes("create") || act.includes("registered") || act.includes("resolve")) {
    return "border-emerald-500/20 bg-emerald-500/5 text-emerald-400";
  }
  if (act.includes("delete") || act.includes("reject") || act.includes("remove")) {
    return "border-rose-500/20 bg-rose-500/5 text-rose-400";
  }
  if (act.includes("update") || act.includes("change") || act.includes("assign")) {
    return "border-amber-500/20 bg-amber-500/5 text-amber-400";
  }
  return "border-indigo-500/20 bg-indigo-500/5 text-indigo-400";
}

// State comparison view
function StateDiffViewer({ prev, next }: { prev: any; next: any }) {
  if (!prev && !next) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
        <Info className="h-6 w-6 opacity-30 mb-2" />
        <span className="text-xs">No state payload recorded for this event.</span>
      </div>
    );
  }

  const isObject = (val: any) => val && typeof val === "object" && !Array.isArray(val);

  if (!isObject(prev) && !isObject(next)) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prev !== null && prev !== undefined && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Before</span>
            <pre className="rounded-lg bg-muted/60 border border-border p-3 text-xs font-mono text-rose-300 max-h-40 overflow-y-auto">
              {String(prev)}
            </pre>
          </div>
        )}
        {next !== null && next !== undefined && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">After</span>
            <pre className="rounded-lg bg-muted/60 border border-border p-3 text-xs font-mono text-emerald-300 max-h-40 overflow-y-auto">
              {String(next)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  const pObj = isObject(prev) ? prev : {};
  const nObj = isObject(next) ? next : {};
  const allKeys = Array.from(new Set([...Object.keys(pObj), ...Object.keys(nObj)]));

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden text-xs">
      <div className="grid grid-cols-3 gap-3 bg-muted/60 px-4 py-2.5 font-semibold text-muted-foreground border-b border-border">
        <div>Property</div>
        <div>Previous State</div>
        <div>New State</div>
      </div>
      <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
        {allKeys.map((key) => {
          const prevVal = pObj[key];
          const newVal = nObj[key];
          const hasPrev = key in pObj;
          const hasNext = key in nObj;
          const isChanged = JSON.stringify(prevVal) !== JSON.stringify(newVal);

          if (!isChanged) return null; // Show only modified properties

          const renderValue = (val: any) => {
            if (val === null) return "null";
            if (val === undefined) return "undefined";
            if (typeof val === "object") return JSON.stringify(val);
            return String(val);
          };

          return (
            <div key={key} className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/10 items-start">
              <div className="font-mono font-medium text-foreground select-all break-all">{key}</div>
              <div className="text-rose-400 font-mono line-through break-all pr-2" title={renderValue(prevVal)}>
                {hasPrev ? renderValue(prevVal) : <span className="opacity-30 italic">not defined</span>}
              </div>
              <div className="text-emerald-400 font-mono font-semibold break-all" title={renderValue(newVal)}>
                {hasNext ? renderValue(newVal) : <span className="text-rose-400 line-through opacity-30 italic">removed</span>}
              </div>
            </div>
          );
        })}
        {allKeys.filter((k) => JSON.stringify(pObj[k]) !== JSON.stringify(nObj[k])).length === 0 && (
          <div className="p-6 text-center text-muted-foreground italic bg-muted/5">
            No property transitions detected. All static values.
          </div>
        )}
      </div>
    </div>
  );
}

function AuditPage() {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"diff" | "raw">("diff");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [limit, setLimit] = useState(200);

  const { data: logs, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: () => auditService.getLogs(limit),
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Audit records updated.");
    } catch (err) {
      toast.error("Failed to refresh audit log.");
    }
  };

  const logsList = Array.isArray(logs) ? logs : (logs as any)?.data || [];

  // Gather unique options dynamically for filtering helper
  const uniqueActions = Array.from(new Set(logsList.map((l: AuditLogEntry) => l.action))) as string[];
  const uniqueTargets = Array.from(
    new Set(logsList.map((l: AuditLogEntry) => l.target_type).filter(Boolean))
  ) as string[];

  // Filter local results based on inputs
  const filteredLogs = logsList.filter((log: AuditLogEntry) => {
    const actorName = log.actor_id?.name || "";
    const actorEmail = log.actor_id?.email || "";
    const action = log.action || "";
    const ip = log.ip_address || "";
    const targetType = log.target_type || "";

    const matchesSearch =
      actorName.toLowerCase().includes(search.toLowerCase()) ||
      actorEmail.toLowerCase().includes(search.toLowerCase()) ||
      action.toLowerCase().includes(search.toLowerCase()) ||
      ip.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "all" || action === actionFilter;
    const matchesTarget = targetFilter === "all" || targetType === targetFilter;

    return matchesSearch && matchesAction && matchesTarget;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Security Audit Logs</h2>
            <div className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-2.5 py-0.5 text-xs font-medium text-success">
              <ShieldCheck className="h-3 w-3" /> Ledger Active
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time, immutable security trail tracking state changes and operational updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={50}>Last 50 events</option>
            <option value={200}>Last 200 events</option>
            <option value={500}>Last 500 events</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={isLoading || isFetching}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-input bg-background hover:bg-muted text-foreground transition active:scale-[0.98] disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter and Control Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-card">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Actor, email, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Action filter */}
        <div className="relative">
          <div className="absolute left-3 top-3 pointer-events-none">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {getActionLabel(act)}
              </option>
            ))}
          </select>
        </div>

        {/* Target Type Filter */}
        <div className="relative">
          <div className="absolute left-3 top-3 pointer-events-none">
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>
          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <option value="all">All Object Types</option>
            {uniqueTargets.map((tgt) => (
              <option key={tgt} value={tgt}>
                {tgt}
              </option>
            ))}
          </select>
        </div>

        {/* Total counts chip */}
        <div className="flex items-center justify-end px-2 text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground px-1">{filteredLogs.length}</span> of{" "}
          <span className="font-semibold text-foreground px-1">{logsList.length}</span> logs
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3.5 font-medium">Timestamp</th>
                <th className="px-4 py-3.5 font-medium">Actor</th>
                <th className="px-4 py-3.5 font-medium">Action & Target</th>
                <th className="px-4 py-3.5 font-medium">Client Info</th>
                <th className="px-4 py-3.5 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2"></div>
                    <p className="text-xs">Fetching ledger audit history...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <ScrollText className="mx-auto h-9 w-9 opacity-20 mb-3" />
                    <p className="font-medium text-foreground">No audit entries found</p>
                    <p className="text-xs mt-1 text-muted-foreground/80">Try relaxing your search terms or filter selection.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: AuditLogEntry) => (
                  <tr key={log._id} className="hover:bg-muted/20 transition-colors">
                    {/* Timestamp column */}
                    <td className="px-4 py-3.5 font-mono text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 opacity-45" />
                        {formatDateTime(log.created_at)}
                      </div>
                    </td>

                    {/* Actor details */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                          {log.actor_id?.name ? log.actor_id.name.charAt(0) : <User className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground max-w-[150px] truncate" title={log.actor_id?.name}>
                            {log.actor_id?.name || "System Service"}
                          </div>
                          <div className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={log.actor_id?.email}>
                            {log.actor_id?.email || "internal@service.local"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action & Target details */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getActionBadgeStyle(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                        {log.target_type && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="font-medium text-foreground/80">{log.target_type}</span>
                            <span className="opacity-40">|</span>
                            <span className="font-mono truncate max-w-[120px]" title={log.target_id}>
                              {log.target_id}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Connection details */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          <Globe className="h-3 w-3 opacity-55" />
                          {log.ip_address || "127.0.0.1"}
                        </div>
                        {log.user_agent && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 max-w-[180px] truncate" title={log.user_agent}>
                            <Laptop className="h-3 w-3 opacity-45 shrink-0" />
                            {log.user_agent}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Inspection triggers */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setInspectorTab("diff");
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Inspector Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-3xl overflow-hidden bg-card border-border">
          {selectedLog && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" /> Event ID: {selectedLog._id}
                </div>
                <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2 mt-1">
                  <span>Audit Record Details</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getActionBadgeStyle(selectedLog.action)}`}>
                    {getActionLabel(selectedLog.action)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              {/* Event Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Actor</div>
                  <div className="font-semibold text-sm text-foreground mt-1 truncate">
                    {selectedLog.actor_id?.name || "System Service"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{selectedLog.actor_id?.email || "system"}</div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Target Reference</div>
                  <div className="font-semibold text-sm text-foreground mt-1">
                    {selectedLog.target_type || "N/A"}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground truncate" title={selectedLog.target_id}>
                    {selectedLog.target_id || "No target object"}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Client Details</div>
                  <div className="font-semibold text-sm text-foreground mt-1 font-mono">
                    {selectedLog.ip_address || "127.0.0.1"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || "No agent info"}
                  </div>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center justify-between border-b border-border pb-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => setInspectorTab("diff")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      inspectorTab === "diff"
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Visual Property Transition
                  </button>
                  <button
                    onClick={() => setInspectorTab("raw")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      inspectorTab === "raw"
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Raw Document Object
                  </button>
                </div>

                <span className="text-[10px] font-mono text-muted-foreground/80">
                  Logged: {formatDateTime(selectedLog.created_at)}
                </span>
              </div>

              {/* Content Panel */}
              <div className="space-y-2 mt-2">
                {inspectorTab === "diff" ? (
                  <StateDiffViewer prev={selectedLog.previous_state} next={selectedLog.new_state} />
                ) : (
                  <pre className="rounded-xl border border-border bg-muted/40 p-4 text-xs font-mono text-foreground max-h-96 overflow-y-auto select-all">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
