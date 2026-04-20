"use client";

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface TeamPerformanceChartProps {
  data: Array<{
    name: string;
    bugsReported: number;
    bugsClosed: number;
    closeRate: number;
  }>;
  title?: string;
}

export function TeamPerformanceChart({ data, title = 'Team Performance' }: TeamPerformanceChartProps) {
  const chartData = useMemo(() => {
    return data
      .sort((a, b) => b.bugsReported - a.bugsReported)
      .slice(0, 10) // Top 10 performers
      .map(d => ({
        name: d.name.split(' ')[0], // First name only for space
        Reported: d.bugsReported,
        Closed: d.bugsClosed,
        'Close Rate': d.closeRate,
      }));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const reported = payload.find((p: any) => p.dataKey === 'Reported')?.value || 0;
      const closed = payload.find((p: any) => p.dataKey === 'Closed')?.value || 0;
      const closeRate = payload.find((p: any) => p.dataKey === 'Close Rate')?.value || 0;
      
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
          <p className="font-bold text-sm mb-2">{label}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                Reported
              </span>
              <span className="font-bold">{reported}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Closed
              </span>
              <span className="font-bold">{closed}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
              <span>Close Rate</span>
              <span className="font-bold text-primary">{closeRate}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="circle"
            />
            <Bar 
              dataKey="Reported" 
              fill="#3b82f6" 
              radius={[8, 8, 0, 0]}
              animationBegin={0}
              animationDuration={800}
            />
            <Bar 
              dataKey="Closed" 
              fill="#22c55e" 
              radius={[8, 8, 0, 0]}
              animationBegin={200}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
