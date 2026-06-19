"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle2, Zap, Rocket, Building2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_PRICING, type PlanTier } from '@/types/organization';

const PLANS: { tier: PlanTier; icon: any; tagline: string; features: string[]; accent: string }[] = [
  {
    tier: 'free', icon: Zap, tagline: 'For individuals getting started',
    features: ['3 users', '5 test plans', '10 devices', 'Basic analytics'],
    accent: 'text-zinc-400',
  },
  {
    tier: 'pro', icon: Rocket, tagline: 'For growing QA teams',
    features: ['Unlimited users', 'Unlimited plans', 'Unlimited devices', 'Jira sync', 'Advanced analytics', 'Priority support'],
    accent: 'text-emerald-500',
  },
  {
    tier: 'enterprise', icon: Building2, tagline: 'For large QA departments',
    features: ['Everything in Pro', 'SSO / SAML', 'API access', 'Custom integrations', 'Dedicated support'],
    accent: 'text-indigo-500',
  },
];

export default function BillingPage() {
  const router = useRouter();
  const { plan, isInternal, orgId } = useAuth();

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-10 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-emerald-500" /> Subscription & Billing
          </h1>
          <p className="text-muted-foreground">Manage your Zenit Tracker plan.</p>
        </div>
        {/* Current plan badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/40 border border-border/50">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold">
            Current: {isInternal ? 'Enterprise (Internal)' : plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Enterprise'}
          </span>
        </div>
      </div>

      {isInternal && (
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-5 py-4 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <p className="text-sm text-indigo-300">
            You&apos;re on the <strong>Internal Enterprise</strong> plan — all premium features are unlocked free for @sunnetwork.in accounts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(p => {
          const pricing = PLAN_PRICING[p.tier];
          const isCurrent = isInternal ? p.tier === 'enterprise' : plan === p.tier;
          const isPopular = p.tier === 'pro';
          return (
            <Card key={p.tier} className={cn('relative overflow-hidden', isPopular && 'border-emerald-500/50 shadow-xl shadow-emerald-500/10', isCurrent && 'ring-2 ring-emerald-500/40')}>
              {isPopular && <div className="absolute top-0 right-0 py-1 px-4 bg-emerald-500 text-white text-xs font-bold rounded-bl-lg">POPULAR</div>}
              <CardHeader>
                <CardTitle className={cn('text-xl flex items-center justify-between', p.accent)}>
                  {pricing.label}
                  <p.icon className="w-5 h-5" />
                </CardTitle>
                <div className="text-3xl font-bold">
                  {p.tier === 'free' ? '₹0' : `₹${pricing.monthly.toLocaleString('en-IN')}`}
                  <span className="text-base text-muted-foreground font-normal">{p.tier === 'free' ? '/forever' : '/user/mo'}</span>
                </div>
                <CardDescription>{p.tagline}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex gap-2 items-center"><CheckCircle2 className={cn('w-4 h-4', p.accent)} />{f}</li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : p.tier === 'free' ? (
                  <Button variant="outline" className="w-full" disabled={isInternal}>Downgrade</Button>
                ) : (
                  <Button
                    onClick={() => router.push(`/billing/checkout?plan=${p.tier}`)}
                    className={cn('w-full text-white border-0', isPopular ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700')}
                    disabled={isInternal}
                  >
                    {isInternal ? 'Included' : `Upgrade to ${pricing.label}`}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
