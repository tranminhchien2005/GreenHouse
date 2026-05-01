import { useEffect, useState } from 'react';
import { getMqttClient, getMqttStatus, TOPICS } from './mqttClient';
import { useQueryClient } from '@tanstack/react-query';
import { sensorService } from '@/services/sensorService';

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

// Hook to receive sensor data in real-time and persist to DB
export function useSensorData() {
  const queryClient = useQueryClient();
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    const client = getMqttClient();

    const handleMessage = async (topic, payload) => {
      if (topic !== TOPICS.SENSORS) return;
      try {
        const data = JSON.parse(payload);
        setLatest(data);
        // Save to database
        await sensorService.create({
          temperature: data.temperature,
          humidity: data.humidity,
          soil_moisture: data.soil_moisture,
          light: data.light,
          gas: data.gas,
        });
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

    if (!client._listeners_registered) {
      client._listeners_registered = true;
    }

    client.on('message', handleMessage);
    return () => client.off('message', handleMessage);
  }, [queryClient]);

  return latest;
}
