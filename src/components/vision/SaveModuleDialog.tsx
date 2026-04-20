"use client";

import React, { useState } from 'react';
import { X, Package } from 'lucide-react';
import { ZenitModule, ModuleLocator } from '@/types/module';
import { moduleStore } from '@/lib/moduleStore';
import { buildLocatorsFromElement, inferSupportedActions } from '@/lib/healingEngine';

interface SaveModuleDialogProps {
  element: any;
  currentPackage: string;
  screenshotUrl: string | null;
  onSave: (module: ZenitModule) => void;
  onClose: () => void;
}

const CATEGORIES = ['Authentication', 'Navigation', 'Cart', 'Forms', 'Media', 'Search', 'Other'];

function ConfidenceDots({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence * 5);
  return (
    <span className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < filled ? 'bg-[#0078D4]' : 'bg-[#D0D0D0]'}`} />
      ))}
    </span>
  );
}

export default function SaveModuleDialog({ element, currentPackage, screenshotUrl, onSave, onClose }: SaveModuleDialogProps) {
  const defaultName = element?.name || element?.type?.split('.').pop() || 'Element';
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState('Other');
  const [tagsInput, setTagsInput] = useState('');
  const [description, setDescription] = useState('');

  const locators: ModuleLocator[] = element ? buildLocatorsFromElement(element) : [];
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

  const handleSave = () => {
    if (!name.trim()) return;
    const savedModule = moduleStore.create({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      appPackage: currentPackage,
      screenshot: screenshotUrl || undefined,
      locators,
      supportedActions: element ? inferSupportedActions(element) : ['click'],
      bounds: element?.attributes?.bounds,
      tags,
    });
    onSave(savedModule);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#0078D4]" />
            <span className="text-[13px] font-semibold text-[#2D2D2D]">Save as Module</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F0F0F0] rounded transition-colors">
            <X className="w-4 h-4 text-[#616161]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D]"
              placeholder="e.g. Login Button"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D] bg-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Tags</label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D]"
              placeholder="login, auth, button (comma-separated)"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-[#EBF4FF] text-[#0078D4] text-[10px] rounded-full">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D]"
              placeholder="Optional description"
            />
          </div>

          {/* Locators */}
          {locators.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1.5">Locators (auto-extracted)</label>
              <div className="space-y-1.5">
                {locators.map((loc, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-[11px] ${i === 0 ? 'border-[#0078D4] bg-[#EBF4FF]' : 'border-[#E8E8E8] bg-[#FAFAFA]'}`}>
                    {i === 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#0078D4] shrink-0" />}
                    <span className={`font-semibold uppercase text-[9px] tracking-wider shrink-0 ${i === 0 ? 'text-[#0078D4]' : 'text-[#888]'}`}>
                      {loc.strategy}
                    </span>
                    <span className="font-mono text-[10px] text-[#1E1E1E] truncate flex-1">{loc.value}</span>
                    <ConfidenceDots confidence={loc.confidence} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E0E0E0] bg-[#FAFAFA]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium text-[#616161] border border-[#D0D0D0] rounded-md hover:bg-[#F0F0F0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-[11px] font-medium bg-[#0078D4] text-white rounded-md hover:bg-[#106EBE] disabled:opacity-40 transition-colors"
          >
            Save Module
          </button>
        </div>
      </div>
    </div>
  );
}
