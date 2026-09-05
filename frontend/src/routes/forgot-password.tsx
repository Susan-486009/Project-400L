import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { authService } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — LASUSTECH Resolution Center" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send you a secure link to reset it."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-medium text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5">
          <h3 className="font-medium text-foreground">Check your inbox</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account matches that email, we've sent reset instructions. The link expires in 30
            minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            label="University email"
            type="email"
            placeholder="you@lasustech.edu.ng"
            leading={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
