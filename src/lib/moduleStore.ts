import { ZenitModule } from '@/types/module';
import { ZenitTestPlan } from '@/types/testPlan';
import { ZenitDataSet, DataRow } from '@/types/dataset';

const KEYS = {
  modules:   'zenit:modules',
  testPlans: 'zenit:testPlans',
  dataSets:  'zenit:dataSets',
};

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const moduleStore = {
  getAll: (): ZenitModule[] => {
    try { return JSON.parse(localStorage.getItem(KEYS.modules) || '[]'); }
    catch { return []; }
  },
  save: (m: ZenitModule): void => {
    const all = moduleStore.getAll();
    const idx = all.findIndex(x => x.id === m.id);
    if (idx >= 0) all[idx] = m; else all.push(m);
    localStorage.setItem(KEYS.modules, JSON.stringify(all));
  },
  delete: (id: string): void => {
    localStorage.setItem(KEYS.modules,
      JSON.stringify(moduleStore.getAll().filter(x => x.id !== id)));
  },
  create: (partial: Omit<ZenitModule, 'id' | 'capturedAt'>): ZenitModule => {
    const m: ZenitModule = { ...partial, id: uid(), capturedAt: Date.now() };
    moduleStore.save(m);
    return m;
  },
};

export const planStore = {
  getAll: (): ZenitTestPlan[] => {
    try { return JSON.parse(localStorage.getItem(KEYS.testPlans) || '[]'); }
    catch { return []; }
  },
  save: (p: ZenitTestPlan): void => {
    const all = planStore.getAll();
    const idx = all.findIndex(x => x.id === p.id);
    if (idx >= 0) all[idx] = p; else all.push(p);
    localStorage.setItem(KEYS.testPlans, JSON.stringify(all));
  },
  delete: (id: string): void => {
    localStorage.setItem(KEYS.testPlans,
      JSON.stringify(planStore.getAll().filter(x => x.id !== id)));
  },
  create: (partial: Omit<ZenitTestPlan, 'id' | 'createdAt' | 'updatedAt'>): ZenitTestPlan => {
    const p: ZenitTestPlan = {
      ...partial, id: uid(),
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    planStore.save(p);
    return p;
  },
};

export const dataSetStore = {
  getAll: (): ZenitDataSet[] => {
    try { return JSON.parse(localStorage.getItem(KEYS.dataSets) || '[]'); }
    catch { return []; }
  },
  save: (d: ZenitDataSet): void => {
    const all = dataSetStore.getAll();
    const idx = all.findIndex(x => x.id === d.id);
    if (idx >= 0) all[idx] = d; else all.push(d);
    localStorage.setItem(KEYS.dataSets, JSON.stringify(all));
  },
  delete: (id: string): void => {
    localStorage.setItem(KEYS.dataSets,
      JSON.stringify(dataSetStore.getAll().filter(x => x.id !== id)));
  },
  create: (name: string, columns: string[]): ZenitDataSet => {
    const d: ZenitDataSet = { id: uid(), name, columns, rows: [], createdAt: Date.now() };
    dataSetStore.save(d);
    return d;
  },
};
