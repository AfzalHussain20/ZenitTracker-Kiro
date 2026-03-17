import { useState, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Layers,
    CircleDot,
    Search,
    Terminal,
    PlayCircle,
    FileCode2,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Database,
    History,
    FileText
} from 'lucide-react';

const MENU_ITEMS = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { path: '/suites', label: 'Test Suites', icon: <Layers size={18} /> },
    { path: '/recorder', label: 'Recorder', icon: <CircleDot size={18} /> },
    { path: '/inspector', label: 'Inspector', icon: <Search size={18} /> },
    { path: '/scripts', label: 'Scripts', icon: <FileCode2 size={18} /> },
    { path: '/runner', label: 'Test Runner', icon: <PlayCircle size={18} /> },
    { path: '/templates', label: 'Templates', icon: <Database size={18} /> },
    { path: '/docs', label: 'Docs', icon: <FileText size={18} /> },
    { path: '/locators', label: 'Locators', icon: <ShieldCheck size={18} /> },
];

export default function Layout({ children }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex h-screen bg-[#09090b] text-zinc-100 font-inter overflow-hidden">
            {/* Sidebar */}
            <aside className={`
        ${collapsed ? 'w-20' : 'w-64'} 
        h-full bg-[#121215] border-r border-zinc-800/40 transition-all duration-300 ease-in-out flex flex-col relative z-20 group/sidebar
      `}>
                {/* Toggle Button */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute -right-3 top-20 bg-pink-500 hover:bg-pink-600 text-white rounded-full p-1 shadow-[0_0_15px_rgba(236,72,153,0.3)] z-30 transition-transform hover:scale-110"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Logo */}
                <div className={`p-6 mb-8 flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-3'}`}>
                    <div className="w-10 h-10 bg-gradient-to-br from-pink-500 via-sky-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.2)] animate-pulse-glow">
                        <Terminal className="text-white" size={24} />
                    </div>
                    {!collapsed && (
                        <div>
                            <h1 className="font-barlow text-xl font-bold tracking-widest uppercase italic bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                                Zenit QA
                            </h1>
                            <p className="text-[10px] text-zinc-600 font-mono tracking-tighter -mt-1 uppercase">Automate Everything</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2">
                    {MENU_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200 group
                ${isActive ? 'bg-zinc-800/60 text-pink-400 border border-zinc-700/50 shadow-inner' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}
              `}
                        >
                            <div className="text-current shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]">
                                {item.icon}
                            </div>
                            {!collapsed && (
                                <span className="font-barlow tracking-wider font-semibold uppercase text-xs">
                                    {item.label}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User Profile Info */}
                <div className={`p-6 border-t border-zinc-900 flex items-center ${collapsed ? 'justify-center' : 'gap-4'}`}>
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500">
                        <Database size={14} />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase font-barlow tracking-widest truncate">Environment</p>
                            <p className="text-xs font-medium text-sky-500 truncate uppercase">STAGING_UAT_1</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-full overflow-hidden flex flex-col relative">
                {/* Background Gradients */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-pink-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none -z-10" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-sky-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none -z-10" />

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {children}
                </div>
            </main>
        </div>
    );
}
