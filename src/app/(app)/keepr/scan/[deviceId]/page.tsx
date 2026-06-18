"use client";

/**
 * QR Scan Checkout Page — /keepr/scan/[deviceId]
 * Mobile-optimized. Worker scans QR → sees device → one tap checkout/checkin.
 * No navigation, no searching, no friction.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, onSnapshot, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
    Smartphone, Tablet, Laptop, Tv, Box, Monitor,
    CheckCircle2, RefreshCw, Wrench, MapPin, Shield,
    Wifi, Zap, User, Clock, AlertTriangle, ArrowLeft,
    Package
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
    checkedOutBy?: { name: string; uid: string };
    checkedOutAt?: string;
    totalCheckouts?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function getOverdueInfo(checkedOutAt?: string) {
    if (!checkedOutAt) return { isOverdue: false, duration: '', hours: 0 };
    const hours = (Date.now() - new Date(checkedOutAt).getTime()) / 3_600_000;
    let duration = '';
    if (hours < 1) duration = `${Math.round(hours * 60)}m ago`;
    else if (hours < 24) duration = `${Math.round(hours)}h ago`;
    else duration = `${Math.floor(hours / 24)}d ago`;
    return { isOverdue: hours > 8, duration, hours };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ScanCheckoutPage() {
    const params = useParams();
    const deviceId = params?.deviceId as string;
    const { user } = useAuth();

    const [device, setDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionState, setActionState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [actionMessage, setActionMessage] = useState('');
    const [notFound, setNotFound] = useState(false);

    // ── Load device ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!deviceId) { setNotFound(true); setLoading(false); return; }

        // Try Firestore first
        if (db) {
            const unsub = onSnapshot(
                doc(db, 'keepr_devices', deviceId),
                (snap) => {
                    if (snap.exists()) {
                        setDevice({ id: snap.id, ...snap.data() } as Device);
                    } else {
                        setNotFound(true);
                    }
                    setLoading(false);
                },
                () => {
                    // Firestore failed — show not found
                    setNotFound(true);
                    setLoading(false);
                }
            );
            return () => unsub();
        } else {
            setNotFound(true);
            setLoading(false);
        }
    }, [deviceId]);

    // ── Checkout handler ─────────────────────────────────────────────────────
    async function handleCheckout() {
        if (!device || actionState === 'loading') return;
        setActionState('loading');

        const userName = user?.displayName ?? user?.email ?? 'Team Member';
        const uid = user?.uid ?? 'scan-user';
        const now = new Date().toISOString();

        const update = {
            status: 'checked-out' as const,
            checkedOutBy: { name: userName, uid },
            checkedOutAt: now,
            totalCheckouts: (device.totalCheckouts ?? 0) + 1,
        };

        // Update local state immediately
        setDevice(prev => prev ? { ...prev, ...update } : prev);

        // Sync to Firebase
        if (db) {
            try {
                await updateDoc(doc(db, 'keepr_devices', deviceId), update);
            } catch { /* ignore */ }
        }

        setActionState('success');
        setActionMessage(`Checked out to ${userName}`);
    }

    // ── Checkin handler ──────────────────────────────────────────────────────
    async function handleCheckin() {
        if (!device || actionState === 'loading') return;
        setActionState('loading');

        const update = {
            status: 'available' as const,
            checkedOutBy: null,
            checkedOutAt: null,
            lastCheckedIn: new Date().toISOString(),
        };

        setDevice(prev => prev ? { ...prev, status: 'available', checkedOutBy: undefined, checkedOutAt: undefined } : prev);

        if (db) {
            try {
                await updateDoc(doc(db, 'keepr_devices', deviceId), update);
            } catch { /* ignore */ }
        }

        setActionState('success');
        setActionMessage('Device returned successfully');
    }

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
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
                    <p className="text-slate-400 text-sm mb-6">This QR code may be outdated or the device was removed.</p>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-center p-6">
            {/* Back link */}
            <div className="w-full max-w-sm mb-4">
                <Link href="/keepr" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />Back to all devices
                </Link>
            </div>

            {/* Device card */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-sm"
            >
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className={cn('bg-gradient-to-br p-8 flex flex-col items-center text-center', gradient)}>
                        <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mb-4 shadow-lg">
                            <TypeIcon className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white">{device.name}</h1>
                        <div className="flex items-center gap-1.5 mt-2 text-white/70 text-sm">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{device.location}</span>
                        </div>
                    </div>

                    {/* Specs */}
                    <div className="p-5 space-y-3">
                        <div className="flex flex-wrap gap-2 justify-center">
                            {device.os && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                                    <Shield className="w-3 h-3" />{device.os}
                                </span>
                            )}
                            {device.ram && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                                    <Zap className="w-3 h-3" />{device.ram}
                                </span>
                            )}
                            {device.network && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                                    <Wifi className="w-3 h-3" />{device.network}
                                </span>
                            )}
                        </div>

                        {/* Current status */}
                        <div className={cn(
                            'rounded-2xl p-4 text-center',
                            device.status === 'available' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                            device.status === 'checked-out' ? 'bg-sky-500/20 border border-sky-500/30' :
                            'bg-amber-500/20 border border-amber-500/30'
                        )}>
                            {device.status === 'available' && (
                                <div className="flex items-center justify-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-emerald-300 font-semibold text-sm">Available — Ready to take</span>
                                </div>
                            )}
                            {device.status === 'checked-out' && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-center gap-2">
                                        <User className="w-4 h-4 text-sky-400" />
                                        <span className="text-sky-300 font-semibold text-sm">
                                            In use by {device.checkedOutBy?.name ?? 'someone'}
                                        </span>
                                    </div>
                                    {overdueInfo.duration && (
                                        <p className={cn('text-xs', overdueInfo.isOverdue ? 'text-red-400' : 'text-sky-400/70')}>
                                            {overdueInfo.isOverdue && '⚠ Overdue · '}{overdueInfo.duration}
                                        </p>
                                    )}
                                </div>
                            )}
                            {device.status === 'maintenance' && (
                                <div className="flex items-center justify-center gap-2">
                                    <Wrench className="w-4 h-4 text-amber-400" />
                                    <span className="text-amber-300 font-semibold text-sm">Under Maintenance</span>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {device.notes && (
                            <p className="text-white/50 text-xs text-center px-2">{device.notes}</p>
                        )}
                    </div>

                    {/* Action button */}
                    <div className="px-5 pb-6">
                        <AnimatePresence mode="wait">
                            {actionState === 'success' ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center gap-3 py-4"
                                >
                                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    </div>
                                    <p className="text-emerald-300 font-semibold text-center">{actionMessage}</p>
                                    <Link href="/keepr" className="text-white/50 text-xs hover:text-white/80 transition-colors">
                                        Back to all devices →
                                    </Link>
                                </motion.div>
                            ) : device.status === 'available' ? (
                                <motion.div key="checkout" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <Button
                                        onClick={handleCheckout}
                                        disabled={actionState === 'loading'}
                                        className="w-full h-14 text-base font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
                                    >
                                        {actionState === 'loading' ? (
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                                Take This Device
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-white/30 text-xs text-center mt-3">
                                        Logged as {user?.displayName ?? user?.email ?? 'you'}
                                    </p>
                                </motion.div>
                            ) : device.status === 'checked-out' ? (
                                <motion.div key="checkin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                                    <Button
                                        onClick={handleCheckin}
                                        disabled={actionState === 'loading'}
                                        className="w-full h-14 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                                    >
                                        {actionState === 'loading' ? (
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <RefreshCw className="w-5 h-5 mr-2" />
                                                Return This Device
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-white/30 text-xs text-center">
                                        Tap to mark as returned
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div key="maintenance" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <div className="w-full h-14 flex items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30">
                                        <Wrench className="w-5 h-5 text-amber-400 mr-2" />
                                        <span className="text-amber-300 font-semibold">Under Maintenance</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/20 text-xs mt-4">
                    Keepr · QA Device Tracker
                </p>
            </motion.div>
        </div>
    );
}
