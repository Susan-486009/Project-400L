import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  User as UserIcon,
  ShieldCheck,
  Bell,
  Moon,
  Sun,
  Monitor,
  Loader2,
  LogOut,
  Save,
  KeyRound,
  Sliders,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, platformConfigService, type UserSettings } from "@/lib/api";
import { applyTheme } from "@/lib/theme";
import { motion } from "framer-motion";

export const Route = createFileRoute("/superadmin/settings")({
  head: () => ({ meta: [{ title: "Platform Settings — Control Center" }] }),
  component: SuperadminSettingsPage,
});

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function SuperadminSettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Active Admin tabs
  const [activeTab, setActiveTab] = useState<"personal" | "platform">("personal");

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => authService.me(),
  });

  const { data: backendConfig, isLoading: configLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: () => platformConfigService.get(),
  });

  // Personal form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    settings: {
      email_notifications: true,
      in_app_notifications: true,
      theme: "light" as "light" | "dark" | "system",
    },
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Platform/Institutional configurations state
  const [platformConfig, setPlatformConfig] = useState({
    systemName: "LASUSTECH Student Resolution Center",
    maintenanceMode: false,
    anonymousSubmissions: true,
    slaTargetHours: 48,
    sessionTimeoutMinutes: 30,
    maxUploadLimitMb: 10,
    twoFactorEnforced: false,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        settings: {
          email_notifications: user.settings?.email_notifications ?? true,
          in_app_notifications: user.settings?.in_app_notifications ?? true,
          theme: user.settings?.theme ?? "light",
        },
      });
    }
  }, [user]);

  // Sync platform config from backend into local form state
  useEffect(() => {
    if (backendConfig) {
      setPlatformConfig((prev) => ({
        ...prev,
        ...backendConfig,
      }));
    }
  }, [backendConfig]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => authService.updateProfile(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["me"], updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      toast.success("Account settings updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save account settings");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: any) => authService.changePassword(data),
    onSuccess: () => {
      toast.success("Security credentials updated successfully");
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Credential change failed");
    },
  });

  const handleTogglePreference = (key: keyof UserSettings) => {
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: !prev.settings[key],
      },
    }));
  };

  const handleSaveProfile = () => {
    updateMutation.mutate(formData);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Security passwords do not match");
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const platformConfigMutation = useMutation({
    mutationFn: (config: any) => platformConfigService.update(config),
    onSuccess: (saved) => {
      localStorage.setItem("resolve_global_config", JSON.stringify(saved));
      toast.success("Institutional platform policies deployed successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to deploy platform policies");
    },
  });

  const handleSavePlatformConfig = () => {
    localStorage.setItem("resolve_global_config", JSON.stringify(platformConfig));
    platformConfigMutation.mutate(platformConfig);
  };

  const handleLogout = () => {
    localStorage.removeItem("as_access_token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate({ to: "/login" });
  };

  if (userLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Platform & Account Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure security baselines, institutional rule sets, and personal administrator profiles.
        </p>
      </div>

      {/* Modern sliding navigation tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab("personal")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === "personal"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Personal Profile & Preferences
        </button>
        <button
          onClick={() => setActiveTab("platform")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === "platform"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Institutional Platform Policies
        </button>
      </div>

      <motion.div variants={sectionVariants} initial="hidden" animate="show" className="space-y-6">
        {activeTab === "personal" ? (
          <>
            {/* Account Profile Details */}
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Administrator Identity</h3>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Full Administrator Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Security Email Endpoint
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Staff Identity Reference (Role-based ID)
                  </label>
                  <input
                    type="text"
                    value={user?.matric || "SUPERADMIN_LEDGER_01"}
                    disabled
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed outline-none"
                  />
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    This staff credential is bound to the institutional database ledger and cannot be altered here.
                  </p>
                </div>
              </div>
            </section>

            {/* Account Credentials Change */}
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Security & Access Keys</h3>
                </div>
              </div>
              <div className="p-6">
                {!showPasswordForm ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Update Administrator Credentials</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Implement a strong, complex password sequence to secure platform command levels.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted transition whitespace-nowrap"
                    >
                      Change Security Password
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSavePassword} className="space-y-4 animate-in fade-in">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Current Security Password
                        </label>
                        <input
                          type="password"
                          required
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData((p) => ({ ...p, currentPassword: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          New Security Password
                        </label>
                        <input
                          type="password"
                          required
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData((p) => ({ ...p, newPassword: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Confirm New Security Password
                        </label>
                        <input
                          type="password"
                          required
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={passwordMutation.isPending}
                        className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition disabled:opacity-50"
                      >
                        {passwordMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <KeyRound className="h-3 w-3" />
                        )}
                        Save Security Keys
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>

            {/* Premium Theme Card Selectors & Alert Prefs */}
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">System Experience & Alerts</h3>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* Advanced Premium Theme Selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Display Theme Preference
                  </label>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    {/* Light option */}
                    <button
                      onClick={() => {
                        setFormData((p) => ({
                          ...p,
                          settings: { ...p.settings, theme: "light" },
                        }));
                        applyTheme("light");
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                        formData.settings.theme === "light"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:bg-muted/35 text-muted-foreground"
                      }`}
                    >
                      <Sun className="h-6 w-6 mb-2" />
                      <span className="text-xs font-semibold">Light Mode</span>
                    </button>

                    {/* Dark option */}
                    <button
                      onClick={() => {
                        setFormData((p) => ({
                          ...p,
                          settings: { ...p.settings, theme: "dark" },
                        }));
                        applyTheme("dark");
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                        formData.settings.theme === "dark"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:bg-muted/35 text-muted-foreground"
                      }`}
                    >
                      <Moon className="h-6 w-6 mb-2" />
                      <span className="text-xs font-semibold">Dark Mode</span>
                    </button>

                    {/* System option */}
                    <button
                      onClick={() => {
                        setFormData((p) => ({
                          ...p,
                          settings: { ...p.settings, theme: "system" },
                        }));
                        applyTheme("system");
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                        formData.settings.theme === "system"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:bg-muted/35 text-muted-foreground"
                      }`}
                    >
                      <Monitor className="h-6 w-6 mb-2" />
                      <span className="text-xs font-semibold">System Default</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-border pt-2">
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">Critical Security Email Alerts</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Receive instant emails regarding user registry modifications or access breaches.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTogglePreference("email_notifications")}
                      className={`h-5 w-10 rounded-full transition-colors relative ${
                        formData.settings.email_notifications ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          formData.settings.email_notifications ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">Live Toast Feedback Notifications</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Show visual dynamic updates while you manage administrative consoles.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTogglePreference("in_app_notifications")}
                      className={`h-5 w-10 rounded-full transition-colors relative ${
                        formData.settings.in_app_notifications ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          formData.settings.in_app_notifications ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Profile Action Triggers */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-4">
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-500/20 transition"
              >
                <LogOut className="h-4 w-4" />
                Sign out of account
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Personal Settings
              </button>
            </div>
          </>
        ) : (
          /* Institutional Policy Controls for Platform */
          <>
            {/* Global Settings */}
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">System Parameter Configurations</h3>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Title System */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      Platform Brand Display Name
                    </label>
                    <input
                      type="text"
                      value={platformConfig.systemName}
                      onChange={(e) => setPlatformConfig({ ...platformConfig, systemName: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                    />
                  </div>

                  {/* SLA Limits */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Target Case SLA Threshold (Hours)
                    </label>
                    <input
                      type="number"
                      value={platformConfig.slaTargetHours}
                      onChange={(e) =>
                        setPlatformConfig({ ...platformConfig, slaTargetHours: Math.max(1, Number(e.target.value)) })
                      }
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition font-mono"
                    />
                  </div>

                  {/* Session limits */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Administrator Session Expiry (Minutes)
                    </label>
                    <input
                      type="number"
                      value={platformConfig.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setPlatformConfig({
                          ...platformConfig,
                          sessionTimeoutMinutes: Math.max(5, Number(e.target.value)),
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition font-mono"
                    />
                  </div>

                  {/* Max File Size Limit */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Max Attachment File Limit (MB)
                    </label>
                    <select
                      value={platformConfig.maxUploadLimitMb}
                      onChange={(e) =>
                        setPlatformConfig({ ...platformConfig, maxUploadLimitMb: Number(e.target.value) })
                      }
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                    >
                      <option value={2}>2 Megabytes</option>
                      <option value={5}>5 Megabytes</option>
                      <option value={10}>10 Megabytes</option>
                      <option value={20}>20 Megabytes</option>
                      <option value={50}>50 Megabytes</option>
                    </select>
                  </div>
                </div>

                <div className="divide-y divide-border border-t border-border mt-4">
                  {/* Anonymous Submissions control */}
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">Anonymous Student Complaint Submission</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Allows students to submit complaints anonymously. Security and database logs remain active.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setPlatformConfig({
                          ...platformConfig,
                          anonymousSubmissions: !platformConfig.anonymousSubmissions,
                        })
                      }
                      className={`h-5 w-10 rounded-full transition-colors relative ${
                        platformConfig.anonymousSubmissions ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          platformConfig.anonymousSubmissions ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Strict double factor assignment control */}
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">Enforce Strict Role Change Confirmation</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requires administrators to double-authenticate whenever changing platform access roles.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setPlatformConfig({
                          ...platformConfig,
                          twoFactorEnforced: !platformConfig.twoFactorEnforced,
                        })
                      }
                      className={`h-5 w-10 rounded-full transition-colors relative ${
                        platformConfig.twoFactorEnforced ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          platformConfig.twoFactorEnforced ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Platform Emergency Maintenance Card */}
            <section className="rounded-xl border border-orange-500/25 bg-orange-500/5 shadow-sm overflow-hidden">
              <div className="border-b border-orange-500/20 bg-orange-500/10 px-6 py-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-orange-400">Emergency Maintenance Controls</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium text-orange-200">Activate System-Wide Maintenance Mode</p>
                    <p className="text-xs text-orange-300/80 mt-1 max-w-xl">
                      Enabling this blocks students and staff from logging complaints or initiating updates. Normal
                      platform operations are paused, and standard users will view a system under maintenance screen.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setPlatformConfig({
                        ...platformConfig,
                        maintenanceMode: !platformConfig.maintenanceMode,
                      })
                    }
                    className={`h-6 w-12 rounded-full transition-colors relative shrink-0 ${
                      platformConfig.maintenanceMode ? "bg-orange-500" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        platformConfig.maintenanceMode ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Action Save triggers */}
            <div className="flex items-center justify-end pt-4">
              <button
                onClick={handleSavePlatformConfig}
                disabled={platformConfigMutation.isPending}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition disabled:opacity-50"
              >
                {platformConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Deploy Platform Policies
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
