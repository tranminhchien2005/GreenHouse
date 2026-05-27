import { DEVICE_CONTROL_TOPICS } from "./mqttTopics.js";
import { publishMqtt } from "./mqtt.js";
import { broadcastRealtime } from "./realtime.js";
import { createDeviceCommandLog } from "./repositories/deviceCommandLogRepository.js";
import { upsertDeviceByName } from "./repositories/deviceRepository.js";

export const DEVICE_LABELS = {
  pump: "Máy bơm",
  fan: "Quạt",
  mist: "Phun sương",
  light: "Đèn",
};

export const DEVICE_ALIASES = {
  pump: ["pump", "bơm", "bom", "máy bơm", "may bom", "tưới", "tuoi"],
  fan: ["fan", "quạt", "quat", "thông gió", "thong gio"],
  mist: ["mist", "phun sương", "phun suong", "sương", "suong"],
  light: ["light", "đèn", "den", "ánh sáng", "anh sang"],
};

export function isValidDeviceId(deviceId) {
  return Boolean(DEVICE_CONTROL_TOPICS[deviceId]);
}

export function getDeviceLabel(deviceId) {
  return DEVICE_LABELS[deviceId] || deviceId;
}

export function getActionLabel(isOn) {
  return isOn ? "Bật" : "Tắt";
}

export function toDeviceAction(isOn) {
  return isOn ? "turn_on" : "turn_off";
}

export function toDevicePayload({ deviceId, isOn, source = "manual" }) {
  return {
    device: deviceId,
    is_on: isOn,
    action: toDeviceAction(isOn),
    source,
  };
}

export function normalizeDeviceCommand({ deviceId, action, isOn }) {
  const normalizedDeviceId = String(deviceId || "").trim();
  const normalizedAction = String(action || "").trim();
  let nextIsOn = typeof isOn === "boolean" ? isOn : null;

  if (nextIsOn == null) {
    if (normalizedAction === "turn_on" || normalizedAction === "on") nextIsOn = true;
    if (normalizedAction === "turn_off" || normalizedAction === "off") nextIsOn = false;
  }

  if (!isValidDeviceId(normalizedDeviceId) || nextIsOn == null) {
    return null;
  }

  return {
    deviceId: normalizedDeviceId,
    isOn: nextIsOn,
    action: toDeviceAction(nextIsOn),
  };
}

export async function executeDeviceCommand({ deviceId, isOn, requestedBy = null, source = "manual" }) {
  const command = normalizeDeviceCommand({ deviceId, isOn });
  if (!command) {
    const error = new Error("Lệnh thiết bị không hợp lệ");
    error.status = 400;
    throw error;
  }

  const topic = DEVICE_CONTROL_TOPICS[command.deviceId];
  const device = await upsertDeviceByName({
    name: command.deviceId,
    type: command.deviceId,
    ...(source === "manual" ? { mode: "manual" } : {}),
  });
  let commandLog = null;
  const payload = toDevicePayload({
    deviceId: command.deviceId,
    isOn: command.isOn,
    source,
  });

  try {
    await publishMqtt(topic, payload, { qos: 1 });
    commandLog = await createDeviceCommandLog({
      device_id: device.id,
      device_name: device.name,
      command: command.action,
      source,
      requested_by: requestedBy,
      mqtt_published: true,
      device_confirmed: false,
    });
    broadcastRealtime("device_command:new", commandLog);
  } catch (error) {
    const failedCommandLog = await createDeviceCommandLog({
      device_id: device.id,
      device_name: device.name,
      command: command.action,
      source,
      requested_by: requestedBy,
      mqtt_published: false,
      device_confirmed: false,
    }).catch((logError) => {
      console.error("[DeviceControl] Failed to record MQTT publish failure:", logError.message);
      return null;
    });
    if (failedCommandLog) broadcastRealtime("device_command:new", failedCommandLog);
    throw error;
  }

  return {
    device,
    commandLog,
    topic,
    payload,
    action: command.action,
    message: `Đã gửi lệnh ${getActionLabel(command.isOn).toLowerCase()} ${getDeviceLabel(command.deviceId)}, đang chờ thiết bị phản hồi.`,
  };
}
