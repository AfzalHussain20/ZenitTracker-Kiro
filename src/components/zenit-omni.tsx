"use client";

import React, { useState, useEffect, useRef } from "react";
import { Command } from "cmdk";
import {
    Search, GraduationCap, Shield, Activity,
    Layout, User, Compass, Trophy, Bot, Library,
    FlaskConical, ClipboardCheck, Info, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function ZenitOmni() {
    const [open, setOpen] = useState(false);
    const [verifyMode, setVerifyMode] = useState(false);
    const [credId, setCredId] = useState("");
    const credInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { user } = useAuth();

    // Trigger on Ctrl+K (Windows) or Cmd+K (Mac)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === "Escape") {
                if (verifyMode) {
                    setVerifyMode(false);
                    setCredId("");
                } else {
                    setOpen(false);
                }
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [verifyMode]);

    // Focus credential input when verify mode activates
    useEffect(() => {
        if (verifyMode && credInputRef.current) {
            setTimeout(() => credInputRef.current?.focus(), 50);
        }
    }, [verifyMode]);

    const runCommand = (action: () => void) => {
        setOpen(false);
        setVerifyMode(false);
        setCredId("");
        setTimeout(action, 80);
    };

    const handleVerifySubmit = () => {
        const id = credId.trim();
        if (!id) return;
        runCommand(() => router.push(`/verify/${encodeURIComponent(id)}`));
    };

    return (
        <>
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="omni-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setOpen(false); setVerifyMode(false); setCredId(""); }}
                            className="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm"
                        />

                        {/* Panel */}
                        <motion.div
                            key="omni-panel"
                            initial={{ opacity: 0, scale: 0.97, y: -12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -12 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed left-1/2 top-[14vh] -translate-x-1/2 z-[100] w-full max-w-[680px] px-4"
                        >
                            <div className="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl rounded-[32px] border border-white/20 dark:border-zinc-800/50 shadow-[0_48px_100px_rgba(0,0,0,0.5)] overflow-hidden">
                                <Command className="flex flex-col bg-transparent" shouldFilter={!verifyMode}>

                                    {/* Search / Verify Input */}
                                    <div className="flex items-center border-b border-border/60 px-5 py-4 gap-3">
                                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                                        {verifyMode ? (
                                            <div className="flex flex-1 items-center gap-3">
                                                <input
                                                    ref={credInputRef}
                                                    value={credId}
                                                    onChange={e => setCredId(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleVerifySubmit(); if (e.key === 'Escape') { setVerifyMode(false); setCredId(""); } }}
                                                    placeholder="Enter Credential ID (e.g. ZNT-2024-001)..."
                                                    className="flex-1 bg-transparent border-none outline-none text-foreground text-sm font-medium placeholder:text-muted-foreground"
                                                />
                                                <button
                                                    onClick={handleVerifySubmit}
                                                    disabled={!credId.trim()}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
                                                >
                                                    Verify <ArrowRight className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => { setVerifyMode(false); setCredId(""); }}
                                                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Command.Input
                                                    placeholder="Search Zenit — navigate, tools, credentials..."
                                                    className="flex-1 bg-transparent border-none outline-none text-foreground text-sm font-medium placeholder:text-muted-foreground"
                                                />
                                                <kbd className="hidden sm:flex px-2 py-1 rounded-lg bg-muted text-[9px] font-black text-muted-foreground uppercase tracking-widest border border-border">
                                                    Esc
                                                </kbd>
                                            </>
                                        )}
                                    </div>

                                    {!verifyMode && (
                                        <Command.List className="max-h-[420px] overflow-y-auto p-3 select-none">

                                            <Command.Empty className="py-10 text-center flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                                    <Compass className="w-6 h-6 text-muted-foreground" />
                                                </div>
                                                <p className="text-sm font-medium text-muted-foreground mt-1">No results found.</p>
                                                <p className="text-xs text-muted-foreground/60">Try &apos;nexus&apos;, &apos;cert&apos;, &apos;automate&apos;, or &apos;verify&apos;.</p>
                                            </Command.Empty>

                                            {/* ── Navigation ─────────────────────────────────── */}
                                            <Group label="Navigation">
                                                <Item value="dashboard mission control home overview" onSelect={() => runCommand(() => router.push('/dashboard'))}>
                                                    <Layout className="w-4 h-4" />
                                                    <span>Mission Control</span>
                                                    <Shortcut>D</Shortcut>
                                                </Item>
                                                <Item value="nexus academy training learning courses lessons" onSelect={() => runCommand(() => router.push('/nexus'))}>
                                                    <GraduationCap className="w-4 h-4" />
                                                    <span>Zenit Academy Nexus</span>
                                                    <Shortcut>N</Shortcut>
                                                </Item>
                                                <Item value="automation hub sunnxt selenium bot scripts" onSelect={() => runCommand(() => router.push('/automation'))}>
                                                    <Bot className="w-4 h-4" />
                                                    <span>Automation Hub</span>
                                                    <Shortcut>A</Shortcut>
                                                </Item>
                                                <Item value="test repository library cases managed" onSelect={() => runCommand(() => router.push('/dashboard/repository'))}>
                                                    <Library className="w-4 h-4" />
                                                    <span>Test Repository</span>
                                                    <Shortcut>R</Shortcut>
                                                </Item>
                                            </Group>

                                            {/* ── Tools ──────────────────────────────────────── */}
                                            <Group label="Advanced Tools">
                                                <Item value="performance lab vitals web testing metrics reports" onSelect={() => runCommand(() => router.push('/performance'))}>
                                                    <Activity className="w-4 h-4" />
                                                    <span>Performance Lab</span>
                                                    <Shortcut>P</Shortcut>
                                                </Item>
                                                <Item value="locator studio inspector element finder xpath" onSelect={() => runCommand(() => router.push('/dashboard/locator-lab'))}>
                                                    <FlaskConical className="w-4 h-4" />
                                                    <span>Locator Studio</span>
                                                </Item>
                                                <Item value="test suite active run current execute tracker" onSelect={() => runCommand(() => router.push('/dashboard/repository'))}>
                                                    <ClipboardCheck className="w-4 h-4" />
                                                    <span>Active Test Suite</span>
                                                </Item>
                                            </Group>

                                            {/* ── Credentials ────────────────────────────────── */}
                                            <Group label="Credentials">
                                                <Item value="certificate certificates award graduation completion" onSelect={() => runCommand(() => router.push('/nexus?view=certificate'))}>
                                                    <Trophy className="w-4 h-4" />
                                                    <span>My Certificates</span>
                                                    <Shortcut>C</Shortcut>
                                                </Item>
                                                <Item value="verify credential id scan check certification" onSelect={() => setVerifyMode(true)}>
                                                    <Shield className="w-4 h-4" />
                                                    <span>Verify a Credential ID</span>
                                                    <Shortcut>V</Shortcut>
                                                </Item>
                                            </Group>

                                            {/* ── Account ────────────────────────────────────── */}
                                            <Group label="Account">
                                                <Item value="profile account settings preferences me" onSelect={() => runCommand(() => router.push('/profile'))}>
                                                    <User className="w-4 h-4" />
                                                    <span>My Profile</span>
                                                    {user?.email && (
                                                        <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[160px]">{user.email}</span>
                                                    )}
                                                </Item>
                                                <Item value="about information version platform zenit" onSelect={() => runCommand(() => router.push('/dashboard'))}>
                                                    <Info className="w-4 h-4" />
                                                    <span>About Zenit</span>
                                                </Item>
                                            </Group>

                                        </Command.List>
                                    )}

                                    {/* Footer */}
                                    <div className="border-t border-border/50 px-5 py-3 flex items-center justify-between bg-muted/20">
                                        <div className="flex items-center gap-5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                                            <span className="flex items-center gap-1.5">
                                                <kbd className="w-5 h-5 rounded bg-muted border border-border flex items-center justify-center text-[9px]">↲</kbd>
                                                Select
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <kbd className="w-5 h-5 rounded bg-muted border border-border flex items-center justify-center text-[9px]">↑↓</kbd>
                                                Navigate
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <kbd className="px-1.5 h-5 rounded bg-muted border border-border flex items-center justify-center text-[9px]">Esc</kbd>
                                                Close
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Zenit Omni</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        </div>
                                    </div>

                                </Command>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Command.Group heading={
            <span className="px-2 py-2 block text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
                {label}
            </span>
        }>
            {children}
        </Command.Group>
    );
}

function Item({ children, onSelect, value }: {
    children: React.ReactNode;
    onSelect: () => void;
    value?: string;
}) {
    return (
        <Command.Item
            onSelect={onSelect}
            value={value}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer text-sm text-foreground/80 transition-all duration-150 group data-[selected=true]:bg-primary/8 data-[selected=true]:text-primary hover:bg-primary/5 hover:text-primary"
        >
            {children}
        </Command.Item>
    );
}

function Shortcut({ children }: { children: React.ReactNode }) {
    return (
        <div className="ml-auto flex items-center gap-1 opacity-35 group-data-[selected=true]:opacity-100 transition-opacity">
            <kbd className="text-[9px] font-black px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl</kbd>
            <kbd className="text-[9px] font-black px-1.5 py-0.5 rounded bg-muted border border-border">{children}</kbd>
        </div>
    );
}
