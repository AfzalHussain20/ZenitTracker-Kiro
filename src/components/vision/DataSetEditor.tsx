"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Upload, Table2 } from 'lucide-react';
import { ZenitDataSet, DataRow } from '@/types/dataset';
import { dataSetStore, uid } from '@/lib/moduleStore';

export default function DataSetEditor() {
  const [datasets, setDatasets] = useState<ZenitDataSet[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    const all = dataSetStore.getAll();
    setDatasets(all);
    if (!selectedId && all.length > 0) setSelectedId(all[0].id);
  };

  useEffect(() => { reload(); }, []);

  const selected = datasets.find(d => d.id === selectedId) ?? null;

  const saveSelected = (updated: ZenitDataSet) => {
    dataSetStore.save(updated);
    setDatasets(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const createDataset = () => {
    const ds = dataSetStore.create('New Dataset', ['column1']);
    setDatasets(dataSetStore.getAll());
    setSelectedId(ds.id);
  };

  const addRow = () => {
    if (!selected) return;
    const row: DataRow = {
      id: uid(),
      values: Object.fromEntries(selected.columns.map(c => [c, ''])),
      enabled: true,
    };
    saveSelected({ ...selected, rows: [...selected.rows, row] });
  };

  const removeRow = (rowId: string) => {
    if (!selected) return;
    saveSelected({ ...selected, rows: selected.rows.filter(r => r.id !== rowId) });
  };

  const updateCell = (rowId: string, col: string, value: string) => {
    if (!selected) return;
    saveSelected({
      ...selected,
      rows: selected.rows.map(r => r.id === rowId ? { ...r, values: { ...r.values, [col]: value } } : r),
    });
  };

  const addColumn = () => {
    if (!selected) return;
    const name = `column${selected.columns.length + 1}`;
    saveSelected({
      ...selected,
      columns: [...selected.columns, name],
      rows: selected.rows.map(r => ({ ...r, values: { ...r.values, [name]: '' } })),
    });
  };

  const renameColumn = (oldName: string, newName: string) => {
    if (!selected) return;
    if (!/^\w+$/.test(newName)) { setHeaderError('No spaces allowed — use letters, digits, underscore only'); return; }
    if (selected.columns.includes(newName) && newName !== oldName) { setHeaderError('Column name already exists'); return; }
    setHeaderError('');
    const updated: ZenitDataSet = {
      ...selected,
      columns: selected.columns.map(c => c === oldName ? newName : c),
      rows: selected.rows.map(r => {
        const values = { ...r.values };
        values[newName] = values[oldName] ?? '';
        if (newName !== oldName) delete values[oldName];
        return { ...r, values };
      }),
    };
    saveSelected(updated);
    setEditingHeader(null);
  };

  const removeColumn = (col: string) => {
    if (!selected || selected.columns.length <= 1) return;
    saveSelected({
      ...selected,
      columns: selected.columns.filter(c => c !== col),
      rows: selected.rows.map(r => {
        const values = { ...r.values };
        delete values[col];
        return { ...r, values };
      }),
    });
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 1) return;
      const columns = lines[0].split(',').map(c => c.trim().replace(/"/g, ''));
      const rows: DataRow[] = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const values: Record<string, string> = {};
        columns.forEach((col, i) => { values[col] = vals[i] ?? ''; });
        return { id: uid(), values, enabled: true };
      });
      const newDs = dataSetStore.create(`Imported ${file.name}`, columns);
      newDs.rows = rows;
      dataSetStore.save(newDs);
      const all = dataSetStore.getAll();
      setDatasets(all);
      setSelectedId(newDs.id);
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    if (!selected) return;
    const header = selected.columns.join(',');
    const rows = selected.rows.map(r =>
      selected.columns.map(col => `"${r.values[col] ?? ''}"`).join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selected.name}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-[#F0F0F0] flex items-center gap-2 shrink-0 flex-wrap">
        <button
          onClick={createDataset}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-[#0078D4] text-white rounded-md hover:bg-[#106EBE] transition-colors"
        >
          <Plus className="w-3 h-3" /> New Dataset
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium border border-[#D0D0D0] text-[#616161] rounded-md hover:bg-[#F0F0F0] transition-colors"
        >
          <Upload className="w-3 h-3" /> Import CSV
        </button>
        <button
          onClick={exportCSV}
          disabled={!selected}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium border border-[#D0D0D0] text-[#616161] rounded-md hover:bg-[#F0F0F0] disabled:opacity-40 transition-colors"
        >
          <Download className="w-3 h-3" /> Export
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
          onChange={e => { if (e.target.files?.[0]) importCSV(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {/* Dataset selector */}
      {datasets.length > 0 && (
        <div className="px-3 py-2 border-b border-[#F0F0F0] shrink-0">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-2 py-1 text-[11px] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] text-[#2D2D2D] bg-white"
          >
            {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto vs-scroll">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Table2 className="w-8 h-8 text-[#D0D0D0] mb-2" />
            <p className="text-[11px] text-[#999]">No datasets yet.</p>
            <p className="text-[10px] text-[#BBB]">Create one or import a CSV file.</p>
          </div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#F8F8F8] border-b border-[#E0E0E0]">
                <th className="w-8 px-2 py-1.5 text-[10px] text-[#999] font-medium border-r border-[#E0E0E0]">#</th>
                {selected.columns.map(col => (
                  <th key={col} className="px-2 py-1.5 text-left border-r border-[#E0E0E0] min-w-[100px]">
                    <div className="flex items-center gap-1 group">
                      {editingHeader === col ? (
                        <div className="flex flex-col w-full">
                          <input
                            autoFocus
                            defaultValue={col}
                            className={`w-full px-1 py-0.5 text-[10px] border rounded outline-none ${headerError ? 'border-red-400' : 'border-[#0078D4]'}`}
                            onBlur={e => renameColumn(col, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') renameColumn(col, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') { setEditingHeader(null); setHeaderError(''); }
                            }}
                          />
                          {headerError && <span className="text-[9px] text-red-500 mt-0.5">{headerError}</span>}
                        </div>
                      ) : (
                        <>
                          <span
                            className="font-semibold text-[#2D2D2D] cursor-pointer hover:text-[#0078D4]"
                            onClick={() => { setEditingHeader(col); setHeaderError(''); }}
                          >
                            {col}
                          </span>
                          <button
                            onClick={() => removeColumn(col)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#FEE2E2] rounded transition-all"
                          >
                            <Trash2 className="w-2.5 h-2.5 text-[#EF4444]" />
                          </button>
                        </>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-1.5 w-8">
                  <button onClick={addColumn} className="p-0.5 hover:bg-[#EBF4FF] rounded transition-colors" title="Add column">
                    <Plus className="w-3 h-3 text-[#0078D4]" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {selected.rows.map((row, i) => (
                <tr key={row.id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
                  <td className="px-2 py-1 text-[10px] text-[#999] text-center border-r border-[#E0E0E0]">{i + 1}</td>
                  {selected.columns.map(col => (
                    <td key={col} className="px-1 py-0.5 border-r border-[#F0F0F0]">
                      {editingCell?.rowId === row.id && editingCell?.col === col ? (
                        <input
                          autoFocus
                          defaultValue={row.values[col] ?? ''}
                          className="w-full px-1.5 py-0.5 text-[11px] border border-[#0078D4] rounded outline-none"
                          onBlur={e => { updateCell(row.id, col, e.target.value); setEditingCell(null); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { updateCell(row.id, col, (e.target as HTMLInputElement).value); setEditingCell(null); }
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                        />
                      ) : (
                        <div
                          className="px-1.5 py-0.5 min-h-[22px] cursor-text rounded hover:bg-[#F0F0F0] text-[#2D2D2D]"
                          onClick={() => setEditingCell({ rowId: row.id, col })}
                        >
                          {row.values[col] || <span className="text-[#CCC]">—</span>}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-1 py-0.5 text-center">
                    <button onClick={() => removeRow(row.id)} className="p-0.5 hover:bg-[#FEE2E2] rounded transition-colors">
                      <Trash2 className="w-3 h-3 text-[#EF4444]" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Add row */}
              <tr>
                <td colSpan={selected.columns.length + 2} className="px-2 py-1">
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 text-[10px] text-[#0078D4] hover:text-[#106EBE] transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Footer hint */}
      {selected && (
        <div className="px-3 py-1.5 border-t border-[#F0F0F0] shrink-0">
          <p className="text-[10px] text-[#999]">
            Column names used as <span className="font-mono text-[#C7A008]">{'{{variables}}'}</span> in Builder
          </p>
        </div>
      )}
    </div>
  );
}
