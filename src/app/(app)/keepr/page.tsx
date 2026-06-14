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
    "Android Team", "Sun Direct Team", "iOS Team", "PM Desk", "Satish Team", "Others"
];

const DEVICE_TYPES = [
    { value: 'phone',     label: 'Phone',       icon: Smartphone, gradient: 'from-blue-500 to-indigo-600' },
    { value: 'tablet',    label: 'Tablet',       icon: Tablet,     gradient: 'from-violet-500 to-purple-600' },
    { value: 'laptop',    label: 'Laptop / Mac', icon: Laptop,     gradient: 'from-slate-500 to-gray-600' },
    { value: 'tv',        label: 'TV / STB',     icon: Tv,         gradient: 'from-rose-500 to-pink-600' },
    { value: 'monitor',   label: 'Monitor',      icon: Monitor,    gradient: 'from-teal-500 to-cyan-600' },
    { value: 'accessory', label: 'Accessory',    icon: Package,    gradient: 'from-amber-500 to-yellow-500' },
    { value: 'other',     label: 'Other',        icon: Box,        gradient: 'from-amber-500 to-orange-600' },
];

const OS_OPTIONS = [
    'Android 14','Android 13','Android 12','Android 11','Android 10',
    'iOS 17','iOS 16','iOS 15','tvOS 17','Fire OS 8','Windows 11','macOS','Other'
];

const ACCESSORY_TYPES = [
    'Lightning cable', 'Type-C cable', 'Type-B cable',
    'HDMI cable', 'Power cable', 'Charger adaptor',
    'USB-A to USB-C', 'Display Port cable', 'Remote control', 'Other',
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
    status: 'available' | 'checked-out' | 'maintenance' | 'missing';
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
    // Accessory fields
    quantity?: number;          // how many exist (e.g. 3 chargers)
    quantityAvailable?: number; // how many are currently available
    linkedDeviceId?: string;    // which device this accessory belongs to
    accessoryType?: string;     // 'Lightning cable' | 'Type-C cable' | 'Type-B cable' | 'Charger adaptor' | 'Other'
    assignedTo?: string;        // person name for permanently assigned devices
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
    // ── QA Team ──
    { name: 'Oppo A78',             type: 'phone',  status: 'available',   location: 'QA Team Device Rack', os: 'Android 13', ram: '8GB', network: '4G',  condition: 'good',      totalCheckouts: 12 },
    { name: 'Moto g31',             type: 'phone',  status: 'available',   location: 'QA Team Device Rack', os: 'Android 11', ram: '4GB', network: '4G',  condition: 'fair',      totalCheckouts: 8  },
    { name: 'Galaxy M32 5G',        type: 'phone',  status: 'available',   location: 'QA Team Device Rack', os: 'Android 13', ram: '6GB', network: '5G',  condition: 'excellent', totalCheckouts: 21 },
    { name: 'Redmi Tab Pad',        type: 'tablet', status: 'available',   location: 'QA Team Device Rack', os: 'Android 13', ram: '4GB', network: 'WiFi',condition: 'good',      totalCheckouts: 5  },
    { name: 'Fire TV 4K Stick',     type: 'tv',     status: 'available',   location: 'QA Team Device Rack', os: 'Fire OS 8',              network: 'WiFi',condition: 'excellent', totalCheckouts: 3  },
    // ── iOS Team ──
    { name: 'iPhone 12',            type: 'phone',  status: 'available',   location: 'iOS Team', os: 'iOS 15', network: '5G',  condition: 'good',      assignedTo: 'QA', notes: 'Assigned to QA team', totalCheckouts: 0 },
    { name: 'iPhone XR',            type: 'phone',  status: 'checked-out', location: 'iOS Team', os: 'iOS 16', network: '4G',  condition: 'good',      assignedTo: 'Prasanth', checkedOutBy: { name: 'Prasanth', uid: 'prasanth' }, totalCheckouts: 0 },
    { name: 'iPhone 8',             type: 'phone',  status: 'available',   location: 'iOS Team', os: 'iOS 15', network: '4G',  condition: 'fair',      assignedTo: 'QA', notes: 'Assigned to QA team', totalCheckouts: 0 },
    { name: 'iPhone 14 Pro',        type: 'phone',  status: 'checked-out', location: 'iOS Team', os: 'iOS 17', network: '5G',  condition: 'excellent', assignedTo: 'Mahendran', checkedOutBy: { name: 'Mahendran', uid: 'mahendran' }, totalCheckouts: 0 },
    { name: 'iPad Mini',            type: 'tablet', status: 'available',   location: 'API Team', os: 'iOS 16', network: 'WiFi',condition: 'good',      notes: 'Assigned to API Team', totalCheckouts: 0 },
    { name: 'iPhone 14',            type: 'phone',  status: 'available',   location: 'iOS Team', os: 'iOS 17', ram: '6GB', network: '5G', condition: 'excellent', totalCheckouts: 17 },
    { name: 'iPad Air 5',           type: 'tablet', status: 'maintenance', location: 'iOS Team', os: 'iOS 17', ram: '8GB', network: 'WiFi', condition: 'poor', totalCheckouts: 9, notes: 'Screen crack — sent for repair' },
    // ── iOS Team TVs / Boxes ──
    { name: 'Apple TV 4K Box',      type: 'tv',     status: 'checked-out', location: 'iOS Team', os: 'tvOS 17', network: 'WiFi', condition: 'good', assignedTo: 'Seeman', checkedOutBy: { name: 'Seeman', uid: 'seeman' }, notes: 'With Seeman', totalCheckouts: 0 },
    { name: 'HD Box',               type: 'tv',     status: 'checked-out', location: 'Sun Direct Team', network: 'WiFi', condition: 'good', assignedTo: 'Prasanth', checkedOutBy: { name: 'Prasanth', uid: 'prasanth' }, notes: 'Prasanth place', totalCheckouts: 0 },
    // ── iOS Team Laptops ──
    { name: 'MacBook Pro (Elayaraja)',  type: 'laptop', status: 'checked-out', location: 'iOS Team', os: 'macOS', ram: '16GB', condition: 'good', assignedTo: 'Elayaraja', checkedOutBy: { name: 'Elayaraja', uid: 'elayaraja' }, totalCheckouts: 0 },
    { name: 'MacBook Pro (Seeman)',     type: 'laptop', status: 'checked-out', location: 'iOS Team', os: 'macOS', ram: '16GB', condition: 'good', assignedTo: 'Seeman',    checkedOutBy: { name: 'Seeman', uid: 'seeman' }, totalCheckouts: 0 },
    { name: 'MacBook Pro (Prasanth)',   type: 'laptop', status: 'checked-out', location: 'iOS Team', os: 'macOS', ram: '16GB', condition: 'good', assignedTo: 'Prasanth',  checkedOutBy: { name: 'Prasanth', uid: 'prasanth' }, totalCheckouts: 0 },
    { name: 'MacBook Pro (Mahendran)', type: 'laptop', status: 'checked-out', location: 'iOS Team', os: 'macOS', ram: '16GB', condition: 'good', assignedTo: 'Mahendran', checkedOutBy: { name: 'Mahendran', uid: 'mahendran' }, totalCheckouts: 0 },
    { name: 'MacBook Pro (Vignesh)',   type: 'laptop', status: 'checked-out', location: 'PM Desk',  os: 'macOS', ram: '16GB', condition: 'good', assignedTo: 'Vignesh (PM)', checkedOutBy: { name: 'Vignesh', uid: 'vignesh' }, notes: 'PM MacBook', totalCheckouts: 0 },
    // ── Android Team ──
    { name: 'Samsung Galaxy Tab S8', type: 'tablet', status: 'available', location: 'Android Team', os: 'Android 14', ram: '8GB', network: '5G', condition: 'excellent', totalCheckouts: 14 },
    { name: 'Realme 11 Pro',          type: 'phone',  status: 'available', location: 'Android Team', os: 'Android 14', ram: '8GB', network: '5G', condition: 'excellent', totalCheckouts: 0 },
    { name: 'Samsung Galaxy S21 FE 5G', type: 'phone', status: 'available', location: 'Android Team', os: 'Android 13', ram: '8GB', network: '5G', condition: 'good', totalCheckouts: 0 },
    { name: 'Samsung Galaxy Z Fold 5', type: 'phone',  status: 'available', location: 'Android Team', os: 'Android 14', ram: '12GB', network: '5G', condition: 'excellent', totalCheckouts: 0, notes: 'Foldable — handle with care' },
    { name: 'Oppo A78 5G (Android)',   type: 'phone',  status: 'available', location: 'Android Team', os: 'Android 13', ram: '8GB', network: '5G', condition: 'good', totalCheckouts: 0 },
    { name: 'Fire Stick 4K Max',       type: 'tv',     status: 'available', location: 'Android Team', os: 'Fire OS 8', network: 'WiFi', condition: 'excellent', totalCheckouts: 0 },
    { name: 'JIO STB',                 type: 'tv',     status: 'available', location: 'Android Team', network: 'WiFi', condition: 'good', totalCheckouts: 0 },
    // ── Accessories ──
    { name: 'Device Charger',   type: 'accessory', status: 'available', location: 'QA Team Device Rack', accessoryType: 'Charger adaptor', quantity: 3, quantityAvailable: 3, condition: 'good',    notes: '3 device chargers in rack' },
    { name: 'Lightning Cable',  type: 'accessory', status: 'available', location: 'iOS Team',            accessoryType: 'Lightning cable',  quantity: 2, quantityAvailable: 1, condition: 'fair',    notes: '1 missing — track with iPhone XR' },
    { name: 'Type-C Cable',     type: 'accessory', status: 'missing',   location: 'iOS Team',            accessoryType: 'Type-C cable',     quantity: 3, quantityAvailable: 0, condition: 'unknown', notes: 'All 3 cables missing — last seen iOS team area' },
    { name: 'Type-B Cable',     type: 'accessory', status: 'missing',   location: 'QA Team Device Rack', accessoryType: 'Type-B cable',     quantity: 2, quantityAvailable: 0, condition: 'unknown', notes: '2 Type-B cables missing' },
    { name: 'Charger Adaptor',  type: 'accessory', status: 'available', location: 'iOS Team',            accessoryType: 'Charger adaptor',  quantity: 4, quantityAvailable: 2, condition: 'good',    notes: '2 with devices, 2 in rack' },
    // ── TV Accessories ──
    { name: 'HDMI Cable (Apple TV)', type: 'accessory', status: 'available', location: 'iOS Team',         accessoryType: 'HDMI cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'Apple TV 4K Box',  notes: 'HDMI for Apple TV 4K — with Seeman' },
    { name: 'HDMI Cable (HD Box)',   type: 'accessory', status: 'available', location: 'Sun Direct Team',  accessoryType: 'HDMI cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'HD Box',           notes: 'HDMI for HD Box — Prasanth place' },
    { name: 'HDMI Cable (QA Rack)',  type: 'accessory', status: 'missing',   location: 'QA Team Device Rack', accessoryType: 'HDMI cable', quantity: 2, quantityAvailable: 0, condition: 'unknown', notes: '2 HDMI cables missing from QA rack' },
    { name: 'Power Cable (Apple TV)', type: 'accessory', status: 'available', location: 'iOS Team',        accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'Apple TV 4K Box',  notes: 'Power cable for Apple TV — with Seeman' },
    { name: 'Power Cable (HD Box)',   type: 'accessory', status: 'available', location: 'Sun Direct Team', accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'HD Box',           notes: 'Power cable for HD Box — Prasanth place' },
    { name: 'Power Cable (Fire TV)',  type: 'accessory', status: 'available', location: 'QA Team Device Rack', accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good', linkedDeviceId: 'Fire TV 4K Stick', notes: 'Micro-USB power for Fire TV Stick' },
    // ── Android Team TV Accessories ──
    { name: 'HDMI Cable (Fire Stick 4K Max)', type: 'accessory', status: 'available', location: 'Android Team', accessoryType: 'HDMI cable', quantity: 1, quantityAvailable: 1, condition: 'good', linkedDeviceId: 'Fire Stick 4K Max', notes: 'HDMI for Fire Stick 4K Max' },
    { name: 'Power Cable (Fire Stick 4K Max)', type: 'accessory', status: 'available', location: 'Android Team', accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good', linkedDeviceId: 'Fire Stick 4K Max', notes: 'USB power for Fire Stick 4K Max' },
    { name: 'HDMI Cable (JIO STB)', type: 'accessory', status: 'available', location: 'Android Team', accessoryType: 'HDMI cable', quantity: 1, quantityAvailable: 1, condition: 'good', linkedDeviceId: 'JIO STB', notes: 'HDMI for JIO STB' },
    { name: 'Power Cable (JIO STB)', type: 'accessory', status: 'available', location: 'Android Team', accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good', linkedDeviceId: 'JIO STB', notes: 'Power adaptor for JIO STB' },
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
        case 'missing':     return { dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-400',         bg: 'bg-red-500/10 border border-red-500/20',         label: 'Missing',     pulse: true  };
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

// ─── History Panel ────────────────────────────────────────────────────────────
interface HistoryRecord {
    id: string;
    sessionId: string;
    deviceId: string;
    deviceName: string;
    deviceType: string;
    action: 'checkout' | 'checkin';
    userName: string;
    accountId: string;
    team: string;
    checkedOutAt: string | null;
    checkedInAt: string | null;
    durationHours: number | null;
    timestamp: any;
}

interface HistoryStats {
    totalSessions: number;
    avgDurationHours: number;
    topUser: string | null;
    topDevice: string | null;
}

function formatDuration(hours: number | null): string {
    if (hours == null) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function HistoryPanel({ devices }: { devices: Device[] }) {
    const [records, setRecords]   = useState<HistoryRecord[]>([]);
    const [stats, setStats]       = useState<HistoryStats | null>(null);
    const [loading, setLoading]   = useState(false);
    const [filterDevice, setFilterDevice] = useState<string>('all');
    const [filterTeam, setFilterTeam]     = useState<string>('all');
    const [filterFrom, setFilterFrom]     = useState<string>('');
    const [filterTo, setFilterTo]         = useState<string>('');
    const [viewMode, setViewMode]         = useState<'timeline' | 'table'>('timeline');

    // Derive unique teams from records
    const teams = useMemo(() => {
        const t = new Set(records.map(r => r.team).filter(Boolean));
        return Array.from(t).sort();
    }, [records]);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterDevice !== 'all') params.set('deviceId', filterDevice);
        if (filterTeam   !== 'all') params.set('team', filterTeam);
        if (filterFrom)             params.set('from', filterFrom);
        if (filterTo)               params.set('to', filterTo);
        params.set('limit', '200');

        try {
            const res  = await fetch(`/api/keepr/history?${params.toString()}`);
            const data = await res.json();
            setRecords(data.records ?? []);
            setStats(data.stats ?? null);
        } catch {
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, [filterDevice, filterTeam, filterFrom, filterTo]);

    // Auto-fetch on mount and filter change
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // ── Per-device usage summary ─────────────────────────────────────────────
    const deviceSummary = useMemo(() => {
        const map: Record<string, { name: string; sessions: number; totalHours: number; lastUser: string; lastDate: string }> = {};
        for (const r of records) {
            if (!map[r.deviceId]) map[r.deviceId] = { name: r.deviceName, sessions: 0, totalHours: 0, lastUser: '', lastDate: '' };
            map[r.deviceId].sessions++;
            map[r.deviceId].totalHours += r.durationHours ?? 0;
            if (!map[r.deviceId].lastDate || (r.checkedOutAt ?? '') > map[r.deviceId].lastDate) {
                map[r.deviceId].lastDate = r.checkedOutAt ?? '';
                map[r.deviceId].lastUser = r.userName;
            }
        }
        return Object.values(map).sort((a, b) => b.sessions - a.sessions);
    }, [records]);

    // ── Per-person usage summary ─────────────────────────────────────────────
    const personSummary = useMemo(() => {
        const map: Record<string, {
            name: string; team: string; sessions: number; totalHours: number;
            deviceNames: Set<string>;   // actual device names used
            deviceCheckouts: Record<string, number>; // device → checkout count
        }> = {};
        for (const r of records) {
            const key = r.accountId || r.userName;
            if (!map[key]) map[key] = { name: r.userName, team: r.team, sessions: 0, totalHours: 0, deviceNames: new Set(), deviceCheckouts: {} };
            map[key].sessions++;
            map[key].totalHours += r.durationHours ?? 0;
            if (r.deviceName) {
                map[key].deviceNames.add(r.deviceName);
                map[key].deviceCheckouts[r.deviceName] = (map[key].deviceCheckouts[r.deviceName] ?? 0) + 1;
            }
        }
        return Object.values(map)
            .map(p => ({
                ...p,
                deviceCount: p.deviceNames.size,
                // Top device this person used most
                topDevice: Object.entries(p.deviceCheckouts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
                // All device names sorted by usage
                deviceList: Object.entries(p.deviceCheckouts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
            }))
            .sort((a, b) => b.sessions - a.sessions);
    }, [records]);

    return (
        <div className="space-y-6">
            {/* ── Stats row ── */}
            {stats && (
                <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={History}      label="Total Sessions"   value={stats.totalSessions}   gradient="from-blue-500 to-indigo-600" />
                    <StatCard icon={Clock}        label="Avg Duration"     value={parseFloat(stats.avgDurationHours.toFixed(1))} gradient="from-violet-500 to-purple-600" sub={`${stats.avgDurationHours.toFixed(1)}h avg`} />
                    <StatCard icon={Crown}        label="Top User"         value={0} gradient="from-amber-500 to-orange-600" sub={stats.topUser ?? '—'} />
                    <StatCard icon={TrendingUp}   label="Most Used Device" value={0} gradient="from-emerald-500 to-teal-600" sub={stats.topDevice ?? '—'} />
                </motion.div>
            )}

            {/* ── Filters ── */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap gap-3 items-center">
                {/* Device filter */}
                <Select value={filterDevice} onValueChange={setFilterDevice}>
                    <SelectTrigger className="h-9 text-sm w-44 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700">
                        <Package className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <SelectValue placeholder="All Devices" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Devices</SelectItem>
                        {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                {/* Team filter */}
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                    <SelectTrigger className="h-9 text-sm w-40 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700">
                        <Users className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <SelectValue placeholder="All Teams" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>

                {/* Date range */}
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={e => setFilterFrom(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                        type="date"
                        value={filterTo}
                        onChange={e => setFilterTo(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300"
                    />
                </div>

                {/* Clear */}
                {(filterDevice !== 'all' || filterTeam !== 'all' || filterFrom || filterTo) && (
                    <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-500" onClick={() => { setFilterDevice('all'); setFilterTeam('all'); setFilterFrom(''); setFilterTo(''); }}>
                        <X className="w-3.5 h-3.5 mr-1" />Clear
                    </Button>
                )}

                <div className="flex-1" />

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                    <button onClick={() => setViewMode('timeline')} className={cn('px-3 py-1 rounded-md text-xs font-semibold transition-all', viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                        Timeline
                    </button>
                    <button onClick={() => setViewMode('table')} className={cn('px-3 py-1 rounded-md text-xs font-semibold transition-all', viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                        Table
                    </button>
                </div>

                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading} className="h-9 text-xs gap-1.5">
                    <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Refresh
                </Button>
            </motion.div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-500">Loading history…</p>
                </div>
            ) : records.length === 0 ? (
                <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-semibold">No history yet</p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                        History is recorded automatically when devices are checked out or returned.
                    </p>
                </motion.div>
            ) : viewMode === 'timeline' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ── Device usage summary ── */}
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-500" />Device Usage
                        </h3>
                        <div className="space-y-3">
                            {deviceSummary.slice(0, 8).map(d => (
                                <div key={d.name} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{d.name}</span>
                                            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{d.sessions} sessions</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min((d.sessions / (deviceSummary[0]?.sessions || 1)) * 100, 100)}%` }}
                                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <span className="text-[10px] text-slate-400">{d.totalHours.toFixed(1)}h total · last: {d.lastUser}</span>
                                            <span className="text-[10px] text-slate-400">{d.lastDate ? new Date(d.lastDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ── Person usage summary ── */}
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4 text-violet-500" />Who Used What
                            <span className="ml-auto text-[10px] font-normal text-slate-400">{personSummary.length} people</span>
                        </h3>
                        <div className="space-y-3">
                            {personSummary.slice(0, 8).map((p, idx) => (
                                <div key={p.name} className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden">
                                    {/* Person header row */}
                                    <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60">
                                        <div className="relative flex-shrink-0">
                                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black', getAvatarColor(p.name))}>
                                                {p.name.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            {idx === 0 && (
                                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center">
                                                    <Crown className="w-2 h-2 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{p.team || 'No team'}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 space-y-0.5">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                {p.sessions} <span className="font-normal text-slate-400">checkout{p.sessions !== 1 ? 's' : ''}</span>
                                            </p>
                                            <p className="text-[10px] text-slate-400">{p.totalHours.toFixed(1)}h total</p>
                                        </div>
                                    </div>
                                    {/* Device breakdown */}
                                    <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-white/60 dark:bg-slate-900/40">
                                        {p.deviceList.map(({ name, count }) => (
                                            <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-700/40 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                                                <Package className="w-2.5 h-2.5 flex-shrink-0" />
                                                {name}
                                                <span className="ml-0.5 px-1 py-0 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-[9px]">×{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ── Recent activity feed ── */}
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="lg:col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-500" />Recent Activity
                        </h3>
                        <div className="space-y-2">
                            {records.slice(0, 20).map(r => (
                                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', r.action === 'checkout' ? 'bg-blue-500/10' : 'bg-emerald-500/10')}>
                                        {r.action === 'checkout'
                                            ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                            : <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                            <span className={r.action === 'checkout' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                                {r.action === 'checkout' ? 'Checked out' : 'Returned'}
                                            </span>
                                            {' '}{r.deviceName}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">{r.userName} · {r.team}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[10px] text-slate-500">{r.checkedOutAt ? formatDate(r.checkedOutAt) : '—'}</p>
                                        {r.durationHours != null && (
                                            <p className={cn('text-[10px] font-semibold', r.durationHours > 8 ? 'text-red-500' : 'text-slate-400')}>
                                                {formatDuration(r.durationHours)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            ) : (
                /* ── Table view ── */
                <motion.div variants={fadeUp} initial="hidden" animate="show" className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60">
                                    {['Device', 'Person', 'Team', 'Action', 'Checked Out', 'Checked In', 'Duration'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((r, i) => (
                                    <tr key={r.id} className={cn('border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors', i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/20')}>
                                        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{r.deviceName}</td>
                                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.userName}</td>
                                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-500 whitespace-nowrap">{r.team || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px]',
                                                r.action === 'checkout'
                                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            )}>
                                                {r.action === 'checkout' ? '↑ Out' : '↓ In'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(r.checkedOutAt)}</td>
                                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(r.checkedInAt)}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            <span className={cn('font-semibold', r.durationHours != null && r.durationHours > 8 ? 'text-red-500' : 'text-slate-600 dark:text-slate-400')}>
                                                {formatDuration(r.durationHours)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 text-center">
                        {records.length} record{records.length !== 1 ? 's' : ''}
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ─── Avatar color helper (reused from scan page) ──────────────────────────────
const AVATAR_COLORS_LIST = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
];
function getAvatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return AVATAR_COLORS_LIST[h % AVATAR_COLORS_LIST.length];
}


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
    const [activeTab, setActiveTab]       = useState<'devices' | 'history'>('devices');

    // ── Tick every 60s to refresh duration displays without re-fetching ──────────
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 60_000);
        return () => clearInterval(t);
    }, []);

    // ── Firestore listener with local-first approach + API polling ──────────
    useEffect(() => {
        // Always start with seed data immediately
        const localDevices = SEED_DEVICES.map((d, i) => ({ ...d, id: `device_${i + 1}` }));
        setDevices(localDevices);
        setLoading(false);

        // Poll the API every 5 seconds to pick up QR scan changes
        // Uses /api/keepr/device/list to get ALL devices from Firestore (not hardcoded IDs)
        const pollApi = async () => {
            try {
                const res = await fetch('/api/keepr/device/list', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.devices?.length > 0) {
                        setDevices(data.devices);
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
        const update: Partial<Device> = {
            status: 'checked-out',
            checkedOutBy: { name: userName, uid },
            // checkedOutAt set SERVER-SIDE — set optimistic local time only for UI
            checkedOutAt: new Date().toISOString(),
            totalCheckouts: (device.totalCheckouts ?? 0) + 1,
        };
        // Update local state immediately for instant UI feedback
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, ...update } : d));
        // Write through API (uses Firebase Admin SDK — server sets the real timestamp)
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
            returnedTo: null,
            returnLocation: 'web_app', // logs that it was returned via web dashboard
            // lastCheckedIn set SERVER-SIDE — don't send from client
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
        missing:     devices.filter(d => d.status === 'missing').length,
        accessories: devices.filter(d => d.type === 'accessory').length,
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
                if (statusFilter === 'missing'     && d.status !== 'missing')     return false;
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
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/keepr/alerts', { method: 'POST' });
                                        const data = await res.json();
                                        if (data.sent) alert(`✅ Alert sent for ${data.overdueCount} device(s)`);
                                        else alert(`ℹ️ ${data.reason ?? data.error ?? 'Configure KEEPR_WEBHOOK_URL in .env to enable alerts'}`);
                                    } catch { alert('Failed to send alert'); }
                                }}
                                className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold"
                            >
                                <Bell className="w-3 h-3" />Alert Team
                            </button>
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
                            {stats.missing > 0 && <StatPill label="Missing" value={stats.missing} color="bg-red-500/20 border-red-400/30 text-red-300" />}
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

                {/* ── Tab switcher ────────────────────────────────────────── */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm">
                    <button
                        onClick={() => setActiveTab('devices')}
                        className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all', activeTab === 'devices' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}
                    >
                        <Package className="w-4 h-4" />Devices
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all', activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}
                    >
                        <History className="w-4 h-4" />Usage History
                    </button>
                </motion.div>

                {/* ── Stats row ──────────────────────────────────────────── */}
                {activeTab === 'devices' && (<>
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
                            <SelectItem value="missing">Missing</SelectItem>
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
                    {/* Sync Fleet — pushes master device list to Firebase */}
                    <Button
                        onClick={async () => {
                            try {
                                const res = await fetch('/api/keepr/device/list', { method: 'POST' });
                                const data = await res.json();
                                alert(data.added > 0
                                    ? `✅ Synced! Added ${data.added} new device(s): ${data.newDevices?.join(', ')}`
                                    : `ℹ️ ${data.message || 'All devices already in sync'}`);
                            } catch { alert('Sync failed'); }
                        }}
                        variant="outline"
                        size="sm"
                        className="h-9 text-sm gap-1.5"
                    >
                        <RefreshCw className="w-4 h-4" />Sync Fleet
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
                </>)}

                {/* ── History Tab ─────────────────────────────────────────── */}
                {activeTab === 'history' && (
                    <HistoryPanel devices={devices} />
                )}
            </div>

            {/* ── Dialogs ──────────────────────────────────────────────────── */}
            <AddDeviceDialog
                open={showAdd}
                onClose={() => setShowAdd(false)}
                onAdd={handleAddDevice}
            />

            <DeviceDetailModal
                device={detailDevice ? (devices.find(d => d.id === detailDevice.id) ?? detailDevice) : null}
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
