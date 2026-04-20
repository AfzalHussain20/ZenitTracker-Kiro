"use client";

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface BugTrendChartProps {
  data: Array<{
    month: string;
    bugs: number;
    open: number;
    closed: number;
    inProgress: number;
  }>;
  title?: string;
}

export function BugTrendChart({ data, title = 'Bug Trend Analysis' }: BugTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      name: d.month,
      Total: d.bugs,
      Open: d.open,
      Closed: d.closed,
      'In Progress': d.inProgress,
    }));
  }, [data]);

  const stats = useMemo(() => {
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    
    if (!latest || !previous) return null;
    
    const totalChange = latest.bugs - previous.bugs;
    const openChange = latest.open - previous.open;
    const closedChange = latest.closed - previous.closed;
    
    return {
      totalChange,
      openChange,
      closedChange,
      latest,
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl min-w-[180px]">
          <p className="font-black text-base mb-3 text-foreground">{label}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }} 
                  />
                  {entry.name}
                </span>
                <span className="font-black text-base">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
        {payload.map((entry: any, index: number) => (
          <div 
            key={index} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
          >
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="text-sm font-semibold text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-black text-foreground">{title}</h3>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Total Bugs</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600">{stats.latest.bugs}</span>
                {stats.totalChange !== 0 && (
                  <span className={`text-xs font-bold ${stats.totalChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.totalChange > 0 ? '▲' : '▼'} {Math.abs(stats.totalChange)}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Open</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-red-600">{stats.latest.open}</span>
                {stats.openChange !== 0 && (
                  <span className={`text-xs font-bold ${stats.openChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.openChange > 0 ? '▲' : '▼'} {Math.abs(stats.openChange)}
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Closed</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-green-600">{stats.latest.closed}</span>
                {stats.closedChange !== 0 && (
                  <span className={`text-xs font-bold ${stats.closedChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.closedChange > 0 ? '▲' : '▼'} {Math.abs(stats.closedChange)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-900/30 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.2}
              vertical={false}
            />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={13}
              fontWeight={600}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={13}
              fontWeight={600}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            <Area 
              type="monotone" 
              dataKey="Total" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorTotal)"
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="Open" 
              stroke="#ef4444" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorOpen)"
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="Closed" 
              stroke="#22c55e" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorClosed)"
              dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="In Progress" 
              stroke="#f59e0b" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorInProgress)"
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
