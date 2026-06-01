import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Thermometer, Droplets, CloudRain, Sun } from 'lucide-react';
import SensorCard from '@/components/dashboard/SensorCard';
import DeviceStatusBar from '@/components/dashboard/DeviceStatusBar';
import RecentAlerts from '@/components/dashboard/RecentAlerts';
import MiniChart from '@/components/dashboard/MiniChart';
import CompareMiniChart from '@/components/dashboard/CompareMiniChart';
import ActivityLog from '@/components/dashboard/ActivityLog';
import NodeSelector from '@/components/dashboard/NodeSelector';
import { appClient } from '@/api/appClient';
import { alertService } from '@/services/alertService';
import { deviceService } from '@/services/deviceService';
import { getSensorWarning } from '@/services/alertRules';
import {
  DASHBOARD_VIEW_ALL,
  EXPECTED_SENSOR_NODES,
  mergeLatestByExpectedNodes,
  SENSOR_LABELS,
} from '@/config/greenhouse';
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
  const [viewMode, setViewMode] = useState(EXPECTED_SENSOR_NODES[0]);
  const isCompareView = viewMode === DASHBOARD_VIEW_ALL;

  const { data: latestByNode = [] } = useQuery({
    queryKey: ['sensorData', 'latest-by-node'],
    queryFn: () => sensorService.listLatestByNode(),
    refetchOnMount: 'always',
    refetchInterval: 3000,
  });

  const nodesById = useMemo(() => {
    const map = new Map();
    for (const row of mergeLatestByExpectedNodes(latestByNode)) {
      map.set(row.node_id ?? row.nodeId, row);
    }
    return map;
  }, [latestByNode]);

  const latest = useMemo(() => {
    if (isCompareView) return {};
    return nodesById.get(viewMode) ?? { node_id: viewMode };
  }, [isCompareView, nodesById, viewMode]);

  const { data: sensorHistory = [] } = useQuery({
    queryKey: ['sensorData', 'history', 50, viewMode],
    queryFn: () => sensorService.listHistory({ limit: 50, nodeId: viewMode }),
    enabled: !isCompareView,
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });

  const { data: historyNode1 = [] } = useQuery({
    queryKey: ['sensorData', 'history', 50, 'node-1'],
    queryFn: () => sensorService.listHistory({ limit: 50, nodeId: 'node-1' }),
    enabled: isCompareView,
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });

  const { data: historyNode2 = [] } = useQuery({
    queryKey: ['sensorData', 'history', 50, 'node-2'],
    queryFn: () => sensorService.listHistory({ limit: 50, nodeId: 'node-2' }),
    enabled: isCompareView,
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });

  const historiesByNode = useMemo(
    () => ({
      'node-1': historyNode1,
      'node-2': historyNode2,
    }),
    [historyNode1, historyNode2],
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan nhà kính</h1>
          <p className="text-muted-foreground text-sm mt-1">Giám sát dữ liệu môi trường từ backend</p>
        </div>
        <NodeSelector value={viewMode} onChange={setViewMode} />
      </div>

      {!isCompareView ? (
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
      ) : null}

      <DeviceStatusBar devices={devices} selectedNodeView={viewMode} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isCompareView
          ? miniCharts.map((chart) => (
              <CompareMiniChart
                key={chart.dataKey}
                historiesByNode={historiesByNode}
                title={chart.title}
                dataKey={chart.dataKey}
                unit={chart.unit}
              />
            ))
          : miniCharts.map((chart) => (
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
