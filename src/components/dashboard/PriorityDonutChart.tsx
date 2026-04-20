"use client";

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriorityDonutChartProps {
  data: {
    Highest: number;
    High: number;
    Medium: number;
    Low: number;
    Lowest: number;
  };
  title?: string;
}

const PRIORITY_CONFIG = {
  Highest: { 
    color: '#dc2626', 
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-900',
    textColor: 'text-red-700 dark:text-red-400',
    label: 'Critical',
    icon: '🔴'
  },
  High: { 
    color: '#f97316', 
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-900',
    textColor: 'text-orange-700 dark:text-orange-400',
    label: 'High',
    icon: '🟠'
  },
  Medium: { 
    color: '#f59e0b', 
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200 dark:border-amber-900',
    textColor: 'text-amber-700 dark:text-amber-400',
    label: 'Medium',
    icon: '🟡'
  },
  Low: { 
    color: '#3b82f6', 
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-900',
    textColor: 'text-blue-700 dark:text-blue-400',
    label: 'Low',
    icon: '🔵'
  },
  Lowest: { 
    color: '#64748b', 
    bgColor: 'bg-slate-50 dark:bg-slate-950/20',
    borderColor: 'border-slate-200 dark:border-slate-900',
    textColor: 'text-slate-700 dark:text-slate-400',
    label: 'Lowest',
    icon: '⚪'
  },
};

export function PriorityDonutChart({ data, title = 'Priority Distribution' }: PriorityDonutChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        ...PRIORITY_CONFIG[name as keyof typeof PRIORITY_CONFIG],
      }));
  }, [data]);

  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{data.payload.icon}</span>
            <span className="font-black text-base">{data.payload.label}</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-foreground">{data.value}</div>
            <div className="text-xs font-semibold text-muted-foreground">{percentage}% of total</div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        className="text-sm font-black drop-shadow-lg"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (total === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-black text-foreground">{title}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="w-16 h-16 opacity-20 mb-4" />
          <div className="font-semibold">No bugs to display</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-xl font-black text-foreground">{title}</h3>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Chart */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={320} height={320}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={140}
                innerRadius={90}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={1000}
                strokeWidth={3}
                stroke="white"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-5xl font-black text-foreground mb-1">{total}</div>
            <div className="text-sm font-bold text-muted-foreground">Total Bugs</div>
          </div>
        </div>

        {/* Legend - Large Cards */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 gap-3">
            {chartData.map((entry) => {
              const percentage = ((entry.value / total) * 100).toFixed(1);
              return (
                <div 
                  key={entry.name} 
                  className={cn(
                    'flex items-center justify-between p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer',
                    entry.bgColor,
                    entry.borderColor
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{entry.icon}</span>
                    <div>
                      <div className={cn('text-base font-black', entry.textColor)}>
                        {entry.label}
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {percentage}% of total
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-foreground">{entry.value}</div>
                    <div className="text-xs font-semibold text-muted-foreground">bugs</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-900/30 border-2 border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-black text-red-600">
                  {(data.Highest || 0) + (data.High || 0)}
                </div>
                <div className="text-xs font-semibold text-muted-foreground mt-1">High Priority</div>
              </div>
              <div>
                <div className="text-2xl font-black text-amber-600">
                  {data.Medium || 0}
                </div>
                <div className="text-xs font-semibold text-muted-foreground mt-1">Medium</div>
              </div>
              <div>
                <div className="text-2xl font-black text-blue-600">
                  {(data.Low || 0) + (data.Lowest || 0)}
                </div>
                <div className="text-xs font-semibold text-muted-foreground mt-1">Low Priority</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
