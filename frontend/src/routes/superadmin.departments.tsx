import { createFileRoute } from "@tanstack/react-router";
import { Building2, Plus, Edit2, Trash2, Shield } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentService, authService } from "@/lib/api";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const availableCategories = [
  { value: "academic-result", label: "Academic Results" },
  { value: "academic-lecturer", label: "Academic / Lecturers" },
  { value: "facility-maint", label: "Campus Facilities" },
  { value: "facility-hostel", label: "Hostel & Welfare" },
  { value: "admin-staff", label: "Administrative Process" },
  { value: "security", label: "Security & Safety" },
  { value: "financial", label: "Financial / Payments" },
  { value: "it-service", label: "IT Portal Services" },
  { value: "other", label: "Other Issues" },
];

export const Route = createFileRoute("/superadmin/departments")({
  head: () => ({ meta: [{ title: "Departments — Superadmin" }] }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [managingDeptId, setManagingDeptId] = useState<string | null>(null);
  const [assigningStaffId, setAssigningStaffId] = useState("");

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    head_id: string;
    categories: string[];
  }>({
    name: "",
    description: "",
    head_id: "",
    categories: [],
  });

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentService.getAll(),
  });

  const { data: allStaffData } = useQuery({
    queryKey: ["all-staff-users"],
    queryFn: () => authService.getUsers({ role: "staff", limit: 100 }),
  });
  const allStaff = allStaffData?.users || [];

  const addMutation = useMutation({
    mutationFn: (data: any) => departmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department created successfully.");
      setIsAddOpen(false);
      setFormData({ name: "", description: "", head_id: "", categories: [] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create department"),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => departmentService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department updated successfully.");
      setIsEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update department"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department deactivated successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete department"),
  });

  const assignStaffMutation = useMutation({
    mutationFn: ({ userId, deptId }: { userId: string; deptId: string | null }) =>
      authService.updateUser(userId, { department_id: deptId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-staff-users"] });
      toast.success("Staff assignment updated.");
      setAssigningStaffId("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update assignment"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description,
      head_id: formData.head_id === "" ? undefined : formData.head_id,
      categories: formData.categories,
    };
    if (isEditOpen && selectedDept) {
      editMutation.mutate({ id: selectedDept._id, data: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const openEdit = (dept: any) => {
    setSelectedDept(dept);
    setFormData({
      name: dept.name,
      description: dept.description || "",
      head_id: dept.head_id?._id || "",
      categories: dept.categories || [],
    });
    setIsEditOpen(true);
  };

  // We ensure data returned from API matches the format array. If it's wrapped in { data: [] }, extract it.
  const deptList = Array.isArray(departments) ? departments : (departments as any)?.data || [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Department Management</h2>
          <p className="text-muted-foreground">Configure resolution departments and assign leads.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <button
              onClick={() => setFormData({ name: "", description: "", head_id: "", categories: [] })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Add Department
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add New Department</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="head_id">Department Head (Staff)</Label>
                  <select
                    id="head_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.head_id}
                    onChange={(e) => setFormData({ ...formData, head_id: e.target.value })}
                  >
                    <option value="">-- Select a Staff Member --</option>
                    {allStaff.map((s: any) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Assigned Complaint Categories</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1 rounded-lg border border-border bg-muted/10 p-3">
                    {availableCategories.map((cat) => {
                      const isChecked = formData.categories.includes(cat.value);
                      return (
                        <label key={cat.value} className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-foreground transition text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const newCats = e.target.checked
                                ? [...formData.categories, cat.value]
                                : formData.categories.filter((c) => c !== cat.value);
                              setFormData({ ...formData, categories: newCats });
                            }}
                            className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          {cat.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
                >
                  {addMutation.isPending ? "Saving..." : "Save Department"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Department Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Department Head</th>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  </td>
                </tr>
              ) : deptList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    <Building2 className="mx-auto h-8 w-8 opacity-20 mb-3" />
                    No departments found.
                  </td>
                </tr>
              ) : (
                deptList.map((dept: any) => (
                  <tr key={dept._id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{dept.name}</div>
                      {dept.categories && dept.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {dept.categories.map((c: string) => (
                            <span key={c} className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary uppercase tracking-wider">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {dept.description || <span className="italic opacity-50">No description</span>}
                    </td>
                    <td className="px-4 py-3">
                      {dept.head_id ? (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <span>{dept.head_id.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      {/* Staff in this department */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Assigned Staff</span>
                          <button
                            onClick={() => setManagingDeptId(managingDeptId === dept._id ? null : dept._id)}
                            className="text-[10px] font-bold text-primary hover:underline ml-2"
                          >
                            {managingDeptId === dept._id ? "Done" : "Manage"}
                          </button>
                        </div>

                        {/* Staff list */}
                        <div className="flex flex-col gap-1">
                          {allStaff.filter((s: any) => s.department_id === dept._id || s.department?.id === dept._id).length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">No staff assigned yet.</p>
                          ) : (
                            allStaff
                              .filter((s: any) => s.department_id === dept._id || s.department?.id === dept._id)
                              .map((s: any) => (
                                <div key={s._id || s.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                                  <span className="font-medium">{s.name}</span>
                                  {managingDeptId === dept._id && (
                                    <button
                                      onClick={() => assignStaffMutation.mutate({ userId: s._id || s.id, deptId: null })}
                                      className="text-[10px] text-rose-400 hover:text-rose-600 font-semibold ml-2"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))
                          )}
                        </div>

                        {/* Add staff dropdown */}
                        {managingDeptId === dept._id && (
                          <div className="mt-2 flex gap-2">
                            <select
                              value={assigningStaffId}
                              onChange={(e) => setAssigningStaffId(e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                            >
                              <option value="">Add a staff member...</option>
                              {allStaff
                                .filter((s: any) => s.department_id !== dept._id && s.department?.id !== dept._id)
                                .map((s: any) => (
                                  <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                                ))}
                            </select>
                            <button
                              onClick={() => {
                                if (assigningStaffId) {
                                  assignStaffMutation.mutate({ userId: assigningStaffId, deptId: dept._id });
                                }
                              }}
                              disabled={!assigningStaffId || assignStaffMutation.isPending}
                              className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground disabled:opacity-50 transition hover:opacity-90"
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(dept)}
                          className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this department?")) {
                              deleteMutation.mutate(dept._id);
                            }
                          }}
                          className="p-2 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-head">Department Head (Staff)</Label>
                <select
                  id="edit-head"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.head_id}
                  onChange={(e) => setFormData({ ...formData, head_id: e.target.value })}
                >
                  <option value="">-- Unassigned --</option>
                  {allStaff.map((s: any) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned Complaint Categories</Label>
                <div className="grid grid-cols-2 gap-2 mt-1 rounded-lg border border-border bg-muted/10 p-3">
                  {availableCategories.map((cat) => {
                    const isChecked = formData.categories.includes(cat.value);
                    return (
                      <label key={cat.value} className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-foreground transition text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newCats = e.target.checked
                              ? [...formData.categories, cat.value]
                              : formData.categories.filter((c) => c !== cat.value);
                            setFormData({ ...formData, categories: newCats });
                          }}
                          className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        {cat.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
