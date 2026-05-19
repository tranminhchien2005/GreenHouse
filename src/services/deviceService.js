import { appClient } from '@/api/appClient';

export const deviceService = {
  list() {
    return appClient.entities.DeviceState.list();
  },
  update(id, patch) {
    return appClient.entities.DeviceState.update(id, patch);
  },
  command(deviceId, data) {
    return appClient.devices.command(deviceId, data);
  },
  listCommandLogs(limit = 10) {
    return appClient.entities.DeviceCommandLog.list('-created_date', limit);
  },
};
