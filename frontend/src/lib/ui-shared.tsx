import {
  LayoutDashboard,
  Inbox,
  Building2,
  BarChart3,
  FileText,
  Settings,
  Users,
  ShieldAlert,
} from "lucide-react";
import React from "react";

export const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/reports", label: "Complaints", icon: FileText },
];

export const staffNav = [
  { to: "/staff", label: "My Complaints", icon: Inbox },
];

export const superadminNav = [
  { to: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/superadmin/cases", label: "All Cases", icon: Inbox },
  { to: "/superadmin/users", label: "User Management", icon: Users },
  { to: "/superadmin/departments", label: "Departments", icon: Building2 },
  { to: "/superadmin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/superadmin/audit", label: "Audit Logs", icon: ShieldAlert },
  { to: "/superadmin/settings", label: "Settings", icon: Settings },
];

export function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${map[tone] || map.muted}`}
    >
      {children}
    </span>
  );
}

export function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    "academic-result": "Academic Concern (Results/Exams)",
    "academic-lecturer": "Lecturer Conduct / Concern",
    "facility-maint": "Campus Facility & Maintenance",
    "facility-hostel": "Hostel & Welfare",
    "admin-staff": "Administrative & Staff Issue",
    security: "Security & Safety",
    financial: "Financial & Payments",
    "it-service": "IT Services",
    delicate: "Sensitive / Delicate Issues (Harassment, Welfare)",
    other: "Other Issues",
  };
  return map[cat] || cat;
}
