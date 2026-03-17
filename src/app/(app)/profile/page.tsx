"use client";

import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, User, Save, Pencil, X, Shield, Calendar, CheckCircle2, Zap } from 'lucide-react';
import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: 'easeOut' },
});

export default function ProfilePage() {
  const { user, loading, userRole } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSave = async () => {
    if (!user || !displayName.trim()) return;
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      toast({ title: 'Profile updated', description: 'Your display name has been saved.' });
      setIsEditing(false);
    } catch {
      toast({ title: 'Update failed', description: 'Could not update profile.', variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => {
    setDisplayName(user?.displayName || '');
    setIsEditing(false);
  };

  if (loading) return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );

  if (!user) return null;

  const joinedDate = user.metadata.creationTime
    ? format(new Date(user.metadata.creationTime), 'MMMM yyyy')
    : null;

  const isLead = userRole === 'lead';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

      {/* Page title */}
      <motion.div {...fadeUp(0)}>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account details</p>
      </motion.div>

      {/* Hero card */}
      <motion.div {...fadeUp(0.05)}
        className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8">
        {/* Subtle gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <Avatar className="w-24 h-24 rounded-2xl">
                  <AvatarImage src={user.photoURL} className="rounded-2xl" />
                  <AvatarFallback className="text-2xl font-bold rounded-2xl">{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-3xl font-extrabold text-primary">{getInitials(user.displayName)}</span>
              )}
            </div>
            {/* Online dot */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card" />
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">{user.displayName || 'User'}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border',
                isLead
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              )}>
                <Shield className="w-3 h-3" />
                {isLead ? 'Team Lead' : 'Tester'}
              </span>
              {joinedDate && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Joined {joinedDate}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account details card */}
      <motion.div {...fadeUp(0.1)} className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="text-sm font-bold text-foreground">Account Information</p>
            <p className="text-xs text-muted-foreground">Update your personal details</p>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="rounded-xl gap-1.5 h-8 text-xs">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleCancel} className="rounded-xl gap-1.5 h-8 text-xs text-muted-foreground">
              <X className="w-3.5 h-3.5" />
              Cancel
            </Button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Email Address
            </Label>
            <div className="relative">
              <Input value={user.email || ''} disabled
                className="bg-muted/50 border-border text-muted-foreground pr-24 rounded-xl" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground/50 bg-muted px-2 py-0.5 rounded-md">
                Read only
              </span>
            </div>
          </div>

          {/* Display name field */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Display Name
            </Label>
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                disabled={!isEditing}
                placeholder="Your name"
                className={cn('rounded-xl flex-1', !isEditing ? 'bg-muted/50 border-border text-muted-foreground' : 'border-primary/40 focus:border-primary')}
              />
              {isEditing && (
                <Button onClick={handleSave}
                  disabled={isSaving || !displayName.trim() || displayName === user.displayName}
                  className="rounded-xl gap-1.5 shrink-0">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account stats */}
      <motion.div {...fadeUp(0.15)} className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { icon: Zap, label: 'Account Status', value: 'Active', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { icon: Shield, label: 'Role', value: isLead ? 'Team Lead' : 'Tester', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
          { icon: CheckCircle2, label: 'Auth Provider', value: user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.label} {...fadeUp(0.15 + i * 0.05)}
              className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
              <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', item.bg)}>
                <Icon className={cn('w-4 h-4', item.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                <p className="text-sm font-bold text-foreground truncate">{item.value}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* UID (for devs) */}
      <motion.div {...fadeUp(0.2)} className="rounded-2xl border border-border bg-muted/30 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">User ID</p>
        <p className="text-xs font-mono text-muted-foreground break-all">{user.uid}</p>
      </motion.div>
    </div>
  );
}
