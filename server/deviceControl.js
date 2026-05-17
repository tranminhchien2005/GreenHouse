import { DEVICE_CONTROL_TOPICS } from "./automation.js";
import { publishMqtt } from "./mqtt.js";
import { query } from "./database.js";
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

export function toDevicePayload(isOn) {
  return isOn ? "1" : "0";
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
  await publishMqtt(topic, toDevicePayload(command.isOn), { qos: 1 });

  const device = await upsertDeviceByName({
    name: command.deviceId,
    type: command.deviceId,
    is_on: command.isOn,
    mode: "manual",
  });

  await query(
    `
      INSERT INTO device_command_logs (device_id, device_name, command, source, requested_by, mqtt_published)
      VALUES ($1, $2, $3, $4, $5, true)
    `,
    [device.id, device.name, command.action, source, requestedBy],
  );

  return {
    device,
    topic,
    payload: toDevicePayload(command.isOn),
    action: command.action,
    message: `Đã gửi lệnh ${getActionLabel(command.isOn).toLowerCase()} ${getDeviceLabel(command.deviceId)}.`,
  };
}
