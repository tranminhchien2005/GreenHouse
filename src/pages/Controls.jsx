import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Droplets, Fan, CloudRain, Lightbulb, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { publishCommand, TOPICS } from '@/lib/mqttClient';
import { DEVICE_IDS } from '@/config/greenhouse';
import { deviceService } from '@/services/deviceService';

const deviceConfig = {
  pump: { icon: Droplets, label: 'Máy bơm nước', desc: 'Tưới cây tự động', gradient: 'from-blue-500 to-cyan-400' },
  fan: { icon: Fan, label: 'Quạt thông gió', desc: 'Làm mát nhà kính', gradient: 'from-teal-500 to-emerald-400' },
  mist: { icon: CloudRain, label: 'Phun sương', desc: 'Tăng độ ẩm không khí', gradient: 'from-violet-500 to-purple-400' },
  light: { icon: Lightbulb, label: 'Đèn chiếu sáng', desc: 'Bổ sung ánh sáng', gradient: 'from-amber-500 to-yellow-400' },
};

const deviceTopics = {
  pump: TOPICS.CONTROL_PUMP,
  fan: TOPICS.CONTROL_FAN,
  mist: TOPICS.CONTROL_MIST,
  light: TOPICS.CONTROL_LIGHT,
};

function DeviceControlCard({ deviceId, device, index, onToggle, onModeChange }) {
  const config = deviceConfig[deviceId];
  const Icon = config.icon;
  const isOn = device?.is_on || false;

  return (
    <motion.div
      key={deviceId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={cn(
        "relative overflow-hidden border-0 shadow-sm transition-all duration-500",
        isOn && "shadow-lg"
      )}>
        {/* Gradient top bar */}
        <div className={cn(
          "h-1.5 bg-gradient-to-r transition-opacity duration-500",
          config.gradient,
          isOn ? "opacity-100" : "opacity-20"
        )} />

        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                isOn
                  ? `bg-gradient-to-br ${config.gradient} text-white shadow-lg`
                  : "bg-muted text-muted-foreground"
              )}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{config.label}</h3>
                <p className="text-sm text-muted-foreground">{config.desc}</p>
              </div>
            </div>
            <Badge variant={isOn ? "default" : "secondary"} className={cn(
              "text-xs",
              isOn && "bg-primary"
            )}>
              {isOn ? 'BẬT' : 'TẮT'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className="w-4 h-4 text-muted-foreground" />
              <Switch
                checked={isOn}
                onCheckedChange={(checked) => onToggle(device, deviceId, checked)}
                disabled={!device}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onModeChange(device, 'manual')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  device?.mode === 'manual' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Thủ công
              </button>
              <button
                onClick={() => onModeChange(device, 'auto')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  device?.mode === 'auto' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Tự động
              </button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Controls() {
  const queryClient = useQueryClient();

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', 'list'],
    queryFn: () => deviceService.list(),
    refetchOnMount: 'always',
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, device_id, is_on }) => {
      // Publish MQTT command to ESP8266
      const topic = deviceTopics[device_id];
      if (topic) publishCommand(topic, is_on ? '1' : '0');
      // Update DB state
      return deviceService.update(id, { is_on });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const modeMutation = useMutation({
    mutationFn: ({ id, mode }) => deviceService.update(id, { mode }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const handleToggleDevice = (device, deviceId, isOn) => {
    if (!device) return;
    toggleMutation.mutate({ id: device.id, device_id: deviceId, is_on: isOn });
  };

  const handleModeChange = (device, mode) => {
    if (!device) return;
    modeMutation.mutate({ id: device.id, mode });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Điều khiển thiết bị</h1>
        <p className="text-muted-foreground text-sm mt-1">Bật/tắt và quản lý chế độ hoạt động</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DEVICE_IDS.map((deviceId, i) => {
          const device = devices.find(d => d.device_id === deviceId);

          return (
            <DeviceControlCard
              key={deviceId}
              deviceId={deviceId}
              device={device}
              index={i}
              onToggle={handleToggleDevice}
              onModeChange={handleModeChange}
            />
          );
        })}
      </div>
    </div>
  );
}
