"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Zap, Shield, BarChart3, Users, Rocket, Bug,
  ClipboardList, Layers, Globe, CheckCircle2, ArrowRight, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' },
});

const features = [
  { icon: Rocket, title: 'Session Execution', desc: 'Run structured test sessions with a Jira-grade 3-column layout. Mark pass, fail, or N/A with one click.', color: 'text-primary bg-primary/10 border-primary/20' },
  { icon: Bug, title: 'Jira Integration', desc: 'Push bugs directly to Jira the moment a test case fails. Auto-fills issue ID and links back to the ticket.', color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  { icon: ClipboardList, title: 'Task Assignment', desc: 'Leads assign tasks to testers with priority, due dates, and a live kanban board. Testers see only their work.', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { icon: BarChart3, title: 'Analytics & Reports', desc: 'Three.js powered 3D charts show pass/fail trends, session activity, and team performance at a glance.', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { icon: Users, title: 'Team Management', desc: 'Role-based access for leads and testers. Leads see everything; testers see their own sessions and tasks.', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { icon: Layers, title: 'Multi-Platform', desc: 'Test across Android TV, Apple TV, Fire TV, Samsung, LG, Roku, Web, Mobile and more — all in one place.', color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20' },
];

const stack = [
  { label: 'Next.js 14', sub: 'App Router' },
  { label: 'Firebase', sub: 'Auth + Firestore' },
  { label: 'Three.js', sub: '3D Visualizations' },
  { label: 'Framer Motion', sub: 'Animations' },
  { label: 'Tailwind CSS', sub: 'Styling' },
  { label: 'Jira REST API', sub: 'Bug Tracking' },
];

const stats = [
  { value: '6+', label: 'Platforms Supported' },
  { value: '3D', label: 'Charts & Visuals' },
  { value: 'Real-time', label: 'Cloud Sync' },
  { value: 'Role-based', label: 'Access Control' },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-20 pb-16">

      {/* Hero */}
      <motion.div {...fadeUp(0)} className="text-center space-y-5 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-bold text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          Built for QA teams at Sun Network
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
          Precision in<br />
          <span className="text-primary">Every Test.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Zenit is a professional test case execution platform designed to make QA workflows faster, smarter, and more collaborative.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/dashboard">
            <Button className="rounded-xl gap-2">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/tasks">
            <Button variant="outline" className="rounded-xl">View Tasks</Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} {...fadeUp(0.1 + i * 0.05)}
            className="flex flex-col items-center gap-1 p-5 rounded-2xl border border-border bg-card text-center">
            <span className="text-2xl font-extrabold text-primary">{s.value}</span>
            <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Features */}
      <div className="space-y-6">
        <motion.div {...fadeUp(0.15)} className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Everything you need</h2>
          <p className="text-sm text-muted-foreground">A complete QA toolkit in one platform.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} {...fadeUp(0.15 + i * 0.06)}
                className="group p-5 rounded-2xl border border-border bg-card hover:shadow-md transition-all hover:-translate-y-0.5 space-y-3">
                <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center', f.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <motion.div {...fadeUp(0.2)} className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">How it works</h2>
          <p className="text-sm text-muted-foreground">From test case to report in minutes.</p>
        </div>
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-5 top-8 bottom-8 w-px bg-border hidden md:block" />
          <div className="space-y-4">
            {[
              { step: '01', title: 'Upload test cases', desc: 'Import your test cases from an Excel sheet. Zenit parses and structures them automatically.' },
              { step: '02', title: 'Start a session', desc: 'Select your platform, device, and app version. Launch a new test session in seconds.' },
              { step: '03', title: 'Execute & mark', desc: 'Work through each test case. Mark Pass, Fail, or N/A. Log bugs directly to Jira on failures.' },
              { step: '04', title: 'Generate report', desc: 'When done, Zenit generates a full session report with pass rates, defect list, and timeline.' },
            ].map((item, i) => (
              <motion.div key={item.step} {...fadeUp(0.2 + i * 0.07)}
                className="flex gap-5 items-start p-5 rounded-2xl border border-border bg-card">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-xs font-extrabold text-primary">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tech stack */}
      <motion.div {...fadeUp(0.25)} className="space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Built with</h2>
          <p className="text-sm text-muted-foreground">Modern stack, production-grade quality.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {stack.map((s, i) => (
            <motion.div key={s.label} {...fadeUp(0.25 + i * 0.04)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-card">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Footer CTA */}
      <motion.div {...fadeUp(0.3)}
        className="text-center p-10 rounded-3xl border border-primary/20 bg-primary/5 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Ready to test smarter?</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Start a new session, assign tasks to your team, and ship with confidence.</p>
        <Link href="/dashboard/new-session">
          <Button className="rounded-xl gap-2 mt-2">
            <Rocket className="w-4 h-4" />
            Start a Session
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
