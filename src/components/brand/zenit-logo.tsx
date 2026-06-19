'use client';

import { cn } from '@/lib/utils';

/** The original Zenit mark — animated "Z" that draws itself, with the signature dot. */
export function ZenitMark({ className, animate = false }: { className?: string; animate?: boolean }) {
    return (
        <svg viewBox="0 0 100 100" className={cn('overflow-visible', className)}>
            <defs>
                <linearGradient id="zenitBrand" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#007BFF" />
                    <stop offset="100%" stopColor="#00C6FF" />
                </linearGradient>
            </defs>
            <path
                d="M 15 25 H 80 L 30 80 H 65"
                stroke="url(#zenitBrand)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={animate ? { strokeDasharray: 240, strokeDashoffset: 240, animation: 'zdraw 1.4s ease-out forwards' } : undefined}
            />
            <circle cx="75" cy="28" r="7" fill="#00AFFF"
                style={animate ? { opacity: 0, animation: 'zdot 0.4s ease-out 1.3s forwards' } : undefined}
            />
            {animate && (
                <style>{`
                    @keyframes zdraw { to { stroke-dashoffset: 0; } }
                    @keyframes zdot { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
                `}</style>
            )}
        </svg>
    );
}

/** Logo + wordmark lockup */
export function ZenitLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
    return (
        <div className={cn('flex items-center gap-2.5', className)}>
            <ZenitMark className={cn('w-8 h-8', markClassName)} />
            <span className="font-black text-lg tracking-tight">
                Zenit<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF]"> Tracker</span>
            </span>
        </div>
    );
}
