"use client";

import { useEffect, useId, useState } from 'react';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Timer, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logWork } from '@/hooks/useWorklogs';

export interface IssueOption {
    key: string;
    summary?: string;
}

interface LogWorkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called after a worklog is successfully created. */
    onLogged?: () => void;
    /** Pre-fill the issue key (e.g. when opened from an issue row). */
    defaultIssueKey?: string;
    /** When opened for a specific person, their name is embedded in the comment. */
    loggedForName?: string;
    /** Optional issue list to power the key suggestions datalist. */
    issues?: IssueOption[];
}

const todayInput = () => new Date().toISOString().slice(0, 10);

export function LogWorkDialog({
    open, onOpenChange, onLogged, defaultIssueKey = '', loggedForName = '', issues,
}: LogWorkDialogProps) {
    const { toast } = useToast();
    const [issueKey, setIssueKey] = useState(defaultIssueKey);
    const [hours, setHours] = useState('1');
    const [date, setDate] = useState(todayInput());
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    // Reset fields each time the dialog opens.
    useEffect(() => {
        if (open) {
            setIssueKey(defaultIssueKey);
            setHours('1');
            setDate(todayInput());
            setComment('');
            setSaving(false);
        }
    }, [open, defaultIssueKey]);

    const hoursNum = Number(hours);
    const valid = /^[A-Z][A-Z0-9_]*-\d+$/i.test(issueKey.trim())
        && Number.isFinite(hoursNum) && hoursNum > 0 && hoursNum <= 24 * 30;

    const listId = useId();

    const submit = async () => {
        if (!valid) return;
        setSaving(true);
        try {
            const started = date ? new Date(`${date}T09:00:00`).toISOString() : undefined;
            const result = await logWork({
                issueKey: issueKey.trim().toUpperCase(),
                timeSpentSeconds: Math.round(hoursNum * 3600),
                comment: comment.trim() || undefined,
                started,
                loggedForName: loggedForName || undefined,
            });
            toast({
                title: 'Worklog added',
                description: `Logged ${hours}h on ${result.issueKey}${loggedForName ? ` for ${loggedForName}` : ''}.`,
            });
            onLogged?.();
            onOpenChange(false);
        } catch (e) {
            toast({
                title: 'Could not log work',
                description: (e as Error).message,
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-primary" />
                        Log Work
                    </DialogTitle>
                    <DialogDescription>
                        {loggedForName
                            ? `Record time for ${loggedForName} on a Jira issue.`
                            : 'Record time on a Jira issue.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="lw-issue" className="text-xs font-semibold">Issue key</Label>
                        <Input
                            id="lw-issue"
                            list={issues && issues.length ? listId : undefined}
                            value={issueKey}
                            onChange={e => setIssueKey(e.target.value)}
                            placeholder="SUN-123"
                            className="rounded-xl"
                            autoComplete="off"
                        />
                        {issues && issues.length > 0 && (
                            <datalist id={listId}>
                                {issues.slice(0, 500).map(i => (
                                    <option key={i.key} value={i.key}>{i.summary || i.key}</option>
                                ))}
                            </datalist>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="lw-hours" className="text-xs font-semibold">Hours</Label>
                            <Input
                                id="lw-hours"
                                type="number"
                                min="0.1"
                                step="0.25"
                                value={hours}
                                onChange={e => setHours(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="lw-date" className="text-xs font-semibold">Date</Label>
                            <Input
                                id="lw-date"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="lw-comment" className="text-xs font-semibold">Comment (optional)</Label>
                        <Textarea
                            id="lw-comment"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="What did you work on?"
                            rows={3}
                            className="rounded-xl resize-none"
                        />
                    </div>

                    <div className="flex items-start gap-2 rounded-xl bg-muted/50 border border-border px-3 py-2">
                        <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Worklogs are recorded by the Zenit integration account.
                            {loggedForName && <> The name <strong>{loggedForName}</strong> is added to the comment.</>}
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={!valid || saving} className="gap-1.5">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />}
                        Log Work
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
