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
    ClipboardCheck, Crown, Users, History, Bell, Tag, ChevronRight,
    ChevronDown, Settings, Download, Cable
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCATIONS = [
    "QA Team Device Rack", "Raja Sekar Rack", "API Team",
    "Android Team", "Sun Direct Team", "iOS Team", "PM Desk", "Satish Team", "Others"
];

const DEVICE_TYPES = [
    { value: 'phone',     label: 'Phone',       icon: Smartphone, gradient: 'from-blue-500 to-indigo-600' },
    { value: 'tablet',    label: 'Tablet',      icon: Tablet,     gradient: 'from-violet-500 to-purple-600' },
    { value: 'laptop',    label: 'Laptop / Mac', icon: Laptop,    gradient: 'from-slate-500 to-gray-600' },
    { value: 'tv',        label: 'TV / STB',    icon: Tv,         gradient: 'from-rose-500 to-pink-600' },
    { value: 'monitor',   label: 'Monitor',     icon: Monitor,    gradient: 'from-teal-500 to-cyan-600' },
    { value: 'accessory', label: 'Accessory',   icon: Cable,      gradient: 'from-amber-500 to-yellow-500' },
    { value: 'other',     label: 'Other',       icon: Box,        gradient: 'from-amber-500 to-orange-600' },
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
    quantity?: number;
    quantityAvailable?: number;
    linkedDeviceId?: string;
    accessoryType?: string;
    assignedTo?: string;
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
    { name: 'HDMI Cable (Apple TV)', type: 'accessory', status: 'available', location: 'iOS Team',         accessoryType: 'HDMI cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'Apple TV 4K Box',  notes: 'HDMI for Apple TV 4K — with Seeman' },
    { name: 'HDMI Cable (HD Box)',   type: 'accessory', status: 'available', location: 'Sun Direct Team',  accessoryType: 'HDMI cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'HD Box',           notes: 'HDMI for HD Box — Prasanth place' },
    { name: 'HDMI Cable (QA Rack)',  type: 'accessory', status: 'missing',   location: 'QA Team Device Rack', accessoryType: 'HDMI cable', quantity: 2, quantityAvailable: 0, condition: 'unknown', notes: '2 HDMI cables missing from QA rack' },
    { name: 'Power Cable (Apple TV)', type: 'accessory', status: 'available', location: 'iOS Team',        accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'Apple TV 4K Box',  notes: 'Power cable for Apple TV — with Seeman' },
    { name: 'Power Cable (HD Box)',   type: 'accessory', status: 'available', location: 'Sun Direct Team', accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good',    linkedDeviceId: 'HD Box',           notes: 'Power cable for HD Box — Prasanth place' },
    { name: 'Power Cable (Fire TV)',  type: 'accessory', status: 'available', location: 'QA Team Device Rack', accessoryType: 'Power cable', quantity: 1, quantityAvailable: 1, condition: 'good', linkedDeviceId: 'Fire TV 4K Stick', notes: 'Micro-USB power for Fire TV Stick' },
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
        case 'available':   return { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', label: 'Available',   icon: '🟢' };
        case 'checked-out': return { dot: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-400',         bg: 'bg-sky-500/10 border border-sky-500/20',         label: 'In Use',      icon: '🔵' };
        case 'maintenance': return { dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-500/10 border border-amber-500/20',     label: 'Maintenance', icon: '🟡' };
        case 'missing':     return { dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-400',         bg: 'bg-red-500/10 border border-red-500/20',         label: 'Missing',     icon: '🔴' };
        default:            return { dot: 'bg-slate-400',   text: 'text-slate-600',                         bg: 'bg-slate-500/10 border border-slate-500/20',     label: status,        icon: '⚪' };
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
    if (hours < 1)       duration = `${Math.round(hours * 60)}m`;
    else if (hours < 24) duration = `${Math.round(hours)}h`;
    else                 duration = `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
    return { isOverdue, isCritical, duration, hours };
}

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };

// ─── Compact Device Row ───────────────────────────────────────────────────────
function DeviceRow({ device, onCheckout, onCheckin, onShowQR, onExpand, isExpanded }: {
    device: Device;
    onCheckout: (device: Device) => void;
    onCheckin: (device: Device) => void;
    onShowQR: (device: Device) => void;
    onExpand: (device: Device) => void;
    isExpanded: boolean;
}) {
    const typeConfig   = getTypeConfig(device.type);
    const statusConfig = getStatusConfig(device.status);
    const overdueInfo  = getOverdueInfo(device.checkedOutAt);
    const TypeIcon     = typeConfig.icon;

    const isAccessory = device.type === 'accessory';

    return (
        <div className="group">
            <div
                onClick={() => onExpand(device)}
                className={cn(
                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 rounded-lg',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    isExpanded && 'bg-slate-50 dark:bg-slate-800/50',
                    overdueInfo.isCritical && 'border-l-2 border-l-red-500'
                )}
            >
                {/* Type icon */}
                <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isAccessory
                        ? 'bg-amber-100 dark:bg-amber-900/30'
                        : `bg-gradient-to-br ${typeConfig.gradient} shadow-sm`
                )}>
                    {isAccessory
                        ? <Cable className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        : <TypeIcon className="w-4 h-4 text-white" />
                    }
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate block">
                        {device.name}
                    </span>
                </div>

                {/* Status badge */}
                <div className={cn(
                    'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0',
                    statusConfig.bg, statusConfig.text
                )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusConfig.dot)} />
                    {statusConfig.label}
                </div>

                {/* Assigned to / quantity info */}
                <div className="hidden sm:block w-28 flex-shrink-0 text-right">
                    {device.status === 'checked-out' && device.checkedOutBy && (
                        <span className="text-xs text-sky-600 dark:text-sky-400 font-medium truncate block">
                            {device.checkedOutBy.name}
                            {overdueInfo.duration && <span className="text-slate-400 ml-1">{overdueInfo.duration}</span>}
                        </span>
                    )}
                    {isAccessory && device.quantity && (
                        <span className={cn('text-xs font-medium', (device.quantityAvailable ?? 0) === 0 ? 'text-red-500' : 'text-slate-500')}>
                            {device.quantityAvailable ?? 0}/{device.quantity} avail
                        </span>
                    )}
                    {device.status === 'available' && device.assignedTo && !isAccessory && (
                        <span className="text-xs text-slate-400 truncate block">{device.assignedTo}</span>
                    )}
                </div>

                {/* QR button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onShowQR(device); }}
                    title="Show QR code"
                    className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                        <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                    </svg>
                </button>

                {/* Action button */}
                <div className="flex-shrink-0 w-20">
                    {device.status === 'available' && !isAccessory && (
                        <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onCheckout(device); }}
                            className="h-7 w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0"
                        >
                            Take
                        </Button>
                    )}
                    {device.status === 'checked-out' && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onCheckin(device); }}
                            className="h-7 w-full text-xs font-semibold border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400"
                        >
                            Return
                        </Button>
                    )}
                    {device.status === 'maintenance' && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onCheckin(device); }}
                            className="h-7 w-full text-xs font-semibold border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                        >
                            Fix
                        </Button>
                    )}
                </div>
            </div>

            {/* Expandable detail panel */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3 pt-1 ml-11 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 dark:border-slate-800 mt-1">
                            {device.os && (
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">OS</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{device.os}</p>
                                </div>
                            )}
                            {device.ram && (
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">RAM</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{device.ram}</p>
                                </div>
                            )}
                            {device.network && (
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Network</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{device.network}</p>
                                </div>
                            )}
                            {device.condition && (
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Condition</p>
                                    <p className={cn('text-xs font-semibold', getConditionConfig(device.condition).color)}>{getConditionConfig(device.condition).label}</p>
                                </div>
                            )}
                            {device.notes && (
                                <div className="col-span-2 sm:col-span-4">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Notes</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">{device.notes}</p>
                                </div>
                            )}
                            {device.totalCheckouts != null && device.totalCheckouts > 0 && (
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Checkouts</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{device.totalCheckouts} times</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Location Section ─────────────────────────────────────────────────────────
function LocationSection({ location, devices, onCheckout, onCheckin, onShowQR, expandedId, onExpand, isOpen, onToggle }: {
    location: string;
    devices: Device[];
    onCheckout: (device: Device) => void;
    onCheckin: (device: Device) => void;
    onShowQR: (device: Device) => void;
    expandedId: string | null;
    onExpand: (device: Device) => void;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const deviceItems = devices.filter(d => d.type !== 'accessory');
    const accessories = devices.filter(d => d.type === 'accessory');
    const missingCount = devices.filter(d => d.status === 'missing').length;

    return (
        <motion.div variants={fadeUp} id={`loc-${location.replace(/\s+/g, '-')}`} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden shadow-sm scroll-mt-28">
            <Collapsible open={isOpen} onOpenChange={onToggle}>
                <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                        <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-bold text-slate-800 dark:text-white flex-1 text-left">{location}</span>
                        <span className="text-xs text-slate-400 font-medium">
                            {deviceItems.length} device{deviceItems.length !== 1 ? 's' : ''}
                            {accessories.length > 0 && `, ${accessories.length} accessor${accessories.length !== 1 ? 'ies' : 'y'}`}
                        </span>
                        {missingCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3" />{missingCount} missing
                            </span>
                        )}
                        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50">
                        {deviceItems.map(device => (
                            <DeviceRow
                                key={device.id}
                                device={device}
                                onCheckout={onCheckout}
                                onCheckin={onCheckin}
                                onShowQR={onShowQR}
                                onExpand={onExpand}
                                isExpanded={expandedId === device.id}
                            />
                        ))}
                        {accessories.length > 0 && (
                            <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-950/10">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600/70 dark:text-amber-400/60 mb-1">Accessories</p>
                            </div>
                        )}
                        {accessories.map(device => (
                            <DeviceRow
                                key={device.id}
                                device={device}
                                onCheckout={onCheckout}
                                onCheckin={onCheckin}
                                onShowQR={onShowQR}
                                onExpand={onExpand}
                                isExpanded={expandedId === device.id}
                            />
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </motion.div>
    );
}

// ─── Welcome Card ─────────────────────────────────────────────────────────────
function WelcomeCard({ onDismiss }: { onDismiss: () => void }) {
    return (
        <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-5"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Welcome to Keepr! 👋</h3>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            Click <strong>QR</strong> to generate a scannable code for any device
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            Tap <strong>Take</strong> to checkout — <strong>Return</strong> to bring it back
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            Use the <strong>History</strong> tab to see who had what and when
                        </li>
                    </ul>
                </div>
                <button
                    onClick={onDismiss}
                    className="flex-shrink-0 p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
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
    const [records, setRecords] = useState<HistoryRecord[]>([]);
    const [stats, setStats] = useState<HistoryStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [filterDevice, setFilterDevice] = useState<string>('all');

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterDevice !== 'all') params.set('deviceId', filterDevice);
        params.set('limit', '100');
        try {
            const res = await fetch(`/api/keepr/history?${params.toString()}`);
            const data = await res.json();
            setRecords(data.records ?? []);
            setStats(data.stats ?? null);
        } catch {
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, [filterDevice]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    return (
        <div className="space-y-4">
            {/* Filter row */}
            <div className="flex items-center gap-3">
                <Select value={filterDevice} onValueChange={setFilterDevice}>
                    <SelectTrigger className="h-9 text-sm w-48 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700">
                        <Package className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <SelectValue placeholder="All Devices" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Devices</SelectItem>
                        {devices.filter(d => d.type !== 'accessory').map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading} className="h-9 text-xs gap-1.5 ml-auto">
                    <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Refresh
                </Button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Sessions', value: stats.totalSessions, icon: Activity },
                        { label: 'Avg Duration', value: `${stats.avgDurationHours.toFixed(1)}h`, icon: Clock },
                        { label: 'Top User', value: stats.topUser ?? '—', icon: Crown },
                        { label: 'Most Used', value: stats.topDevice ?? '—', icon: TrendingUp },
                    ].map(s => (
                        <div key={s.label} className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                                <s.icon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{s.label}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Activity feed */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
            ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm text-slate-500 font-medium">No history yet</p>
                    <p className="text-xs text-slate-400 mt-1">History is recorded when devices are checked out or returned.</p>
                </div>
            ) : (
                <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl overflow-hidden">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {records.slice(0, 30).map(r => (
                            <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                                    r.action === 'checkout' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
                                )}>
                                    {r.action === 'checkout'
                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                        : <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                        <span className={r.action === 'checkout' ? 'text-blue-600' : 'text-emerald-600'}>
                                            {r.action === 'checkout' ? 'Took' : 'Returned'}
                                        </span>{' '}
                                        {r.deviceName}
                                    </p>
                                    <p className="text-[10px] text-slate-400">{r.userName}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] text-slate-400">{formatDate(r.checkedOutAt)}</p>
                                    {r.durationHours != null && (
                                        <p className={cn('text-[10px] font-semibold', r.durationHours > 8 ? 'text-red-500' : 'text-slate-400')}>
                                            {formatDuration(r.durationHours)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Accessories Panel ────────────────────────────────────────────────────────
function AccessoriesPanel({ devices }: { devices: Device[] }) {
    const accessories = devices.filter(d => d.type === 'accessory');
    const grouped = useMemo(() => {
        const map: Record<string, Device[]> = {};
        for (const a of accessories) {
            const loc = a.location;
            if (!map[loc]) map[loc] = [];
            map[loc].push(a);
        }
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [accessories]);

    if (accessories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Cable className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 font-medium">No accessories tracked</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {grouped.map(([location, items]) => (
                <div key={location} className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{location}</span>
                            <span className="text-[10px] text-slate-400 ml-auto">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {items.map(a => {
                            const statusConfig = getStatusConfig(a.status);
                            return (
                                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <Cable className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">{a.name}</span>
                                        {a.accessoryType && <span className="text-[10px] text-slate-400">{a.accessoryType}</span>}
                                    </div>
                                    <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold', statusConfig.bg, statusConfig.text)}>
                                        <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
                                        {statusConfig.label}
                                    </div>
                                    {a.quantity && (
                                        <span className={cn('text-xs font-semibold tabular-nums', (a.quantityAvailable ?? 0) === 0 ? 'text-red-500' : 'text-slate-500')}>
                                            {a.quantityAvailable ?? 0}/{a.quantity}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Audit Panel ──────────────────────────────────────────────────────────────
type AuditStatus = 'present' | 'missing' | 'reassigned' | 'pending';

interface AuditResult {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    location: string;
    status: AuditStatus;
    assignedTo?: string;
    notes?: string;
}

interface PastAudit {
    id: string;
    auditedBy: string;
    auditedAt: string;
    weekNumber: number;
    summary: { total: number; present: number; missing: number; reassigned: number };
}

function AuditPanel({ devices, userName }: { devices: Device[]; userName: string }) {
    const [phase, setPhase] = useState<'start' | 'auditing' | 'summary'>('start');
    const [results, setResults] = useState<AuditResult[]>([]);
    const [currentLocationIdx, setCurrentLocationIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [pastAudits, setPastAudits] = useState<PastAudit[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [assignDialog, setAssignDialog] = useState<{ deviceId: string; deviceName: string } | null>(null);
    const [assignName, setAssignName] = useState('');
    const [assignNotes, setAssignNotes] = useState('');

    // Only audit non-accessory devices
    const auditableDevices = useMemo(() => devices.filter(d => d.type !== 'accessory'), [devices]);

    // Group by location
    const locationGroups = useMemo(() => {
        const map: Record<string, Device[]> = {};
        for (const d of auditableDevices) {
            if (!map[d.location]) map[d.location] = [];
            map[d.location].push(d);
        }
        return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
    }, [auditableDevices]);

    const currentLocation = locationGroups[currentLocationIdx];
    const currentDevices = currentLocation?.[1] ?? [];

    // Fetch past audits on mount
    useEffect(() => {
        setLoadingHistory(true);
        fetch('/api/keepr/audit?limit=10')
            .then(r => r.json())
            .then(d => setPastAudits(d.audits ?? []))
            .catch(() => {})
            .finally(() => setLoadingHistory(false));
    }, []);

    // Start a new audit
    const startAudit = () => {
        const initial: AuditResult[] = auditableDevices.map(d => ({
            deviceId: d.id,
            deviceName: d.name,
            deviceType: d.type,
            location: d.location,
            status: 'pending',
        }));
        setResults(initial);
        setCurrentLocationIdx(0);
        setPhase('auditing');
    };

    // Mark a device
    const markDevice = (deviceId: string, status: AuditStatus) => {
        setResults(prev => prev.map(r => r.deviceId === deviceId ? { ...r, status } : r));
    };

    // Mark all in current location as present
    const markAllPresent = () => {
        setResults(prev => prev.map(r =>
            currentDevices.some(d => d.id === r.deviceId) && r.status === 'pending'
                ? { ...r, status: 'present' }
                : r
        ));
    };

    // Assign dialog submit
    const submitAssign = () => {
        if (!assignDialog || !assignName.trim()) return;
        setResults(prev => prev.map(r =>
            r.deviceId === assignDialog.deviceId
                ? { ...r, status: 'reassigned', assignedTo: assignName.trim(), notes: assignNotes.trim() || undefined }
                : r
        ));
        setAssignDialog(null);
        setAssignName('');
        setAssignNotes('');
    };

    // Navigation
    const nextLocation = () => {
        if (currentLocationIdx < locationGroups.length - 1) {
            setCurrentLocationIdx(i => i + 1);
        } else {
            setPhase('summary');
        }
    };

    const prevLocation = () => {
        if (currentLocationIdx > 0) setCurrentLocationIdx(i => i - 1);
    };

    // Save audit
    const saveAudit = async () => {
        setSaving(true);
        try {
            const finalResults = results.filter(r => r.status !== 'pending');
            const res = await fetch('/api/keepr/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auditedBy: userName, results: finalResults }),
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Audit saved! ${data.summary.present} present, ${data.summary.missing} missing, ${data.summary.reassigned} reassigned.`);
                setPhase('start');
                // Refresh history
                fetch('/api/keepr/audit?limit=10').then(r => r.json()).then(d => setPastAudits(d.audits ?? [])).catch(() => {});
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch {
            alert('Failed to save audit');
        } finally {
            setSaving(false);
        }
    };

    // Progress stats
    const progress = useMemo(() => {
        const audited = results.filter(r => r.status !== 'pending').length;
        const total = results.length;
        return { audited, total, pct: total > 0 ? Math.round((audited / total) * 100) : 0 };
    }, [results]);

    const currentResults = results.filter(r => currentDevices.some(d => d.id === r.deviceId));
    const currentDone = currentResults.filter(r => r.status !== 'pending').length;

    // ── START PHASE ──────────────────────────────────────────────────────────
    if (phase === 'start') {
        return (
            <div className="space-y-6">
                {/* Start new audit card */}
                <motion.div variants={fadeUp} initial="hidden" animate="show"
                    className="bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-50 dark:from-indigo-950/30 dark:via-blue-950/20 dark:to-violet-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl p-6 text-center"
                >
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                        <ClipboardCheck className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Weekly Device Audit</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-md mx-auto">
                        Walk through each location, confirm devices are present, flag missing ones, and reassign as needed. Takes about 5 minutes.
                    </p>
                    <Button
                        onClick={startAudit}
                        className="h-10 px-6 text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-md"
                    >
                        <ClipboardCheck className="w-4 h-4 mr-2" />Start Audit ({auditableDevices.length} devices)
                    </Button>
                </motion.div>

                {/* Past audits */}
                <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-400" />Past Audits
                    </h4>
                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                        </div>
                    ) : pastAudits.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">No audits completed yet. Start your first one above!</p>
                    ) : (
                        <div className="space-y-2">
                            {pastAudits.map(a => (
                                <div key={a.id} className="flex items-center gap-4 px-4 py-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                        <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Week {a.weekNumber} — by {a.auditedBy}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {new Date(a.auditedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-[10px] font-bold text-emerald-600">✓ {a.summary.present}</span>
                                        {a.summary.missing > 0 && <span className="text-[10px] font-bold text-red-500">✗ {a.summary.missing}</span>}
                                        {a.summary.reassigned > 0 && <span className="text-[10px] font-bold text-amber-500">↻ {a.summary.reassigned}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── AUDITING PHASE ───────────────────────────────────────────────────────
    if (phase === 'auditing') {
        return (
            <div className="space-y-5">
                {/* Progress bar */}
                <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            📍 {currentLocation?.[0]} ({currentLocationIdx + 1}/{locationGroups.length})
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{progress.pct}% complete</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.pct}%` }}
                            transition={{ duration: 0.4 }}
                        />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                        <span>✓ {progress.audited} done</span>
                        <span>○ {progress.total - progress.audited} remaining</span>
                    </div>
                </div>

                {/* Quick action */}
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={markAllPresent} className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 className="w-3.5 h-3.5" />All Present Here
                    </Button>
                    <span className="text-[10px] text-slate-400 ml-2">{currentDone}/{currentResults.length} checked</span>
                </div>

                {/* Device checklist */}
                <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {currentDevices.map(device => {
                        const result = results.find(r => r.deviceId === device.id);
                        const status = result?.status ?? 'pending';
                        const typeConfig = getTypeConfig(device.type);
                        const TypeIcon = typeConfig.icon;

                        return (
                            <div key={device.id} className={cn(
                                'flex items-center gap-3 px-4 py-3 transition-colors',
                                status === 'present' && 'bg-emerald-50/50 dark:bg-emerald-950/10',
                                status === 'missing' && 'bg-red-50/50 dark:bg-red-950/10',
                                status === 'reassigned' && 'bg-amber-50/50 dark:bg-amber-950/10',
                            )}>
                                {/* Icon */}
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br shadow-sm', typeConfig.gradient)}>
                                    <TypeIcon className="w-4 h-4 text-white" />
                                </div>

                                {/* Name + info */}
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 block truncate">{device.name}</span>
                                    <span className="text-[10px] text-slate-400">{device.os ?? device.type}</span>
                                    {status === 'reassigned' && result?.assignedTo && (
                                        <span className="text-[10px] text-amber-600 font-medium block">→ {result.assignedTo}</span>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button
                                        onClick={() => markDevice(device.id, 'present')}
                                        className={cn(
                                            'h-8 w-8 rounded-lg flex items-center justify-center border transition-all',
                                            status === 'present'
                                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50'
                                        )}
                                        title="Present"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => markDevice(device.id, 'missing')}
                                        className={cn(
                                            'h-8 w-8 rounded-lg flex items-center justify-center border transition-all',
                                            status === 'missing'
                                                ? 'bg-red-500 border-red-500 text-white shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50'
                                        )}
                                        title="Missing"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setAssignDialog({ deviceId: device.id, deviceName: device.name })}
                                        className={cn(
                                            'h-8 w-8 rounded-lg flex items-center justify-center border transition-all',
                                            status === 'reassigned'
                                                ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50'
                                        )}
                                        title="Reassign"
                                    >
                                        <User className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={prevLocation} disabled={currentLocationIdx === 0} className="h-9 text-xs gap-1.5">
                        <ArrowLeft className="w-3.5 h-3.5" />Previous
                    </Button>
                    <span className="text-xs text-slate-400">
                        Location {currentLocationIdx + 1} of {locationGroups.length}
                    </span>
                    <Button size="sm" onClick={nextLocation} className="h-9 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                        {currentLocationIdx < locationGroups.length - 1 ? 'Next Location' : 'Review & Finish'}
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Assign dialog */}
                <Dialog open={!!assignDialog} onOpenChange={v => !v && setAssignDialog(null)}>
                    <DialogContent className="max-w-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <DialogHeader>
                            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">
                                Reassign: {assignDialog?.deviceName}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Who has this device? We&apos;ll update the record.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 mt-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Assigned To *</Label>
                                <Input
                                    value={assignName}
                                    onChange={e => setAssignName(e.target.value)}
                                    placeholder="e.g. Prasanth"
                                    className="h-9 text-sm"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Notes (optional)</Label>
                                <Input
                                    value={assignNotes}
                                    onChange={e => setAssignNotes(e.target.value)}
                                    placeholder="e.g. Found on their desk"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 pt-3">
                            <Button variant="outline" size="sm" onClick={() => setAssignDialog(null)} className="h-8 text-xs">Cancel</Button>
                            <Button size="sm" onClick={submitAssign} disabled={!assignName.trim()} className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white border-0">
                                <User className="w-3.5 h-3.5 mr-1" />Assign
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // ── SUMMARY PHASE ────────────────────────────────────────────────────────
    const present = results.filter(r => r.status === 'present');
    const missing = results.filter(r => r.status === 'missing');
    const reassigned = results.filter(r => r.status === 'reassigned');
    const pending = results.filter(r => r.status === 'pending');

    return (
        <div className="space-y-5">
            {/* Summary header */}
            <motion.div variants={fadeUp} initial="hidden" animate="show"
                className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl p-6 text-center"
            >
                <div className="text-4xl mb-2">🎉</div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Audit Complete!</h3>
                <p className="text-sm text-slate-500 mb-4">Here&apos;s your summary — review and save.</p>

                <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                        <p className="text-2xl font-black text-emerald-600">{present.length}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Present</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-black text-red-500">{missing.length}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Missing</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-black text-amber-500">{reassigned.length}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Reassigned</p>
                    </div>
                    {pending.length > 0 && (
                        <div className="text-center">
                            <p className="text-2xl font-black text-slate-400">{pending.length}</p>
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Skipped</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Missing items detail */}
            {missing.length > 0 && (
                <div className="bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />Missing Devices ({missing.length})
                    </h4>
                    <div className="space-y-1.5">
                        {missing.map(r => (
                            <div key={r.deviceId} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                <X className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium">{r.deviceName}</span>
                                <span className="text-red-400 dark:text-red-500">— {r.location}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reassigned items detail */}
            {reassigned.length > 0 && (
                <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />Reassigned Devices ({reassigned.length})
                    </h4>
                    <div className="space-y-1.5">
                        {reassigned.map(r => (
                            <div key={r.deviceId} className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium">{r.deviceName}</span>
                                <span className="text-amber-500">→ {r.assignedTo}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPhase('auditing')} className="h-9 text-xs gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" />Go Back & Edit
                </Button>
                <div className="flex-1" />
                <Button
                    onClick={saveAudit}
                    disabled={saving}
                    className="h-9 text-sm font-bold gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-md"
                >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving ? 'Saving…' : 'Save Audit'}
                </Button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN PAGE COMPONENT ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function KeeprPage() {
    const { user } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [showAdd, setShowAdd] = useState(false);
    const [qrDevice, setQrDevice] = useState<Device | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [openLocation, setOpenLocation] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'devices' | 'history' | 'accessories' | 'audit'>('devices');
    const [showWelcome, setShowWelcome] = useState(false);

    // Check first-visit flag
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const dismissed = localStorage.getItem('keepr_welcome_dismissed');
            if (!dismissed) setShowWelcome(true);
        }
    }, []);

    const dismissWelcome = () => {
        setShowWelcome(false);
        localStorage.setItem('keepr_welcome_dismissed', '1');
    };

    // ── Tick every 60s to refresh durations ──────────────────────────────────
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 60_000);
        return () => clearInterval(t);
    }, []);

    // ── Firestore listener + API polling ─────────────────────────────────────
    useEffect(() => {
        const localDevices = SEED_DEVICES.map((d, i) => ({ ...d, id: `device_${i + 1}` }));
        setDevices(localDevices);
        setLoading(false);

        const pollApi = async () => {
            try {
                const res = await fetch('/api/keepr/device/list', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.devices?.length > 0) setDevices(data.devices);
                }
            } catch { /* ignore */ }
        };

        pollApi();
        const interval = setInterval(pollApi, 5000);

        if (db) {
            try {
                const q = query(collection(db, 'keepr_devices'));
                const unsub = onSnapshot(q, (snap) => {
                    if (!snap.empty) {
                        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Device));
                        setDevices(docs);
                    }
                }, () => {});
                return () => { clearInterval(interval); unsub(); };
            } catch {}
        }

        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleCheckout = useCallback(async (device: Device) => {
        const userName = user?.displayName ?? user?.email ?? 'You';
        const uid = user?.uid ?? 'local';
        const update: Partial<Device> = {
            status: 'checked-out',
            checkedOutBy: { name: userName, uid },
            checkedOutAt: new Date().toISOString(),
            totalCheckouts: (device.totalCheckouts ?? 0) + 1,
        };
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, ...update } : d));
        try {
            await fetch(`/api/keepr/device/${device.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            });
        } catch {}
    }, [user]);

    const handleCheckin = useCallback(async (device: Device) => {
        const update = {
            status: 'available' as const,
            checkedOutBy: null,
            checkedOutAt: null,
            returnedTo: null,
            returnLocation: 'web_app',
        };
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'available', checkedOutBy: undefined, checkedOutAt: undefined } : d));
        try {
            await fetch(`/api/keepr/device/${device.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            });
        } catch {}
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
        } catch {}
    }, []);

    const handleExpand = useCallback((device: Device) => {
        setExpandedId(prev => prev === device.id ? null : device.id);
    }, []);

    const handleJumpToLocation = useCallback((location: string) => {
        setOpenLocation(location);
        // Scroll to the section after a brief delay for the collapsible to open
        setTimeout(() => {
            const el = document.getElementById(`loc-${location.replace(/\s+/g, '-')}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }, []);

    // ── Derived data ─────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total:       devices.filter(d => d.type !== 'accessory').length,
        available:   devices.filter(d => d.status === 'available' && d.type !== 'accessory').length,
        inUse:       devices.filter(d => d.status === 'checked-out').length,
        missing:     devices.filter(d => d.status === 'missing').length,
    }), [devices]);

    const overdueDevices = useMemo(() =>
        devices.filter(d => d.status === 'checked-out' && getOverdueInfo(d.checkedOutAt).isCritical),
    [devices]);

    const missingDevices = useMemo(() =>
        devices.filter(d => d.status === 'missing'),
    [devices]);

    // ── Filtered + grouped ───────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return devices.filter(d => {
            if (statusFilter !== 'all') {
                if (statusFilter === 'available'   && d.status !== 'available')   return false;
                if (statusFilter === 'checked-out' && d.status !== 'checked-out') return false;
                if (statusFilter === 'maintenance' && d.status !== 'maintenance') return false;
                if (statusFilter === 'missing'     && d.status !== 'missing')     return false;
            }
            if (locationFilter !== 'all' && d.location !== locationFilter) return false;
            if (q && !d.name.toLowerCase().includes(q) && !d.location.toLowerCase().includes(q) && !(d.os ?? '').toLowerCase().includes(q)) return false;
            return true;
        });
    }, [devices, search, statusFilter, locationFilter]);

    const locationGroups = useMemo(() => {
        const map: Record<string, Device[]> = {};
        for (const d of filtered) {
            if (!map[d.location]) map[d.location] = [];
            map[d.location].push(d);
        }
        // Sort locations by device count (descending)
        return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
    }, [filtered]);

    // Unique locations from devices for filter dropdown
    const activeLocations = useMemo(() => {
        const locs = new Set(devices.map(d => d.location));
        return Array.from(locs).sort();
    }, [devices]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">

            {/* ── Alert Banner (overdue 24h+ or missing) ──────────────────── */}
            <AnimatePresence>
                {(overdueDevices.length > 0 || missingDevices.length > 0) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className={cn(
                            'px-6 py-2.5 flex items-center gap-3 text-sm font-medium text-white',
                            overdueDevices.length > 0 ? 'bg-red-500' : 'bg-amber-500'
                        )}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">
                                {overdueDevices.length > 0 && (
                                    <><strong>{overdueDevices.length}</strong> device{overdueDevices.length > 1 ? 's' : ''} overdue (24h+). </>
                                )}
                                {missingDevices.length > 0 && (
                                    <><strong>{missingDevices.length}</strong> item{missingDevices.length > 1 ? 's' : ''} missing. </>
                                )}
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
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold"
                            >
                                <Bell className="w-3 h-3" />Alert Team
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Compact Header ───────────────────────────────────────────── */}
            <div className="border-b border-slate-200/80 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        {/* Back */}
                        <Link href="/dashboard">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </Link>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Keepr</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">QA Device Fleet</p>
                        </div>

                        {/* Status pills */}
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{stats.available} Available
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-semibold text-sky-700 dark:text-sky-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />{stats.inUse} In Use
                            </span>
                            {stats.missing > 0 && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-700 dark:text-red-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{stats.missing} Missing
                                </span>
                            )}
                        </div>

                        {/* Admin menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => setShowAdd(true)}>
                                    <Plus className="w-4 h-4 mr-2" />Add Device
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                    try {
                                        const res = await fetch('/api/keepr/device/list', { method: 'POST' });
                                        const data = await res.json();
                                        alert(data.added > 0
                                            ? `✅ Synced! Added ${data.added} new device(s)`
                                            : `ℹ️ ${data.message || 'All devices in sync'}`);
                                    } catch { alert('Sync failed'); }
                                }}>
                                    <RefreshCw className="w-4 h-4 mr-2" />Sync Fleet
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                    const csv = devices.map(d => `${d.name},${d.type},${d.status},${d.location},${d.checkedOutBy?.name ?? ''}`).join('\n');
                                    const blob = new Blob([`Name,Type,Status,Location,User\n${csv}`], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url; a.download = 'keepr_fleet.csv'; a.click();
                                    URL.revokeObjectURL(url);
                                }}>
                                    <Download className="w-4 h-4 mr-2" />Export CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* ── Page Body ────────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

                {/* Welcome card */}
                {showWelcome && <WelcomeCard onDismiss={dismissWelcome} />}

                {/* ── Tabs ─────────────────────────────────────────────────── */}
                <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg p-1 w-fit">
                    {([
                        { key: 'devices', label: 'Devices', icon: Package },
                        { key: 'audit', label: 'Audit', icon: ClipboardCheck },
                        { key: 'history', label: 'History', icon: History },
                        { key: 'accessories', label: 'Accessories', icon: Cable },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                                activeTab === tab.key
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />{tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Devices Tab ──────────────────────────────────────────── */}
                {activeTab === 'devices' && (
                    <>
                        {/* Search + Filter row */}
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            {/* Search */}
                            <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
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

                            {/* Location filter */}
                            <Select value={locationFilter} onValueChange={setLocationFilter}>
                                <SelectTrigger className="h-9 text-sm w-48 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700">
                                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations</SelectItem>
                                    {activeLocations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* Status pills */}
                            <div className="flex items-center gap-1 flex-wrap">
                                {([
                                    { value: 'all',         label: 'All' },
                                    { value: 'available',   label: 'Available' },
                                    { value: 'checked-out', label: 'In Use' },
                                    { value: 'maintenance', label: 'Maintenance' },
                                    { value: 'missing',     label: 'Missing' },
                                ]).map(s => (
                                    <button
                                        key={s.value}
                                        onClick={() => setStatusFilter(s.value)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                                            statusFilter === s.value
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Location-grouped device list */}
                        {loading ? (
                            <div className="space-y-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-32 rounded-xl bg-white/60 dark:bg-slate-900/60 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
                                ))}
                            </div>
                        ) : locationGroups.length === 0 ? (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col items-center justify-center py-16 text-center">
                                <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                                <p className="text-sm text-slate-500 font-medium">No devices match your filters</p>
                                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setLocationFilter('all'); }} className="mt-3 text-xs">
                                    Clear filters
                                </Button>
                            </motion.div>
                        ) : (
                            <>
                                {/* Jump nav — click to scroll & expand */}
                                <div className="flex items-center gap-2 flex-wrap sticky top-0 z-10 bg-gradient-to-b from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/95 pb-3 pt-1 -mt-1">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mr-1">Jump to:</span>
                                    {locationGroups.map(([location, items]) => {
                                        const devCount = items.filter(d => d.type !== 'accessory').length;
                                        const isActive = openLocation === location;
                                        return (
                                            <button
                                                key={location}
                                                onClick={() => handleJumpToLocation(location)}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                                                    isActive
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                        : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                                                )}
                                            >
                                                <MapPin className="w-3 h-3" />
                                                {location}
                                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold', isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}>
                                                    {devCount}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
                                    {locationGroups.map(([location, items]) => (
                                        <LocationSection
                                            key={location}
                                            location={location}
                                            devices={items}
                                            onCheckout={handleCheckout}
                                            onCheckin={handleCheckin}
                                            onShowQR={setQrDevice}
                                            expandedId={expandedId}
                                            onExpand={handleExpand}
                                            isOpen={openLocation === location}
                                            onToggle={() => setOpenLocation(prev => prev === location ? null : location)}
                                        />
                                    ))}
                                </motion.div>
                            </>
                        )}

                        {/* Results count */}
                        {!loading && filtered.length > 0 && (
                            <p className="text-xs text-slate-400 text-center pt-2">
                                {filtered.length} item{filtered.length !== 1 ? 's' : ''} across {locationGroups.length} location{locationGroups.length !== 1 ? 's' : ''}
                            </p>
                        )}
                    </>
                )}

                {/* ── History Tab ──────────────────────────────────────────── */}
                {activeTab === 'history' && <HistoryPanel devices={devices} />}

                {/* ── Audit Tab ────────────────────────────────────────────── */}
                {activeTab === 'audit' && <AuditPanel devices={devices} userName={user?.displayName ?? user?.email ?? 'Unknown'} />}

                {/* ── Accessories Tab ──────────────────────────────────────── */}
                {activeTab === 'accessories' && <AccessoriesPanel devices={devices} />}
            </div>

            {/* ── Dialogs ──────────────────────────────────────────────────── */}
            <AddDeviceDialog open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAddDevice} />

            {/* ── QR Code Modal ────────────────────────────────────────────── */}
            <Dialog open={!!qrDevice} onOpenChange={v => !v && setQrDevice(null)}>
                <DialogContent className="max-w-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 p-0 overflow-hidden">
                    {qrDevice && (() => {
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
                                        Scan to check out or return this device
                                    </p>
                                    <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-100">
                                        <QRCodeSVG value={scanUrl} size={180} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#0f172a" />
                                    </div>
                                    <div className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-400 font-medium mb-0.5">Scan URL</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-mono break-all">{scanUrl}</p>
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setQrDevice(null)}>
                                            Close
                                        </Button>
                                        <Button className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={() => window.open(scanUrl, '_blank')}>
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
