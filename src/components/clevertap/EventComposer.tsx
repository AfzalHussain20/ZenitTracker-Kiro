'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Rocket, CheckCircle2, PlusCircle, FileDown, Layers, BarChart3,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type ComposerStep = 'platform' | 'config' | 'workspace';

interface Platform { id: string; label: string; icon: React.ElementType; gradient: string }
interface ContentTypeDef { id: string; label: string; icon: React.ElementType; color: string }

interface EventComposerProps {
  platforms: Platform[];
  contentTypes: ContentTypeDef[];
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  '1': 'Live TV', '2': 'TV Shows', '3': 'Movies',
  '4': 'Shorts', '5': 'Music Videos', '6': 'Comedy',
};
const CORE_EVENTS = ['Content Started', 'Content Played', 'Content Started Version 1', 'Content Played Version 1'];
const ADS_EVENT = 'Ads Played';

// ─── Parse CleverTap tooltip HTML ─────────────────────────────────────────────
function parseHtml(html: string): Record<string, string> {
  const pattern = /<span[^>]*data-t="tooltip"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/span>/g;
  const params: Record<string, string> = {};
  const counts: Record<string, number> = {};
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const key = m[1].trim();
    const val = m[2].trim();
    if (counts[key]) { counts[key]++; params[`${key} (${counts[key]})`] = val; }
    else { counts[key] = 1; params[key] = val; }
  }
  return params;
}

// ─── HTML Input Modal ─────────────────────────────────────────────────────────
function HtmlInputDialog({
  contentType, events, savedInputs, onSave, onCancel,
}: {
  contentType: string;
  events: string[];
  savedInputs: Record<string, string>;
  onSave: (inputs: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>(savedInputs);
  return (
    <>
      <DialogHeader>
        <DialogTitle>HTML Input — <span className="text-orange-500">{contentType}</span></DialogTitle>
        <DialogDescription>Paste the HTML markup from CleverTap/Kibana for each event.</DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-5 max-h-[55vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {events.map(ev => (
            <div key={ev} className="space-y-1.5">
              <Label className="text-sm font-semibold">{ev}</Label>
              <Textarea
                value={inputs[ev] || ''}
                onChange={e => setInputs(prev => ({ ...prev, [ev]: e.target.value }))}
                placeholder="Paste HTML markup here..."
                rows={4}
                className="font-mono text-xs resize-none"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(inputs)} className="bg-orange-500 hover:bg-orange-600 text-white">Save & Close</Button>
      </div>
    </>
  );
}

// ─── Main Composer Component ──────────────────────────────────────────────────
export default function EventComposer({ platforms, contentTypes }: EventComposerProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<ComposerStep>('platform');
  const [platform, setPlatform] = useState('');
  const [env, setEnv] = useState<'Production' | 'Pre-Production'>('Production');
  const [version, setVersion] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [adsMap, setAdsMap] = useState<Record<string, boolean>>({});
  const [htmlInputs, setHtmlInputs] = useState<Record<string, Record<string, string>>>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [otherEvents, setOtherEvents] = useState<{ name: string; params: Record<string, string> }[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherHtml, setOtherHtml] = useState('');

  const handleHtmlSave = (ct: string, inputs: Record<string, string>) => {
    setHtmlInputs(prev => ({ ...prev, [ct]: inputs }));
    if (!completed.includes(ct)) setCompleted(prev => [...prev, ct]);
    toast({ title: 'Saved', description: `Data for "${ct}" saved.` });
    setActiveModal(null);
  };

  const handleExport = () => {
    if (completed.length === 0 && otherEvents.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' }); return;
    }
    const wb = XLSX.utils.book_new();

    // Summary
    const summary = [
      { Key: 'Platform', Value: platforms.find(p => p.id === platform)?.label || platform },
      { Key: 'Environment', Value: env },
      { Key: 'App Version', Value: version },
      { Key: 'Export Date', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    ];
    const sw = XLSX.utils.json_to_sheet(summary, { skipHeader: true });
    sw['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, sw, 'Summary');

    // Content type sheets
    for (const ct of completed) {
      const inputs = htmlInputs[ct] || {};
      const events = adsMap[ct] ? [...CORE_EVENTS, ADS_EVENT] : CORE_EVENTS;
      const parsed = events.flatMap(ev => {
        const html = inputs[ev];
        if (!html) return [];
        try { return [{ eventName: ev, params: parseHtml(html) }]; }
        catch { return []; }
      });
      if (parsed.length === 0) continue;

      const maxRows = Math.max(...parsed.map(e => Object.keys(e.params).length));
      const rows: Record<string, string>[] = [];
      for (let i = 0; i < maxRows; i++) {
        const row: Record<string, string> = {};
        parsed.forEach((e, idx) => {
          const entries = Object.entries(e.params);
          row[`Key_${idx + 1}`] = entries[i] ? entries[i][0].replace(/ \(\d+\)$/, '') : '';
          row[`Value_${idx + 1}`] = entries[i] ? entries[i][1] : '';
        });
        rows.push(row);
      }
      const headers = parsed.flatMap((_, i) => [`Key_${i + 1}`, `Value_${i + 1}`]);
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      ws['!cols'] = headers.map(() => ({ wch: 30 }));
      const range = XLSX.utils.decode_range(ws['!ref']!);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ c: C, r: 0 });
        if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '800080' } } };
      }
      XLSX.utils.book_append_sheet(wb, ws, ct.replace(/[/\\?*[\]]/g, '').substring(0, 31));
    }

    // Other events
    for (const ev of otherEvents) {
      const rows = Object.entries(ev.params).map(([k, v]) => ({ Key: k.replace(/ \(\d+\)$/, ''), Value: v }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 35 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, ws, ev.name.replace(/[/\\?*[\]]/g, '').substring(0, 31));
    }

    XLSX.writeFile(wb, `clevertap_events_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: '✅ Exported!', description: 'Excel file downloaded.' });
  };

  return (
    <AnimatePresence mode="wait">
      {/* ── Step 1: Platform ── */}
      {step === 'platform' && (
        <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
          <Card><CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600"><Rocket className="w-6 h-6 text-white" /></div>
              <div><h2 className="text-xl font-bold">Step 1 — Platform Configuration</h2><p className="text-sm text-muted-foreground">Select your testing platform and environment</p></div>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-3 block">Platform *</Label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {platforms.map(p => {
                  const sel = platform === p.id;
                  return (
                    <button type="button" key={p.id} onClick={() => setPlatform(p.id)}
                      className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${sel ? 'border-orange-500 bg-orange-500/10' : 'border-border hover:border-orange-500/50'}`}>
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${p.gradient}`}><p.icon className="w-5 h-5 text-white" /></div>
                      <span className="text-xs font-medium text-center leading-tight">{p.label}</span>
                      {sel && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-orange-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Test Environment *</Label>
                <Select value={env} onValueChange={v => setEnv(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Pre-Production">Pre-Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>App Version *</Label>
                <Input placeholder="e.g. 4.2.1" value={version} onChange={e => setVersion(e.target.value)} />
              </div>
            </div>
            <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 text-white"
              onClick={() => {
                if (!platform || !version.trim()) { toast({ title: 'Missing fields', description: 'Select a platform and enter an app version.', variant: 'destructive' }); return; }
                setStep('config');
              }}>
              Continue to Content Types <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent></Card>
        </motion.div>
      )}

      {/* ── Step 2: Content Type Selection ── */}
      {step === 'config' && (
        <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
          <Card><CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600"><BarChart3 className="w-6 h-6 text-white" /></div>
              <div><h2 className="text-xl font-bold">Step 2 — Select Content Types</h2>
                <p className="text-sm text-muted-foreground">Choose content types on <strong>{platforms.find(p => p.id === platform)?.label}</strong></p></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(CONTENT_TYPE_MAP).map(([key, label]) => {
                const sel = selectedTypes.includes(label);
                return (
                  <div key={key} className={`flex flex-col space-y-2 p-4 rounded-xl border-2 transition-all ${sel ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:border-purple-500/40'}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox id={`ct-${key}`} checked={sel} onCheckedChange={v => setSelectedTypes(prev => v ? [...prev, label] : prev.filter(x => x !== label))} />
                      <Label htmlFor={`ct-${key}`} className="cursor-pointer font-semibold">{label}</Label>
                    </div>
                    {sel && (
                      <div className="flex items-center gap-2 pl-6">
                        <Checkbox id={`ads-${key}`} checked={!!adsMap[label]} onCheckedChange={v => setAdsMap(prev => ({ ...prev, [label]: !!v }))} />
                        <Label htmlFor={`ads-${key}`} className="cursor-pointer text-sm text-muted-foreground">Include Ads Played</Label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('platform')} className="flex-1">Back</Button>
              <Button variant="outline" onClick={() => setStep('workspace')} className="flex-1 text-muted-foreground">Skip</Button>
              <Button onClick={() => setStep('workspace')} className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white">
                Go to Workspace <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent></Card>
        </motion.div>
      )}

      {/* ── Step 3: Workspace ── */}
      {step === 'workspace' && (
        <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
          <Card><CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600"><Layers className="w-5 h-5 text-white" /></div>
                <div><h2 className="text-lg font-bold">Step 3 — Data Input Workspace</h2>
                  <p className="text-sm text-muted-foreground">Click a content type to paste its HTML events</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setOtherOpen(true)} className="gap-1.5">
                  <PlusCircle className="w-4 h-4" /> Add Other Event
                </Button>
                <Button size="sm" onClick={handleExport} className="gap-1.5 bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  <FileDown className="w-4 h-4" /> Export Excel
                </Button>
              </div>
            </div>

            {selectedTypes.length === 0 && otherEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No content types selected. Use "Add Other Event" to capture custom events.</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedTypes.map(ct => {
                const done = completed.includes(ct);
                return (
                  <button key={ct} onClick={() => setActiveModal(ct)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-orange-500/60'}`}>
                    <span className="font-semibold text-sm">{ct}</span>
                    {done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <ChevronRight className="w-5 h-5 text-orange-500" />}
                  </button>
                );
              })}
            </div>

            {otherEvents.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Events</p>
                <div className="flex flex-wrap gap-2">
                  {otherEvents.map((ev, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs font-medium text-blue-700 dark:text-blue-400">
                      <CheckCircle2 className="w-3 h-3" /> {ev.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent></Card>

          {/* HTML Input Modal */}
          {activeModal && (
            <Dialog open={!!activeModal} onOpenChange={v => !v && setActiveModal(null)}>
              <DialogContent className="max-w-3xl">
                <HtmlInputDialog
                  contentType={activeModal}
                  events={adsMap[activeModal] ? [...CORE_EVENTS, ADS_EVENT] : CORE_EVENTS}
                  savedInputs={htmlInputs[activeModal] || {}}
                  onSave={inputs => handleHtmlSave(activeModal, inputs)}
                  onCancel={() => setActiveModal(null)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Other Event Modal */}
          <Dialog open={otherOpen} onOpenChange={setOtherOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Event</DialogTitle>
                <DialogDescription>Each unique event name creates its own sheet in the export.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input value={otherName} onChange={e => setOtherName(e.target.value)} placeholder="e.g., user_profile_updated" />
                </div>
                <div className="space-y-2">
                  <Label>HTML Markup</Label>
                  <Textarea value={otherHtml} onChange={e => setOtherHtml(e.target.value)} placeholder="Paste raw HTML here..." rows={8} className="font-mono text-xs resize-none" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setOtherOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!otherName.trim() || !otherHtml.trim()) { toast({ title: 'Missing fields', variant: 'destructive' }); return; }
                  try {
                    const params = parseHtml(otherHtml);
                    setOtherEvents(prev => [...prev, { name: otherName.trim(), params }]);
                    setOtherName(''); setOtherHtml('');
                    setOtherOpen(false);
                    toast({ title: `Event "${otherName}" added` });
                  } catch { toast({ title: 'Parse error', variant: 'destructive' }); }
                }}>Save Event</Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
