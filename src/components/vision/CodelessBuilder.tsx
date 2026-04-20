"use client";

import React, { useState, useEffect } from 'react';
import { Play, Save, ChevronUp, ChevronDown, X, Download, Circle } from 'lucide-react';
import { ZenitTestPlan, TestStep } from '@/types/testPlan';
import { ZenitDataSet } from '@/types/dataset';
import { ZenitModule, ModuleActionType } from '@/types/module';
import { moduleStore, planStore, dataSetStore, uid } from '@/lib/moduleStore';
import { resolveLocator, buildActionPayload, substituteVariables } from '@/lib/healingEngine';

interface CodelessBuilderProps {
  hierarchy: any;
  currentPackage: string;
  wsRef: React.RefObject<WebSocket | null>;
  onToast: (message: string, variant?: 'default' | 'destructive') => void;
}

type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

const ACTION_LABELS: Record<ModuleActionType, string> = {
  click: 'Click', longPress: 'Long Press', doubleTap: 'Double Tap',
  type: 'Type', clear: 'Clear', scroll: 'Scroll', swipe: 'Swipe',
  assertVisible: 'Assert Visible', assertText: 'Assert Text', assertEnabled: 'Assert Enabled',
};

function sendAndAwait(ws: WebSocket, payload: object, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', handler);
      reject(new Error('Step timeout'));
    }, timeoutMs);
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'action_done' || msg.type === 'assertionResult') {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve();
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ type: 'action', payload }));
  });
}

export default function CodelessBuilder({ hierarchy, currentPackage, wsRef, onToast }: CodelessBuilderProps) {
  const [currentPlan, setCurrentPlan] = useState<ZenitTestPlan>(() => {
    const all = planStore.getAll();
    return all[0] ?? planStore.create({
      name: 'New Test Plan',
      appPackage: currentPackage,
      platform: 'android',
      steps: [],
      tags: [],
      lastRunStatus: 'never',
    });
  });
  const [dataSets, setDataSets] = useState<ZenitDataSet[]>([]);
  const [selectedDataSetId, setSelectedDataSetId] = useState('');
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [planName, setPlanName] = useState(currentPlan.name);

  useEffect(() => { setDataSets(dataSetStore.getAll()); }, []);

  const updatePlan = (partial: Partial<ZenitTestPlan>) => {
    const updated = { ...currentPlan, ...partial, updatedAt: Date.now() };
    setCurrentPlan(updated);
    planStore.save(updated);
  };

  const handleDropOnZone = (e: React.DragEvent, insertAtIndex?: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-[#EBF4FF]', 'border-[#0078D4]');
    const moduleId = e.dataTransfer.getData('moduleId');
    const foundModule = moduleStore.getAll().find(m => m.id === moduleId);
    if (!foundModule) return;
    const newStep: TestStep = {
      id: uid(),
      order: insertAtIndex ?? currentPlan.steps.length,
      moduleId: foundModule.id,
      moduleName: foundModule.name,
      action: foundModule.supportedActions[0] ?? 'click',
      timeout: 15000,
      continueOnFail: false,
    };
    const steps = [...currentPlan.steps];
    if (insertAtIndex !== undefined) steps.splice(insertAtIndex, 0, newStep);
    else steps.push(newStep);
    updatePlan({ steps: steps.map((s, i) => ({ ...s, order: i })) });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-[#EBF4FF]', 'border-[#0078D4]');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-[#EBF4FF]', 'border-[#0078D4]');
  };

  const removeStep = (id: string) => {
    updatePlan({ steps: currentPlan.steps.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })) });
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    const steps = [...currentPlan.steps];
    const idx = steps.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    updatePlan({ steps: steps.map((s, i) => ({ ...s, order: i })) });
  };

  const updateStep = (id: string, partial: Partial<TestStep>) => {
    updatePlan({ steps: currentPlan.steps.map(s => s.id === id ? { ...s, ...partial } : s) });
  };

  const runPlan = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onToast('Device not connected', 'destructive');
      return;
    }
    const dataSet = selectedDataSetId ? dataSetStore.getAll().find(d => d.id === selectedDataSetId) : null;
    const rows = dataSet?.rows.filter(r => r.enabled) ?? [null];
    setIsRunning(true);
    const initStatuses: Record<string, StepStatus> = {};
    currentPlan.steps.forEach(s => { initStatuses[s.id] = 'pending'; });
    setStepStatuses(initStatuses);

    for (const row of rows) {
      const variables = (row as any)?.values ?? {};
      for (const step of currentPlan.steps) {
        setStepStatuses(prev => ({ ...prev, [step.id]: 'running' }));
        const stepModule = moduleStore.getAll().find(m => m.id === step.moduleId);
        if (!stepModule) {
          setStepStatuses(prev => ({ ...prev, [step.id]: 'failed' }));
          if (!step.continueOnFail) break;
          continue;
        }
        const healing = resolveLocator(stepModule, hierarchy);
        if (!healing.found || !healing.locatorUsed) {
          setStepStatuses(prev => ({ ...prev, [step.id]: 'failed' }));
          onToast(`Step ${step.order + 1}: "${step.moduleName}" not found`, 'destructive');
          if (!step.continueOnFail) break;
          continue;
        }
        const payload = buildActionPayload(step, healing.locatorUsed, variables);
        if (!payload) {
          setStepStatuses(prev => ({ ...prev, [step.id]: 'skipped' }));
          continue;
        }
        try {
          await sendAndAwait(wsRef.current!, payload, step.timeout ?? 15000);
          setStepStatuses(prev => ({ ...prev, [step.id]: 'passed' }));
        } catch {
          setStepStatuses(prev => ({ ...prev, [step.id]: 'failed' }));
          if (!step.continueOnFail) break;
        }
      }
    }
    setIsRunning(false);
  };

  const exportScript = () => {
    const lines = currentPlan.steps.map((s, i) => {
      const m = moduleStore.getAll().find(x => x.id === s.moduleId);
      const loc = m?.locators[0];
      return `# Step ${i + 1}: ${s.moduleName} — ${s.action}\n# locator: ${loc?.strategy}="${loc?.value}"`;
    });
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${currentPlan.name}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const statusColor: Record<StepStatus, string> = {
    pending: '#D0D0D0', running: '#C7A008', passed: '#107C10', failed: '#EF4444', skipped: '#888',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Plan header */}
      <div className="px-3 py-2 border-b border-[#F0F0F0] shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={planName}
            onChange={e => setPlanName(e.target.value)}
            onBlur={() => updatePlan({ name: planName })}
            className="flex-1 px-2 py-1 text-[11px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D]"
            placeholder="Plan name"
          />
          <button
            onClick={() => updatePlan({ name: planName })}
            className="p-1.5 hover:bg-[#F0F0F0] rounded-md transition-colors text-[#616161]"
            title="Save plan"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
        <select
          value={selectedDataSetId}
          onChange={e => setSelectedDataSetId(e.target.value)}
          className="w-full px-2 py-1 text-[11px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D] bg-white"
        >
          <option value="">No data set</option>
          {dataSets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Steps */}
      <div className="flex-1 min-h-0 overflow-y-auto vs-scroll px-3 py-2 space-y-1.5">
        {currentPlan.steps.length === 0 ? (
          <div
            className="flex items-center justify-center h-24 border-2 border-dashed border-[#D0D0D0] rounded-lg text-[11px] text-[#999] transition-colors"
            onDrop={e => handleDropOnZone(e)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            Drop a module here to start
          </div>
        ) : (
          currentPlan.steps.map((step, idx) => {
            const stepModule = moduleStore.getAll().find(m => m.id === step.moduleId);
            const health = stepModule && hierarchy ? resolveLocator(stepModule, hierarchy) : null;
            const status = stepStatuses[step.id];
            const needsInput = step.action === 'type' || step.action === 'assertText';
            const isUnhealthy = health && !health.found;

            return (
              <div key={step.id}>
                {/* Insert zone above */}
                <div
                  className="h-1.5 rounded border border-transparent transition-colors mb-0.5"
                  onDrop={e => handleDropOnZone(e, idx)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                />
                <div className={`bg-white border rounded-lg p-2.5 transition-all ${isUnhealthy ? 'border-red-300 border-l-4 border-l-red-500' : 'border-[#E8E8E8]'}`}>
                  <div className="flex items-center gap-2">
                    {/* Status dot */}
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: status ? statusColor[status] + '22' : '#F5F5F5' }}>
                      <Circle className="w-2 h-2" style={{ color: status ? statusColor[status] : '#D0D0D0', fill: status ? statusColor[status] : '#D0D0D0' }} />
                    </div>
                    {/* Step number */}
                    <span className="text-[10px] text-[#999] shrink-0 w-4">{idx + 1}.</span>
                    {/* Module name */}
                    <span className="text-[11px] font-medium text-[#0078D4] bg-[#EBF4FF] px-1.5 py-0.5 rounded shrink-0 truncate max-w-[100px]">
                      {step.moduleName}
                    </span>
                    {/* Action dropdown */}
                    <select
                      value={step.action}
                      onChange={e => updateStep(step.id, { action: e.target.value as ModuleActionType })}
                      className="flex-1 px-1.5 py-0.5 text-[10px] border border-[#E0E0E0] rounded outline-none focus:border-[#0078D4] bg-white text-[#2D2D2D]"
                    >
                      {(stepModule?.supportedActions ?? ['click']).map((a: string) => (
                        <option key={a} value={a}>{(ACTION_LABELS as Record<string, string>)[a] ?? a}</option>
                      ))}
                    </select>
                    {/* Controls */}
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => moveStep(step.id, -1)} disabled={idx === 0} className="p-0.5 hover:bg-[#F0F0F0] rounded disabled:opacity-30">
                        <ChevronUp className="w-3 h-3 text-[#888]" />
                      </button>
                      <button onClick={() => moveStep(step.id, 1)} disabled={idx === currentPlan.steps.length - 1} className="p-0.5 hover:bg-[#F0F0F0] rounded disabled:opacity-30">
                        <ChevronDown className="w-3 h-3 text-[#888]" />
                      </button>
                      <button onClick={() => removeStep(step.id)} className="p-0.5 hover:bg-[#FEE2E2] rounded">
                        <X className="w-3 h-3 text-[#EF4444]" />
                      </button>
                    </div>
                  </div>

                  {/* Input field for type/assertText */}
                  {needsInput && (
                    <div className="mt-1.5 ml-6">
                      <input
                        value={step.inputValue || ''}
                        onChange={e => updateStep(step.id, { inputValue: e.target.value })}
                        placeholder={step.action === 'type' ? '{{variable}} or literal text' : 'Expected text'}
                        className="w-full px-2 py-1 text-[10px] font-mono border border-[#E0E0E0] rounded outline-none focus:border-[#0078D4] text-[#2D2D2D]"
                      />
                    </div>
                  )}

                  {/* Locator health */}
                  {health && (
                    <div className={`mt-1 ml-6 flex items-center gap-1 text-[10px] ${health.found ? (health.healingOccurred ? 'text-[#C7A008]' : 'text-[#107C10]') : 'text-red-500'}`}>
                      <span>{health.found ? (health.healingOccurred ? '⚡' : '✓') : '✗'}</span>
                      <span>
                        {health.found
                          ? health.healingOccurred
                            ? `healing: using ${health.locatorUsed?.strategy}`
                            : `found via ${health.locatorUsed?.strategy}`
                          : 'not in tree'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Bottom drop zone */}
        {currentPlan.steps.length > 0 && (
          <div
            className="flex items-center justify-center h-8 border border-dashed border-[#D0D0D0] rounded-lg text-[10px] text-[#BBB] transition-colors mt-1"
            onDrop={e => handleDropOnZone(e)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            + Drop module here
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-3 py-2 border-t border-[#F0F0F0] flex items-center gap-2 shrink-0">
        {isRunning ? (
          <button
            onClick={() => setIsRunning(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={runPlan}
            disabled={currentPlan.steps.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            <Play className="w-3 h-3" /> Run Plan
          </button>
        )}
        <button
          onClick={exportScript}
          disabled={currentPlan.steps.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-[#D0D0D0] text-[#616161] rounded-md hover:bg-[#F0F0F0] disabled:opacity-40 transition-colors"
        >
          <Download className="w-3 h-3" /> Export
        </button>
      </div>
    </div>
  );
}
