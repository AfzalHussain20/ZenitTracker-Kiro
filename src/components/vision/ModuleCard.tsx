"use client";

import { Package, Edit2, Trash2, GripVertical } from 'lucide-react';
import { ZenitModule } from '@/types/module';
import ConfidenceBar from './ConfidenceBar';

const CATEGORY_COLORS: Record<string, string> = {
  Authentication: '#0078D4',
  Navigation:     '#107C10',
  Cart:           '#C7A008',
  Forms:          '#8764B8',
  Media:          '#D13438',
  Other:          '#616161',
};

interface Props {
  module: ZenitModule;
  onEdit?: (m: ZenitModule) => void;
  onDelete?: (id: string) => void;
  draggable?: boolean;
  compact?: boolean;
}

export default function ModuleCard({ module, onEdit, onDelete, draggable = true, compact = false }: Props) {
  const bestLocator = [...module.locators].sort((a, b) => b.confidence - a.confidence)[0];
  const catColor = CATEGORY_COLORS[module.category] || '#616161';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('moduleId', module.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      className={`group relative bg-white border border-[#E0E0E0] rounded-lg transition-all hover:border-[#0078D4]/40 hover:shadow-sm ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical className="w-3 h-3 text-[#ABABAB] mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${catColor}18` }}>
          <Package className="w-3 h-3" style={{ color: catColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] font-semibold text-[#2D2D2D] truncate">{module.name}</span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${catColor}18`, color: catColor }}
            >
              {module.category}
            </span>
          </div>
          {!compact && (
            <div className="flex items-center gap-2 mt-1">
              {bestLocator && (
                <>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[#888]">{bestLocator.strategy}</span>
                  <ConfidenceBar confidence={bestLocator.confidence} />
                </>
              )}
              <span className="text-[9px] text-[#ABABAB] ml-auto">{module.locators.length} locators</span>
            </div>
          )}
          {!compact && module.appPackage && (
            <div className="text-[9px] text-[#ABABAB] font-mono truncate mt-0.5">{module.appPackage}</div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(module); }}
              className="p-1 hover:bg-[#EBF4FF] rounded transition-colors"
              title="Edit module"
            >
              <Edit2 className="w-3 h-3 text-[#0078D4]" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(module.id); }}
              className="p-1 hover:bg-red-50 rounded transition-colors"
              title="Delete module"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
