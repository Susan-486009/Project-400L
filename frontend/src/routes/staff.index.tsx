import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  FileText,
  User,
  Building2,
  ChevronRight,
  Loader2,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { complaintService, type Complaint } from "@/lib/api";
import { StatusBadge, formatCategory } from "@/lib/ui-shared";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/staff/")({
  head: () => ({ meta: [{ title: "My Assigned Complaints — Staff Portal" }] }),
  component: StaffBoard,
});

function StaffBoard() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: rawComplaints, isLoading, refetch } = useQuery({
    queryKey: ["staff-complaints"],
    queryFn: () => complaintService.getAll(),
    retry: 1,
  });

  const complaints = Array.isArray((rawComplaints as any)?.complaints)
    ? ((rawComplaints as any)?.complaints as Complaint[]) || []
    : (rawComplaints as any)?.data || [];

  const { data: active, isLoading: detailLoading } = useQuery({
    queryKey: ["staff-complaint-detail", selectedId],
    queryFn: () => complaintService.getById(selectedId!),
    enabled: !!selectedId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, feedback }: { id: string; status: string; feedback?: string }) =>
      complaintService.updateStatus(id, status, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["staff-complaint-detail", selectedId] });
      setReplyText("");
      toast.success("Status updated successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      complaintService.addInternalNote(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-complaint-detail", selectedId] });
      setNoteText("");
      toast.success("Reply sent.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send reply"),
  });

  const filtered = complaints.filter((c: any) => {
    if (filterStatus === "all") return true;
    return c.status === filterStatus;
  });

  const pending = complaints.filter((c: any) => c.status === "pending").length;
  const inReview = complaints.filter((c: any) => c.status === "in_review").length;
  const resolved = complaints.filter((c: any) => c.status === "resolved" || c.status === "fixed").length;

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

  const filters = ["all", "pending", "in_review", "resolved", "rejected"];

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your assigned complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">My Assigned Complaints</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complaints routed to your department that need your attention.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{pending}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">Pending</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{inReview}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">In Review</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-500">{resolved}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">Resolved</div>
        </div>
      </div>

      {/* Main Layout: List + Detail */}
      <div className="flex h-[calc(100vh-18rem)] gap-6 overflow-hidden min-h-0">
        {/* Left: Complaint List */}
        <div className={`flex flex-col rounded-2xl border border-border bg-card overflow-hidden h-full min-h-0 ${
          selectedId ? "hidden lg:flex lg:w-[340px] shrink-0" : "flex w-full lg:w-[340px] shrink-0"
        }`}>
          {/* Filters */}
          <div className="border-b border-border p-3 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition capitalize ${
                  filterStatus === f
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {f === "all" ? "All" : f.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* List */}
          <ul className="flex-1 overflow-y-auto divide-y divide-border/60 min-h-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-20 mb-2" />
                <p className="text-xs font-semibold">No complaints found</p>
                <p className="text-[11px] mt-1 opacity-70">No complaints have been routed to you yet.</p>
              </div>
            ) : (
              filtered.map((c: any) => {
                const isActive = selectedId === c._id;
                return (
                  <motion.li
                    key={c._id}
                    onClick={() => setSelectedId(c._id)}
                    whileHover={{ x: 3 }}
                    className={`cursor-pointer px-4 py-3.5 transition-all duration-200 border-l-2 ${
                      isActive
                        ? "bg-primary/5 border-primary"
                        : "border-transparent hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[9px] tracking-wider text-muted-foreground font-semibold uppercase">
                        #{c.reference_id || c.referenceId || "N/A"}
                      </span>
                      <StatusBadge tone={getStatusTone(c.status || "pending")}>
                        {(c.status || "pending").replace("_", " ").toUpperCase()}
                      </StatusBadge>
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{c.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{formatCategory(c.category)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.created_at ? format(new Date(c.created_at), "MMM d") : ""}
                      </span>
                    </div>
                  </motion.li>
                );
              })
            )}
          </ul>
        </div>

        {/* Right: Detail Panel */}
        <div className={`flex-1 h-full min-h-0 overflow-hidden ${
          selectedId === null ? "hidden lg:flex" : "flex"
        }`}>
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div
                key={active._id || active.referenceId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col h-full w-full overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* Detail Header */}
                <div className="border-b border-border p-5 shrink-0">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition lg:hidden"
                  >
                    ← Back to list
                  </button>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                      #{active.referenceId || active.reference_id}
                    </span>
                    <StatusBadge tone={getStatusTone(active.status || "pending")}>
                      {(active.status || "pending").replace("_", " ").toUpperCase()}
                    </StatusBadge>
                  </div>
                  <h2 className="font-display text-lg font-bold tracking-tight">{active.title}</h2>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {formatCategory(active.category)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {active.anonymous ? "Anonymous Student" : (active.submitter?.name || "Student")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {active.createdAt ? format(new Date(active.createdAt), "PPP") : ""}
                    </span>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
                  {/* Description */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Complaint Description
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {active.description || "No description provided."}
                    </p>
                  </div>

                  {/* Status Update */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Update Status
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground font-medium">Change to:</span>
                      <select
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold cursor-pointer focus:border-primary outline-none"
                        value={active.status}
                        onChange={(e) => statusMutation.mutate({ id: active._id, status: e.target.value })}
                        disabled={statusMutation.isPending}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_review">In Review</option>
                        <option value="resolved">Resolved</option>
                        <option value="fixed">Fixed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      {statusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    </div>
                  </div>

                  {/* Reply to Student */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-accent" /> Reply to Student
                    </h3>

                    {(active.adminFeedback || active.admin_feedback) && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                        <div className="text-[9px] font-bold text-emerald-400 uppercase mb-1">Previous Reply</div>
                        <p className="text-foreground leading-relaxed">{active.adminFeedback || active.admin_feedback}</p>
                      </div>
                    )}

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply to the student here..."
                      className="w-full h-24 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none transition text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => statusMutation.mutate({ id: active._id, status: active.status, feedback: replyText })}
                        disabled={statusMutation.isPending || !replyText.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition active:scale-95"
                      >
                        {statusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send Reply
                      </button>
                    </div>
                  </div>

                  {/* Internal Note */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-primary" /> Internal Notes
                    </h3>

                    {active.internalNotes?.map((note: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border/80 bg-card p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{note.admin_id?.name || "Staff"}</span>
                          <span className="text-muted-foreground">{note.created_at ? format(new Date(note.created_at), "MMM d, HH:mm") : ""}</span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed">{note.text}</p>
                      </div>
                    ))}

                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add an internal note (not visible to students)..."
                      className="w-full h-20 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none transition text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => noteMutation.mutate({ id: active._id, text: noteText })}
                        disabled={noteMutation.isPending || !noteText.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50 transition active:scale-95"
                      >
                        {noteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        Save Note
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : detailLoading ? (
              <div className="flex flex-col items-center justify-center h-full w-full rounded-2xl border border-border bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full rounded-2xl border border-border bg-card text-center p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground/30 mb-4">
                  <Inbox className="h-8 w-8" />
                </div>
                <p className="font-semibold text-foreground">Select a complaint</p>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                  Pick a complaint from the list to view its details and take action.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
