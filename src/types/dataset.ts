export interface ZenitDataSet {
  id: string;
  name: string;
  columns: string[];
  rows: DataRow[];
  createdAt: number;
}

export interface DataRow {
  id: string;
  values: Record<string, string>;
  label?: string;
  enabled: boolean;
}
