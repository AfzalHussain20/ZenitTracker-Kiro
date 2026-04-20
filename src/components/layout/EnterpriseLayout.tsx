"use client";

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
    LayoutDashboard, Activity, Link as LinkIcon, PieChart, 
    Settings, Search, Bell, Menu, X, Terminal, Combine, Bug
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AdBanner from './AdBanner';
import { LogoIcon } from '@/components/ui/Logo';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Performance', href: '/performance', icon: <Activity className="w-5 h-5" /> },
    { label: 'Test Suites', href: '/test-suite', icon: <Combine className="w-5 h-5" /> },
    { label: 'Bug Tracker', href: '/bugs', icon: <Bug className="w-5 h-5" /> },
    { label: 'Analytics', href: '/analytics', icon: <PieChart className="w-5 h-5" /> },
    { label: 'Integrations', href: '/integrations', icon: <LinkIcon className="w-5 h-5" /> },
    { label: 'Settings', href: '/profile', icon: <Settings className="w-5 h-5" /> },
];

export default function EnterpriseLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            <AdBanner />
            
            {/* Top Navigation Bar (Azure/VS Code style Header) */}
            <header className="h-[48px] shrink-0 bg-secondary border-b border-border flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 text-foreground font-semibold">
                        <Terminal className="w-5 h-5 text-primary" />
                        <span>Zenit <span className="text-muted-foreground font-normal">Enterprise</span></span>
                    </div>
                </div>

                <div className="flex-1 max-w-xl mx-8">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Search resources, Test cases, or ID (Ctrl+K)" 
                            className="w-full h-8 bg-background border border-border rounded text-sm pl-9 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button className="text-muted-foreground hover:text-foreground transition-colors relative">
                        <Bell className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                    </button>
                    <div className="w-px h-6 bg-border" />
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <span className="text-sm font-medium hidden md:block">{user?.displayName || 'User'}</span>
                        <Avatar className="w-7 h-7 rounded border border-border">
                            <AvatarImage src={user?.photoURL || ''} />
                            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground rounded">
                                {user?.displayName?.[0] || 'U'}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Activity Bar */}
                <aside className={`bg-secondary border-r border-border transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-[240px]' : 'w-[50px]'} shrink-0`}>
                    <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div className={`flex items-center px-4 py-2 mx-2 rounded-sm cursor-pointer transition-colors ${
                                        isActive 
                                            ? 'bg-primary/10 text-primary font-medium' 
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}>
                                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                            {item.icon}
                                        </div>
                                        {sidebarOpen && (
                                            <span className="ml-3 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                                {item.label}
                                            </span>
                                        )}
                                        {isActive && sidebarOpen && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
                    <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto h-[calc(100%-24px)]">
                        {children}
                    </div>
                </main>
            </div>

            {/* VS Code Style Status Bar */}
            <footer className="h-[24px] shrink-0 bg-primary border-t border-border flex items-center justify-between px-3 text-[11px] text-primary-foreground font-sans z-50">
                <div className="flex items-center gap-4 h-full">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:bg-primary-foreground/20 h-full px-2 transition-colors">
                        <Terminal className="w-3 h-3" />
                        <span>Zenit Engine v2.4.1</span>
                    </div>
                    <div className="flex items-center gap-1.5 cursor-pointer hover:bg-primary-foreground/20 h-full px-2 transition-colors">
                        <X className="w-3 h-3 text-red-200" /> <span className="text-red-100">0</span>
                        <Bell className="w-3 h-3 text-yellow-200 ml-1" /> <span className="text-yellow-100">0</span>
                    </div>
                </div>
                <div className="flex items-center h-full">
                    <div className="flex items-center cursor-pointer hover:bg-primary-foreground/20 h-full px-2 transition-colors">
                        <span>Ln 1, Col 1</span>
                    </div>
                    <div className="flex items-center cursor-pointer hover:bg-primary-foreground/20 h-full px-2 transition-colors">
                        <span>UTF-8</span>
                    </div>
                    <div className="flex items-center cursor-pointer hover:bg-primary-foreground/20 h-full px-2 transition-colors">
                        <span>TypeScript React</span>
                    </div>
                    <div className="flex items-center cursor-pointer hover:bg-primary-foreground/20 h-full px-2 transition-colors">
                        <Activity className="w-3 h-3 mr-1" />
                        <span>Prettier</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
