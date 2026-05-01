import { appClient } from '@/api/appClient';

export const deviceService = {
  list() {
    return appClient.entities.DeviceState.list();
  },
  update(id, patch) {
    return appClient.entities.DeviceState.update(id, patch);
  },
};
