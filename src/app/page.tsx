"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ZenitMark, ZenitLogo } from '@/components/brand/zenit-logo';
import ZenitSplashAnimation from '@/components/zenit-splash-animation';
import { CURRENCIES, fmtPrice, annualPrice, currencyForCountry, type CurrencyCode } from '@/lib/pricing';
import {
    CheckCircle2, Smartphone, BarChart3, ClipboardCheck, Bug, Users, Zap,
    ArrowRight, Globe, ShieldCheck, Workflow, Star, ChevronDown,
} from 'lucide-react';

// ─── Branded splash uses the exact in-app ZenitSplashAnimation component ─────

const FEATURES = [
    { icon: ClipboardCheck, title: 'Test Management', desc: 'Plan, execute, and track suites with step-by-step run execution and live pass-rates.', span: 'lg:col-span-2' },
    { icon: Smartphone, title: 'Device Fleet — Keepr', desc: 'Know which phone every bug came from. QR checkout, weekly audits, real-time sync.', span: '' },
    { icon: Bug, title: 'Bug Tracking', desc: 'Jira sync, priority analytics, KPI dashboards.', span: '' },
    { icon: BarChart3, title: 'QA Analytics', desc: 'Pass rates, coverage, team performance and trend visualization in 3D.', span: 'lg:col-span-2' },
    { icon: Users, title: 'Team & Worklog', desc: 'Roles, capacity, and time tracking.', span: '' },
    { icon: Zap, title: 'Automation Runner', desc: 'Run and monitor automated suites with live telemetry.', span: '' },
];

const FAQS = [
    { q: 'How is Zenit different from TestRail or Zephyr?', a: 'Those tools only do test management. Zenit unifies test management, bug tracking, device fleet management, automation, and analytics in one platform — at a fraction of the price.' },
    { q: 'Can I import my existing test cases?', a: 'Yes. Create a plan, add cases manually or in bulk, and start running. Spreadsheet import is on the roadmap.' },
    { q: 'Is there a free plan?', a: 'Yes — 3 users, 5 test plans, and basic device tracking, free forever. Upgrade when your team grows.' },
    { q: 'Do you integrate with Jira?', a: 'Yes. Bug analytics and KPI dashboards sync directly with your Jira project on the Pro and Enterprise plans.' },
];

export default function RootPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [splash, setSplash] = useState(true);
    const [cur, setCur] = useState<CurrencyCode>('INR');
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    // redirect logged-in users to the app
    useEffect(() => { if (!loading && user) router.push('/dashboard'); }, [user, loading, router]);

    // reveal the page after the in-app splash finishes (matches ZenitSplashAnimation's 3.5s)
    useEffect(() => { const t = setTimeout(() => setSplash(false), 3600); return () => clearTimeout(t); }, []);

    // detect currency from visitor geography (works behind a VPN)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            // 1) Vercel edge header (server-side) — accurate on production
            try {
                const r = await fetch('/api/geo', { cache: 'no-store' });
                const d = await r.json();
                if (!cancelled && d?.country && d?.currency) { setCur(d.currency); return; }
            } catch { /* ignore */ }
            // 2) Client-side IP lookup fallback — reads the browser's egress (VPN) IP
            try {
                const r2 = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
                const d2 = await r2.json();
                if (!cancelled && d2?.country_code) setCur(currencyForCountry(d2.country_code));
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading || user) return null;

    const cfg = CURRENCIES[cur];
    const proPrice = cycle === 'annual' ? annualPrice(cfg.pro) : cfg.pro;
    const entPrice = cycle === 'annual' ? annualPrice(cfg.enterprise) : cfg.enterprise;
    const per = cycle === 'annual' ? '/yr per user' : '/mo per user';

    const fade = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

    return (
        <div className="min-h-screen bg-[#05070f] text-white overflow-x-hidden selection:bg-[#007BFF]/30">
            {splash && <ZenitSplashAnimation />}

            {/* Aurora background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute -top-40 left-1/4 w-[40rem] h-[40rem] bg-[#007BFF]/10 rounded-full blur-[120px]" />
                <div className="absolute top-1/3 -right-40 w-[36rem] h-[36rem] bg-[#00C6FF]/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-1/3 w-[32rem] h-[32rem] bg-violet-600/8 rounded-full blur-[120px]" />
                <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
            </div>

            {/* Nav */}
            <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#05070f]/70 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <ZenitLogo />
                    <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login"><Button variant="ghost" className="text-sm text-white/70 hover:text-white">Log in</Button></Link>
                        <Link href="/signup">
                            <Button className="text-sm bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-lg shadow-[#007BFF]/25">
                                Get Started <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-36 pb-24 px-6 text-center">
                <motion.div initial="hidden" animate={splash ? 'hidden' : 'show'} variants={stagger} className="max-w-4xl mx-auto">
                    <motion.div variants={fade} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[#5cc8ff] font-semibold mb-8">
                        <Globe className="w-3.5 h-3.5" />The all-in-one QA platform
                    </motion.div>
                    <motion.div variants={fade} className="flex justify-center mb-6">
                        <ZenitMark className="w-16 h-16" />
                    </motion.div>
                    <motion.h1 variants={fade} className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        Ship quality<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] via-[#00C6FF] to-violet-400">at the speed of trust.</span>
                    </motion.h1>
                    <motion.p variants={fade} className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Test management, bug tracking, device fleet control, automation and analytics — unified in one beautiful platform. Built by QA engineers, for QA teams.
                    </motion.p>
                    <motion.div variants={fade} className="flex items-center justify-center gap-4 flex-wrap">
                        <Link href="/signup">
                            <Button size="lg" className="h-12 px-8 text-sm font-bold bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-xl shadow-[#007BFF]/30">
                                Start Free — No Credit Card
                            </Button>
                        </Link>
                        <a href="#pricing">
                            <Button size="lg" className="h-12 px-8 text-sm font-bold bg-white/5 hover:bg-white/10 text-white border border-white/15">
                                View Pricing
                            </Button>
                        </a>
                    </motion.div>
                    <motion.div variants={fade} className="flex items-center justify-center gap-6 mt-8 text-xs text-white/40">
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Free forever plan</span>
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Setup in 5 minutes</span>
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Cancel anytime</span>
                    </motion.div>
                </motion.div>

                {/* App preview mockup */}
                <motion.div
                    initial={{ opacity: 0, y: 60, rotateX: 12 }}
                    animate={splash ? {} : { opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="max-w-5xl mx-auto mt-16 [perspective:1000px]"
                >
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent backdrop-blur-sm shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 h-9 border-b border-white/10 bg-white/[0.03]">
                            <span className="w-3 h-3 rounded-full bg-red-400/70" />
                            <span className="w-3 h-3 rounded-full bg-amber-400/70" />
                            <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
                            <span className="ml-3 text-[11px] text-white/30">app.zenittracker.com/dashboard</span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: 'Pass Rate', value: '98.2%', color: 'from-emerald-500/20 to-emerald-500/5', accent: 'text-emerald-400' },
                                { label: 'Active Runs', value: '3', color: 'from-[#007BFF]/20 to-[#007BFF]/5', accent: 'text-[#5cc8ff]' },
                                { label: 'Devices Tracked', value: '35', color: 'from-violet-500/20 to-violet-500/5', accent: 'text-violet-400' },
                            ].map((c, i) => (
                                <div key={i} className={`rounded-xl border border-white/10 bg-gradient-to-br ${c.color} p-4 text-left`}>
                                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">{c.label}</p>
                                    <p className={`text-3xl font-black mt-1 ${c.accent}`}>{c.value}</p>
                                </div>
                            ))}
                            <div className="md:col-span-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-end gap-2 h-28">
                                {[40, 65, 50, 80, 70, 95, 60, 88, 72, 90].map((h, i) => (
                                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#007BFF] to-[#00C6FF]" style={{ height: `${h}%`, opacity: 0.5 + (i / 20) }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Trust band */}
            <section className="py-10 px-6 border-y border-white/5">
                <p className="text-center text-xs uppercase tracking-[0.3em] text-white/30 mb-6">Replaces the tools you&apos;re already paying for</p>
                <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap text-white/30 text-sm font-semibold">
                    <span>TestRail</span><span>+</span><span>Zephyr</span><span>+</span><span>Spreadsheets</span><span>+</span><span>Device Drawer</span><span>=</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF] font-black">Zenit</span>
                </div>
            </section>

            {/* Features — bento */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
                        <motion.h2 variants={fade} className="text-4xl font-black text-center mb-3">Everything your QA team needs</motion.h2>
                        <motion.p variants={fade} className="text-center text-white/40 mb-14 max-w-xl mx-auto">One platform. Zero context-switching.</motion.p>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {FEATURES.map((f, i) => (
                                <motion.div key={i} variants={fade} className={`group p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#007BFF]/40 hover:bg-[#007BFF]/[0.04] transition-all ${f.span}`}>
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#007BFF]/20 to-[#00C6FF]/10 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <f.icon className="w-5 h-5 text-[#5cc8ff]" />
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                                    <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 px-6 border-y border-white/5 bg-white/[0.02]">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { v: '5-in-1', l: 'Tools unified' },
                        { v: '5 min', l: 'To first test run' },
                        { v: '3×', l: 'Cheaper than TestRail' },
                        { v: '100%', l: 'Web-based, no install' },
                    ].map((s, i) => (
                        <div key={i}>
                            <p className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF]">{s.v}</p>
                            <p className="text-xs text-white/40 mt-1.5">{s.l}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-4xl font-black text-center mb-3">Simple, fair pricing</h2>
                    <p className="text-center text-white/40 mb-3">
                        Showing prices in <span className="text-white font-semibold">{cfg.code}</span>
                        <span className="text-white/30"> · auto-detected for your region</span>
                    </p>
                    {/* cycle toggle */}
                    <div className="flex justify-center mb-12">
                        <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                            <button onClick={() => setCycle('monthly')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cycle === 'monthly' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Monthly</button>
                            <button onClick={() => setCycle('annual')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cycle === 'annual' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Annual <span className="text-emerald-400">−17%</span></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Free */}
                        <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                            <h3 className="text-lg font-bold mb-1">Free</h3>
                            <div className="text-3xl font-black mb-1">{fmtPrice(0, cfg)}</div>
                            <p className="text-xs text-white/40 mb-6">Forever, for individuals</p>
                            <ul className="space-y-2.5 mb-7">
                                {['3 users', '5 test plans', '10 devices', 'Basic analytics'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-white/60"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{f}</li>
                                ))}
                            </ul>
                            <Link href="/signup"><Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">Start Free</Button></Link>
                        </div>

                        {/* Pro */}
                        <div className="relative p-7 rounded-2xl border border-[#007BFF]/40 bg-gradient-to-b from-[#007BFF]/10 to-transparent ring-1 ring-[#007BFF]/20">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#007BFF] to-[#00C6FF] text-white">Most Popular</span>
                            <h3 className="text-lg font-bold mb-1">Pro</h3>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-3xl font-black">{fmtPrice(proPrice, cfg)}</span>
                                <span className="text-sm text-white/40">{per}</span>
                            </div>
                            <p className="text-xs text-white/40 mb-6">For growing QA teams</p>
                            <ul className="space-y-2.5 mb-7">
                                {['Unlimited users', 'Unlimited plans', 'Unlimited devices', 'Jira integration', 'Advanced analytics', 'Priority support'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-white/70"><CheckCircle2 className="w-4 h-4 text-[#5cc8ff]" />{f}</li>
                                ))}
                            </ul>
                            <Link href="/signup"><Button className="w-full bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0">Start Trial</Button></Link>
                        </div>

                        {/* Enterprise */}
                        <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                            <h3 className="text-lg font-bold mb-1">Enterprise</h3>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-3xl font-black">{fmtPrice(entPrice, cfg)}</span>
                                <span className="text-sm text-white/40">{per}</span>
                            </div>
                            <p className="text-xs text-white/40 mb-6">For large QA departments</p>
                            <ul className="space-y-2.5 mb-7">
                                {['Everything in Pro', 'SSO / SAML', 'API access', 'Custom integrations', 'Dedicated support'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-white/60"><CheckCircle2 className="w-4 h-4 text-violet-400" />{f}</li>
                                ))}
                            </ul>
                            <Link href="/signup"><Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">Get Started</Button></Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-black text-center mb-12">Questions, answered</h2>
                    <div className="space-y-3">
                        {FAQS.map((f, i) => (
                            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                                    <span className="font-semibold text-sm">{f.q}</span>
                                    <ChevronDown className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openFaq === i && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <p className="px-5 pb-4 text-sm text-white/50 leading-relaxed">{f.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#007BFF]/15 via-[#00C6FF]/8 to-transparent p-12 md:p-16 text-center relative overflow-hidden">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#007BFF]/20 rounded-full blur-[100px]" />
                    <div className="relative">
                        <ZenitMark className="w-14 h-14 mx-auto mb-6" />
                        <h2 className="text-4xl font-black mb-4">Bring your QA into one place.</h2>
                        <p className="text-white/50 mb-8 max-w-lg mx-auto">Start free in minutes. No credit card, no migration headache.</p>
                        <Link href="/signup">
                            <Button size="lg" className="h-12 px-10 text-sm font-bold bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-xl shadow-[#007BFF]/30">
                                Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/10">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <ZenitLogo markClassName="w-6 h-6" />
                    <div className="flex items-center gap-6 text-xs text-white/40">
                        <a href="#features" className="hover:text-white">Features</a>
                        <a href="#pricing" className="hover:text-white">Pricing</a>
                        <Link href="/login" className="hover:text-white">Log in</Link>
                    </div>
                    <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Zenit Antigravity</p>
                </div>
            </footer>
        </div>
    );
}
