"use client";

import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Link2, RefreshCw, CheckCircle2, UserRound } from 'lucide-react';

interface JiraUser {
    accountId: string;
    displayName: string;
    email?: string;
}

export function JiraAccountMapping() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<JiraUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selected, setSelected] = useState<string>('');
    const [savedName, setSavedName] = useState<string>('');

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/jira/users');
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setUsers(json.users || []);
        } catch (e) {
            toast({ title: 'Could not load Jira users', description: (e as Error).message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Read the mapping already stored on the user doc.
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                const data = snap.data();
                if (data?.jiraAccountId) {
                    setSelected(data.jiraAccountId);
                    setSavedName(data.jiraDisplayName || '');
                }
            } catch { /* non-fatal */ }
        })();
    }, [user]);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    const save = async () => {
        if (!user || !selected) return;
        setSaving(true);
        try {
            const picked = users.find(u => u.accountId === selected);
            await setDoc(doc(db, 'users', user.uid), {
                jiraAccountId: selected,
                jiraDisplayName: picked?.displayName || '',
                jiraAccountEmail: picked?.email || '',
                updatedAt: new Date(),
            }, { merge: true });
            setSavedName(picked?.displayName || '');
            toast({ title: 'Jira account linked', description: picked?.displayName ? `Linked to ${picked.displayName}.` : 'Mapping saved.' });
        } catch (e) {
            toast({ title: 'Could not save mapping', description: (e as Error).message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const clear = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                jiraAccountId: '',
                jiraDisplayName: '',
                jiraAccountEmail: '',
                updatedAt: new Date(),
            }, { merge: true });
            setSelected('');
            setSavedName('');
            toast({ title: 'Jira account unlinked' });
        } catch (e) {
            toast({ title: 'Could not unlink', description: (e as Error).message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="rounded-3xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-primary" />
                        Jira Account
                    </p>
                    <p className="text-xs text-muted-foreground">Link your Jira user so worklogs map to you</p>
                </div>
                <Button variant="ghost" size="sm" onClick={loadUsers} disabled={loading} className="h-8 text-xs gap-1.5 rounded-xl">
                    <RefreshCw className={loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
                    Refresh
                </Button>
            </div>

            <CardContent className="p-6 space-y-4">
                {savedName && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Currently linked to <strong>{savedName}</strong>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UserRound className="w-3.5 h-3.5" />
                        Your Jira User
                    </label>
                    <div className="flex gap-2">
                        <Select value={selected || undefined} onValueChange={setSelected} disabled={loading}>
                            <SelectTrigger className="rounded-xl flex-1">
                                <SelectValue placeholder={loading ? 'Loading Jira users...' : 'Select your Jira account'} />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map(u => (
                                    <SelectItem key={u.accountId} value={u.accountId}>
                                        {u.displayName}{u.email ? ` — ${u.email}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={save} disabled={!selected || saving || loading} className="rounded-xl gap-1.5 shrink-0">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                            Link
                        </Button>
                        {savedName && (
                            <Button variant="ghost" onClick={clear} disabled={saving} className="rounded-xl text-muted-foreground shrink-0">
                                Unlink
                            </Button>
                        )}
                    </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Worklogs are written using the Zenit integration account; this mapping is used to
                    match your activity and highlight when your work hasn&apos;t been logged.
                </p>
            </CardContent>
        </Card>
    );
}
