import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { authService } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Reset password — LASUSTECH Resolution Center" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = useSearch({ from: "/reset-password" });
  const nav = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    if (password.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    if (!token) {
      return toast.error("This reset link is invalid. Please request a new one.");
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      toast.success("Password reset successfully! Please sign in.");
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password to secure your account."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-medium text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h3 className="font-medium text-foreground">Password updated</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <button
            onClick={() => nav({ to: "/login" })}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Sign in now
          </button>
        </div>
      ) : !token ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-medium text-foreground">Invalid reset link</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This reset link is missing or invalid. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" autoComplete="off">
          <Field
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            leading={<KeyRound className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Use 8+ characters with a mix of letters and numbers."
            required
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            type="password"
            placeholder="Repeat your password"
            leading={<KeyRound className="h-4 w-4" />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
