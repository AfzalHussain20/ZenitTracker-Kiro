"use client";

/**
 * PUBLIC QR Scan Page — /scan/[deviceId]
 * NO LOGIN REQUIRED
 * 
 * Flow:
 * 1. Worker scans QR → lands here
 * 2. Sees device info + current status
 * 3. Selects their team → selects their name
 * 4. Taps "Take It" or "Return It"
 * 5. Logged in Zenit automatically
 * 
 * Teams + members fetched from Jira API
 * Device data from Firebase REST (no auth)
 * Last-used person remembered in localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    Smartphone, Tablet, Laptop, Tv, Box, Monitor,
    CheckCircle2, RefreshCw, Wrench, MapPin, Shield,
    Wifi, Zap, User, AlertTriangle, ArrowLeft,
    Package, Users, ChevronRight, ChevronLeft, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Device {
    id: string;
    name: string;
    type: string;
    status: 'available' | 'checked-out' | 'maintenance';
    location: string;
    os?: string;
    ram?: string;
    network?: string;
    condition?: string;
    notes?: string;
    checkedOutBy?: { name: string; accountId: string; team: string };
    checkedOutAt?: string;
    totalCheckouts?: number;
}

interface TeamMember {
    accountId: string;
    displayName: string;
    avatarUrl?: string;
}

interface JiraTeam {
    id: string;
    name: string;
    members: TeamMember[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ElementType> = {
    phone: Smartphone, tablet: Tablet, laptop: Laptop,
    tv: Tv, monitor: Monitor, other: Box,
};

const TYPE_GRADIENTS: Record<string, string> = {
    phone: 'from-blue-500 to-indigo-600',
    tablet: 'from-violet-500 to-purple-600',
    laptop: 'from-slate-500 to-gray-600',
    tv: 'from-rose-500 to-pink-600',
    monitor: 'from-teal-500 to-cyan-600',
    other: 'from-amber-500 to-orange-600',
};

const TEAM_COLORS = [
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
    'from-green-500 to-emerald-600',
    'from-red-500 to-rose-600',
];

function getOverdueInfo(checkedOutAt?: string) {
    if (!checkedOutAt) return { isOverdue: false, duration: '', hours: 0 };
    const hours = (Date.now() - new Date(checkedOutAt).getTime()) / 3_600_000;
    let duration = '';
    if (hours < 1) duration = `${Math.round(hours * 60)}m ago`;
    else if (hours < 24) duration = `${Math.round(hours)}h ago`;
    else duration = `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h ago`;
    return { isOverdue: hours > 8, duration, hours };
}

function getInitials(name: string) {
    return name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
];

function getAvatarColor(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ─── Step types ───────────────────────────────────────────────────────────────
type Step = 'device' | 'team' | 'member' | 'confirm' | 'done';

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PublicScanPage() {
    const params = useParams();
    const deviceId = params?.deviceId as string;

    // State
    const [device, setDevice] = useState<Device | null>(null);
    const [teams, setTeams] = useState<JiraTeam[]>([]);
    const [loadingDevice, setLoadingDevice] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [step, setStep] = useState<Step>('device');
    const [selectedTeam, setSelectedTeam] = useState<JiraTeam | null>(null);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [action, setAction] = useState<'checkout' | 'checkin'>('checkout');
    const [lastUsed, setLastUsed] = useState<{ teamId: string; accountId: string; name: string } | null>(null);

    // ── Load device ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!deviceId) { setNotFound(true); setLoadingDevice(false); return; }

        fetch(`/api/keepr/device/${deviceId}`)
            .then(r => r.json())
            .then(data => {
                if (data.device) {
                    setDevice(data.device);
                    setAction(data.device.status === 'checked-out' ? 'checkin' : 'checkout');
                } else {
                    setNotFound(true);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoadingDevice(false));
    }, [deviceId]);

    // ── Load Jira teams ──────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/jira/teams')
            .then(r => r.json())
            .then(async (data) => {
                if (data.teams?.length) {
                    setTeams(data.teams);
                } else {
                    // Fallback: build teams from Jira sync people array
                    try {
                        const syncRes = await fetch('/api/jira/sync?sprintId=266');
                        const syncData = await syncRes.json();
                        const people: any[] = syncData?.people ?? syncData?.data?.people ?? [];
                        if (people.length > 0) {
                            // Group by team field
                            const teamMap = new Map<string, TeamMember[]>();
                            for (const p of people) {
                                const teamName: string = p.team || 'Other';
                                if (!teamMap.has(teamName)) teamMap.set(teamName, []);
                                teamMap.get(teamName)!.push({
                                    accountId: p.accountId || p.id || p.displayName,
                                    displayName: p.displayName || p.name || p.accountId,
                                    avatarUrl: p.avatarUrl || p.avatarUrls?.['48x48'],
                                });
                            }
                            const fallbackTeams: JiraTeam[] = Array.from(teamMap.entries()).map(([name, members], i) => ({
                                id: `team_${i}`,
                                name,
                                members,
                            }));
                            if (fallbackTeams.length > 0) {
                                setTeams(fallbackTeams);
                            }
                        }
                    } catch { /* ignore fallback errors */ }
                }
            })
            .catch(() => {})
            .finally(() => setLoadingTeams(false));
    }, []);

    // ── Load last used person from localStorage ───────────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem('keepr_last_user');
            if (stored) setLastUsed(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);

    // ── Handle action ────────────────────────────────────────────────────────
    const handleAction = useCallback(async () => {
        if (!device || !selectedMember || !selectedTeam) return;
        setActionLoading(true);

        const now = new Date().toISOString();
        const update = action === 'checkout'
            ? {
                status: 'checked-out',
                checkedOutBy: {
                    name: selectedMember.displayName,
                    accountId: selectedMember.accountId,
                    team: selectedTeam.name,
                },
                checkedOutAt: now,
                totalCheckouts: (device.totalCheckouts ?? 0) + 1,
            }
            : {
                status: 'available',
                checkedOutBy: null,
                checkedOutAt: null,
                lastCheckedIn: now,
            };

        try {
            await fetch(`/api/keepr/device/${deviceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            });

            // Save last used to localStorage
            localStorage.setItem('keepr_last_user', JSON.stringify({
                teamId: selectedTeam.id,
                accountId: selectedMember.accountId,
                name: selectedMember.displayName,
            }));

            setDevice(prev => prev ? { ...prev, ...update } as Device : prev);
            setStep('done');
        } catch {
            // Still show done — optimistic
            setStep('done');
        } finally {
            setActionLoading(false);
        }
    }, [device, selectedMember, selectedTeam, action, deviceId]);

    // ── Quick re-use last person ──────────────────────────────────────────────
    const handleQuickUse = useCallback(() => {
        if (!lastUsed || !teams.length) return;
        const team = teams.find(t => t.id === lastUsed.teamId);
        const member = team?.members.find(m => m.accountId === lastUsed.accountId);
        if (team && member) {
            setSelectedTeam(team);
            setSelectedMember(member);
            setStep('confirm');
        }
    }, [lastUsed, teams]);

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loadingDevice) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center animate-pulse">
                        <Package className="w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-slate-400 text-sm">Loading device…</p>
                </div>
            </div>
        );
    }

    // ── Not found ────────────────────────────────────────────────────────────
    if (notFound || !device) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-white text-xl font-bold mb-2">Device Not Found</h2>
                    <p className="text-slate-400 text-sm mb-6">This QR code may be outdated.</p>
                    <Link href="/keepr">
                        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                            <ArrowLeft className="w-4 h-4 mr-2" />Go to Keepr
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const TypeIcon = TYPE_ICONS[device.type] ?? Box;
    const gradient = TYPE_GRADIENTS[device.type] ?? 'from-slate-500 to-slate-700';
    const overdueInfo = getOverdueInfo(device.checkedOutAt);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-start p-4 pt-8">
            <div className="w-full max-w-sm space-y-4">

                {/* ── Device Info Card (always visible) ── */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden"
                >
                    <div className={cn('bg-gradient-to-br p-5 flex items-center gap-4', gradient)}>
                        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shadow-lg flex-shrink-0">
                            <TypeIcon className="w-7 h-7 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-black text-white truncate">{device.name}</h1>
                            <div className="flex items-center gap-1.5 mt-0.5 text-white/70 text-xs">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{device.location}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {device.os && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-[10px] font-medium"><Shield className="w-2.5 h-2.5" />{device.os}</span>}
                                {device.ram && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-[10px] font-medium"><Zap className="w-2.5 h-2.5" />{device.ram}</span>}
                                {device.network && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-[10px] font-medium"><Wifi className="w-2.5 h-2.5" />{device.network}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Current status */}
                    <div className="px-4 py-3">
                        {device.status === 'available' && (
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-300 text-sm font-semibold">Available — Ready to take</span>
                            </div>
                        )}
                        {device.status === 'checked-out' && (
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-sky-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-sky-300 text-sm font-semibold">
                                        {device.checkedOutBy?.name ?? 'Someone'}
                                    </span>
                                    {device.checkedOutBy?.team && (
                                        <span className="text-sky-400/60 text-xs ml-1.5">· {device.checkedOutBy.team}</span>
                                    )}
                                    {overdueInfo.duration && (
                                        <div className={cn('text-xs mt-0.5', overdueInfo.isOverdue ? 'text-red-400' : 'text-sky-400/60')}>
                                            {overdueInfo.isOverdue && '⚠ Overdue · '}{overdueInfo.duration}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {device.status === 'maintenance' && (
                            <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-amber-400" />
                                <span className="text-amber-300 text-sm font-semibold">Under Maintenance</span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ── Step: Device — show action choice ── */}
                <AnimatePresence mode="wait">

                    {step === 'device' && device.status !== 'maintenance' && (
                        <motion.div
                            key="device-step"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                        >
                            {/* Quick re-use last person */}
                            {lastUsed && !loadingTeams && (
                                <button
                                    onClick={handleQuickUse}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all active:scale-95"
                                >
                                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0', getAvatarColor(lastUsed.name))}>
                                        {getInitials(lastUsed.name)}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-white font-semibold text-sm truncate">Continue as {lastUsed.name}</p>
                                        <p className="text-white/50 text-xs">Last used · tap to continue</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
                                </button>
                            )}

                            <button
                                onClick={() => setStep('team')}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-all active:scale-95"
                            >
                                <div className="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-5 h-5 text-blue-300" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-white font-semibold text-sm">
                                        {action === 'checkout' ? 'Take this device' : 'Return this device'}
                                    </p>
                                    <p className="text-white/50 text-xs">Select your team and name</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
                            </button>
                        </motion.div>
                    )}

                    {/* ── Step: Team selection ── */}
                    {step === 'team' && (
                        <motion.div
                            key="team-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-3"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <button onClick={() => setStep('device')} className="text-white/50 hover:text-white transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <p className="text-white/70 text-sm font-medium">Select your team</p>
                            </div>

                            {loadingTeams ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {[1,2,3,4].map(i => (
                                        <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : teams.length === 0 ? (
                                <div className="text-center py-8 text-white/40 text-sm">
                                    No teams found. Check Jira connection.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {teams.map((team, i) => (
                                        <button
                                            key={team.id}
                                            onClick={() => { setSelectedTeam(team); setStep('member'); }}
                                            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all active:scale-95"
                                        >
                                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', TEAM_COLORS[i % TEAM_COLORS.length])}>
                                                <Users className="w-5 h-5 text-white" />
                                            </div>
                                            <span className="text-white text-xs font-semibold text-center leading-tight line-clamp-2">{team.name}</span>
                                            <span className="text-white/40 text-[10px]">{team.members.length} members</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── Step: Member selection ── */}
                    {step === 'member' && selectedTeam && (
                        <motion.div
                            key="member-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-3"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <button onClick={() => setStep('team')} className="text-white/50 hover:text-white transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <p className="text-white/70 text-sm font-medium">Who are you?</p>
                                    <p className="text-white/40 text-xs">{selectedTeam.name}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {selectedTeam.members.map(member => (
                                    <button
                                        key={member.accountId}
                                        onClick={() => { setSelectedMember(member); setStep('confirm'); }}
                                        className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all active:scale-95"
                                    >
                                        {member.avatarUrl ? (
                                            <img
                                                src={member.avatarUrl}
                                                alt={member.displayName}
                                                className="w-12 h-12 rounded-xl object-cover"
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-black', getAvatarColor(member.displayName))}>
                                                {getInitials(member.displayName)}
                                            </div>
                                        )}
                                        <span className="text-white text-[10px] font-semibold text-center leading-tight line-clamp-2">
                                            {member.displayName.split(' ')[0]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Step: Confirm ── */}
                    {step === 'confirm' && selectedMember && selectedTeam && (
                        <motion.div
                            key="confirm-step"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <button onClick={() => setStep('member')} className="text-white/50 hover:text-white transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <p className="text-white/70 text-sm font-medium">Confirm</p>
                            </div>

                            {/* Who */}
                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 border border-white/20">
                                {selectedMember.avatarUrl ? (
                                    <img src={selectedMember.avatarUrl} alt={selectedMember.displayName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                                ) : (
                                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-black flex-shrink-0', getAvatarColor(selectedMember.displayName))}>
                                        {getInitials(selectedMember.displayName)}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-white font-bold text-base truncate">{selectedMember.displayName}</p>
                                    <p className="text-white/50 text-xs">{selectedTeam.name}</p>
                                </div>
                            </div>

                            {/* Action summary */}
                            <div className={cn(
                                'px-4 py-3 rounded-2xl border text-center',
                                action === 'checkout'
                                    ? 'bg-blue-500/20 border-blue-500/30'
                                    : 'bg-emerald-500/20 border-emerald-500/30'
                            )}>
                                <p className={cn('font-semibold text-sm', action === 'checkout' ? 'text-blue-300' : 'text-emerald-300')}>
                                    {action === 'checkout' ? `Taking "${device.name}"` : `Returning "${device.name}"`}
                                </p>
                                <p className="text-white/40 text-xs mt-0.5">
                                    {action === 'checkout' ? 'This will be logged under your name' : 'Device will be marked as available'}
                                </p>
                            </div>

                            {/* Confirm button */}
                            <Button
                                onClick={handleAction}
                                disabled={actionLoading}
                                className={cn(
                                    'w-full h-14 text-base font-bold rounded-2xl border-0 shadow-lg active:scale-95 transition-transform',
                                    action === 'checkout'
                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/30'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30'
                                )}
                            >
                                {actionLoading ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : action === 'checkout' ? (
                                    <><CheckCircle2 className="w-5 h-5 mr-2" />Confirm — Take Device</>
                                ) : (
                                    <><RefreshCw className="w-5 h-5 mr-2" />Confirm — Return Device</>
                                )}
                            </Button>
                        </motion.div>
                    )}

                    {/* ── Step: Done ── */}
                    {step === 'done' && (
                        <motion.div
                            key="done-step"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-4 py-6"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                                className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
                            >
                                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                            </motion.div>
                            <div className="text-center">
                                <p className="text-white text-xl font-black">
                                    {action === 'checkout' ? 'Enjoy!' : 'Thanks!'}
                                </p>
                                <p className="text-white/60 text-sm mt-1">
                                    {action === 'checkout'
                                        ? `${device.name} is now logged to ${selectedMember?.displayName}`
                                        : `${device.name} has been returned`}
                                </p>
                            </div>
                            <Link href="/keepr" className="text-white/40 text-xs hover:text-white/70 transition-colors mt-2">
                                View all devices →
                            </Link>
                        </motion.div>
                    )}

                </AnimatePresence>

                {/* Footer */}
                <p className="text-center text-white/20 text-xs pb-4">
                    Keepr · QA Device Tracker · Zenit
                </p>
            </div>
        </div>
    );
}
