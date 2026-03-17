"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Activity, Bug, TrendingUp, Users, Target, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const mockPlatforms = [
  { name: 'Android', rate: 2.1, color: 'from-green-500 to-emerald-600', max: 5.2 },
  { name: 'iOS', rate: 1.5, color: 'from-blue-500 to-cyan-600', max: 5.2 },
  { name: 'Web', rate: 0.8, color: 'from-purple-500 to-indigo-600', max: 5.2 },
  { name: 'Smart TV', rate: 5.2, color: 'from-orange-500 to-red-600', max: 5.2 },
];

const mockBugTrends = [
  { month: 'Jan', bugs: 65, critical: 10 },
  { month: 'Feb', bugs: 59, critical: 8 },
  { month: 'Mar', bugs: 80, critical: 15 },
  { month: 'Apr', bugs: 81, critical: 12 },
  { month: 'May', bugs: 56, critical: 5 },
  { month: 'Jun', bugs: 40, critical: 3 },
];

const maxBugs = Math.max(...mockBugTrends.map(d => d.bugs));

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 p-8">
        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Analytics
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="text-gradient">Analytics Dashboard</span>
            </h1>
            <p className="text-muted-foreground text-lg mt-2">
              Comprehensive insights into testing performance and quality metrics
            </p>
          </motion.div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Tests Executed', value: '12,450', change: '+18% from last month', icon: Activity, gradient: 'from-blue-500 to-cyan-600' },
          { title: 'Bugs Logged', value: '381', change: '-5% from last month', icon: Bug, gradient: 'from-red-500 to-pink-600' },
          { title: 'Quality Score', value: '94.2%', change: '+2.1% from last month', icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' },
          { title: 'Active Testers', value: '14', change: 'Stable capacity', icon: Users, gradient: 'from-purple-500 to-indigo-600' },
        ].map((stat, i) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <h3 className="text-3xl font-bold mt-2">{stat.value}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bug Discovery Trend – CSS bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Bug Discovery Trend
            </CardTitle>
            <CardDescription>Total bugs vs critical bugs over 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-48 pt-4">
              {mockBugTrends.map((d, i) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-0.5 h-36">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.bugs / maxBugs) * 100}%` }}
                      transition={{ delay: i * 0.08, duration: 0.6 }}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400"
                      title={`Total: ${d.bugs}`}
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.critical / maxBugs) * 100}%` }}
                      transition={{ delay: i * 0.08 + 0.1, duration: 0.6 }}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-red-600 to-red-400"
                      title={`Critical: ${d.critical}`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                <span className="text-xs text-muted-foreground">Total Bugs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                <span className="text-xs text-muted-foreground">Critical</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Platform Insights
            </CardTitle>
            <CardDescription>Crash rate by platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockPlatforms.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-sm font-bold">{p.rate}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.rate / p.max) * 100}%` }}
                    transition={{ delay: i * 0.1 + 0.4, duration: 0.8 }}
                    className={`h-full bg-gradient-to-r ${p.color}`}
                  />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { label: 'Avg Response Time', value: '1.2s', sub: '↓ 15% faster', icon: Zap, gradient: 'from-green-500 to-emerald-600', subColor: 'text-green-600' },
          { label: 'Test Coverage', value: '87%', sub: '↑ 3% increase', icon: Target, gradient: 'from-blue-500 to-cyan-600', subColor: 'text-blue-600' },
          { label: 'Automation Rate', value: '62%', sub: '↑ 8% increase', icon: Activity, gradient: 'from-purple-500 to-indigo-600', subColor: 'text-purple-600' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-5`} />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${m.gradient}`}>
                    <m.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{m.label}</div>
                    <div className="text-2xl font-bold">{m.value}</div>
                  </div>
                </div>
                <div className={`text-xs font-medium ${m.subColor}`}>{m.sub}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
