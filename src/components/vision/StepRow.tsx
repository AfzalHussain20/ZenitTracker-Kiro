"use client";

import { useState } from 'react';
import { X, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { TestStep } from '@/types/testPlan';
import { ZenitModule, ModuleActionType } from '@/types/module';
import { ZenitDataSet } from '@/types/dataset';
import { resolveLocator } from '@/lib/healingEngine';
import LocatorHealthDot from './LocatorHealthDot';
import VariablePicker from './VariablePicker';

const ACTION_LABELS: Record<ModuleActionType, string> = {
  click: 'Click',
  longPress: 'Long Press',
  doubleTap: 'Double Tap',
  type: 'Type',
  clear: 'Clear',
  scroll: 'Scroll',
  swipe: 'Swipe',
  assertVisible: 'Assert Visible',
  assertText: 'Assert Text',
  assertEnabled: 'Assert Enabled',
};

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-[#F5F5F5] text-[#888]',
  running:  'bg-blue-50 text-[#0078D4] animate-pulse',
  passed:   'bg-[#E8F5E9] text-[#107C10]',
  failed:   'bg-red-50 text-red-600',
  skipped:  'bg-amber-50 text-amber-600',
};

interface Props {
  step: TestStep;
  module: ZenitModule | undefined;
  index: number;
  total: number;
  hierarchy: any;
  dataSet?: ZenitDataSet | null;
  onChange: (updated: TestStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function StepRow({ step, module, index, total, hierarchy, dataSet, onChange, onDelete, onMoveUp, onMoveDown }: Props) {
  const [showVarPicker, setShowVarPicker] = useState(false);

  const healing = module && hierarchy ? resolveLocator(module, hierarchy) : null;
  const needsInput = ['type', 'assertText', 'scroll'].includes(step.action);

  // Render input value with {{variable}} tokens highlighted
  const renderTokenizedValue = (val: string) => {
    const parts = val.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) =>
      /^\{\{[^}]+\}\}$/.test(part)
        ? <span key={i} className="bg-amber-100 text-amber-700 rounded px-0.5 font-mono text-[10px]">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div
      className={`relative group border rounded-lg transition-all ${
        step.runStatus === 'failed' ? 'border-red-300 bg-red-50/30' :
        step.runStatus === 'passed' ? 'border-[#107C10]/30 bg-[#E8F5E9]/30' :
        module && healing && !healing.found ? 'border-red-200 bg-red-50/20' :
        'border-[#E8E8E8] bg-white hover:border-[#0078D4]/30'
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        {/* Step number */}
        <div className="w-5 h-5 rounded-full bg-[#F0F0F0] flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-bold text-[#888]">{index + 1}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Module name */}
            <span className="text-[11px] font-semibold text-[#2D2D2D] truncate max-w-[120px]">
              {module ? module.name : <span className="text-red-500">Module deleted</span>}
            </span>

            {/* Action dropdown */}
            <select
              value={step.action}
              onChange={e => onChange({ ...step, action: e.target.value as ModuleActionType })}
              className="text-[10px] border border-[#E0E0E0] rounded px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#0078D4] text-[#2D2D2D]"
            >
              {(module?.supportedActions || Object.keys(ACTION_LABELS) as ModuleActionType[]).map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>

            {/* Locator health */}
            <LocatorHealthDot
              found={healing?.found ?? true}
              healingOccurred={healing?.healingOccurred}
              noHierarchy={!hierarchy}
            />

            {/* Run status badge */}
            {step.runStatus && step.runStatus !== 'pending' && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[step.runStatus]}`}>
                {step.runStatus.toUpperCase()}
              </span>
            )}
          </div>

          {/* Locator used */}
          {healing?.locatorUsed && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#ABABAB]">via</span>
              <span className="text-[9px] font-mono text-[#888]">{healing.locatorUsed.strategy}</span>
              {healing.healingOccurred && (
                <span className="flex items-center gap-0.5 text-[9px] text-amber-600">
                  <AlertTriangle className="w-2.5 h-2.5" /> healed
                </span>
              )}
            </div>
          )}

          {/* Input field */}
          {needsInput && (
            <div className="relative">
              <input
                value={step.inputValue || ''}
                onChange={e => onChange({ ...step, inputValue: e.target.value })}
                onFocus={() => dataSet && setShowVarPicker(true)}
                onBlur={() => setTimeout(() => setShowVarPicker(false), 150)}
                placeholder={step.action === 'scroll' ? 'up / down' : step.action === 'assertText' ? 'Expected text or {{variable}}' : 'Value or {{variable}}'}
                className="w-full px-2 py-1 text-[11px] border border-[#E0E0E0] rounded focus:outline-none focus:border-[#0078D4] bg-white font-mono"
              />
              {/* Token preview */}
              {step.inputValue && step.inputValue.includes('{{') && (
                <div className="absolute inset-0 px-2 py-1 text-[11px] pointer-events-none flex items-center flex-wrap gap-0 overflow-hidden">
                  {renderTokenizedValue(step.inputValue)}
                </div>
              )}
              {showVarPicker && dataSet && (
                <VariablePicker
                  columns={dataSet.columns}
                  onInsert={v => onChange({ ...step, inputValue: (step.inputValue || '') + v })}
                  onClose={() => setShowVarPicker(false)}
                />
              )}
            </div>
          )}

          {/* Run log */}
          {step.runLog && (
            <div className="text-[10px] text-[#888] font-mono bg-[#F8F8F8] px-2 py-1 rounded">{step.runLog}</div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} className="p-0.5 hover:bg-[#F0F0F0] rounded disabled:opacity-30 transition-colors">
            <ChevronUp className="w-3 h-3 text-[#888]" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-0.5 hover:bg-[#F0F0F0] rounded disabled:opacity-30 transition-colors">
            <ChevronDown className="w-3 h-3 text-[#888]" />
          </button>
          <button onClick={onDelete} className="p-0.5 hover:bg-red-50 rounded transition-colors">
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
