import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock3,
  Droplets,
  Fan,
  Lightbulb,
  Loader2,
  Power,
  RadioTower,
  SendHorizontal,
  Settings2,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { DEVICE_IDS } from '@/config/greenhouse';
import { deviceService } from '@/services/deviceService';
import { useToast } from '@/components/ui/use-toast';

const deviceConfig = {
  pump: {
    icon: Droplets,
    label: 'Máy bơm nước',
    desc: 'Tưới cây tự động',
    accent: 'bg-blue-500',
    soft: 'bg-blue-50 text-blue-700 border-blue-100',
    active: 'bg-blue-600 text-white',
  },
  fan: {
    icon: Fan,
    label: 'Quạt thông gió',
    desc: 'Làm mát nhà kính',
    accent: 'bg-teal-500',
    soft: 'bg-teal-50 text-teal-700 border-teal-100',
    active: 'bg-teal-600 text-white',
  },
  light: {
    icon: Lightbulb,
    label: 'Đèn chiếu sáng',
    desc: 'Bổ sung ánh sáng',
    accent: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-700 border-amber-100',
    active: 'bg-amber-500 text-white',
  },
};

const commandStatusConfig = {
  command_sent: {
    icon: Loader2,
    label: 'Chờ xác nhận',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    iconClassName: 'animate-spin',
  },
  confirmed: {
    icon: CheckCircle2,
    label: 'Đã xác nhận',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  failed: {
    icon: TriangleAlert,
    label: 'Gửi thất bại',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  timeout: {
    icon: Clock3,
    label: 'Hết thời gian',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
};

function getCommandStatus(log) {
  return log?.command_status || log?.commandStatus || 'command_sent';
}

function matchesDeviceId(item, deviceId) {
  return item?.device_id === deviceId || item?.deviceName === deviceId || item?.name === deviceId;
}

function matchesCommandLog(log, deviceId) {
  return (log?.device_name || log?.deviceName) === deviceId;
}

function DeviceCommandStatus({ log }) {
  if (!log) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        Chưa có lệnh gần đây
      </span>
    );
  }

  const status = getCommandStatus(log);
  const config = commandStatusConfig[status] || commandStatusConfig.command_sent;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5 border px-2 py-1 text-[11px]', config.className)}>
      <Icon className={cn('h-3.5 w-3.5', config.iconClassName)} />
      {config.label}
    </Badge>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="rounded-lg border-0 bg-card/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function ModeButton({ active, disabled, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 min-w-20 rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function DeviceStateBadge({ device, isOn }) {
  if (!device) {
    return (
      <Badge variant="secondary" className="border border-dashed border-border bg-muted text-muted-foreground">
        Chưa có
      </Badge>
    );
  }

  return (
    <Badge className={cn('border px-2.5 py-1 text-xs', isOn
      ? 'border-primary/20 bg-primary text-primary-foreground'
      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100'
    )}>
      {isOn ? 'Đang bật' : 'Đang tắt'}
    </Badge>
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
  const isOnline = device?.online === true;

  return (
    <motion.div
      key={deviceId}
      className="h-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className={cn(
        'relative h-full overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        isOn ? 'border-primary/25' : 'border-border',
      )}>
        <div className={cn(
          'absolute inset-y-0 left-0 w-1 transition-opacity',
          isOn ? config.accent : 'bg-border',
        )} />

        <div className="flex h-full flex-col p-5 pl-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition-colors',
                isOn ? config.active : config.soft,
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{config.label}</h3>
                <p className="truncate text-sm text-muted-foreground">{config.desc}</p>
              </div>
            </div>
            <DeviceStateBadge device={device} isOn={isOn} />
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-md bg-muted/50 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-primary" />
                ) : (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="truncate">{isOnline ? 'Đã kết nối' : 'Chưa kết nối'}</span>
              </div>
              <DeviceCommandStatus log={latestCommandLog} />
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Power className="h-4 w-4 text-muted-foreground" />
                Nguồn
              </div>
              <Switch
                checked={isOn}
                onCheckedChange={(checked) => onToggle(device, deviceId, checked)}
                disabled={!device || isDevicePending}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Chế độ
              </div>
              <div className="inline-grid grid-cols-2 rounded-lg bg-muted p-1">
                <ModeButton
                  active={device?.mode === 'manual'}
                  disabled={!device || isDevicePending || device?.mode === 'manual'}
                  onClick={() => onModeChange(device, 'manual')}
                >
                  Thủ công
                </ModeButton>
                <ModeButton
                  active={device?.mode === 'auto'}
                  disabled={!device || isDevicePending || device?.mode === 'auto'}
                  onClick={() => onModeChange(device, 'auto')}
                >
                  Tự động
                </ModeButton>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function GatewayFrequencyCard({
  value,
  isPending,
  onChange,
  onSubmit,
}) {
  return (
    <Card className="rounded-lg border bg-card p-5 shadow-sm">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RadioTower className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Gateway</h2>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gateway-update-frequency">Tần suất cập nhật</Label>
            <div className="relative w-full sm:w-64">
              <Input
                id="gateway-update-frequency"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={isPending}
                className="pr-14"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
                giây
              </span>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={isPending} className="w-full gap-2 sm:w-fit">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
          Gửi Gateway
        </Button>
      </form>
    </Card>
  );
}

export default function Controls() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [gatewayFrequencySeconds, setGatewayFrequencySeconds] = useState('10');

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

  const gatewayFrequencyMutation = useMutation({
    mutationFn: (seconds) => deviceService.updateGatewayFrequency(seconds),
    onSuccess: (_data, seconds) => {
      toast({
        title: 'Đã gửi cấu hình Gateway',
        description: `Tần suất cập nhật: ${seconds} giây.`,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Gửi cấu hình Gateway thất bại',
        description: error?.message || 'Không thể gửi tần suất cập nhật xuống Gateway.',
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

  const handleGatewayFrequencySubmit = (event) => {
    event.preventDefault();

    const seconds = Number(gatewayFrequencySeconds);
    if (!Number.isInteger(seconds) || seconds <= 0) {
      toast({
        variant: 'destructive',
        title: 'Tần suất không hợp lệ',
        description: 'Vui lòng nhập số nguyên dương, đơn vị giây.',
      });
      return;
    }

    gatewayFrequencyMutation.mutate(seconds);
  };

  const configuredDevices = DEVICE_IDS.map((deviceId) => devices.find(d => matchesDeviceId(d, deviceId)));
  const activeCount = configuredDevices.filter((device) => device?.is_on).length;
  const autoCount = configuredDevices.filter((device) => device?.mode === 'auto').length;
  const pendingCount = DEVICE_IDS
    .map((deviceId) => commandLogs.find((log) => matchesCommandLog(log, deviceId)))
    .filter(Boolean)
    .filter((log) => getCommandStatus(log) === 'command_sent')
    .length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Điều khiển thiết bị</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bật/tắt relay và chuyển chế độ vận hành</p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 border-primary/20 bg-primary/5 px-3 py-1 text-primary">
          <RadioTower className="h-3.5 w-3.5" />
          {DEVICE_IDS.length} thiết bị
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Power}
          label="Đang bật"
          value={`${activeCount}/${DEVICE_IDS.length}`}
          tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          icon={Settings2}
          label="Tự động"
          value={autoCount}
          tone="bg-blue-50 text-blue-700"
        />
        <SummaryCard
          icon={Clock3}
          label="Đang chờ"
          value={pendingCount}
          tone="bg-amber-50 text-amber-700"
        />
      </div>

      <GatewayFrequencyCard
        value={gatewayFrequencySeconds}
        isPending={gatewayFrequencyMutation.isPending}
        onChange={setGatewayFrequencySeconds}
        onSubmit={handleGatewayFrequencySubmit}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {DEVICE_IDS.map((deviceId, i) => {
          const device = devices.find(d => matchesDeviceId(d, deviceId));
          const latestCommandLog = commandLogs.find((log) => matchesCommandLog(log, deviceId));
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
