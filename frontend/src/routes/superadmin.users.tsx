import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, departmentService, User } from "@/lib/api";
import { Search, Filter, Shield, User as UserIcon, Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/superadmin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    role: "",
    department_id: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search, roleFilter],
    queryFn: () => authService.getUsers({ search, role: roleFilter }),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentService.getAll(),
  });
  const departments = Array.isArray(departmentsData) ? departmentsData : (departmentsData as any)?.data || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => authService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User updated successfully.");
      setIsEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update user"),
  });

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name || "",
      role: user.role || "student",
      department_id: (user as any).department?.id || (user as any).department_id || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateMutation.mutate({
      id: selectedUser.id,
      data: {
        name: editFormData.name,
        role: editFormData.role,
        department_id: editFormData.role === "student" ? null : (editFormData.department_id || null),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Users</h2>
          <p className="text-muted-foreground">Manage all students, staff, and administrators.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search by name, email or matric..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
            <option value="superadmin">Super Admins</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Identifier</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4" colSpan={5}>
                      <div className="h-10 rounded bg-muted/20" />
                    </td>
                  </tr>
                ))
              ) : data?.users.length ? (
                data.users.map((user: User) => (
                  <tr key={user.id} className="group hover:bg-muted/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold">{user.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {user.email || "No email provided"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs uppercase text-muted-foreground">
                      {user.matric}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-amber-500/10 text-amber-500"
                            : user.role === "staff"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {user.role === "admin" && <Shield className="h-2.5 w-2.5" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 mr-2" />
                      <span className="text-xs">Active</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="rounded-lg p-1.5 hover:bg-muted transition text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(user)}
                        title="Edit User"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-10 text-center text-muted-foreground" colSpan={5}>
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit User Account</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g. Susan Rade"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">System Role</Label>
                <select
                  id="edit-role"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {(editFormData.role === "staff" || editFormData.role === "admin") && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-dept">Department Assignment</Label>
                  <select
                    id="edit-dept"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
                    value={editFormData.department_id}
                    onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                  >
                    <option value="">No Department</option>
                    {departments.map((dept: any) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
