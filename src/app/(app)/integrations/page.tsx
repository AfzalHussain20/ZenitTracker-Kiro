"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Network, Blocks, CheckCircle2, Link as LinkIcon, AlertCircle, ArrowRight } from 'lucide-react';
import StarBorder from '@/components/ui/StarBorder';

const integrations = [
  {
    id: 'jira',
    name: 'Jira Software',
    description: 'Automatically create bug tickets when a test fails.',
    status: 'connected',
    icon: <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Blocks className="w-6 h-6" /></div>
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Sync and extract Test Cases from PRDs automatically.',
    status: 'disconnected',
    icon: <div className="p-2 bg-blue-600/10 text-blue-600 rounded-lg"><Blocks className="w-6 h-6" /></div>
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send test session summaries and real-time alerts to a channel.',
    status: 'disconnected',
    icon: <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg"><Network className="w-6 h-6" /></div>
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Trigger CI/CD pipelines and link PRs to test sessions.',
    status: 'disconnected',
    icon: <div className="p-2 bg-slate-500/10 text-slate-500 rounded-lg"><Network className="w-6 h-6" /></div>
  }
];

export default function IntegrationsPage() {
  const [active, setActive] = useState<Record<string, boolean>>({
    jira: true,
    confluence: false,
    slack: false,
    github: false
  });

  const toggleIntegration = (id: string) => {
    setActive(p => ({ ...p, [id]: !p[id] }));
  };

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-end border-b section-border pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <LinkIcon className="w-10 h-10 text-indigo-500" /> Integrations Hub
          </h1>
          <p className="text-muted-foreground text-lg">
            Connect Zenit Tracker with your entire development ecosystem.
          </p>
        </div>
        <div className="flex gap-3">
          <StarBorder>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Add Custom Webhook</Button>
          </StarBorder>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((app) => (
          <Card key={app.id} className="glass-panel border-indigo-500/10 hover:border-indigo-500/30 transition-all">
            <CardHeader className="flex flex-row items-center gap-4">
              {app.icon}
              <div className="flex-1">
                <CardTitle className="text-xl flex items-center justify-between">
                  {app.name}
                  <Switch 
                    checked={active[app.id]} 
                    onCheckedChange={() => toggleIntegration(app.id)} 
                  />
                </CardTitle>
                <CardDescription className="mt-1">{app.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {active[app.id] ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-green-600 dark:text-green-400">Connected</p>
                    <p className="text-green-600/80 dark:text-green-400/80 text-xs">Syncing active. Last synced 2 minutes ago.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-500/5 border border-slate-500/10 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-500 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-600 dark:text-slate-400">Disconnected</p>
                    <p className="text-slate-500 text-xs">Configure via API token or OAuth.</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="ghost" className="w-full justify-between hover:bg-indigo-500/10 hover:text-indigo-500">
                Configure Settings <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
