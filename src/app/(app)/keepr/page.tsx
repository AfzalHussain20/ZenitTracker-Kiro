"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, onSnapshot, updateDoc, doc, setDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Lazy-load QR code to avoid SSR issues
const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })), { ssr: false });
import {
    Smartphone, Tablet, Laptop, Tv, Box, Search, Plus, ArrowLeft,
    CheckCircle2, Clock, Wrench, AlertTriangle, Shield, Activity,
    MapPin, User, Calendar, X, Wifi, Battery,
    Monitor, Package, Filter, LayoutGrid, List, Star, Zap,
    TrendingUp, BarChart3, RefreshCw, Info, Edit3,
    ClipboardCheck, Crown, Users, History, Bell, Tag, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCATIONS = [
    "QA Team Device Rack", "Raja Sekar Rack", "API Team",
    "Android Team", "Sun Direct Team", "iOS Team", "Others"
];

const DEVICE_TYPES = [
    { value: 'phone',   label: 'Phone',   icon: Smartphone, gradient: 'from-blue-500 to-indigo-600' },
    { value: 'tablet',  label: 'Tablet',  icon: Tablet,     gradient: 'from-violet-500 to-purple-600' },
    { value: 'laptop',  label: 'Laptop',  icon: Laptop,     gradient: 'from-slate-500 to-gray-600' },
    { value: 'tv',      label: 'TV / STB',icon: Tv,         gradient: 'from-rose-500 to-pink-600' },
    { value: 'monitor', label: 'Monitor', icon: Monitor,    gradient: 'from-teal-500 to-cyan-600' },
    { value: 'other',   label: 'Other',   icon: Box,        gradient: 'from-amber-500 to-orange-600' },
];

const OS_OPTIONS = [
    'Android 14','Android 13','Android 12','Android 11','Android 10',
    'iOS 17','iOS 16','iOS 15','tvOS 17','Fire OS 8','Windows 11','macOS','Other'
];

const CONDITION_OPTIONS = [
    { value: 'excellent', label: 'Excellent',    color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { value: 'good',      label: 'Good',         color: 'text-blue-600 dark:text-blue-400',       dot: 'bg-blue-500',    bg: 'bg-blue-500/10 border-blue-500/20' },
    { value: 'fair',      label: 'Fair',         color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500',   bg: 'bg-amber-500/10 border-amber-500/20' },
    { value: 'poor',      label: 'Needs Repair', color: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500',     bg: 'bg-red-500/10 border-red-500/20' },
];

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
    serialNumber?: string;
    lastCheckedIn?: string;
}

interface AddDeviceForm {
    name: string;
    type: string;
    location: string;
    os: string;
    ram: string;
    network: string;
    condition: string;
    notes: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED_DEVICES: Omit<Device, 'id'>[] = [
    { name: 'Oppo A78',             type: 'phone',  status: 'available',   location: 'QA Team Device Rack', os: 'Android 13', ram: '8GB', network: '4G',  condition: 'good',      totalCheckouts: 12 },
    { name: 'Moto g31',             type: 'phone',  status: 'available',   location: 'QA Team Device Rack', os: 'Android 11', ram: '4GB', network: '4G',  condition: 'fair',      totalCheckouts: 8  },
    { name: 'Galaxy M32 5G',        type: 'phone',  status: 'checked-out', location: 'QA Team Device Rack', os: 'Android 13', ram: '6GB', network: '5G',  condition: 'excellent', totalCheckouts: 21,
      checkedOutBy: { name: 'Saranya', uid: 'system' }, checkedOutAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { name: 'Redmi Tab Pad',        type: 'tablet', status: 'available',   location: 'QA Team Device Rack', os: 'Android 13', ram: '4GB', network: 'WiFi',condition: 'good',      totalCheckouts: 5  },
    { name: 'Fire TV 4K Stick',     type: 'tv',     status: 'available',   location: 'QA Team Device Rack', os: 'Fire OS 8',              network: 'WiFi',condition: 'excellent', totalCheckouts: 3  },
    { name: 'iPhone 14',            type: 'phone',  status: 'available',   location: 'iOS Team',            os: 'iOS 17',     ram: '6GB', network: '5G',  condition: 'excellent', totalCheckouts: 17 },
    { name: 'iPad Air 5',           type: 'tablet', status: 'maintenance', location: 'iOS Team',            os: 'iOS 17',     ram: '8GB', network: 'WiFi',condition: 'poor',      totalCheckouts: 9,
      notes: 'Screen crack — sent for repair' },
    { name: 'Samsung Galaxy Tab S8',type: 'tablet', status: 'available',   location: 'Android Team',        os: 'Android 14', ram: '8GB', network: '5G',  condition: 'excellent', totalCheckouts: 14 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTypeConfig(type: string) {
    return DEVICE_TYPES.find(t => t.value === type) ?? DEVICE_TYPES[DEVICE_TYPES.length - 1];
}

function getStatusConfig(status: string) {
    switch (status) {
        case 'available':   return { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', label: 'Available',   pulse: true  };
        case 'checked-out': return { dot: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-400',         bg: 'bg-sky-500/10 border border-sky-500/20',         label: 'In Use',      pulse: false };
        case 'maintenance': return { dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-500/10 border border-amber-500/20',     label: 'Maintenance', pulse: false };
        default:            return { dot: 'bg-slate-400',   text: 'text-slate-600',                         bg: 'bg-slate-500/10 border border-slate-500/20',     label: status,        pulse: false };
    }
}

function getConditionConfig(condition?: string) {
    return CONDITION_OPTIONS.find(c => c.value === condition) ?? CONDITION_OPTIONS[1];
}

function getOverdueInfo(checkedOutAt?: string) {
    if (!checkedOutAt) return { isOverdue: false, isCritical: false, duration: '', hours: 0 };
    const hours = (Date.now() - new Date(checkedOutAt).getTime()) / 3_600_000;
    const isOverdue  = hours > 8;
    const isCritical = hours > 24;
    let duration = '';
    if (hours < 1)       duration = `${Math.round(hours * 60)}m ago`;
    else if (hours < 24) duration = `${Math.round(hours)}h ago`;
    else                 duration = `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h ago`;
    return { isOverdue, isCritical, duration, hours };
}

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.92 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } } };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <motion.div variants={fadeUp} className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border', color)}>
            <span className="tabular-nums">{value}</span>
            <span className="opacity-80">{label}</span>
        </motion.div>
    );
}

function StatCard({ icon: Icon, label, value, sub, gradient, delay = 0 }: {
    icon: React.ElementType; label: string; value: number; sub?: string; gradient: string; delay?: number;
}) {
    return (
        <motion.div variants={fadeUp} transition={{ delay }} whileHover={{ y: -2, transition: { duration: 0.2 } }}>
            <Card className="relative overflow-hidden border-0 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                <div className={cn('absolute inset-0 opacity-[0.04] bg-gradient-to-br', gradient)} />
                <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm flex-shrink-0', gradient)}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{value}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{label}</p>
                        {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function UtilizationBar({ available, inUse, maintenance, total }: { available: number; inUse: number; maintenance: number; total: number }) {
    if (total === 0) return null;
    const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
    return (
        <motion.div variants={fadeUp} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fleet Utilization</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{total} devices total</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {available > 0   && <motion.div initial={{ width: 0 }} animate={{ width: pct(available) }}   transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }} className="bg-emerald-500 rounded-l-full" title={`Available: ${available}`} />}
                {inUse > 0       && <motion.div initial={{ width: 0 }} animate={{ width: pct(inUse) }}       transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }} className="bg-sky-500"                  title={`In Use: ${inUse}`} />}
                {maintenance > 0 && <motion.div initial={{ width: 0 }} animate={{ width: pct(maintenance) }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }} className="bg-amber-500 rounded-r-full" title={`Maintenance: ${maintenance}`} />}
            </div>
            <div className="flex items-center gap-4 mt-3">
                {[
                    { color: 'bg-emerald-500', label: 'Available',    count: available   },
                    { color: 'bg-sky-500',     label: 'In Use',       count: inUse       },
                    { color: 'bg-amber-500',   label: 'Maintenance',  count: maintenance },
                ].map(({ color, label, count }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', color)} />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{label} <span className="font-semibold text-slate-700 dark:text-slate-300">{count}</span></span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── Device Card ──────────────────────────────────────────────────────────────
function DeviceCard({ device, currentUser, onCheckout, onCheckin, onOpenDetail, onShowQR }: {
    device: Device;
    currentUser: { name: string; uid: string } | null;
    onCheckout: (device: Device) => void;
    onCheckin:  (device: Device) => void;
    onOpenDetail: (device: Device) => void;
    onShowQR: (device: Device) => void;
}) {
    const typeConfig      = getTypeConfig(device.type);
    const statusConfig    = getStatusConfig(device.status);
    const conditionConfig = getConditionConfig(device.condition);
    const overdueInfo     = getOverdueInfo(device.checkedOutAt);
    const TypeIcon        = typeConfig.icon;

    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.015, transition: { duration: 0.18 } }}
            className="group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-sm hover:shadow-lg hover:border-slate-300/80 dark:hover:border-slate-600/80 transition-all duration-200 overflow-hidden flex flex-col"
        >
            {/* Overdue warning stripe */}
            {overdueInfo.isOverdue && (
                <div className={cn('h-0.5 w-full', overdueInfo.isCritical ? 'bg-red-500' : 'bg-amber-500')} />
            )}

            <div className="p-5 flex flex-col gap-3 flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm flex-shrink-0', typeConfig.gradient)}>
                            <TypeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <button
                                onClick={() => onOpenDetail(device)}
                                className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left leading-tight truncate block max-w-[160px]"
                            >
                                {device.name}
                            </button>
                            <div className="flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{device.location}</span>
                            </div>
                        </div>
                    </div>
                    {/* Status badge */}
                    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0', statusConfig.bg, statusConfig.text)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusConfig.dot, statusConfig.pulse && 'animate-pulse')} />
                        {statusConfig.label}
                    </div>
                </div>

                {/* Spec badges */}
                <div className="flex flex-wrap gap-1.5">
                    {device.os && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <Shield className="w-2.5 h-2.5" />{device.os}
                        </span>
                    )}
                    {device.ram && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <Zap className="w-2.5 h-2.5" />{device.ram}
                        </span>
                    )}
                    {device.network && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <Wifi className="w-2.5 h-2.5" />{device.network}
                        </span>
                    )}
                </div>

                {/* Condition */}
                {device.condition && (
                    <div className={cn('inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[11px] font-semibold border', conditionConfig.bg, conditionConfig.color)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', conditionConfig.dot)} />
                        {conditionConfig.label}
                    </div>
                )}

                {/* Checked out info */}
                {device.status === 'checked-out' && device.checkedOutBy && (
                    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs', overdueInfo.isOverdue ? 'bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40' : 'bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40')}>
                        <User className={cn('w-3.5 h-3.5 flex-shrink-0', overdueInfo.isOverdue ? 'text-red-500' : 'text-sky-500')} />
                        <span className={cn('font-medium truncate', overdueInfo.isOverdue ? 'text-red-700 dark:text-red-400' : 'text-sky-700 dark:text-sky-400')}>
                            {device.checkedOutBy.name}
                        </span>
                        {overdueInfo.duration && (
                            <span className={cn('ml-auto flex-shrink-0 font-semibold', overdueInfo.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400')}>
                                {overdueInfo.isOverdue && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                                {overdueInfo.duration}
                            </span>
                        )}
                    </div>
                )}

                {/* Maintenance note */}
                {device.status === 'maintenance' && device.notes && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
                        <Wrench className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{device.notes}</span>
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action buttons */}
                <div className="pt-1 flex gap-2">
                    <div className="flex-1">
                        {device.status === 'available' && (
                            <Button
                                size="sm"
                                onClick={() => onCheckout(device)}
                                className="w-full h-8 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-sm"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Check Out
                            </Button>
                        )}
                        {device.status === 'checked-out' && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onCheckin(device)}
                                className="w-full h-8 text-xs font-semibold border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                            >
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Check In
                            </Button>
                        )}
                        {device.status === 'maintenance' && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onCheckin(device)}
                                className="w-full h-8 text-xs font-semibold border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Mark Available
                            </Button>
                        )}
                    </div>
                    {/* QR Code button */}
                    <button
                        onClick={() => onShowQR(device)}
                        title="Show QR code"
                        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                            <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                        </svg>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Device List Row ──────────────────────────────────────────────────────────
function DeviceListRow({ device, currentUser, onCheckout, onCheckin, onOpenDetail, onShowQR }: {
    device: Device;
    currentUser: { name: string; uid: string } | null;
    onCheckout: (device: Device) => void;
    onCheckin:  (device: Device) => void;
    onOpenDetail: (device: Device) => void;
    onShowQR: (device: Device) => void;
}) {
    const typeConfig      = getTypeConfig(device.type);
    const statusConfig    = getStatusConfig(device.status);
    const conditionConfig = getConditionConfig(device.condition);
    const overdueInfo     = getOverdueInfo(device.checkedOutAt);
    const TypeIcon        = typeConfig.icon;

    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ x: 2, transition: { duration: 0.15 } }}
            className="group flex items-center gap-4 px-5 py-3.5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl border border-slate-200/70 dark:border-slate-700/60 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-600/80 transition-all duration-200"
        >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm flex-shrink-0', typeConfig.gradient)}>
                <TypeIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4">
                <div className="min-w-0">
                    <button onClick={() => onOpenDetail(device)} className="text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left truncate block">
                        {device.name}
                    </button>
                    <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-[11px] text-slate-400 truncate">{device.location}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {device.os && <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{device.os}</span>}
                    {device.ram && <span className="text-[11px] text-slate-400">·</span>}
                    {device.ram && <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{device.ram}</span>}
                </div>
                <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0', conditionConfig.bg, conditionConfig.color)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', conditionConfig.dot)} />
                    {conditionConfig.label}
                </div>
                <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0', statusConfig.bg, statusConfig.text)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot, statusConfig.pulse && 'animate-pulse')} />
                    {statusConfig.label}
                    {device.status === 'checked-out' && device.checkedOutBy && (
                        <span className="opacity-70">· {device.checkedOutBy.name}</span>
                    )}
                    {overdueInfo.isOverdue && <AlertTriangle className="w-3 h-3 text-red-500 ml-0.5" />}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    {device.status === 'available' && (
                        <Button size="sm" onClick={() => onCheckout(device)} className="h-7 text-xs px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0">
                            Check Out
                        </Button>
                    )}
                    {device.status === 'checked-out' && (
                        <Button size="sm" variant="outline" onClick={() => onCheckin(device)} className="h-7 text-xs px-3 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400">
                            Check In
                        </Button>
                    )}
                    {device.status === 'maintenance' && (
                        <Button size="sm" variant="outline" onClick={() => onCheckin(device)} className="h-7 text-xs px-3 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                            Available
                        </Button>
                    )}
                    {/* QR button */}
                    <button
                        onClick={() => onShowQR(device)}
                        title="Show QR code"
                        className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex-shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                            <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                        </svg>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Add Device Dialog ────────────────────────────────────────────────────────
function AddDeviceDialog({ open, onClose, onAdd }: {
    open: boolean;
    onClose: () => void;
    onAdd: (form: AddDeviceForm) => Promise<void>;
}) {
    const [form, setForm] = useState<AddDeviceForm>({
        name: '', type: 'phone', location: LOCATIONS[0], os: '', ram: '', network: '', condition: 'good', notes: ''
    });
    const [saving, setSaving] = useState(false);

    const set = (key: keyof AddDeviceForm) => (val: string) => setForm(f => ({ ...f, [key]: val }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try { await onAdd(form); onClose(); setForm({ name: '', type: 'phone', location: LOCATIONS[0], os: '', ram: '', network: '', condition: 'good', notes: '' }); }
        finally { setSaving(false); }
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-white" />
                        </div>
                        Add New Device
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Register a new device to the QA fleet.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Device Name *</Label>
                            <Input value={form.name} onChange={e => set('name')(e.target.value)} placeholder="e.g. Samsung Galaxy S24" required className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Type</Label>
                            <Select value={form.type} onValueChange={set('type')}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Location</Label>
                            <Select value={form.location} onValueChange={set('location')}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">OS</Label>
                            <Select value={form.os} onValueChange={set('os')}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select OS" /></SelectTrigger>
                                <SelectContent>{OS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Condition</Label>
                            <Select value={form.condition} onValueChange={set('condition')}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{CONDITION_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">RAM</Label>
                            <Input value={form.ram} onChange={e => set('ram')(e.target.value)} placeholder="e.g. 8GB" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Network</Label>
                            <Input value={form.network} onChange={e => set('network')(e.target.value)} placeholder="e.g. 5G / WiFi" className="h-9 text-sm" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notes</Label>
                            <Textarea value={form.notes} onChange={e => set('notes')(e.target.value)} placeholder="Any additional notes..." rows={2} className="text-sm resize-none" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
                        <Button type="submit" disabled={saving || !form.name.trim()} className="h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0">
                            {saving ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                            {saving ? 'Adding…' : 'Add Device'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Device Detail Modal ──────────────────────────────────────────────────────
function DeviceDetailModal({ device, onClose, onCheckout, onCheckin }: {
    device: Device | null;
    onClose: () => void;
    onCheckout: (device: Device) => void;
    onCheckin:  (device: Device) => void;
}) {
    if (!device) return null;
    const typeConfig      = getTypeConfig(device.type);
    const statusConfig    = getStatusConfig(device.status);
    const conditionConfig = getConditionConfig(device.condition);
    const overdueInfo     = getOverdueInfo(device.checkedOutAt);
    const TypeIcon        = typeConfig.icon;

    return (
        <Dialog open={!!device} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 p-0 overflow-hidden">
                {/* Header gradient */}
                <div className={cn('h-1.5 w-full bg-gradient-to-r', typeConfig.gradient)} />
                <div className="p-6">
                    <DialogHeader className="mb-4">
                        <div className="flex items-start gap-4">
                            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-md flex-shrink-0', typeConfig.gradient)}>
                                <TypeIcon className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{device.name}</DialogTitle>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-sm text-slate-500 dark:text-slate-400">{device.location}</span>
                                </div>
                                <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-2', statusConfig.bg, statusConfig.text)}>
                                    <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot, statusConfig.pulse && 'animate-pulse')} />
                                    {statusConfig.label}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Specs grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {[
                            { icon: Shield,   label: 'OS',        value: device.os },
                            { icon: Zap,      label: 'RAM',       value: device.ram },
                            { icon: Wifi,     label: 'Network',   value: device.network },
                            { icon: Tag,      label: 'Type',      value: getTypeConfig(device.type).label },
                            { icon: Star,     label: 'Condition', value: conditionConfig.label },
                            { icon: Activity, label: 'Checkouts', value: device.totalCheckouts != null ? `${device.totalCheckouts} times` : undefined },
                        ].filter(s => s.value).map(({ icon: Icon, label, value }) => (
                            <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                                <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Checked out info */}
                    {device.status === 'checked-out' && device.checkedOutBy && (
                        <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border', overdueInfo.isOverdue ? 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/40' : 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/60 dark:border-sky-800/40')}>
                            <User className={cn('w-4 h-4 flex-shrink-0', overdueInfo.isOverdue ? 'text-red-500' : 'text-sky-500')} />
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-xs font-semibold', overdueInfo.isOverdue ? 'text-red-700 dark:text-red-400' : 'text-sky-700 dark:text-sky-400')}>
                                    Checked out by {device.checkedOutBy.name}
                                </p>
                                {overdueInfo.duration && (
                                    <p className={cn('text-[11px]', overdueInfo.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400')}>
                                        {overdueInfo.isOverdue && '⚠ Overdue · '}{overdueInfo.duration}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {device.notes && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 mb-4">
                            <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">{device.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">Close</Button>
                        {device.status === 'available' && (
                            <Button onClick={() => { onCheckout(device); onClose(); }} className="flex-1 h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Check Out
                            </Button>
                        )}
                        {(device.status === 'checked-out' || device.status === 'maintenance') && (
                            <Button variant="outline" onClick={() => { onCheckin(device); onClose(); }} className="flex-1 h-9 text-sm border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                {device.status === 'maintenance' ? 'Mark Available' : 'Check In'}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KeeprPage() {
    const { user } = useAuth();
    const [devices, setDevices]           = useState<Device[]>([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter]     = useState<string>('all');
    const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid');
    const [showAdd, setShowAdd]           = useState(false);
    const [detailDevice, setDetailDevice] = useState<Device | null>(null);
    const [qrDevice, setQrDevice]         = useState<Device | null>(null);

    // ── Firestore listener with local-first approach + API polling ──────────
    useEffect(() => {
        // Always start with seed data immediately
        const localDevices = SEED_DEVICES.map((d, i) => ({ ...d, id: `device_${i + 1}` }));
        setDevices(localDevices);
        setLoading(false);

        // Poll the API every 5 seconds to pick up QR scan changes
        // This ensures web page stays in sync when someone scans a QR code
        const pollApi = async () => {
            try {
                const res = await fetch('/api/keepr/device/device_1', { cache: 'no-store' });
                // If API responds, fetch all devices
                if (res.ok) {
                    const allIds = ['device_1','device_2','device_3','device_4','device_5','device_6','device_7','device_8'];
                    const results = await Promise.all(
                        allIds.map(id => fetch(`/api/keepr/device/${id}`, { cache: 'no-store' })
                            .then(r => r.ok ? r.json() : null)
                            .catch(() => null))
                    );
                    const fetched = results
                        .filter(Boolean)
                        .map((r: any) => r.device)
                        .filter(Boolean);
                    if (fetched.length > 0) {
                        setDevices(fetched);
                    }
                }
            } catch { /* ignore */ }
        };

        // Initial poll
        pollApi();

        // Poll every 5 seconds for real-time sync
        const interval = setInterval(pollApi, 5000);

        // Also try Firebase client SDK for real-time updates
        if (db) {
            try {
                const q = query(collection(db, 'keepr_devices'));
                const unsub = onSnapshot(q, (snap) => {
                    if (!snap.empty) {
                        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Device));
                        setDevices(docs);
                    }
                }, () => { /* ignore firebase errors */ });
                return () => { clearInterval(interval); unsub(); };
            } catch { /* ignore */ }
        }

        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers — write through API (Firebase Admin) + update local state ──
    const handleCheckout = useCallback(async (device: Device) => {
        const userName = user?.displayName ?? user?.email ?? 'You';
        const uid = user?.uid ?? 'local';
        const now = new Date().toISOString();
        const update: Partial<Device> = {
            status: 'checked-out',
            checkedOutBy: { name: userName, uid },
            checkedOutAt: now,
            totalCheckouts: (device.totalCheckouts ?? 0) + 1,
        };
        // Update local state immediately for instant UI feedback
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, ...update } : d));
        // Write through API (uses Firebase Admin SDK — bypasses security rules)
        try {
            await fetch(`/api/keepr/device/${device.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            });
        } catch { /* local state already updated */ }
    }, [user]);

    const handleCheckin = useCallback(async (device: Device) => {
        const update = {
            status: 'available' as const,
            checkedOutBy: null,
            checkedOutAt: null,
            lastCheckedIn: new Date().toISOString(),
        };
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'available', checkedOutBy: undefined, checkedOutAt: undefined } : d));
        try {
            await fetch(`/api/keepr/device/${device.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            });
        } catch { /* local state already updated */ }
    }, []);

    const handleSetMaintenance = useCallback(async (device: Device, notes?: string) => {
        const update = { status: 'maintenance' as const, checkedOutBy: null, checkedOutAt: null, notes: notes || device.notes };
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, ...update, checkedOutBy: undefined, checkedOutAt: undefined } : d));
        try {
            await fetch(`/api/keepr/device/${device.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            });
        } catch { /* ignore */ }
    }, []);

    const handleAddDevice = useCallback(async (form: AddDeviceForm) => {
        const newId = `device_${Date.now()}`;
        const newDevice: Device = {
            id: newId, name: form.name.trim(), type: form.type, status: 'available',
            location: form.location, os: form.os || undefined, ram: form.ram || undefined,
            network: form.network || undefined, condition: form.condition,
            notes: form.notes || undefined, totalCheckouts: 0,
        };
        setDevices(prev => [...prev, newDevice]);
        try {
            await fetch(`/api/keepr/device/${newId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDevice),
            });
        } catch { /* ignore */ }
    }, []);

    const handleDeleteDevice = useCallback(async (deviceId: string) => {
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        if (db) {
            try {
                const { deleteDoc } = await import('firebase/firestore');
                await deleteDoc(doc(db, 'keepr_devices', deviceId));
            } catch { /* ignore */ }
        }
    }, []);

    // ── Derived stats ────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total:       devices.length,
        available:   devices.filter(d => d.status === 'available').length,
        inUse:       devices.filter(d => d.status === 'checked-out').length,
        maintenance: devices.filter(d => d.status === 'maintenance').length,
    }), [devices]);

    const overdueDevices = useMemo(() =>
        devices.filter(d => d.status === 'checked-out' && getOverdueInfo(d.checkedOutAt).isCritical),
    [devices]);

    // ── Filtered devices ─────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return devices.filter(d => {
            if (statusFilter !== 'all') {
                if (statusFilter === 'available'   && d.status !== 'available')   return false;
                if (statusFilter === 'checked-out' && d.status !== 'checked-out') return false;
                if (statusFilter === 'maintenance' && d.status !== 'maintenance') return false;
            }
            if (typeFilter !== 'all' && d.type !== typeFilter) return false;
            if (q && !d.name.toLowerCase().includes(q) && !d.location.toLowerCase().includes(q) && !(d.os ?? '').toLowerCase().includes(q)) return false;
            return true;
        });
    }, [devices, search, statusFilter, typeFilter]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">

            {/* ── Overdue Alert Banner ─────────────────────────────────────── */}
            <AnimatePresence>
                {overdueDevices.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-amber-500 text-white px-6 py-2.5 flex items-center gap-3 text-sm font-medium">
                            <Bell className="w-4 h-4 flex-shrink-0 animate-pulse" />
                            <span>
                                <strong>{overdueDevices.length} device{overdueDevices.length > 1 ? 's' : ''}</strong> overdue for check-in (24h+):&nbsp;
                                {overdueDevices.map(d => d.name).join(', ')}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Hero Header ──────────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 border-b border-white/10">
                {/* Background decoration */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-blue-600/5 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-7xl mx-auto px-6 py-8">
                    {/* Back button */}
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                        <Link href="/dashboard">
                            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 mb-5 -ml-2 h-8 text-xs gap-1.5">
                                <ArrowLeft className="w-3.5 h-3.5" />Back to Dashboard
                            </Button>
                        </Link>
                    </motion.div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight">Keepr</h1>
                            </div>
                            <p className="text-blue-200/80 text-sm font-medium">QA Device Fleet Management</p>
                        </motion.div>

                        {/* Live stat pills */}
                        <motion.div
                            variants={stagger}
                            initial="hidden"
                            animate="show"
                            className="flex flex-wrap gap-2"
                        >
                            <StatPill label="Total"       value={stats.total}       color="bg-white/10 border-white/20 text-white" />
                            <StatPill label="Available"   value={stats.available}   color="bg-emerald-500/20 border-emerald-400/30 text-emerald-300" />
                            <StatPill label="In Use"      value={stats.inUse}       color="bg-sky-500/20 border-sky-400/30 text-sky-300" />
                            <StatPill label="Maintenance" value={stats.maintenance} color="bg-amber-500/20 border-amber-400/30 text-amber-300" />
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

                {/* ── Stats row ──────────────────────────────────────────── */}
                <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Package}      label="Total Devices"  value={stats.total}       gradient="from-slate-500 to-slate-700"    sub={`${stats.available} ready`} />
                    <StatCard icon={CheckCircle2} label="Available"      value={stats.available}   gradient="from-emerald-500 to-teal-600"   sub="Ready to check out" delay={0.05} />
                    <StatCard icon={Clock}        label="In Use"         value={stats.inUse}       gradient="from-sky-500 to-blue-600"       sub="Currently checked out" delay={0.1} />
                    <StatCard icon={Wrench}       label="Maintenance"    value={stats.maintenance} gradient="from-amber-500 to-orange-600"   sub="Under repair" delay={0.15} />
                </motion.div>

                {/* ── Utilization bar ─────────────────────────────────────── */}
                <motion.div variants={stagger} initial="hidden" animate="show">
                    <UtilizationBar available={stats.available} inUse={stats.inUse} maintenance={stats.maintenance} total={stats.total} />
                </motion.div>

                {/* ── Filter bar ──────────────────────────────────────────── */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    {/* Search */}
                    <div className="relative flex-1 min-w-0 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search devices…"
                            className="pl-9 h-9 text-sm bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Status filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 text-sm w-36 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700">
                            <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="checked-out">In Use</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Type filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[{ value: 'all', label: 'All' }, ...DEVICE_TYPES.map(t => ({ value: t.value, label: t.label }))].map(t => (
                            <button
                                key={t.value}
                                onClick={() => setTypeFilter(t.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border',
                                    typeFilter === t.value
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* View toggle */}
                    <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                        <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                            <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                            <List className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Add device */}
                    <Button onClick={() => setShowAdd(true)} size="sm" className="h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-sm gap-1.5">
                        <Plus className="w-4 h-4" />Add Device
                    </Button>
                </motion.div>

                {/* ── Device Grid / List ───────────────────────────────────── */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-52 rounded-2xl bg-white/60 dark:bg-slate-900/60 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <Package className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-semibold">No devices found</p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Try adjusting your filters or search query</p>
                        <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }} className="mt-4 text-xs">
                            Clear filters
                        </Button>
                    </motion.div>
                ) : viewMode === 'grid' ? (
                    <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {filtered.map(device => (
                            <DeviceCard
                                key={device.id}
                                device={device}
                                currentUser={null}
                                onCheckout={handleCheckout}
                                onCheckin={handleCheckin}
                                onOpenDetail={setDetailDevice}
                                onShowQR={setQrDevice}
                            />
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        className="flex flex-col gap-2"
                    >
                        {filtered.map(device => (
                            <DeviceListRow
                                key={device.id}
                                device={device}
                                currentUser={null}
                                onCheckout={handleCheckout}
                                onCheckin={handleCheckin}
                                onOpenDetail={setDetailDevice}
                                onShowQR={setQrDevice}
                            />
                        ))}
                    </motion.div>
                )}

                {/* Results count */}
                {!loading && filtered.length > 0 && (
                    <motion.p variants={fadeUp} initial="hidden" animate="show" className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
                        Showing {filtered.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
                    </motion.p>
                )}
            </div>

            {/* ── Dialogs ──────────────────────────────────────────────────── */}
            <AddDeviceDialog
                open={showAdd}
                onClose={() => setShowAdd(false)}
                onAdd={handleAddDevice}
            />

            <DeviceDetailModal
                device={detailDevice}
                onClose={() => setDetailDevice(null)}
                onCheckout={handleCheckout}
                onCheckin={handleCheckin}
            />

            {/* ── QR Code Modal ────────────────────────────────────────────── */}
            <Dialog open={!!qrDevice} onOpenChange={v => !v && setQrDevice(null)}>
                <DialogContent className="max-w-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 p-0 overflow-hidden">
                    {qrDevice && (()=>{
                        const typeConfig = getTypeConfig(qrDevice.type);
                        const TypeIcon = typeConfig.icon;
                        const scanUrl = typeof window !== 'undefined'
                            ? `${window.location.protocol}//${window.location.host}/scan/${qrDevice.id}`
                            : `/scan/${qrDevice.id}`;
                        return (
                            <div>
                                <div className={cn('bg-gradient-to-br p-5 flex items-center gap-3', typeConfig.gradient)}>
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                        <TypeIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <DialogTitle className="text-white font-bold text-base truncate">{qrDevice.name}</DialogTitle>
                                        <p className="text-white/70 text-xs truncate">{qrDevice.location}</p>
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col items-center gap-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 text-center font-medium">
                                        Scan this QR code with your phone to check out or return this device
                                    </p>
                                    {/* QR Code */}
                                    <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-100">
                                        <QRCodeSVG
                                            value={scanUrl}
                                            size={200}
                                            level="M"
                                            includeMargin={false}
                                            bgColor="#ffffff"
                                            fgColor="#0f172a"
                                        />
                                    </div>
                                    {/* URL display */}
                                    <div className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-400 font-medium mb-0.5">Scan URL</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-mono break-all">{scanUrl}</p>
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-9 text-sm"
                                            onClick={() => setQrDevice(null)}
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            className="flex-1 h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0"
                                            onClick={() => window.open(scanUrl, '_blank')}
                                        >
                                            Open Page
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
