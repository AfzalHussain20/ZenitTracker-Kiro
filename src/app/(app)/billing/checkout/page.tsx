'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Shield, CreditCard, ArrowLeft } from 'lucide-react';
import { PLAN_PRICING, type PlanTier } from '@/types/organization';
import Link from 'next/link';

const PLAN_FEATURES: Record<string, string[]> = {
    pro: ['Unlimited users', 'Unlimited test plans', 'Unlimited devices', 'Jira integration', 'Advanced analytics', 'Priority support'],
    enterprise: ['Everything in Pro', 'SSO / SAML', 'API access', 'Custom integrations', 'Dedicated support', 'On-premise option'],
};

function CheckoutInner() {
    const router = useRouter();
    const params = useSearchParams();
    const { user, orgId } = useAuth();
    const plan = (params.get('plan') as PlanTier) || 'pro';
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
    const [processing, setProcessing] = useState(false);
    const [done, setDone] = useState(false);

    const pricing = PLAN_PRICING[plan] ?? PLAN_PRICING.pro;
    const price = cycle === 'annual' ? pricing.annual : pricing.monthly;
    const features = PLAN_FEATURES[plan] ?? PLAN_FEATURES.pro;

    const activate = async (paymentRef?: string) => {
        if (!user) return;
        setProcessing(true);
        try {
            const res = await fetch('/api/billing/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, orgId, plan, paymentRef, billingCycle: cycle }),
            });
            const data = await res.json();
            if (data.success) {
                setDone(true);
                setTimeout(() => router.push('/dashboard'), 1800);
            }
        } catch {}
        finally { setProcessing(false); }
    };

    // Razorpay if configured, otherwise demo activation
    const handlePay = async () => {
        const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (rzpKey && typeof window !== 'undefined' && (window as any).Razorpay) {
            const rzp = new (window as any).Razorpay({
                key: rzpKey,
                amount: price * 100,
                currency: 'INR',
                name: 'Zenit Tracker',
                description: `${pricing.label} plan (${cycle})`,
                prefill: { email: user?.email ?? '', name: user?.displayName ?? '' },
                handler: (resp: any) => activate(resp.razorpay_payment_id),
                theme: { color: '#6366f1' },
            });
            rzp.open();
        } else {
            // Demo / manual-invoice activation — full flow works without a gateway
            await activate();
        }
    };

    // load Razorpay script if key present
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && typeof document !== 'undefined') {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.async = true;
            document.body.appendChild(s);
            return () => { document.body.removeChild(s); };
        }
    }, []);

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <Card className="border-emerald-500/20 bg-slate-900/80 backdrop-blur-xl">
                        <CardContent className="p-10 text-center space-y-4">
                            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white">You&apos;re on {pricing.label}!</h2>
                            <p className="text-sm text-slate-400">All premium features unlocked. Taking you to your dashboard…</p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 flex items-center justify-center">
            <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Plan summary */}
                <Card className="border-white/10 bg-slate-900/80 backdrop-blur-xl">
                    <CardContent className="p-8 space-y-6">
                        <Link href="/billing" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                            <ArrowLeft className="w-3.5 h-3.5" />Back to plans
                        </Link>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-indigo-400 font-bold">Selected Plan</p>
                            <h1 className="text-3xl font-black text-white mt-1">{pricing.label}</h1>
                        </div>

                        {/* Billing cycle toggle */}
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 w-fit">
                            <button onClick={() => setCycle('monthly')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${cycle === 'monthly' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Monthly</button>
                            <button onClick={() => setCycle('annual')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${cycle === 'annual' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                                Annual <span className="text-emerald-400">−17%</span>
                            </button>
                        </div>

                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-white">₹{price.toLocaleString('en-IN')}</span>
                            <span className="text-sm text-slate-400">/{cycle === 'annual' ? 'year' : 'month'} per user</span>
                        </div>

                        <ul className="space-y-2.5">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />{f}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Payment */}
                <Card className="border-indigo-500/20 bg-slate-900/80 backdrop-blur-xl">
                    <CardContent className="p-8 space-y-6">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-lg font-bold text-white">Complete your subscription</h2>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-slate-300">
                                <span>{pricing.label} ({cycle})</span>
                                <span>₹{price.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-white">
                                <span>Total due today</span>
                                <span>₹{price.toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        <Button
                            onClick={handlePay}
                            disabled={processing}
                            className="w-full h-12 text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-lg"
                        >
                            {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                            {processing ? 'Activating…' : `Pay ₹${price.toLocaleString('en-IN')} & Activate`}
                        </Button>

                        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                            Secure checkout. Cancel anytime. By subscribing you agree to our Terms of Service.
                            {!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && (
                                <span className="block mt-1 text-amber-400/70">Demo mode — payment gateway not yet configured; plan activates instantly.</span>
                            )}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>}>
            <CheckoutInner />
        </Suspense>
    );
}
