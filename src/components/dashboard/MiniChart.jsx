import React from 'react';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';

export default function MiniChart({ data, title, dataKey, color, unit }) {
  const chartData = data.slice(-20).map(d => ({
    time: d.created_date ? format(new Date(d.created_date), 'HH:mm') : '',
    value: d[dataKey],
  }));

  return (
    <Card className="p-5 border-0 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        {chartData.length > 0 && (
          <span className="text-lg font-bold">
            {chartData[chartData.length - 1]?.value}{unit}
          </span>
        )}
      </div>
      <div className="h-32">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }}
                formatter={(v) => [`${v}${unit}`, title]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${dataKey})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Chưa có dữ liệu
          </div>
        )}
      </div>
    </Card>
  );
}