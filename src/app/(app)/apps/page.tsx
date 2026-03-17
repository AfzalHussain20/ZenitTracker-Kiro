'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Shield, Library, Crosshair, Wand2, Users, Eye, Sparkles } from 'lucide-react';

const apps = [
  {
    id: 'vision',
    name: 'Vision',
    description: 'AI-powered visual testing and analysis',
    icon: Eye,
    gradient: 'from-cyan-500 to-blue-600',
    href: '/dashboard/vision',
  },
  {
    id: 'wrklog',
    name: 'Wrklog',
    description: 'Track your testing time and productivity',
    icon: Clock,
    gradient: 'from-indigo-500 to-purple-600',
    href: '/wrklog',
  },
  {
    id: 'keepr',
    name: 'Keepr',
    description: 'Device check-in and check-out management',
    icon: Shield,
    gradient: 'from-blue-500 to-cyan-600',
    href: '/keepr',
  },
  {
    id: 'repository',
    name: 'Repository',
    description: 'Test case library and management',
    icon: Library,
    gradient: 'from-green-500 to-emerald-600',
    href: '/dashboard/repository',
  },
  {
    id: 'locator',
    name: 'Locator Lab',
    description: 'Element locator generator tool',
    icon: Crosshair,
    gradient: 'from-orange-500 to-red-600',
    href: '/dashboard/locator-lab',
  },
  {
    id: 'clevertap',
    name: 'CleverTap Tracker',
    description: 'CleverTap event intelligence',
    icon: Wand2,
    gradient: 'from-pink-500 to-rose-600',
    href: '/dashboard/clevertap-tracker',
  },
  {
    id: 'team',
    name: 'Team Performance',
    description: 'Team analytics and leaderboard',
    icon: Users,
    gradient: 'from-purple-500 to-indigo-600',
    href: '/team',
  },
];

export default function AppsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 p-8">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4"
            >
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium mb-3">
                  <Sparkles className="w-3 h-3" />
                  Zenit Suite
                </div>
                <h1 className="text-4xl font-bold tracking-tight">
                  <span className="text-gradient">Zenit Apps</span>
                </h1>
                <p className="text-muted-foreground text-lg mt-2">
                  Powerful tools for modern QA teams
                </p>
              </div>
            </motion.div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app, index) => {
            const AppIcon = app.icon;
            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={app.href}>
                  <Card className="group relative overflow-hidden h-full hover:shadow-2xl transition-all duration-300 border-border/50 hover:border-primary/50">
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    
                    {/* Glow Effect */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <CardContent className="p-6 relative">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`p-4 rounded-2xl bg-gradient-to-br ${app.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                          <AppIcon className="h-8 w-8 text-white" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                            {app.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {app.description}
                          </p>
                        </div>
                      </div>

                      {/* Launch Button */}
                      <div className="mt-6 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Click to launch</span>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all">
                          <svg className="w-4 h-4 text-primary group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="relative overflow-hidden border-border/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-500/10">
                    <Sparkles className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{apps.length}</div>
                    <div className="text-sm text-muted-foreground">Available Apps</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="relative overflow-hidden border-border/50">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-green-500/10">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">100%</div>
                    <div className="text-sm text-muted-foreground">Secure & Reliable</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card className="relative overflow-hidden border-border/50">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">24/7</div>
                    <div className="text-sm text-muted-foreground">Always Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
    </div>
  );
}
