'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    LayoutDashboard, ArrowLeft, Settings, Bell, Search,
    ChevronRight, Sparkles, Menu, X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AppShellProps {
    children: ReactNode;
    appName: string;
    appIcon: ReactNode;
    subtitle?: string;
    accentColor: string;
    navItems: { label: string; href: string; icon: ReactNode; badge?: string }[];
    fullWidth?: boolean;
    hideTopBar?: boolean;
}

export function AppShell({
    children,
    appName,
    appIcon,
    subtitle,
    accentColor,
    navItems = [],
    fullWidth = false,
    hideTopBar = false
}: AppShellProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0, width: sidebarOpen ? 280 : 80 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 bottom-0 z-[150] hidden lg:flex flex-col border-r border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl"
            >
                {/* App Header */}
                <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                        <motion.div
                            className="p-2 rounded-xl"
                            style={{ backgroundColor: `${accentColor}15` }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {appIcon}
                        </motion.div>
                        <AnimatePresence>
                            {sidebarOpen && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                >
                                    <h1 className="text-xl font-bold tracking-tight" style={{ color: accentColor }}>
                                        {appName}
                                    </h1>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Zenit Suite</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href}>
                                <motion.div
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all
                                        ${isActive
                                            ? 'text-white shadow-lg'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }
                                    `}
                                    style={isActive ? { backgroundColor: accentColor } : {}}
                                    whileHover={{ x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {item.icon}
                                    <AnimatePresence>
                                        {sidebarOpen && (
                                            <motion.span
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="font-medium text-sm flex-1"
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                    {item.badge && sidebarOpen && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/20">
                                            {item.badge}
                                        </span>
                                    )}
                                </motion.div>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50">
                    <Link href="/dashboard">
                        <motion.div
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            whileHover={{ x: 4 }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            {sidebarOpen && <span className="font-medium text-sm">Back to Hub</span>}
                        </motion.div>
                    </Link>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-full mt-2 text-slate-400"
                    >
                        <ChevronRight className={`w-5 h-5 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
                    </Button>
                </div>
            </motion.aside>

            {/* Mobile Header */}
            {!hideTopBar && (
                <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
                                <Menu className="w-5 h-5" />
                            </Button>
                            <div className="flex items-center gap-2">
                                {appIcon}
                                <span className="font-bold" style={{ color: accentColor }}>{appName}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
                                <Search className="w-5 h-5" />
                            </Button>
                            <Button variant="ghost" size="icon">
                                <Bell className="w-5 h-5" />
                            </Button>
                            <Avatar className="w-8 h-8">
                                <AvatarImage src={user?.photoURL || ''} />
                                <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white dark:bg-slate-900 p-6"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    {appIcon}
                                    <span className="font-bold text-lg" style={{ color: accentColor }}>{appName}</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <nav className="space-y-1">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                                            <div
                                                className={`
                                                    flex items-center gap-3 px-4 py-3 rounded-xl
                                                    ${isActive ? 'text-white' : 'text-slate-600'}
                                                `}
                                                style={isActive ? { backgroundColor: accentColor } : {}}
                                            >
                                                {item.icon}
                                                <span className="font-medium">{item.label}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="absolute bottom-6 left-6 right-6">
                                <Link href="/dashboard">
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-100">
                                        <ArrowLeft className="w-5 h-5" />
                                        <span className="font-medium">Back to Hub</span>
                                    </div>
                                </Link>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className={`lg:ml-[280px] h-screen transition-all flex flex-col ${!sidebarOpen ? 'lg:ml-[80px]' : ''} ${!hideTopBar ? 'pt-[72px] lg:pt-0' : 'pt-0'}`}>
                {/* Desktop Top Bar */}
                {!hideTopBar && (
                    <div className="hidden lg:flex sticky top-0 z-30 h-16 shrink-0 items-center justify-between px-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100">{appIcon}</div>
                                <div>
                                    <h2 className="text-sm font-black text-slate-950 tracking-tight">{appName}</h2>
                                    {subtitle && <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{subtitle}</p>}
                                </div>
                            </div>

                            <div className="relative group w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                <button
                                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                                    className="w-full text-left bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-2 pl-10 pr-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Omni Search... <span className="float-right opacity-50">Ctrl+K</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="relative text-slate-400">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
                            </Button>
                            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-[12px] font-bold leading-none">{user?.displayName || 'Operative'}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Active</p>
                                </div>
                                <Avatar className="w-9 h-9 border-2 border-white shadow-sm">
                                    <AvatarImage src={user?.photoURL || ''} />
                                    <AvatarFallback className="bg-primary text-white text-[10px] font-bold">
                                        {user?.displayName?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </div>
                    </div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`flex-1 overflow-hidden ${fullWidth ? 'p-0' : 'p-6 lg:p-10'}`}
                >
                    {children}
                </motion.div>
            </main>
        </div>
    );
}
