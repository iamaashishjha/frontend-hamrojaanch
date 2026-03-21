/**
 * Proctor scheduling — availability, workload, queue management.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Calendar,
  ClipboardList,
  Users,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  listProctorAvailability,
  addProctorAvailability,
  deleteProctorAvailability,
  listProctorWorkload,
  listProctorQueue,
  type ProctorAvailabilitySlot,
  type ProctorWorkloadItem,
} from "@/lib/proctor-scheduling-api";
import { getEligibleProctors } from "@/lib/proctor-api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProctorSchedulingPage() {
  const queryClient = useQueryClient();
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [addProctorId, setAddProctorId] = useState<string>("");
  const [addDayOfWeek, setAddDayOfWeek] = useState<number>(1);
  const [addStartTime, setAddStartTime] = useState("09:00");
  const [addEndTime, setAddEndTime] = useState("17:00");
  const [adding, setAdding] = useState(false);

  const { data: availability = [] } = useQuery({
    queryKey: ["proctor-scheduling", "availability"],
    queryFn: () => listProctorAvailability(),
  });

  const { data: workload = [] } = useQuery({
    queryKey: ["proctor-scheduling", "workload"],
    queryFn: listProctorWorkload,
  });

  const { data: queueData } = useQuery({
    queryKey: ["proctor-scheduling", "queue"],
    queryFn: () => listProctorQueue("all"),
  });

  const { data: proctors = [] } = useQuery({
    queryKey: ["proctor", "eligible"],
    queryFn: getEligibleProctors,
  });

  const handleAddSlot = async () => {
    if (!addProctorId) return;
    setAdding(true);
    try {
      await addProctorAvailability({
        proctorUserId: addProctorId,
        dayOfWeek: addDayOfWeek,
        startTime: addStartTime,
        endTime: addEndTime,
      });
      toast({ title: "Availability slot added" });
      queryClient.invalidateQueries({ queryKey: ["proctor-scheduling", "availability"] });
      setAddSlotOpen(false);
      setAddProctorId("");
      setAddDayOfWeek(1);
      setAddStartTime("09:00");
      setAddEndTime("17:00");
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSlot = async (slot: ProctorAvailabilitySlot) => {
    try {
      await deleteProctorAvailability(slot.id);
      toast({ title: "Slot removed" });
      queryClient.invalidateQueries({ queryKey: ["proctor-scheduling", "availability"] });
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    }
  };

  const availabilityByProctor = availability.reduce(
    (acc, s) => {
      const id = s.proctorUserId;
      if (!acc[id]) acc[id] = [];
      acc[id].push(s);
      return acc;
    },
    {} as Record<string, ProctorAvailabilitySlot[]>
  );

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Proctor scheduling</h1>
        <p className="text-muted-foreground">
          Manage proctor availability, view workload, and review queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Active proctor assignments and queue items per proctor.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proctor</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>In review</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workload.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center py-4">
                      No proctors.
                    </TableCell>
                  </TableRow>
                ) : (
                  workload.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{w.email}</div>
                      </TableCell>
                      <TableCell>{w.activeAssignments}</TableCell>
                      <TableCell>{w.inReviewQueue}</TableCell>
                      <TableCell>{w.totalWorkload}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Review queue
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/review-queue">View</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Attempts waiting for review.
            </p>
            <div className="flex gap-4">
              <div>
                <div className="text-2xl font-bold">{queueData?.summary?.pending ?? 0}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{queueData?.summary?.inReview ?? 0}</div>
                <div className="text-xs text-muted-foreground">In review</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Availability
            </CardTitle>
            <Button size="sm" onClick={() => setAddSlotOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Proctor availability slots by day and time.
            </p>
            {availability.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No availability slots. Add one to get started.
              </p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {Object.entries(availabilityByProctor).map(([proctorId, slots]) => {
                  const first = slots[0];
                  const name = first?.proctor?.name ?? proctorId;
                  return (
                    <div key={proctorId} className="space-y-1">
                      <div className="font-medium text-sm">{name}</div>
                      <div className="space-y-1">
                        {slots.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between text-sm text-muted-foreground"
                          >
                            <span>
                              {s.dayLabel} {s.startTime}–{s.endTime}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDeleteSlot(s)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All availability slots</CardTitle>
          <CardDescription>Full list of proctor availability slots.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proctor</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availability.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                    No availability slots.
                  </TableCell>
                </TableRow>
              ) : (
                availability.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.proctor?.name ?? s.proctorUserId}</TableCell>
                    <TableCell>{s.dayLabel}</TableCell>
                    <TableCell>
                      {s.startTime}–{s.endTime}
                    </TableCell>
                    <TableCell>{s.timezone}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSlot(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add availability slot</DialogTitle>
            <DialogDescription>
              Set when a proctor is available to monitor exams.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Proctor</Label>
              <Select value={addProctorId} onValueChange={setAddProctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select proctor" />
                </SelectTrigger>
                <SelectContent>
                  {proctors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day</Label>
              <Select
                value={String(addDayOfWeek)}
                onValueChange={(v) => setAddDayOfWeek(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={addStartTime}
                  onChange={(e) => setAddStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>End time</Label>
                <Input
                  type="time"
                  value={addEndTime}
                  onChange={(e) => setAddEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSlotOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSlot} disabled={adding || !addProctorId}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
