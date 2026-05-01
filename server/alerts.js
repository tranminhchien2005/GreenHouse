import { createAlert, findRecentSimilarAlert } from "./repositories/alertRepository.js";

export const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export const ALERT_THRESHOLDS = {
  temperature_high: 40,
  soil_moisture_low: 30,
  gas_high: 300,
};

const validLevels = new Set(["info", "warning", "danger"]);

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAlertLevel(alert) {
  const level = String(alert?.level ?? alert?.severity ?? alert?.type ?? "").toLowerCase();
  return validLevels.has(level) ? level : "warning";
}

function getCooldownSince(now) {
  const nowTime = new Date(now).getTime();
  const safeNow = Number.isFinite(nowTime) ? nowTime : Date.now();
  return new Date(safeNow - ALERT_COOLDOWN_MS).toISOString();
}

export function toLegacyAlert(alert) {
  if (!alert) return null;

  const level = getAlertLevel(alert);
  const createdAt = alert.created_at ?? alert.created_date;

  return {
    id: alert.id,
    type: alert.type ?? level,
    level,
    message: alert.message || "",
    sensor_type: alert.sensor_type ?? alert.sensorType ?? null,
    sensorType: alert.sensor_type ?? alert.sensorType ?? null,
    value: alert.value ?? null,
    is_read: alert.is_read === true,
    isRead: alert.is_read === true,
    created_at: createdAt,
    created_date: createdAt,
  };
}

export function normalizeAlert(alert, now = new Date().toISOString()) {
  const level = getAlertLevel(alert);

  return {
    type: alert.type || level,
    level,
    message: alert.message || "",
    sensor_type: alert.sensor_type ?? alert.sensorType ?? null,
    value: alert.value ?? null,
    is_read: alert.is_read === true || alert.isRead === true,
    created_at: alert.created_at ?? alert.createdAt ?? alert.created_date ?? now,
    created_date: alert.created_date ?? alert.created_at ?? alert.createdAt ?? now,
  };
}

async function createAlertIfAllowed(alertData, now) {
  const candidate = normalizeAlert(alertData, now);
  const recentAlert = await findRecentSimilarAlert({
    sensor_type: candidate.sensor_type,
    level: candidate.level,
    since: getCooldownSince(now),
  });

  if (recentAlert) {
    return { alert: toLegacyAlert(recentAlert), created: false };
  }

  const alert = await createAlert(candidate);
  return { alert: toLegacyAlert(alert), created: true };
}

export async function createAlertsForSensorData(sensorData, now = new Date().toISOString()) {
  const candidates = [];
  const temperature = toNumber(sensorData.temperature);
  const soilMoisture = toNumber(sensorData.soil_moisture);
  const gas = toNumber(sensorData.gas);

  if (gas != null && gas > ALERT_THRESHOLDS.gas_high) {
    candidates.push({
      type: "danger",
      level: "danger",
      message: `Nguy hiểm! Phát hiện khí gas hoặc cháy. Giá trị: ${gas} ppm, ngưỡng: ${ALERT_THRESHOLDS.gas_high} ppm`,
      sensor_type: "gas",
      value: gas,
      is_read: false,
      created_at: now,
    });
  }

  if (temperature != null && temperature > ALERT_THRESHOLDS.temperature_high) {
    candidates.push({
      type: "warning",
      level: "warning",
      message: `Nhiệt độ vượt ngưỡng cho phép. Giá trị: ${temperature} °C, ngưỡng: ${ALERT_THRESHOLDS.temperature_high} °C`,
      sensor_type: "temperature",
      value: temperature,
      is_read: false,
      created_at: now,
    });
  }

  if (soilMoisture != null && soilMoisture < ALERT_THRESHOLDS.soil_moisture_low) {
    candidates.push({
      type: "warning",
      level: "warning",
      message: `Độ ẩm đất thấp, cần tưới nước. Giá trị: ${soilMoisture} %, ngưỡng: ${ALERT_THRESHOLDS.soil_moisture_low} %`,
      sensor_type: "soil_moisture",
      value: soilMoisture,
      is_read: false,
      created_at: now,
    });
  }

  const createdAlerts = [];
  for (const candidate of candidates) {
    const result = await createAlertIfAllowed(candidate, now);
    if (result.created) createdAlerts.push(result.alert);
  }

  return createdAlerts;
}
