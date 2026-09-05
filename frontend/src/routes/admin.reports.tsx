import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Search,
  Paperclip,
  Send,
  User,
  Building2,
  ShieldCheck,
  ChevronRight,
  Loader2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Info,
  Clock,
  CheckCircle,
  FileText,
  Database,
  ArrowRight,
  Reply,
  ArrowLeft,
  AlertTriangle
} from "lucide-react";
import { StatusBadge, formatCategory } from "@/lib/ui-shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { complaintService } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const SERVER_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/api\/v1\/?$/, "");

function safeFormatDate(dateStr: string | Date | undefined | null, formatStr: string, fallback: string = "N/A"): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
}

const renderStars = (rating: number | undefined | null) => {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
};

function getCategoryStyle(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("academic")) return "bg-blue-500/10 text-blue-600 border-blue-500/15";
  if (cat.includes("hostel") || cat.includes("facilities") || cat.includes("facility")) return "bg-purple-500/10 text-purple-600 border-purple-500/15";
  if (cat.includes("finance") || cat.includes("bursary") || cat.includes("pay")) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/15";
  return "bg-zinc-500/10 text-zinc-600 border-zinc-500/15";
}

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Complaints Registry — Admin" }] }),
  component: ComplaintsPage,
});

const filters = ["All", "Pending", "In review", "Resolved", "Fixed", "Rejected"];

function ComplaintsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [noteText, setNoteText] = useState("");
  const [replyText, setReplyText] = useState("");

  // Custom states for premium responsiveness
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'resolution' | 'control'>('resolution');

  const { data: cases, isLoading: listLoading } = useQuery({
    queryKey: ["all-complaints"],
    queryFn: () => complaintService.getAll(),
  });

  const { data: active, isLoading: detailLoading } = useQuery({
    queryKey: ["complaint-detail", selectedId],
    queryFn: () => complaintService.getById(selectedId!),
    enabled: !!selectedId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminFeedback }: { id: string; status: string; adminFeedback?: string }) =>
      complaintService.updateStatus(id, status, adminFeedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-detail", selectedId] });
      setReplyText("");
      toast.success("Complaint status updated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  const updatePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      complaintService.updatePriority(id, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-detail", selectedId] });
      toast.success("Priority updated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update priority"),
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      complaintService.addInternalNote(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint-detail", selectedId] });
      setNoteText("");
      toast.success("Note logged successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to add note"),
  });

  const aiEnhanceMutation = useMutation({
    mutationFn: async (text: string) => {
      const token = localStorage.getItem("as_access_token") || localStorage.getItem("token");
      const res = await fetch(`${SERVER_URL}/ai/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to enhance text");
      return data.data.rewrittenText;
    },
    onSuccess: (enhancedText) => {
      setReplyText(enhancedText);
      toast.success("Response optimized with AI rewriting");
    },
    onError: (err: any) => {
      toast.error(err.message || "AI rewriter service is currently unreachable.");
    }
  });

  const casesList = useMemo(() => {
    return Array.isArray(cases?.complaints) ? cases.complaints : [];
  }, [cases]);

  const filtered = useMemo(() => {
    return casesList.filter((c) => {
      const status = c.status || "pending";
      const title = c.title || "";
      const refId = c.reference_id || c.referenceId || "";

      const matchesFilter =
        filter === "All" || status.toLowerCase().replace("_", " ") === filter.toLowerCase();
      const matchesQuery =
        query === "" ||
        title.toLowerCase().includes(query.toLowerCase()) ||
        refId.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [casesList, filter, query]);

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

  const getPriorityTone = (priority: string) => {
    switch (priority) {
      case "critical": return "danger";
      case "high": return "warning";
      case "normal": return "accent";
      case "low": return "muted";
      default: return "muted";
    }
  };

  const renderResolutionWorkspace = () => {
    if (!active) return null;
    return (
      <div className="space-y-6">
        {/* Issue summary */}
        <div className="rounded-xl border border-border bg-muted/10 p-5 space-y-3 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" /> Incident Summary Description
          </h3>
          <p className="text-sm leading-relaxed text-foreground select-text font-medium whitespace-pre-wrap break-words break-all">
            {active.description || "No description provided."}
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-accent" /> Resolution Activity Timeline
          </h3>
          <ol className="relative border-l border-border/80 ml-2.5 pl-6 space-y-5">
            {active.timeline?.map((t: any, i: number) => (
              <li key={i} className="relative group">
                <div className="absolute -left-[29px] mt-1 h-3 w-3 rounded-full bg-accent border border-background shadow-[0_0_8px_var(--color-accent)] transition-transform group-hover:scale-110" />
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-foreground leading-snug break-words break-all">
                    {t.text || "Timeline Action"}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1 font-medium flex-wrap">
                    <span>{safeFormatDate(t.created_at, "Pp")}</span>
                    {t.user_id && (
                      <>
                        <span className="opacity-30">|</span>
                        <span className="text-primary/90 flex items-center gap-1">
                          <User className="h-3 w-3" /> {t.user_id.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Official Response */}
        <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Reply className="h-3.5 w-3.5 text-accent" /> Official Resolution Reply (Student Visible)
            </h3>
            
            <button
              onClick={() => aiEnhanceMutation.mutate(replyText)}
              disabled={aiEnhanceMutation.isPending || !replyText.trim() || replyText.trim().length < 5}
              className="relative inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-50 transition-all duration-300 active:scale-95 shadow-md shadow-indigo-500/10 overflow-hidden group cursor-pointer"
            >
              {aiEnhanceMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI Copy Rewrite
            </button>
          </div>

          {(active.admin_feedback || active.adminFeedback) && (
            <div className="rounded-xl border border-success/15 bg-success/5 p-4 text-xs space-y-1">
              <div className="text-[9px] text-success font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Dispatched Resolution Reply
              </div>
              <p className="text-foreground font-medium leading-relaxed break-words break-all">
                {active.admin_feedback || active.adminFeedback}
              </p>
            </div>
          )}

          {active.aiDraftReply && !(active.admin_feedback || active.adminFeedback) && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs relative space-y-1">
              <button
                onClick={() => setReplyText(active.aiDraftReply)}
                className="absolute top-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-500 hover:bg-indigo-500/20 transition-colors shadow-sm"
              >
                Apply Draft
              </button>
              <div className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Auto-Generated AI Draft
              </div>
              <p className="text-muted-foreground leading-relaxed pr-20 italic break-words break-all">
                &ldquo;{active.aiDraftReply}&rdquo;
              </p>
            </div>
          )}

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your official reply, follow-up, or resolution notes to the student here..."
            className="w-full h-28 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none transition-all duration-300 text-foreground"
          />

          <div className="flex items-center justify-between border-t border-border/80 pt-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Change Status To:</span>
              <select
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold cursor-pointer focus:border-primary outline-none"
                value={active.status}
                onChange={(e) =>
                  updateStatusMutation.mutate({
                    id: active._id,
                    status: e.target.value,
                    adminFeedback: replyText || undefined,
                  })
                }
                disabled={updateStatusMutation.isPending}
              >
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="fixed">Fixed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={() =>
                updateStatusMutation.mutate({
                  id: active._id,
                  status: active.status,
                  adminFeedback: replyText,
                })
              }
              disabled={updateStatusMutation.isPending || !replyText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition active:scale-95 cursor-pointer"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Reply
            </button>
          </div>
        </div>

        {/* Internal notes */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-accent" /> Private Internal Annotations (Admins Only)
          </h3>

          <div className="space-y-3">
            {active.internalNotes?.map((note: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-border/80 bg-muted/10 p-4 text-xs space-y-1.5 shadow-sm"
              >
                <div className="flex items-center justify-between text-muted-foreground flex-wrap gap-2">
                  <span className="font-bold text-foreground">
                    {note.admin_id?.name || "Admin"}
                  </span>
                  <span className="font-medium">{safeFormatDate(note.created_at, "Pp")}</span>
                </div>
                <p className="text-foreground/90 leading-relaxed font-medium break-words break-all">{note.text}</p>
              </div>
            ))}

            <div className="rounded-xl border border-border bg-muted/5 p-4 space-y-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add an internal note (only visible to administrators)..."
                className="w-full h-20 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/80 resize-none transition-all duration-300 text-foreground"
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toast.info("Attachment support coming in platform release v2")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-[10px] font-semibold text-muted-foreground transition active:scale-95 cursor-pointer"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Attach private file
                </button>
                <button
                  onClick={() => addNoteMutation.mutate({ id: active._id, text: noteText })}
                  disabled={addNoteMutation.isPending || !noteText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition active:scale-95 cursor-pointer"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Save Private Note
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderControlBoardSidebar = () => {
    if (!active) return null;
    return (
      <div className="space-y-6">
        {/* Control Board Dropdowns */}
        <div className="rounded-xl border border-border bg-muted/10 p-4.5 space-y-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2.5">
            Control Board
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
              Case Status
            </label>
            <div className="relative">
              <select
                className="w-full rounded-xl border border-border bg-background pl-3 pr-9 py-3 text-xs font-bold cursor-pointer focus:border-primary outline-none appearance-none"
                value={active.status}
                onChange={(e) =>
                  updateStatusMutation.mutate({ id: active._id, status: e.target.value })
                }
                disabled={updateStatusMutation.isPending}
              >
                <option value="pending">Pending Dispatch</option>
                <option value="in_review">In Active Review</option>
                <option value="resolved">Mark Resolved</option>
                <option value="fixed">Mark Fixed</option>
                <option value="rejected">Mark Rejected</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
              Response Severity
            </label>
            <div className="relative">
              <select
                className="w-full rounded-xl border border-border bg-background pl-3 pr-9 py-3 text-xs font-bold cursor-pointer focus:border-primary outline-none appearance-none"
                value={active.priority}
                onChange={(e) =>
                  updatePriorityMutation.mutate({ id: active._id, priority: e.target.value })
                }
                disabled={updatePriorityMutation.isPending}
              >
                <option value="low">Low Priority</option>
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Severity</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Evidence */}
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Submitted Attachments</span>
            <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded border border-border bg-background">
              {active.files?.length || 0}
            </span>
          </div>
          <ul className="space-y-2">
            {active.files?.length > 0 ? (
              active.files.map((f: any, i: number) => (
                <li key={i}>
                  <a
                    href={`${SERVER_URL}${f.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/20 hover:bg-muted/30 px-4 py-3 text-xs transition-all duration-300 group shadow-sm animate-in fade-in"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-4">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate font-semibold text-foreground group-hover:text-primary transition-colors break-all break-words" title={f.originalName}>
                        {f.originalName}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </li>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border rounded-xl bg-muted/10">
                <Paperclip className="h-5 w-5 text-muted-foreground/30 mb-1" />
                <span className="text-[10.5px] text-muted-foreground italic font-medium">No attachments provided</span>
              </div>
            )}
          </ul>
        </div>

        {/* Student Satisfaction */}
        {(active.satisfaction_feedback || active.satisfactionFeedback) && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Student Satisfaction
            </div>
            {(() => {
              const isSatisfied = (active.satisfaction_feedback?.satisfied || active.satisfactionFeedback?.satisfied) === "yes";
              const rating = active.satisfaction_feedback?.rating || active.satisfactionFeedback?.rating;
              const comments = active.satisfaction_feedback?.comments || active.satisfactionFeedback?.comments;
              const submittedAt = active.satisfaction_feedback?.submitted_at || active.satisfactionFeedback?.submitted_at;

              return (
                <div className={`rounded-xl border p-4.5 space-y-3 shadow-sm ${
                  isSatisfied ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-rose-500/20 bg-rose-500/[0.03]"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] uppercase font-bold tracking-wider ${isSatisfied ? "text-emerald-600" : "text-rose-600"}`}>
                      Student Rating
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${
                      isSatisfied 
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {isSatisfied ? "😄 Satisfied" : "😞 Unsatisfied"}
                    </span>
                  </div>
                  {rating && (
                    <div className="flex flex-col gap-1 border-t border-b border-border/40 py-2">
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase">Score Rating</span>
                      {renderStars(rating)}
                    </div>
                  )}
                  {comments && (
                    <p className={`text-xs leading-relaxed italic bg-background border rounded-lg p-3 select-all break-words break-all ${
                      isSatisfied ? "text-emerald-700 text-emerald-600 border-emerald-500/10" : "text-rose-700 text-rose-600 border-rose-500/10"
                    }`}>
                      &ldquo;{comments}&rdquo;
                    </p>
                  )}
                  <div className="text-[9px] text-muted-foreground/80 font-mono text-right">
                    Logged: {safeFormatDate(submittedAt, "MMM dd, yyyy HH:mm")}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* System Audit */}
        <div className="rounded-xl border border-border bg-muted/10 p-4.5 space-y-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Database className="h-3.5 w-3.5 text-primary" /> Incident Parameters
          </div>
          
          <div className="space-y-2 text-xs divide-y divide-border/60">
            <div className="flex items-center justify-between py-2 text-foreground font-semibold flex-wrap gap-2">
              <span className="text-muted-foreground font-medium">Department Unit</span>
              <span className="truncate max-w-[140px] break-all text-right" title={formatCategory(active.category)}>
                {formatCategory(active.category)}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2 text-foreground font-semibold">
              <span className="text-muted-foreground font-medium">Privacy Status</span>
              <span>{active.anonymous ? "Anonymous Submission" : "Public Submission"}</span>
            </div>

            <div className="flex items-center justify-between py-2 text-foreground font-semibold flex-wrap gap-2">
              <span className="text-muted-foreground font-medium">Assigned Staff</span>
              <span className="text-primary font-bold">
                {active.assignedStaff ? `${active.assignedStaff.name}` : "Unassigned"}
              </span>
            </div>

            {active.submitter && (
              <>
                <div className="flex items-center justify-between py-2 text-foreground font-semibold flex-wrap gap-2">
                  <span className="text-muted-foreground font-medium">Matric ID</span>
                  <span className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border border-border break-all">{active.submitter.matric || "N/A"}</span>
                </div>
                
                <div className="flex items-center justify-between py-2 text-foreground font-semibold flex-wrap gap-2">
                  <span className="text-muted-foreground font-medium">Contact Endpoint</span>
                  <span className="truncate max-w-[130px] font-mono text-[10px] break-all text-right" title={active.submitter.email || undefined}>
                    {active.submitter.email || "N/A"}
                  </span>
                </div>
              </>
            )}
          </div>
          
          <div className="pt-2 border-t border-border/80 flex items-center gap-1.5 text-[9px] text-muted-foreground/90 font-medium">
            <ShieldCheck className="h-4 w-4 text-success shrink-0" /> State updates are logged securely in ledger
          </div>
        </div>
      </div>
    );
  };

  const isLoading = listLoading;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Scrollbar Custom Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar {
          width: 5px !important;
          height: 0px !important;
        }
        ::-webkit-scrollbar-track {
          background: transparent !important;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.15) !important;
          border-radius: 9999px !important;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.3) !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Complaints Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track, review, and dispatch resolution protocols for student complaints.
          </p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-16rem)] w-full gap-6 overflow-hidden min-h-0 relative select-none">
        
        {/* Left Column - Registry cases list */}
        <div
          className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm h-full min-h-0 transition-all duration-300 ${
            sidebarCollapsed ? "w-0 opacity-0 pointer-events-none mr-[-24px]" : "w-full lg:w-[340px] xl:w-[380px] shrink-0"
          } ${
            selectedId !== null ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-border p-4 space-y-3 bg-muted/10 shrink-0">
            {/* Elegant Search with focus rings */}
            <div className="relative flex items-center rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-300">
              <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cases..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              />
            </div>
            
            {/* Filter tags with no scrollbar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 cursor-pointer ${
                    filter === f
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Scrolling registry elements */}
          <ul className="flex-1 divide-y divide-border/60 overflow-y-auto overflow-x-hidden bg-card/30 min-h-0 select-none">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="animate-spin h-7 w-7 text-primary mb-2" />
                <span className="text-[11px] font-medium">Fetching active registry...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 opacity-20 mb-2" />
                <span className="text-xs font-bold">No registry records found</span>
                <span className="text-[10px] mt-1 opacity-70">Try relaxing your search descriptors</span>
              </div>
            ) : (
              filtered.map((c: any) => {
                const isActive = selectedId === c._id;
                return (
                  <motion.li
                    key={c._id}
                    onClick={() => setSelectedId(c._id)}
                    whileHover={{ x: 4 }}
                    className={`cursor-pointer px-5 py-4 transition-all duration-200 border-l-2 relative ${
                      isActive 
                        ? "bg-primary/[0.04] border-primary" 
                        : "hover:bg-muted/30 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] tracking-wider text-muted-foreground font-semibold uppercase">
                        #{c.reference_id || "N/A"}
                      </span>
                      <StatusBadge tone={getStatusTone(c.status || "pending")}>
                        {(c.status || "pending").replace("_", " ").toUpperCase()}
                      </StatusBadge>
                    </div>
                    <div className="mt-2 line-clamp-1 font-semibold text-sm text-foreground hover:text-primary transition-colors break-words break-all">
                      {c.title || "Untitled Issue"}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-medium ${getCategoryStyle(c.category)}`}>
                        {formatCategory(c.category)}
                      </span>
                      <span className="font-medium text-[10px]">
                        {safeFormatDate(c.created_at, "MMM d, yyyy")}
                      </span>
                    </div>
                  </motion.li>
                );
              })
            )}
          </ul>
        </div>

        {/* Sleek Floating Collapse Handle (Desktop only) */}
        <div className="hidden lg:flex items-center relative z-20 select-none">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute left-[-12px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            title={sidebarCollapsed ? "Expand Registry" : "Collapse Registry"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-primary animate-pulse" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            )}
          </button>
        </div>

        {/* Right Column - Beautiful splits workspace details */}
        <div
          className={`flex-1 h-full min-h-0 overflow-hidden transition-all duration-300 ${
            selectedId === null ? "hidden lg:flex" : "flex"
          }`}
        >
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div 
                key={active._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm min-h-0"
              >
                {/* Header card area */}
                <div className="border-b border-border p-5 md:p-6 bg-muted/10 shrink-0">
                  <div className="flex flex-col justify-between gap-3">
                    {/* Back to cases list on mobile/tablet */}
                    <button
                      onClick={() => setSelectedId(null)}
                      className="self-start inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition active:scale-95 lg:hidden cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to Complaints
                    </button>

                    <div className="space-y-2 max-w-full overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-background px-2.5 py-1 rounded-md border border-border uppercase">
                          #{active.referenceId || active.reference_id || "N/A"}
                        </span>
                        <StatusBadge tone={getStatusTone(active.status || "pending")}>
                          {(active.status || "pending").replace("_", " ").toUpperCase()}
                        </StatusBadge>
                        <StatusBadge tone={getPriorityTone(active.priority || "normal")}>
                          {(active.priority || "normal").toUpperCase()}
                        </StatusBadge>
                      </div>
                      
                      <h2 className="font-display text-lg md:text-xl font-bold tracking-tight text-foreground leading-snug break-words break-all">
                        {active.title || "Untitled Complaint"}
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1 select-none">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 opacity-60 text-primary animate-pulse" />{" "}
                          {active.anonymous ? (
                            <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                              <AlertTriangle className="h-3 w-3" /> {active.submitter?.name || "Anonymous Student"}
                            </span>
                          ) : (
                            <span className="font-semibold text-foreground">{active.submitter?.name || "Student Submittee"}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <Building2 className="h-3.5 w-3.5 opacity-60" /> {formatCategory(active.category)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 opacity-60" /> Submitted {safeFormatDate(active.created_at, "PPP")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Elegant sliding sub-tabs selector for narrow viewports (visible < xl) */}
                <div className="flex border-b border-border bg-muted/10 px-6 gap-6 shrink-0 xl:hidden overflow-x-auto no-scrollbar select-none">
                  <button
                    onClick={() => setActiveDetailTab('resolution')}
                    className={`relative py-3 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      activeDetailTab === 'resolution' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Resolution & Notes
                    {activeDetailTab === 'resolution' && (
                      <motion.div
                        layoutId="detailTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('control')}
                    className={`relative py-3 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      activeDetailTab === 'control' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Control & Parameters
                    {activeDetailTab === 'control' && (
                      <motion.div
                        layoutId="detailTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                </div>

                {/* Wide Viewport Layout (Desktop split) */}
                <div className="hidden xl:flex flex-1 divide-x divide-border overflow-hidden min-h-0 h-full w-full">
                  {/* Left Workspace Panel - Issues & Actions (65% width) */}
                  <div className="w-[65%] overflow-y-auto overflow-x-hidden p-6 space-y-6 min-h-0 bg-muted/5">
                    {renderResolutionWorkspace()}
                  </div>

                  {/* Right Control Sidebar - Parameters & Controls (35% width) */}
                  <div className="w-[35%] overflow-y-auto overflow-x-hidden p-6 space-y-6 min-h-0 bg-muted/10">
                    {renderControlBoardSidebar()}
                  </div>
                </div>

                {/* Narrow Viewport Layout (Responsive tabs) */}
                <div className="flex xl:hidden flex-1 overflow-hidden min-h-0 h-full w-full">
                  {activeDetailTab === 'resolution' ? (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-6 space-y-6 min-h-0 bg-muted/5 animate-in fade-in duration-200">
                      {renderResolutionWorkspace()}
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-6 space-y-6 min-h-0 bg-muted/10 animate-in fade-in duration-200">
                      {renderControlBoardSidebar()}
                    </div>
                  )}
                </div>

              </motion.div>
            ) : detailLoading ? (
              <div className="flex flex-col items-center justify-center h-full w-full rounded-2xl border border-border bg-card">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-3.5 text-xs font-semibold text-muted-foreground">Retrieving incident documents...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full rounded-2xl border border-border bg-card text-center p-6 bg-muted/5 select-none animate-in fade-in">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground/30 mb-4 border border-border">
                  <ArrowRight className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <p className="font-semibold text-foreground text-sm font-display">Platform Action Workspace</p>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
                  Select a student complaint incident from the sidebar ledger to initialize the resolving panel.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
