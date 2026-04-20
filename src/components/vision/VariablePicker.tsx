"use client";

interface Props {
  columns: string[];
  onInsert: (variable: string) => void;
  onClose: () => void;
}

export default function VariablePicker({ columns, onInsert, onClose }: Props) {
  if (columns.length === 0) return null;
  return (
    <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-lg p-2 min-w-[160px] fade-slide-in">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-[#999] px-1 mb-1.5">Insert Variable</div>
      <div className="flex flex-wrap gap-1">
        {columns.map(col => (
          <button
            key={col}
            onClick={() => { onInsert(`{{${col}}}`); onClose(); }}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            {`{{${col}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
