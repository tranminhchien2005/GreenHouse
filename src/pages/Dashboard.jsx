import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Thermometer, Droplets, CloudRain, Sun } from 'lucide-react';
import SensorCard from '@/components/dashboard/SensorCard';
import DeviceStatusBar from '@/components/dashboard/DeviceStatusBar';
import RecentAlerts from '@/components/dashboard/RecentAlerts';
import MiniChart from '@/components/dashboard/MiniChart';
import ActivityLog from '@/components/dashboard/ActivityLog';
import { getSensorWarning } from '@/services/alertRules';
import { SENSOR_LABELS } from '@/config/greenhouse';
import { appClient } from '@/api/appClient';
import { alertService } from '@/services/alertService';
import { deviceService } from '@/services/deviceService';
import { sensorService } from '@/services/sensorService';

const sensorCards = [
  { type: 'temperature', icon: Thermometer, label: SENSOR_LABELS.temperature, unit: '°C', color: 'bg-red-100 text-red-600' },
  { type: 'humidity', icon: Droplets, label: SENSOR_LABELS.humidity, unit: '%', color: 'bg-blue-100 text-blue-600' },
  { type: 'soil_moisture', icon: CloudRain, label: SENSOR_LABELS.soil_moisture, unit: '%', color: 'bg-emerald-100 text-emerald-600' },
  { type: 'light', icon: Sun, label: SENSOR_LABELS.light, unit: 'lux', color: 'bg-amber-100 text-amber-600' },
];

const miniCharts = [
  { title: SENSOR_LABELS.temperature, dataKey: 'temperature', color: '#ef4444', unit: '°C' },
  { title: 'Độ ẩm không khí', dataKey: 'humidity', color: '#3b82f6', unit: '%' },
  { title: SENSOR_LABELS.soil_moisture, dataKey: 'soil_moisture', color: '#10b981', unit: '%' },
];

export default function Dashboard() {
  const { data: latestSensorData = [] } = useQuery({
    queryKey: ['sensorData', 'latest', 1],
    queryFn: () => sensorService.listLatest(1),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const { data: sensorHistory = [] } = useQuery({
    queryKey: ['sensorData', 'history', 50],
    queryFn: () => sensorService.listLatest(50),
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', 'list'],
    queryFn: () => deviceService.list(),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', 'recent', 10],
    queryFn: () => alertService.listRecent(10),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const { data: alertThresholds = [] } = useQuery({
    queryKey: ['alertThresholds'],
    queryFn: () => appClient.entities.AlertThreshold.list(),
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['deviceCommandLogs', 'recent', 10],
    queryFn: () => deviceService.listCommandLogs(10),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const latest = latestSensorData[0] || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan nhà kính</h1>
        <p className="text-muted-foreground text-sm mt-1">Giám sát dữ liệu môi trường từ backend</p>
      </div>

      {/* Sensor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sensorCards.map((sensor) => (
          <SensorCard
            key={sensor.type}
            icon={sensor.icon}
            label={sensor.label}
            value={latest[sensor.type]}
            unit={sensor.unit}
            color={sensor.color}
            warning={getSensorWarning(sensor.type, latest[sensor.type], alertThresholds)}
          />
        ))}
      </div>

      {/* Device Status */}
      <DeviceStatusBar devices={devices} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {miniCharts.map((chart) => (
          <MiniChart
            key={chart.dataKey}
            data={sensorHistory}
            title={chart.title}
            dataKey={chart.dataKey}
            color={chart.color}
            unit={chart.unit}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RecentAlerts alerts={alerts} />
        <ActivityLog logs={activityLogs} />
      </div>
    </div>
  );
}
