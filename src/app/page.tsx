"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
    CheckCircle2, Smartphone, BarChart3, ClipboardCheck,
    Bug, Users, Zap, ArrowRight, Shield, Globe
} from 'lucide-react';

const FEATURES = [
    { icon: ClipboardCheck, title: 'Test Management', desc: 'Plan, execute, and track test suites with step-by-step run execution.' },
    { icon: Bug, title: 'Bug Tracking', desc: 'Track bugs with Jira sync, priority analytics, and KPI dashboards.' },
    { icon: Smartphone, title: 'Device Fleet (Keepr)', desc: 'Track who has what device, weekly audits, QR checkout, real-time sync.' },
    { icon: BarChart3, title: 'QA Analytics', desc: 'KPIs, pass rates, team performance, and trend visualization.' },
    { icon: Users, title: 'Team Management', desc: 'Roles, worklog tracking, and capacity planning for your QA org.' },
    { icon: Zap, title: 'Automation Runner', desc: 'Run and monitor automated test suites with live execution telemetry.' },
];

const PRICING = [
    { name: 'Free', price: '₹0', period: '/forever', features: ['3 users', '5 test plans', '10 devices', 'Basic analytics'], cta: 'Start Free', popular: false },
    { name: 'Pro', price: '₹999', period: '/user/month', features: ['Unlimited users', 'Unlimited plans', 'Unlimited devices', 'Jira integration', 'Priority support'], cta: 'Start Trial', popular: true },
    { name: 'Enterprise', price: '₹2,499', period: '/user/month', features: ['Everything in Pro', 'SSO / SAML', 'API access', 'Custom integrations', 'Dedicated support'], cta: 'Contact Sales', popular: false },
];

export default function RootPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    // Redirect authenticated users straight to dashboard
    useEffect(() => {
        if (!loading && user) router.push('/dashboard');
    }, [user, loading, router]);

    // While checking auth, show nothing (brief)
    if (loading || user) return null;

    // Landing page for unauthenticated visitors
    const fade = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-black text-lg tracking-tight">Zenit</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login">
                            <Button variant="ghost" className="text-sm text-white/70 hover:text-white">Log in</Button>
                        </Link>
                        <Link href="/signup">
                            <Button className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-600/25">
                                Start Free <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl" />
                </div>
                <motion.div initial="hidden" animate="show" variants={stagger} className="relative max-w-4xl mx-auto">
                    <motion.div variants={fade} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-semibold mb-6">
                        <Globe className="w-3.5 h-3.5" />Built for QA teams in India &amp; beyond
                    </motion.div>
                    <motion.h1 variants={fade} className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-6">
                        The QA Platform<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">That Does Everything</span>
                    </motion.h1>
                    <motion.p variants={fade} className="text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
                        Test management, bug tracking, device fleet control, automation, and analytics — unified in one platform. Built by QA engineers, for QA teams.
                    </motion.p>
                    <motion.div variants={fade} className="flex items-center justify-center gap-4 flex-wrap">
                        <Link href="/signup">
                            <Button size="lg" className="h-12 px-8 text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-xl shadow-indigo-600/30">
                                Get Started Free
                            </Button>
                        </Link>
                        <a href="#pricing">
                            <Button size="lg" className="h-12 px-8 text-sm font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-none">
                                See Pricing
                            </Button>
                        </a>
                    </motion.div>
                    <motion.p variants={fade} className="text-xs text-slate-500 mt-4">Free 90-day pilot for the first cohort of teams. We&apos;re looking for feedback, not credit cards.</motion.p>
                </motion.div>
            </section>

            {/* Features */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
                        <motion.h2 variants={fade} className="text-3xl font-black text-center mb-4">Everything Your QA Team Needs</motion.h2>
                        <motion.p variants={fade} className="text-center text-slate-400 mb-12 max-w-xl mx-auto">Replace 5 separate tools with one integrated platform.</motion.p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {FEATURES.map((f, i) => (
                                <motion.div key={i} variants={fade} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all">
                                    <f.icon className="w-8 h-8 text-indigo-400 mb-4" />
                                    <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-20 px-6 bg-slate-900/50">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
                        <motion.h2 variants={fade} className="text-3xl font-black text-center mb-4">Simple, Transparent Pricing</motion.h2>
                        <motion.p variants={fade} className="text-center text-slate-400 mb-12">Start free. Upgrade when you need more.</motion.p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {PRICING.map((p, i) => (
                                <motion.div key={i} variants={fade} className={`p-6 rounded-2xl border ${p.popular ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20' : 'border-white/10 bg-white/5'}`}>
                                    {p.popular && <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-3">Most Popular</p>}
                                    <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-black">{p.price}</span>
                                        <span className="text-sm text-slate-400">{p.period}</span>
                                    </div>
                                    <ul className="space-y-2.5 mb-6">
                                        {p.features.map((f, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />{f}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link href="/signup">
                                        <Button className={`w-full h-10 text-sm font-bold ${p.popular ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white/10 hover:bg-white/15 text-white'} border-0`}>
                                            {p.cta}
                                        </Button>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/10">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <Shield className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-bold text-sm">Zenit Tracker</span>
                    </div>
                    <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Zenit Antigravity. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
