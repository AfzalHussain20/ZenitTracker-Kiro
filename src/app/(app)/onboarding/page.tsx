'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Rocket, Users, CheckCircle2, Loader2, Building2, Zap } from 'lucide-react';
import { PLAN_PRICING, type PlanTier } from '@/types/organization';

export default function OnboardingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<'welcome' | 'create' | 'plan' | 'done'>('welcome');
    const [orgName, setOrgName] = useState('');
    const [orgId, setOrgId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const createOrg = async () => {
        if (!orgName.trim() || !user) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: orgName.trim(),
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email?.split('@')[0],
                }),
            });
            const data = await res.json();
            if (data.success) {
                setOrgId(data.orgId);
                setStep('plan');
            } else {
                setError(data.error || 'Failed to create organization');
            }
        } catch {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    };

    const choosePlan = async (plan: PlanTier) => {
        if (plan === 'free') {
            // activate free instantly
            setSaving(true);
            try {
                await fetch('/api/billing/activate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: user?.uid, orgId, plan: 'free' }),
                });
                setStep('done');
                setTimeout(() => router.push('/dashboard'), 1500);
            } catch {} finally { setSaving(false); }
        } else {
            router.push(`/billing/checkout?plan=${plan}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {step === 'welcome' && (
                    <Card className="border-indigo-500/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
                        <CardContent className="p-8 text-center space-y-6">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                                <Rocket className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white mb-2">Welcome to Zenit</h1>
                                <p className="text-sm text-slate-400">
                                    Let&apos;s set up your workspace. This takes 30 seconds.
                                </p>
                            </div>
                            <div className="space-y-3 text-left">
                                {[
                                    { icon: Building2, text: 'Create your organization' },
                                    { icon: Users, text: 'Invite your team' },
                                    { icon: CheckCircle2, text: 'Start testing' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10">
                                        <item.icon className="w-4 h-4 text-indigo-400" />
                                        <span className="text-sm text-slate-300">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                            <Button
                                onClick={() => setStep('create')}
                                className="w-full h-11 text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-lg"
                            >
                                Get Started
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 'create' && (
                    <Card className="border-indigo-500/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
                        <CardContent className="p-8 space-y-6">
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-500/20 flex items-center justify-center mb-3">
                                    <Building2 className="w-6 h-6 text-indigo-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Name your organization</h2>
                                <p className="text-xs text-slate-400 mt-1">Your team or company name. You can change it later.</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-300">Organization Name</Label>
                                <Input
                                    value={orgName}
                                    onChange={e => setOrgName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') createOrg(); }}
                                    placeholder="e.g. Zenit Antigravity"
                                    className="h-11 text-sm bg-white/5 border-white/15 text-white placeholder-white/40"
                                    autoFocus
                                />
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                            <Button
                                onClick={createOrg}
                                disabled={saving || !orgName.trim()}
                                className="w-full h-11 text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-lg"
                            >
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                {saving ? 'Creating…' : 'Create Organization'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 'plan' && (
                    <Card className="border-indigo-500/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
                        <CardContent className="p-8 space-y-5">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-white">Choose your plan</h2>
                                <p className="text-xs text-slate-400 mt-1">Start free, upgrade anytime.</p>
                            </div>
                            <div className="space-y-3">
                                {/* Free */}
                                <button
                                    onClick={() => choosePlan('free')}
                                    disabled={saving}
                                    className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-zinc-400" />
                                            <span className="font-bold text-white">Free</span>
                                        </div>
                                        <span className="text-sm text-slate-400">₹0</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">3 users · 5 plans · 10 devices</p>
                                </button>
                                {/* Pro */}
                                <button
                                    onClick={() => choosePlan('pro')}
                                    className="w-full text-left p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/15 transition-all relative"
                                >
                                    <span className="absolute top-3 right-3 text-[9px] uppercase font-bold text-emerald-400">Popular</span>
                                    <div className="flex items-center gap-2">
                                        <Rocket className="w-4 h-4 text-emerald-400" />
                                        <span className="font-bold text-white">Pro</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">₹{PLAN_PRICING.pro.monthly}/user/mo · Unlimited everything + Jira</p>
                                </button>
                                {/* Enterprise */}
                                <button
                                    onClick={() => choosePlan('enterprise')}
                                    className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all"
                                >
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-indigo-400" />
                                        <span className="font-bold text-white">Enterprise</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">₹{PLAN_PRICING.enterprise.monthly}/user/mo · SSO + API + dedicated support</p>
                                </button>
                            </div>
                            {saving && <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>}
                        </CardContent>
                    </Card>
                )}

                {step === 'done' && (
                    <Card className="border-emerald-500/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
                        <CardContent className="p-8 text-center space-y-4">
                            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white">You&apos;re all set!</h2>
                            <p className="text-sm text-slate-400">Redirecting to your dashboard…</p>
                        </CardContent>
                    </Card>
                )}
            </motion.div>
        </div>
    );
}
