import React from 'react';
import { Card } from '@/components/ui/card';
import { Droplets, Fan, CloudRain, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEVICE_IDS, DEVICE_LABELS } from '@/config/greenhouse';

const deviceIcons = {
  pump: Droplets,
  fan: Fan,
  mist: CloudRain,
  light: Lightbulb,
};

export default function DeviceStatusBar({ devices }) {
  return (
    <Card className="p-5 border-0 shadow-sm">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Trạng thái thiết bị
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {DEVICE_IDS.map((id) => {
          const device = devices.find(d => d.device_id === id);
          const isOn = device?.is_on || false;
          const Icon = deviceIcons[id];
          return (
            <div
              key={id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                isOn ? "bg-primary/10" : "bg-muted"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                isOn ? "bg-primary text-primary-foreground" : "bg-muted-foreground/10 text-muted-foreground"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium">{DEVICE_LABELS[id]}</p>
                <p className={cn(
                  "text-xs font-semibold",
                  isOn ? "text-primary" : "text-muted-foreground"
                )}>
                  {isOn ? 'BẬT' : 'TẮT'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
