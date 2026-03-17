"use client";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle2, Zap, Rocket, Building2 } from 'lucide-react';
import StarBorder from '@/components/ui/StarBorder';

export default function BillingPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 space-y-12 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-end border-b section-border pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <CreditCard className="w-10 h-10 text-emerald-500" /> Subscription & Billing
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your Zenit Tracker plan, payment methods, and invoices via Stripe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="glass-panel border-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
              Starter
              <Zap className="w-5 h-5 text-zinc-500" />
            </CardTitle>
            <div className="text-3xl font-bold">$0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <CardDescription>Free forever for individuals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1 User</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited Tests</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Local Reports</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>Current Plan</Button>
          </CardFooter>
        </Card>

        <Card className="glass-panel border-emerald-500/50 scale-105 shadow-xl shadow-emerald-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 py-1 px-4 bg-emerald-500 text-white text-xs font-bold rounded-bl-lg">POPULAR</div>
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between text-emerald-500">
              Pro Team
              <Rocket className="w-5 h-5" />
            </CardTitle>
            <div className="text-3xl font-bold">$49<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <CardDescription>Advanced tracking & integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 10 Users</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Jira & Confluence Sync</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Real-time Performance Analytics</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Priority Support</li>
            </ul>
          </CardContent>
          <CardFooter>
            <StarBorder>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Upgrade to Pro</Button>
            </StarBorder>
          </CardFooter>
        </Card>

        <Card className="glass-panel border-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
              Enterprise
              <Building2 className="w-5 h-5 text-indigo-500" />
            </CardTitle>
            <div className="text-3xl font-bold">Custom</div>
            <CardDescription>For very large QA departments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Unlimited Users</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Custom API Webhooks</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Dedicated Account Manager</li>
              <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> On-Premise Deployment options</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">Contact Sales</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
