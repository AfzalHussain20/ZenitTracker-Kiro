"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, getDocs, Timestamp, orderBy
} from 'firebase/firestore';
import type { Task, TaskPriority, TaskStatus, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Plus, ClipboardList, User, Calendar, Flag, Trash2,
  CheckCircle2, Clock, AlertCircle, XCircle, Loader2, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: any; cls: string; dot: string }> = {
  'Pending':     { label: 'Pending',     icon: Clock,         cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',   dot: 'bg-amber-500' },
  'In Progress': { label: 'In Progress', icon: AlertCircle,   cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',       dot: 'bg-blue-500' },
  'Done':        { label: 'Done',        icon: CheckCircle2,  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' },
  'Blocked':     { label: 'Blocked',     icon: XCircle,       cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',           dot: 'bg-red-500' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { cls: string }> = {
  'High':   { cls: 'text-red-600 dark:text-red-400' },
  'Medium': { cls: 'text-amber-600 dark:text-amber-400' },
  'Low':    { cls: 'text-muted-foreground' },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border', c.cls)}>
      <Icon className="w-3 h-3" />{c.label}
    </span>
  );
}

export default function TasksPage() {
  const { user, userRole, displayName } = useAuth();
  const { toast } = useToast();
  const isLead = userRole === 'lead';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [testers, setTesters] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assignedToUid, setAssignedToUid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Load testers (lead only)
  useEffect(() => {
    if (!isLead || !user) return;
    getDocs(collection(db, 'users')).then(snap => {
      setTesters(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });
  }, [isLead, user]);

  // Live tasks listener
  useEffect(() => {
    if (!user) return;
    const q = isLead
      ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'tasks'), where('assignedToUid', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
        } as Task;
      }));
      setIsLoading(false);
    }, () => setIsLoading(false));

    return () => unsub();
  }, [user, isLead]);

  const handleCreate = async () => {
    if (!title.trim() || !assignedToUid) return;
    const tester = testers.find(t => t.uid === assignedToUid);
    if (!tester) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'Pending' as TaskStatus,
        assignedToUid,
        assignedToName: tester.displayName,
        assignedByUid: user!.uid,
        assignedByName: displayName,
        dueDate: dueDate || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      toast({ title: 'Task assigned', description: `Assigned to ${tester.displayName}` });
      setCreateOpen(false);
      setTitle(''); setDescription(''); setPriority('Medium'); setAssignedToUid(''); setDueDate('');
    } catch {
      toast({ title: 'Error', description: 'Failed to create task.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status, updatedAt: Timestamp.now() });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      toast({ title: 'Task deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    }
  };

  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  const grouped: Record<string, Task[]> = {
    'Pending': filtered.filter(t => t.status === 'Pending'),
    'In Progress': filtered.filter(t => t.status === 'In Progress'),
    'Blocked': filtered.filter(t => t.status === 'Blocked'),
    'Done': filtered.filter(t => t.status === 'Done'),
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            {isLead ? 'Task Management' : 'My Tasks'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLead ? 'Assign and track tasks across your team' : 'Tasks assigned to you by your lead'}
          </p>
        </div>
        {isLead && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" />
            Assign Task
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'Pending', 'In Progress', 'Blocked', 'Done'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn('text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors',
              filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
            {s === 'all' ? 'All' : s}
            {s !== 'all' && <span className="ml-1.5 opacity-60">{tasks.filter(t => t.status === s).length}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tasks yet{isLead ? '. Assign one to get started.' : '.'}</p>
        </div>
      ) : (
        /* Kanban-style columns */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(Object.entries(grouped) as [TaskStatus, Task[]][]).map(([status, items]) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <div key={status} className="flex flex-col gap-2">
                {/* Column header */}
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', cfg.cls)}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{cfg.label}</span>
                  <span className="ml-auto text-xs font-bold opacity-60">{items.length}</span>
                </div>

                {/* Cards */}
                <AnimatePresence>
                  {items.map(task => (
                    <motion.div key={task.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-card border border-border rounded-2xl p-4 space-y-3 hover:shadow-md transition-shadow">

                      {/* Title + priority */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground leading-snug flex-1">{task.title}</p>
                        <Flag className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', PRIORITY_CONFIG[task.priority].cls)} />
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>
                      )}

                      {/* Meta */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{isLead ? task.assignedToName : `From: ${task.assignedByName}`}</span>
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>Due {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>

                      {/* Status selector */}
                      <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v as TaskStatus)}>
                        <SelectTrigger className="h-7 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(s => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Lead actions */}
                      {isLead && (
                        <button onClick={() => handleDelete(task.id)}
                          className="flex items-center gap-1.5 text-[11px] text-destructive/70 hover:text-destructive transition-colors">
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {items.length === 0 && (
                  <div className="border border-dashed border-border rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted-foreground/50">Empty</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Dialog (lead only) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign New Task</DialogTitle>
            <DialogDescription>Create a task and assign it to a tester on your team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="e.g. Test login flow on Android TV" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Additional context or instructions..." value={description} onChange={e => setDescription(e.target.value)} className="resize-none h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign To *</Label>
              <Select value={assignedToUid} onValueChange={setAssignedToUid}>
                <SelectTrigger><SelectValue placeholder="Select tester..." /></SelectTrigger>
                <SelectContent>
                  {testers.map(t => (
                    <SelectItem key={t.uid} value={t.uid}>
                      {t.displayName} {t.role === 'lead' ? '(Lead)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim() || !assignedToUid || saving} onClick={handleCreate}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
