import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Droplets, Fan, CloudRain, Lightbulb, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { DEVICE_IDS } from '@/config/greenhouse';
import { deviceService } from '@/services/deviceService';
import { useToast } from '@/components/ui/use-toast';

const deviceConfig = {
  pump: { icon: Droplets, label: 'Máy bơm nước', desc: 'Tưới cây tự động', gradient: 'from-blue-500 to-cyan-400' },
  fan: { icon: Fan, label: 'Quạt thông gió', desc: 'Làm mát nhà kính', gradient: 'from-teal-500 to-emerald-400' },
  mist: { icon: CloudRain, label: 'Phun sương', desc: 'Tăng độ ẩm không khí', gradient: 'from-violet-500 to-purple-400' },
  light: { icon: Lightbulb, label: 'Đèn chiếu sáng', desc: 'Bổ sung ánh sáng', gradient: 'from-amber-500 to-yellow-400' },
};

const commandStatusConfig = {
  command_sent: { label: 'Đã gửi lệnh, chờ phản hồi', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  confirmed: { label: 'Thiết bị đã xác nhận', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  failed: { label: 'Gửi lệnh thất bại', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  timeout: { label: 'Quá thời gian phản hồi', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

function DeviceCommandStatus({ log }) {
  if (!log) return null;

  const status = log.command_status || log.commandStatus || 'command_sent';
  const config = commandStatusConfig[status] || commandStatusConfig.command_sent;

  return (
    <div className="mt-4">
      <Badge className={cn('text-[10px]', config.className)}>
        {config.label}
      </Badge>
    </div>
  );
}

function DeviceControlCard({
  deviceId,
  device,
  latestCommandLog,
  index,
  isTogglePending,
  isModePending,
  onToggle,
  onModeChange,
}) {
  const config = deviceConfig[deviceId];
  const Icon = config.icon;
  const isOn = device?.is_on || false;
  const isDevicePending = isTogglePending || isModePending;

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
                disabled={!device || isDevicePending}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onModeChange(device, 'manual')}
                disabled={!device || isDevicePending || device?.mode === 'manual'}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  device?.mode === 'manual' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Thủ công
              </button>
              <button
                onClick={() => onModeChange(device, 'auto')}
                disabled={!device || isDevicePending || device?.mode === 'auto'}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  device?.mode === 'auto' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Tự động
              </button>
            </div>
          </div>
          <DeviceCommandStatus log={latestCommandLog} />
        </div>
      </Card>
    </motion.div>
  );
}

export default function Controls() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', 'list'],
    queryFn: () => deviceService.list(),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const { data: commandLogs = [] } = useQuery({
    queryKey: ['deviceCommandLogs', 'recent', 20],
    queryFn: () => deviceService.listCommandLogs(20),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ device_id, is_on }) => deviceService.command(device_id, { isOn: is_on }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommandLogs'] });
      const label = deviceConfig[variables.device_id]?.label || variables.device_id;
      toast({
        title: 'Đã gửi lệnh thiết bị',
        description: `${variables.is_on ? 'Bật' : 'Tắt'} ${label}. Đang chờ thiết bị xác nhận.`,
      });
    },
    onError: (error, variables) => {
      const label = deviceConfig[variables?.device_id]?.label || variables?.device_id || 'thiết bị';
      toast({
        variant: 'destructive',
        title: 'Gửi lệnh thất bại',
        description: error?.message || `Không thể gửi lệnh tới ${label}. Kiểm tra backend/MQTT rồi thử lại.`,
      });
    },
  });

  const modeMutation = useMutation({
    mutationFn: ({ id, mode }) => deviceService.update(id, { mode }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      const label = deviceConfig[variables.device_id]?.label || variables.device_id;
      toast({
        title: 'Đã cập nhật chế độ',
        description: `${label} đang ở chế độ ${variables.mode === 'auto' ? 'Tự động' : 'Thủ công'}.`,
      });
    },
    onError: (error, variables) => {
      const label = deviceConfig[variables?.device_id]?.label || variables?.device_id || 'thiết bị';
      toast({
        variant: 'destructive',
        title: 'Cập nhật chế độ thất bại',
        description: error?.message || `Không thể đổi chế độ cho ${label}.`,
      });
    },
  });

  const handleToggleDevice = (device, deviceId, isOn) => {
    if (!device) return;
    if (toggleMutation.isPending && toggleMutation.variables?.device_id === deviceId) return;
    toggleMutation.mutate({ device_id: deviceId, is_on: isOn });
  };

  const handleModeChange = (device, mode) => {
    if (!device || device.mode === mode) return;
    const deviceId = device.device_id || device.name;
    if (modeMutation.isPending && modeMutation.variables?.device_id === deviceId) return;
    modeMutation.mutate({ id: device.id, device_id: deviceId, mode });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Điều khiển thiết bị</h1>
        <p className="text-muted-foreground text-sm mt-1">Bật/tắt và quản lý chế độ hoạt động</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-3xl">
          Thủ công: người dùng điều khiển trực tiếp, automation không tự ghi đè. Tự động: automation được phép điều khiển theo luật.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DEVICE_IDS.map((deviceId, i) => {
          const device = devices.find(d => d.device_id === deviceId);
          const latestCommandLog = commandLogs.find((log) => (
            (log.device_name || log.deviceName) === deviceId
          ));
          const isTogglePending = toggleMutation.isPending && toggleMutation.variables?.device_id === deviceId;
          const isModePending = modeMutation.isPending && modeMutation.variables?.device_id === deviceId;

          return (
            <DeviceControlCard
              key={deviceId}
              deviceId={deviceId}
              device={device}
              latestCommandLog={latestCommandLog}
              index={i}
              isTogglePending={isTogglePending}
              isModePending={isModePending}
              onToggle={handleToggleDevice}
              onModeChange={handleModeChange}
            />
          );
        })}
      </div>
    </div>
  );
}
