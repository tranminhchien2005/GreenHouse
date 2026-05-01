import { subscribeMqtt } from "./mqtt.js";
import { upsertDeviceByName } from "./repositories/deviceRepository.js";

export const DEVICE_STATUS_TOPIC = process.env.DEVICE_STATUS_TOPIC || "greenhouse/device/status";

let unsubscribeDeviceStatus = null;

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function getDeviceName(payload = {}) {
  return String(payload.device ?? payload.device_id ?? payload.name ?? payload.id ?? "").trim();
}

function getLastSeenAt(payload = {}, now = new Date().toISOString()) {
  if (hasOwn(payload, "last_seen_at")) return payload.last_seen_at;
  if (hasOwn(payload, "lastSeenAt")) return payload.lastSeenAt;
  if (hasOwn(payload, "last_seen")) return payload.last_seen;
  return now;
}

function mapStatusPayloadToDevice(payload = {}, now = new Date().toISOString()) {
  const name = getDeviceName(payload);

  if (!name) {
    return null;
  }

  const device = {
    name,
    type: payload.type || name,
    last_seen_at: getLastSeenAt(payload, now),
  };

  if (hasOwn(payload, "is_on")) device.is_on = payload.is_on;
  if (hasOwn(payload, "isOn")) device.is_on = payload.isOn;
  if (hasOwn(payload, "mode")) device.mode = payload.mode;
  if (hasOwn(payload, "online")) device.online = payload.online;

  return device;
}

function toLoggableDevice(device) {
  return {
    ...device,
    device_id: device.name,
  };
}

export async function updateDeviceStateFromStatus(payload) {
  const device = mapStatusPayloadToDevice(payload);

  if (!device) {
    console.warn("[DeviceStatus] Ignored status payload without device name/id:", payload);
    return null;
  }

  const savedDevice = await upsertDeviceByName(device);
  return toLoggableDevice(savedDevice);
}

export function startDeviceStatusMqttListener() {
  if (unsubscribeDeviceStatus) return unsubscribeDeviceStatus;

  unsubscribeDeviceStatus = subscribeMqtt(DEVICE_STATUS_TOPIC, async (message) => {
    let payload;
    try {
      payload = JSON.parse(message);
    } catch {
      console.error(`[DeviceStatus] Invalid JSON on ${DEVICE_STATUS_TOPIC}: ${message}`);
      return;
    }

    try {
      const device = await updateDeviceStateFromStatus(payload);
      if (!device) return;

      console.log(
        `[DeviceStatus] Updated ${device.device_id}: is_on=${device.is_on}, mode=${device.mode}, online=${device.online}`,
      );
    } catch (error) {
      console.error("[DeviceStatus] Failed to update device status:", error.message);
    }
  });

  return unsubscribeDeviceStatus;
}
