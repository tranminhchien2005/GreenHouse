import { appClient } from '@/api/appClient';

export const sensorService = {
  listLatest(limit) {
    return appClient.entities.SensorData.list(null, limit);
  },
  listHistory({ limit, from, to } = {}) {
    return appClient.entities.SensorData.list('-created_date', limit, { from, to });
  },
  listRecent(limit) {
    return appClient.entities.SensorData.list('-created_date', limit);
  },
  dailyStats({ from, to } = {}) {
    return appClient.sensors.dailyStats({ from, to });
  },
  create(data) {
    return appClient.entities.SensorData.create(data);
  },
};
