import { pool } from "./database.js";
import { createAlert, findRecentSimilarAlert } from "./repositories/alertRepository.js";

export const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const THRESHOLD_CACHE_MS = 60 * 1000;

const SENSOR_META = {
  temperature: { label: "Nhiệt độ", unit: "°C" },
  humidity: { label: "Độ ẩm KK", unit: "%" },
  soil_moisture: { label: "Độ ẩm đất", unit: "%" },
  light: { label: "Ánh sáng", unit: "lux" },
  gas: { label: "Khí gas", unit: "ppm" },
};

const validLevels = new Set(["info", "warning", "danger"]);
const validOperators = new Set([">", "<"]);

let thresholdCache = null;
let thresholdCacheAt = 0;

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

export function invalidateThresholdCache() {
  thresholdCache = null;
  thresholdCacheAt = 0;
}

async function loadThresholds() {
  const now = Date.now();
  if (thresholdCache && now - thresholdCacheAt < THRESHOLD_CACHE_MS) {
    return thresholdCache;
  }

  const result = await pool.query(
    "SELECT id, sensor_type, operator, value, level, active FROM alert_thresholds WHERE active = true",
  );

  thresholdCache = result.rows
    .map((row) => ({
      id: row.id,
      sensor_type: row.sensor_type,
      operator: row.operator,
      value: Number(row.value),
      level: validLevels.has(String(row.level).toLowerCase())
        ? String(row.level).toLowerCase()
        : "warning",
    }))
    .filter((t) => validOperators.has(t.operator) && Number.isFinite(t.value));
  thresholdCacheAt = now;

  return thresholdCache;
}

function buildAlertMessage({ sensor_type, operator, value, threshold, level }) {
  const meta = SENSOR_META[sensor_type] || { label: sensor_type, unit: "" };
  const unit = meta.unit ? ` ${meta.unit}` : "";
  const direction = operator === ">" ? "vượt ngưỡng" : "dưới ngưỡng";
  const prefix = level === "danger" ? "Nguy hiểm! " : "";

  return `${prefix}${meta.label} ${direction}. Giá trị: ${value}${unit}, ngưỡng: ${operator} ${threshold}${unit}`;
}

function isThresholdTriggered(operator, value, threshold) {
  if (operator === ">") return value > threshold;
  if (operator === "<") return value < threshold;
  return false;
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
  const thresholds = await loadThresholds();
  const candidates = [];

  for (const threshold of thresholds) {
    const value = toNumber(sensorData[threshold.sensor_type]);
    if (value == null) continue;
    if (!isThresholdTriggered(threshold.operator, value, threshold.value)) continue;

    candidates.push({
      type: threshold.level,
      level: threshold.level,
      message: buildAlertMessage({
        sensor_type: threshold.sensor_type,
        operator: threshold.operator,
        value,
        threshold: threshold.value,
        level: threshold.level,
      }),
      sensor_type: threshold.sensor_type,
      value,
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
