"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Zap, Shield, BarChart3, Users, Rocket, Bug,
  ClipboardList, Layers, Globe, CheckCircle2, ArrowRight, Sparkles,
  ChevronDown, ChevronUp, ExternalLink, Activity, Calendar, Star,
  Code2, Database, Cpu, GitBranch, Terminal, Workflow
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' },
});

const features = [
  { icon: Rocket, title: 'Session Execution', desc: 'Run structured test sessions with a Jira-grade 3-column layout. Mark pass, fail, or N/A with one click.', color: 'text-primary bg-primary/10 border-primary/20',
    details: ['3-column layout: Test Case | Steps | Result', 'One-click Pass / Fail / N/A marking', 'Auto-saves progress in real-time', 'Session timer and progress tracker', 'Export session report as PDF or Excel'] },
  { icon: Bug, title: 'Jira Integration', desc: 'Push bugs directly to Jira the moment a test case fails. Auto-fills issue ID and links back to the ticket.', color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
    details: ['One-click bug creation from failed test cases', 'Auto-fills summary, description, priority', 'Links Jira ticket back to test case', 'Syncs bug status in real-time', 'KPI dashboard with team analytics'] },
  { icon: ClipboardList, title: 'Task Assignment', desc: 'Leads assign tasks to testers with priority, due dates, and a live kanban board. Testers see only their work.', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    details: ['Kanban board with drag-and-drop', 'Priority levels: Critical, High, Medium, Low', 'Due date tracking with overdue alerts', 'Role-based visibility (Lead vs Tester)', 'Task comments and attachments'] },
  { icon: BarChart3, title: 'Analytics & Reports', desc: 'Three.js powered 3D charts show pass/fail trends, session activity, and team performance at a glance.', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    details: ['3D bar charts with Three.js', 'Pass/fail trend over time', 'Team performance leaderboard', 'Bug severity distribution', 'Monthly KPI reports'] },
  { icon: Users, title: 'Team Management', desc: 'Role-based access for leads and testers. Leads see everything; testers see their own sessions and tasks.', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
    details: ['Lead and Tester roles', 'Firebase Auth with Google SSO', 'Team-based data isolation', 'Member profile with KPI breakdown', 'Activity history per member'] },
  { icon: Layers, title: 'Multi-Platform', desc: 'Test across Android TV, Apple TV, Fire TV, Samsung, LG, Roku, Web, Mobile and more — all in one place.', color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20',
    details: ['Android TV, Apple TV, Fire TV', 'Samsung Tizen, LG webOS, Roku', 'Web (Chrome, Firefox, Safari)', 'Mobile (iOS, Android)', 'Custom platform support'] },
];

const stack = [
  { label: 'Next.js 14', sub: 'App Router + RSC', icon: Code2, color: 'text-slate-700' },
  { label: 'Firebase', sub: 'Auth + Firestore', icon: Database, color: 'text-amber-600' },
  { label: 'Three.js', sub: '3D Visualizations', icon: Cpu, color: 'text-blue-600' },
  { label: 'Framer Motion', sub: 'Animations', icon: Activity, color: 'text-pink-600' },
  { label: 'Tailwind CSS', sub: 'Styling', icon: Sparkles, color: 'text-cyan-600' },
  { label: 'Jira REST API', sub: 'Bug Tracking', icon: GitBranch, color: 'text-red-600' },
  { label: 'TypeScript', sub: 'Type Safety', icon: Terminal, color: 'text-blue-700' },
  { label: 'Selenium', sub: 'Automation', icon: Workflow, color: 'text-green-600' },
];

const stats = [
  { value: '8+', label: 'Platforms Supported', icon: Globe, color: 'text-primary' },
  { value: '3D', label: 'Charts & Visuals', icon: BarChart3, color: 'text-violet-600' },
  { value: 'Real-time', label: 'Cloud Sync', icon: Activity, color: 'text-emerald-600' },
  { value: 'Role-based', label: 'Access Control', icon: Shield, color: 'text-amber-600' },
];

const quickLinks = [
  { label: 'Jira KPI Dashboard', href: '/analytics/bugs', icon: BarChart3, desc: 'Team bug analytics & KPIs', color: 'text-primary' },
  { label: 'Test Sessions', href: '/test-suite', icon: ClipboardList, desc: 'Run & manage test sessions', color: 'text-emerald-600' },
  { label: 'Task Board', href: '/tasks', icon: Layers, desc: 'Kanban task management', color: 'text-amber-600' },
  { label: 'Vision AI', href: '/dashboard/vision', icon: Cpu, desc: 'AI-powered test automation', color: 'text-violet-600' },
  { label: 'Performance', href: '/performance', desc: 'App performance metrics', icon: Activity, color: 'text-blue-600' },
  { label: 'Work Logs', href: '/wrklog', desc: 'Time tracking & logs', icon: Calendar, color: 'text-rose-600' },
];

export default function AboutPage() {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('features');

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">

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
        <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
          <Link href="/dashboard">
            <Button className="rounded-xl gap-2">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/analytics/bugs">
            <Button variant="outline" className="rounded-xl gap-2">
              <BarChart3 className="w-4 h-4" /> KPI Dashboard
            </Button>
          </Link>
          <Link href="/tasks">
            <Button variant="outline" className="rounded-xl">View Tasks</Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats row — clickable */}
      <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} {...fadeUp(0.1 + i * 0.05)}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border bg-card text-center hover:border-primary/30 hover:shadow-md transition-all cursor-default">
              <div className={cn('w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center', s.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-2xl font-extrabold text-primary">{s.value}</span>
              <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Links — interactive grid */}
      <motion.div {...fadeUp(0.12)}>
        <button
          onClick={() => toggleSection('links')}
          className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-muted/20 transition-all mb-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">Quick Navigation</div>
              <div className="text-xs text-muted-foreground">Jump to any section of the app</div>
            </div>
          </div>
          {expandedSection === 'links' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {expandedSection === 'links' && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.2}}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                {quickLinks.map((link, i) => {
                  const Icon = link.icon;
                  return (
                    <motion.div key={link.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}>
                      <Link href={link.href}>
                        <div className="group flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                          <div className={cn('w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform', link.color)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate group-hover:text-primary transition-colors">{link.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{link.desc}</div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Features — collapsible with expandable detail */}
      <motion.div {...fadeUp(0.15)}>
        <button
          onClick={() => toggleSection('features')}
          className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-muted/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">Features</div>
              <div className="text-xs text-muted-foreground">Everything you need — click any feature for details</div>
            </div>
          </div>
          {expandedSection === 'features' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {expandedSection === 'features' && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.2}}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                {features.map((f, i) => {
                  const Icon = f.icon;
                  const isExpanded = expandedFeature === f.title;
                  return (
                    <motion.div key={f.title} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}>
                      <Card
                        className={cn('cursor-pointer transition-all hover:shadow-md border', isExpanded ? 'border-primary/40 shadow-md' : 'hover:border-primary/20')}
                        onClick={() => setExpandedFeature(isExpanded ? null : f.title)}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', f.color)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{f.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                          </div>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.15}}>
                                <div className="pt-2 border-t border-border space-y-1.5">
                                  {f.details.map(d => (
                                    <div key={d} className="flex items-start gap-2">
                                      <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                      <span className="text-[11px] text-muted-foreground leading-relaxed">{d}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* How it works — collapsible */}
      <motion.div {...fadeUp(0.2)}>
        <button
          onClick={() => toggleSection('howto')}
          className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-muted/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Workflow className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">How it works</div>
              <div className="text-xs text-muted-foreground">From test case to report in minutes</div>
            </div>
          </div>
          {expandedSection === 'howto' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {expandedSection === 'howto' && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.2}}>
              <div className="relative pt-3">
                <div className="absolute left-[28px] top-6 bottom-6 w-px bg-border hidden md:block" />
                <div className="space-y-3">
                  {[
                    { step: '01', title: 'Upload test cases', desc: 'Import your test cases from an Excel sheet. Zenit parses and structures them automatically.', icon: ClipboardList, color: 'text-primary' },
                    { step: '02', title: 'Start a session', desc: 'Select your platform, device, and app version. Launch a new test session in seconds.', icon: Rocket, color: 'text-emerald-600' },
                    { step: '03', title: 'Execute & mark', desc: 'Work through each test case. Mark Pass, Fail, or N/A. Log bugs directly to Jira on failures.', icon: Bug, color: 'text-red-600' },
                    { step: '04', title: 'Generate report', desc: 'When done, Zenit generates a full session report with pass rates, defect list, and timeline.', icon: BarChart3, color: 'text-violet-600' },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <motion.div key={item.step} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
                        className="flex gap-4 items-start p-4 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all">
                        <div className={cn('shrink-0 w-10 h-10 rounded-xl bg-muted/50 border flex items-center justify-center', item.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.step}</span>
                            <p className="text-sm font-bold text-foreground">{item.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tech stack — collapsible */}
      <motion.div {...fadeUp(0.25)}>
        <button
          onClick={() => toggleSection('stack')}
          className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-muted/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">Tech Stack</div>
              <div className="text-xs text-muted-foreground">Modern stack, production-grade quality</div>
            </div>
          </div>
          {expandedSection === 'stack' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {expandedSection === 'stack' && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.2}}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                {stack.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all">
                      <div className={cn('w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0', s.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer CTA */}
      <motion.div {...fadeUp(0.3)}
        className="text-center p-10 rounded-3xl border border-primary/20 bg-primary/5 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Ready to test smarter?</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Start a new session, assign tasks to your team, and ship with confidence.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          <Link href="/dashboard/new-session">
            <Button className="rounded-xl gap-2">
              <Rocket className="w-4 h-4" />
              Start a Session
            </Button>
          </Link>
          <Link href="/analytics/bugs">
            <Button variant="outline" className="rounded-xl gap-2">
              <BarChart3 className="w-4 h-4" />
              View KPI Dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
