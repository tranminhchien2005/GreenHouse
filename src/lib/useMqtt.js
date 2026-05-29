import { useEffect, useState } from 'react';
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

        const nowRow = {
          id: `mqtt_${Date.now()}`,
          created_date: new Date().toISOString(),
          temperature: data.temperature,
          humidity: data.humidity,
          soil_moisture: data.soil_moisture,
          light: data.light,
        };

        queryClient.setQueriesData({ queryKey: ['sensorData', 'history'] }, (old) => {
          const arr = Array.isArray(old) ? old : [];
          return [nowRow, ...arr].slice(0, 50);
        });
        queryClient.setQueriesData({ queryKey: ['sensorData', 'history', 50] }, (old) => {
          const arr = Array.isArray(old) ? old : [];
          return [nowRow, ...arr].slice(0, 50);
        });
        queryClient.setQueriesData({ queryKey: ['sensorData', 'latest', 1] }, (old) => {
          const arr = Array.isArray(old) ? old : [];
          return [nowRow, ...arr].slice(0, 1);
        });

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
