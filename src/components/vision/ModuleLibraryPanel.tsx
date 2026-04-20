"use client";

import React, { useState, useEffect } from 'react';
import { Search, Package, Trash2, Edit2, Plus } from 'lucide-react';
import { ZenitModule } from '@/types/module';
import { moduleStore } from '@/lib/moduleStore';
import SaveModuleDialog from './SaveModuleDialog';

interface ModuleLibraryPanelProps {
  currentPackage: string;
  hierarchy: any;
  screenshotUrl: string | null;
}

const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
  Authentication: { color: '#0078D4', bg: '#EBF4FF' },
  Navigation:     { color: '#8764B8', bg: '#F3EEF9' },
  Forms:          { color: '#107C10', bg: '#E8F5E9' },
  Cart:           { color: '#C7A008', bg: '#FFF8E1' },
  Media:          { color: '#616161', bg: '#F5F5F5' },
  Search:         { color: '#0F7B6C', bg: '#E6F4F1' },
  Other:          { color: '#616161', bg: '#F5F5F5' },
};

function ConfidenceDots({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence * 5);
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-[#0078D4]' : 'bg-[#D0D0D0]'}`} />
      ))}
    </span>
  );
}

export default function ModuleLibraryPanel({ currentPackage, hierarchy, screenshotUrl }: ModuleLibraryPanelProps) {
  const [modules, setModules] = useState<ZenitModule[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingModule, setEditingModule] = useState<ZenitModule | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const reload = () => setModules(moduleStore.getAll());

  useEffect(() => { reload(); }, []);

  const categories = ['All', ...Array.from(new Set(modules.map(m => m.category)))];

  const filtered = modules.filter(m => {
    const matchesPkg = !currentPackage || m.appPackage === currentPackage || m.appPackage === '';
    const matchesCat = activeCategory === 'All' || m.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch = !q || m.name.toLowerCase().includes(q)
      || m.tags.some(t => t.toLowerCase().includes(q))
      || m.category.toLowerCase().includes(q);
    return matchesPkg && matchesCat && matchesSearch;
  });

  const handleDelete = (id: string) => {
    moduleStore.delete(id);
    reload();
  };

  const handleSaved = () => {
    reload();
    setEditingModule(null);
    setShowNewDialog(false);
  };

  const catStyle = (cat: string) => CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.Other;
  const bestLocator = (m: ZenitModule) => m.locators.sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-md">
          <Search className="w-3 h-3 text-[#999] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules…"
            className="flex-1 bg-transparent text-[11px] text-[#2D2D2D] outline-none placeholder:text-[#999]"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="px-3 pb-2 flex gap-1 flex-wrap shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
              activeCategory === cat
                ? 'bg-[#0078D4] text-white border-[#0078D4]'
                : 'bg-white text-[#616161] border-[#E0E0E0] hover:border-[#0078D4] hover:text-[#0078D4]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Module list */}
      <div className="flex-1 min-h-0 overflow-y-auto vs-scroll px-3 space-y-2 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Package className="w-8 h-8 text-[#D0D0D0] mb-2" />
            <p className="text-[11px] text-[#999]">No modules yet.</p>
            <p className="text-[10px] text-[#BBB]">Inspect an element and click Save as Module.</p>
          </div>
        ) : (
          filtered.map(m => {
            const best = bestLocator(m);
            const cs = catStyle(m.category);
            return (
              <div
                key={m.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('moduleId', m.id)}
                className="bg-white border border-[#E8E8E8] rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-[#0078D4] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Package className="w-3 h-3 text-[#0078D4] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#2D2D2D] truncate">{m.name}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                    style={{ color: cs.color, background: cs.bg }}>
                    {m.category}
                  </span>
                </div>
                {best && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] uppercase font-semibold text-[#999]">{best.strategy}</span>
                    <ConfidenceDots confidence={best.confidence} />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#999]">{m.appPackage || 'any'} · {m.locators.length} locator{m.locators.length !== 1 ? 's' : ''}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingModule(m)} className="p-1 hover:bg-[#F0F0F0] rounded transition-colors">
                      <Edit2 className="w-3 h-3 text-[#888]" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="p-1 hover:bg-[#FEE2E2] rounded transition-colors">
                      <Trash2 className="w-3 h-3 text-[#EF4444]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New module button */}
      <div className="px-3 py-2 border-t border-[#F0F0F0] shrink-0">
        <button
          onClick={() => setShowNewDialog(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-[#0078D4] border border-dashed border-[#0078D4] rounded-md hover:bg-[#EBF4FF] transition-colors"
        >
          <Plus className="w-3 h-3" /> New Module
        </button>
      </div>

      {/* Edit dialog */}
      {editingModule && (
        <SaveModuleDialog
          element={null}
          currentPackage={currentPackage}
          screenshotUrl={screenshotUrl}
          onSave={handleSaved}
          onClose={() => setEditingModule(null)}
        />
      )}

      {/* New module dialog (no element pre-fill) */}
      {showNewDialog && (
        <SaveModuleDialog
          element={null}
          currentPackage={currentPackage}
          screenshotUrl={screenshotUrl}
          onSave={handleSaved}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}
