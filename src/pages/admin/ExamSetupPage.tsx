import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import {
  createExamCategory,
  createExamGroup,
  deleteExamCategory,
  deleteExamGroup,
  listExamCategories,
  listExamGroups,
  listExams,
  updateExamCategory,
  updateExamGroup,
} from "@/lib/exams-module-api";
import type { ExamGroup } from "@/lib/exams-module-types";

export default function ExamSetupPage() {
  const [groups, setGroups] = useState<ExamGroup[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryUsage, setCategoryUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [groupSearch, setGroupSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupMembers, setEditingGroupMembers] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  const refresh = () => setRefreshKey((prev) => prev + 1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [groupRows, categoryRows, examRows] = await Promise.all([
          listExamGroups(),
          listExamCategories(),
          listExams(),
        ]);
        setGroups(groupRows);
        setCategories(categoryRows);
        const usage = examRows.reduce<Record<string, number>>((acc, exam) => {
          if (exam.category) {
            acc[exam.category] = (acc[exam.category] ?? 0) + 1;
          }
          return acc;
        }, {});
        setCategoryUsage(usage);
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load exam setup data.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [refreshKey]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(q));
  }, [groupSearch, groups]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((category) => category.toLowerCase().includes(q));
  }, [categorySearch, categories]);

  const startEditGroup = (group: ExamGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupMembers(String(group.membersCount));
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName("");
    setEditingGroupMembers("");
  };

  const submitCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      notifyError("Group name is required.");
      return;
    }
    const membersCount = newGroupMembers.trim() ? Number(newGroupMembers) : 0;
    if (newGroupMembers.trim() && (!Number.isFinite(membersCount) || membersCount < 0)) {
      notifyError("Members count must be a positive number.");
      return;
    }
    setGroupSubmitting(true);
    try {
      await createExamGroup({ name, membersCount });
      notifySuccess("Group created.");
      setNewGroupName("");
      setNewGroupMembers("");
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to create group.");
    } finally {
      setGroupSubmitting(false);
    }
  };

  const submitUpdateGroup = async () => {
    if (!editingGroupId) return;
    const name = editingGroupName.trim();
    if (!name) {
      notifyError("Group name is required.");
      return;
    }
    const membersCount = editingGroupMembers.trim() ? Number(editingGroupMembers) : 0;
    if (editingGroupMembers.trim() && (!Number.isFinite(membersCount) || membersCount < 0)) {
      notifyError("Members count must be a positive number.");
      return;
    }
    setGroupSubmitting(true);
    try {
      await updateExamGroup(editingGroupId, { name, membersCount });
      notifySuccess("Group updated.");
      cancelEditGroup();
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to update group.");
    } finally {
      setGroupSubmitting(false);
    }
  };

  const submitDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group?")) return;
    setGroupSubmitting(true);
    try {
      await deleteExamGroup(groupId);
      notifySuccess("Group deleted.");
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to delete group.");
    } finally {
      setGroupSubmitting(false);
    }
  };

  const startEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const submitCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      notifyError("Category name is required.");
      return;
    }
    setCategorySubmitting(true);
    try {
      await createExamCategory(name);
      notifySuccess("Category created.");
      setNewCategoryName("");
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to create category.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const submitUpdateCategory = async () => {
    if (!editingCategory) return;
    const name = editingCategoryName.trim();
    if (!name) {
      notifyError("Category name is required.");
      return;
    }
    setCategorySubmitting(true);
    try {
      await updateExamCategory(editingCategory, name);
      notifySuccess("Category updated.");
      cancelEditCategory();
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to update category.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const submitDeleteCategory = async (category: string) => {
    const impacted = categoryUsage[category] ?? 0;
    const message = impacted
      ? `Delete this category? ${impacted} exam(s) will become uncategorized.`
      : "Delete this category?";
    if (!confirm(message)) return;
    setCategorySubmitting(true);
    try {
      await deleteExamCategory(category);
      notifySuccess("Category deleted.");
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to delete category.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Exam Setup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage groups and categories used for exam access, filtering, and reporting.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>Organize candidates into cohorts for group exams.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold text-slate-700">Add group</p>
              <div className="mt-3 grid items-center gap-2 sm:grid-cols-[1fr_160px_auto]">
                <Input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="Group name"
                />
                <Input
                  type="number"
                  min={0}
                  value={newGroupMembers}
                  onChange={(event) => setNewGroupMembers(event.target.value)}
                  placeholder="Members"
                />
                <Button className="min-w-[88px]" onClick={() => void submitCreateGroup()} disabled={groupSubmitting}>
                  {groupSubmitting ? "Saving..." : "Add"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">Group list</p>
                <Input
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  placeholder="Search groups..."
                  className="w-full sm:w-56"
                />
              </div>
              <div className="mt-3 grid gap-2">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <p className="text-sm text-slate-500">No groups found.</p>
                ) : (
                  <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
                    {filteredGroups.map((group) => (
                      <div key={group.id} className="grid items-center gap-3 rounded-md border px-3 py-2 sm:grid-cols-[1fr_auto]">
                        {editingGroupId === group.id ? (
                          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                            <Input
                              value={editingGroupName}
                              onChange={(event) => setEditingGroupName(event.target.value)}
                              placeholder="Group name"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={editingGroupMembers}
                              onChange={(event) => setEditingGroupMembers(event.target.value)}
                              placeholder="Members"
                            />
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">{group.name}</p>
                            <p className="text-xs text-slate-500">{group.membersCount} members</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {editingGroupId === group.id ? (
                            <>
                              <Button size="sm" className="min-w-[72px]" onClick={() => void submitUpdateGroup()} disabled={groupSubmitting}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" className="min-w-[72px]" onClick={cancelEditGroup} disabled={groupSubmitting}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="min-w-[72px]" onClick={() => startEditGroup(group)} disabled={groupSubmitting}>
                                Edit
                              </Button>
                              <Button size="sm" variant="destructive" className="min-w-[72px]" onClick={() => void submitDeleteGroup(group.id)} disabled={groupSubmitting}>
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Used for storefront grouping and search filters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4">
              <p className="text-sm font-semibold text-slate-700">Add category</p>
              <div className="mt-3 grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Category name"
                />
                <Button className="min-w-[88px]" onClick={() => void submitCreateCategory()} disabled={categorySubmitting}>
                  {categorySubmitting ? "Saving..." : "Add"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">General is the default and cannot be removed.</p>
            </div>

            <div className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">Category list</p>
                <Input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search categories..."
                  className="w-full sm:w-56"
                />
              </div>
              <div className="mt-3 grid gap-2">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <p className="text-sm text-slate-500">No categories found.</p>
                ) : (
                  <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
                    {filteredCategories.map((category) => {
                      const locked = category.toLowerCase() === "general";
                      return (
                        <div key={category} className="grid items-center gap-3 rounded-md border px-3 py-2 sm:grid-cols-[1fr_auto]">
                          {editingCategory === category ? (
                            <Input
                              value={editingCategoryName}
                              onChange={(event) => setEditingCategoryName(event.target.value)}
                              placeholder="Category name"
                            />
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{category}</p>
                                <p className="text-xs text-slate-500">
                                  {categoryUsage[category] ?? 0} exam(s)
                                </p>
                              </div>
                              {locked && <Badge variant="outline">Default</Badge>}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {editingCategory === category ? (
                              <>
                                <Button size="sm" className="min-w-[72px]" onClick={() => void submitUpdateCategory()} disabled={categorySubmitting}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" className="min-w-[72px]" onClick={cancelEditCategory} disabled={categorySubmitting}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`min-w-[72px] ${locked ? "opacity-50" : ""}`}
                                  onClick={() => startEditCategory(category)}
                                  disabled={categorySubmitting || locked}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className={`min-w-[72px] ${locked ? "opacity-50" : ""}`}
                                  onClick={() => void submitDeleteCategory(category)}
                                  disabled={categorySubmitting || locked}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
