'use client';

import { useAIFlags } from '@/hooks/useAIFlags';
import type { AIFeatureKey, AIProviderKey } from '@/lib/ai/feature-flags';
import { Loader2, Zap, Globe, TestTube, BarChart3, Tag, Activity, FileText, Search, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const FEATURE_ICONS: Record<AIFeatureKey, string> = {
  'ask-prd': '💬',
  'ask-global': '🌐',
  'generate-tests': '🧪',
  'generate-stream': '⚡',
  'jira-insights': '📊',
  'categorize-prd': '🏷️',
  'analytics-events': '📡',
  'notes-ai': '📝',
  'jira-ai': '🔍',
};

const PROVIDER_COLORS: Record<AIProviderKey, string> = {
  gemini: 'from-blue-500 to-indigo-600',
  groq: 'from-rose-500 to-red-600',
  huggingface: 'from-yellow-500 to-amber-600',
};

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

function ToggleSwitch({ enabled, onChange, disabled, size = 'md' }: ToggleSwitchProps) {
  const track = size === 'sm'
    ? 'w-8 h-4 after:h-3 after:w-3 after:top-0.5'
    : 'w-11 h-6 after:h-5 after:w-5 after:top-0.5';

  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={!disabled ? onChange : undefined}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        track,
        enabled ? 'bg-emerald-500' : 'bg-muted',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block rounded-full bg-white shadow-lg transform transition duration-200 ease-in-out',
        size === 'sm' ? 'h-3 w-3' : 'h-5 w-5',
        enabled
          ? size === 'sm' ? 'translate-x-4' : 'translate-x-5'
          : 'translate-x-0'
      )} />
    </button>
  );
}

interface AIFlagsPanelProps {
  /** If true, renders as a compact inline widget (no card wrapper) */
  compact?: boolean;
}

export default function AIFlagsPanel({ compact = false }: AIFlagsPanelProps) {
  const { flags, loading, saving, featureLabels, providerLabels, toggleFeature, toggleProvider } = useAIFlags();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading AI settings...</span>
      </div>
    );
  }

  if (!flags) return null;

  const content = (
    <div className="space-y-6">
      {/* ── Provider Kill-Switches ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">AI Providers</h3>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Disabling a provider prevents ALL features from using it. Saves your daily RPD quota.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {(Object.keys(flags.providers) as AIProviderKey[]).map(provider => {
            const meta = providerLabels[provider];
            const enabled = flags.providers[provider];
            return (
              <div
                key={provider}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border-2 transition-all',
                  enabled
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-muted/20 opacity-70'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', enabled ? 'bg-emerald-500 shadow-emerald-500/50 shadow-md' : 'bg-muted-foreground')} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{meta?.label || provider}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{meta?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className={cn('text-[10px] font-bold', enabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                  <ToggleSwitch enabled={enabled} onChange={() => toggleProvider(provider)} disabled={saving} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Feature Toggles ── */}
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">AI Features</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Disable specific features to prevent background AI calls. Useful for preserving quota on unused features.
        </p>
        <div className="space-y-2">
          {(Object.keys(flags.features) as AIFeatureKey[]).map(feature => {
            const meta = featureLabels[feature];
            const enabled = flags.features[feature];
            return (
              <div
                key={feature}
                className={cn(
                  'flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                  enabled ? 'border-border/60 bg-card' : 'border-border/30 bg-muted/10 opacity-60'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg shrink-0" aria-hidden>{FEATURE_ICONS[feature]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{meta?.label || feature}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{meta?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className={cn('text-[10px] font-semibold', enabled ? 'text-emerald-600' : 'text-red-500')}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                  <ToggleSwitch enabled={enabled} onChange={() => toggleFeature(feature)} disabled={saving} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quota Warning ── */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2.5">
          <Brain className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Quota Management Tips</p>
            <ul className="text-[11px] text-muted-foreground space-y-1">
              <li>• <strong>PRD Auto-Categorization</strong> triggers on every PRD you open — disable to save ~150 tokens per page view</li>
              <li>• <strong>Streaming Generation</strong> uses the same quota as standard generation — disable to prevent accidental double usage</li>
              <li>• <strong>Groq</strong> is free with generous limits — keep it ON as fallback even if Gemini is disabled</li>
              <li>• Changes take effect immediately for all new AI requests</li>
            </ul>
          </div>
        </div>
      </div>

      {flags.updatedAt && (
        <p className="text-[10px] text-muted-foreground text-right">
          Last updated: {new Date(flags.updatedAt).toLocaleString()}
          {flags.updatedBy ? ` by ${flags.updatedBy}` : ''}
        </p>
      )}
    </div>
  );

  if (compact) return content;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">AI Settings</h2>
            <p className="text-xs text-muted-foreground">Control which AI features and providers are active</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        {content}
      </div>
    </div>
  );
}
