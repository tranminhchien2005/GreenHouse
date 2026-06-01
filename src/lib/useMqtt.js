import { useEffect, useState } from 'react';
import { isDashboardSensorNode } from '@/config/greenhouse';
import { getMqttClient, getMqttStatus, subscribeTopic, TOPICS } from './mqttClient';
import { useQueryClient } from '@tanstack/react-query';

export function useMqttStatus() {
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    const client = getMqttClient();

    const onConnect = () => setStatus('connected');
    const onReconnect = () => setStatus('reconnecting');
    const onDisconnect = () => setStatus('disconnected');
    const onError = () => setStatus('disconnected');

    client.on('connect', onConnect);
    client.on('reconnect', onReconnect);
    client.on('disconnect', onDisconnect);
    client.on('error', onError);

    setStatus(getMqttStatus());

    return () => {
      client.off('connect', onConnect);
      client.off('reconnect', onReconnect);
      client.off('disconnect', onDisconnect);
      client.off('error', onError);
    };
  }, []);

  return status;
}

// Optional browser-side MQTT observer. Backend is responsible for persisting sensor data.
export function useSensorData() {
  const queryClient = useQueryClient();
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    getMqttClient(); // ensure connection exists

    const handleMessage = async (payload) => {
      try {
        const data = JSON.parse(typeof payload === 'string' ? payload : payload?.toString?.() || '');
        setLatest(data);

        const nodeId = data.node_id ?? data.nodeId;

        if (isDashboardSensorNode(nodeId)) {
          const nowRow = {
            id: `mqtt_${Date.now()}`,
            node_id: nodeId,
            nodeId,
            created_date: new Date().toISOString(),
            temperature: data.temperature,
            humidity: data.humidity,
            soil_moisture: data.soil_moisture,
            light: data.light,
          };

          queryClient.setQueryData(['sensorData', 'latest-by-node'], (old) => {
            const arr = Array.isArray(old) ? old : [];
            const others = arr.filter(
              (row) => isDashboardSensorNode(row?.node_id ?? row?.nodeId)
                && (row?.node_id ?? row?.nodeId) !== nodeId,
            );
            return [...others, nowRow];
          });
        }

        // Also refetch server-backed views when convenient
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['sensorData'] }),
          queryClient.invalidateQueries({ queryKey: ['alerts'] }),
          queryClient.invalidateQueries({ queryKey: ['devices'] }),
          queryClient.invalidateQueries({ queryKey: ['automationRules'] }),
        ]);
      } catch (e) {
        console.error('[MQTT] Failed to parse sensor data:', e);
      }
    };

    const unsubscribe = subscribeTopic(TOPICS.SENSORS, handleMessage);
    return () => unsubscribe?.();
  }, [queryClient]);

  return latest;
}
