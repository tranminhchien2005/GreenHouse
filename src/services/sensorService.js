import { appClient } from '@/api/appClient';

export const sensorService = {
  listLatest(limit) {
    return appClient.entities.SensorData.list(null, limit);
  },
  listRecent(limit) {
    return appClient.entities.SensorData.list('-created_date', limit);
  },
  create(data) {
    return appClient.entities.SensorData.create(data);
  },
};
