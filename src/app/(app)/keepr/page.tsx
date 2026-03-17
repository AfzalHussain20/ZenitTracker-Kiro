'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, Search, Smartphone, Tablet, Monitor, Tv, CheckCircle2, Activity, TrendingUp, Package, ArrowLeft, Box, Laptop, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebaseConfig';
import { collection, query, onSnapshot, updateDoc, doc, setDoc } from 'firebase/firestore';

const LOCATIONS = ["QA Team Device Rack", "Raja Sekar Rack", "API Team", "Android Team", "Sun Direct Team", "iOS Team", "Others"];

interface Device {
    id: string;
    name: string;
    type: string;
    status: 'available' | 'checked-out' | 'maintenance';
    checkedOutBy?: { name: string; uid: string };
    location: string;
    assignedTo?: string;
}

const initialDevices: Device[] = [
    { id: '1', name: 'Oppo A78', type: 'phone', status: 'available', location: 'QA Team Device Rack' },
    { id: '2', name: 'Moto g31 mobile', type: 'phone', status: 'available', location: 'QA Team Device Rack' },
    { id: '3', name: 'Galaxy M32 5G', type: 'phone', status: 'checked-out', location: 'QA Team Device Rack', checkedOutBy: { name: 'Saranya', uid: 'system' }, assignedTo: 'Saranya' },
    { id: '4', name: 'Redmi Tab Pad Large', type: 'tablet', status: 'available', location: 'QA Team Device Rack' },
    { id: '5', name: 'Fire TV 4K Stick', type: 'tv', status: 'available', location: 'QA Team Device Rack' },
];

const deviceIcons: Record<string, any> = {
    laptop: Laptop,
    phone: Smartphone,
    tablet: Tablet,
    monitor: Monitor,
    tv: Tv,
    other: Box,
};

export default function KeeprPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const { user } = useAuth();

    const [newDevice, setNewDevice] = useState({
        name: '',
        type: 'phone',
        location: LOCATIONS[0],
    });

    useEffect(() => {
        const q = query(collection(db, 'keepr_devices'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
                for (const d of initialDevices) {
                    await setDoc(doc(db, 'keepr_devices', d.id), d);
                }
            } else {
                const fetchedDevices = snapshot.docs.map(doc => ({ ...doc.data() })) as Device[];
                setDevices(fetchedDevices.sort((a, b) => Number(a.id) - Number(b.id)));
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const stats = {
        total: devices.length,
        available: devices.filter(d => d.status === 'available').length,
        checkedOut: devices.filter(d => d.status === 'checked-out').length,
        maintenance: devices.filter(d => d.status === 'maintenance').length,
    };

    const filteredDevices = devices.filter(device => {
        const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            device.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || device.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const handleAddDevice = async () => {
        if (!newDevice.name) return;
        const id = Date.now().toString();
        const device: Device = {
            id,
            name: newDevice.name,
            type: newDevice.type,
            status: 'available',
            location: newDevice.location,
        };
        await setDoc(doc(db, 'keepr_devices', id), device);
        setNewDevice({ name: '', type: 'phone', location: LOCATIONS[0] });
        setIsAddDialogOpen(false);
    };

    const handleCheckOut = async (deviceId: string) => {
        const deviceRef = doc(db, 'keepr_devices', deviceId);
        await updateDoc(deviceRef, {
            status: 'checked-out',
            checkedOutBy: { name: user?.displayName || 'Tester', uid: user?.uid || 'temp' },
            checkedOutAt: new Date().toISOString(),
        });
    };

    const handleCheckIn = async (deviceId: string) => {
        const deviceRef = doc(db, 'keepr_devices', deviceId);
        await updateDoc(deviceRef, {
            status: 'available',
            checkedOutBy: null,
            checkedOutAt: null,
        });
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'available':
                return { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950', label: 'Available' };
            case 'checked-out':
                return { color: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50 dark:bg-sky-950', label: 'In Use' };
            case 'maintenance':
                return { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950', label: 'Maintenance' };
            default:
                return { color: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-50 dark:bg-slate-950', label: status };
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-500/20 p-8">
                    <div className="relative z-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
                            <Link href="/apps">
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-medium mb-3">
                                    <Shield className="w-3 h-3" />
                                    Device Management
                                </div>
                                <h1 className="text-4xl font-bold tracking-tight">
                                    <span className="text-gradient">Keepr</span>
                                </h1>
                                <p className="text-muted-foreground text-lg mt-2">
                                    Track and manage testing devices
                                </p>
                            </div>
                        </motion.div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl" />
                </div>

                {/* Device Fleet Stats Visual */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Available', value: stats.available, color: 'from-emerald-500 to-green-600', icon: CheckCircle2 },
                        { label: 'In Use', value: stats.checkedOut, color: 'from-sky-500 to-blue-600', icon: Activity },
                        { label: 'Maintenance', value: stats.maintenance, color: 'from-amber-500 to-orange-600', icon: TrendingUp },
                    ].map((s) => (
                        <Card key={s.label} className="relative overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-10`} />
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${s.color}`}>
                                    <s.icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold">{s.value}</div>
                                    <div className="text-sm text-muted-foreground">{s.label}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Devices', value: stats.total, icon: Package, gradient: 'from-sky-500 to-blue-600' },
                        { label: 'Available', value: stats.available, icon: CheckCircle2, gradient: 'from-emerald-500 to-green-600' },
                        { label: 'In Use', value: stats.checkedOut, icon: Activity, gradient: 'from-orange-500 to-amber-600' },
                        { label: 'Maintenance', value: stats.maintenance, icon: TrendingUp, gradient: 'from-purple-500 to-pink-600' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
                                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                                <CardContent className="p-6 relative">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                                            <stat.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold">{stat.value}</div>
                                            <div className="text-xs text-muted-foreground">{stat.label}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Search & Filter */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search devices..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Devices</SelectItem>
                                    <SelectItem value="available">Available</SelectItem>
                                    <SelectItem value="checked-out">In Use</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-gradient-to-r from-sky-500 to-blue-600">
                                        <Plus className="w-4 h-4 mr-2" /> Add Device
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add New Device</DialogTitle>
                                        <DialogDescription>Register a new testing device</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Device Name</Label>
                                            <Input
                                                placeholder="e.g. iPhone 15 Pro"
                                                value={newDevice.name}
                                                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Type</Label>
                                                <Select value={newDevice.type} onValueChange={v => setNewDevice({ ...newDevice, type: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="phone">Phone</SelectItem>
                                                        <SelectItem value="tablet">Tablet</SelectItem>
                                                        <SelectItem value="laptop">Laptop</SelectItem>
                                                        <SelectItem value="tv">TV/STB</SelectItem>
                                                        <SelectItem value="monitor">Monitor</SelectItem>
                                                        <SelectItem value="other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Location</Label>
                                                <Select value={newDevice.location} onValueChange={v => setNewDevice({ ...newDevice, location: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {LOCATIONS.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleAddDevice} className="w-full bg-gradient-to-r from-sky-500 to-blue-600">
                                            Add Device
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                {/* Devices Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDevices.map((device, i) => {
                        const Icon = deviceIcons[device.type] || Box;
                        const statusConfig = getStatusConfig(device.status);
                        return (
                            <motion.div
                                key={device.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Card className="group hover:shadow-xl transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600">
                                                <Icon className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold truncate">{device.name}</h3>
                                                <p className="text-sm text-muted-foreground truncate">{device.location}</p>
                                                <div className="flex items-center gap-2 mt-3">
                                                    <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0`}>
                                                        {statusConfig.label}
                                                    </Badge>
                                                    {device.status === 'available' ? (
                                                        <Button size="sm" variant="outline" onClick={() => handleCheckOut(device.id)}>
                                                            Check Out
                                                        </Button>
                                                    ) : device.status === 'checked-out' ? (
                                                        <Button size="sm" variant="outline" onClick={() => handleCheckIn(device.id)}>
                                                            Check In
                                                        </Button>
                                                    ) : null}
                                                </div>
                                                {device.checkedOutBy && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        Used by: {device.checkedOutBy.name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {filteredDevices.length === 0 && !loading && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No devices found</h3>
                            <p className="text-muted-foreground">Try adjusting your search or filters</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
