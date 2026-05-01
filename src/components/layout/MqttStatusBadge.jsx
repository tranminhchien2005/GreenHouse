import React from 'react';
import { useMqttStatus } from '@/lib/useMqtt';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export default function MqttStatusBadge() {
  const status = useMqttStatus();

  const config = {
    connected: { icon: Wifi, color: 'text-green-400', dot: 'bg-green-400', label: 'MQTT Đã kết nối' },
    reconnecting: { icon: Loader2, color: 'text-amber-400', dot: 'bg-amber-400', label: 'Đang kết nối lại...' },
    disconnected: { icon: WifiOff, color: 'text-red-400', dot: 'bg-red-400', label: 'Mất kết nối MQTT' },
  }[status] || { icon: WifiOff, color: 'text-red-400', dot: 'bg-red-400', label: 'Mất kết nối' };

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", config.dot, status === 'connected' && "animate-pulse")} />
      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", config.color, status === 'reconnecting' && "animate-spin")} />
      <span className={cn("text-xs", config.color)}>{config.label}</span>
    </div>
  );
}