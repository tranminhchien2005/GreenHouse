import { requireUser } from "./auth.js";
import { pool } from "./database.js";
import { readBody, sendJson } from "./httpUtils.js";
import { publishSim800lSmsRequest } from "./sim800l.js";
import { createAlertsForSensorData, invalidateThresholdCache, toLegacyAlert } from "./alerts.js";
import { publishAutomationCommand, runAutomationRulesForSensorData } from "./automation.js";
import {
  createAlert,
  deleteAlert,
  getAlertById,
  listAlerts,
  updateAlert,
} from "./repositories/alertRepository.js";
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationRuleById,
  listAutomationRules,
  updateAutomationRule,
} from "./repositories/automationRepository.js";
import {
  deleteDevice,
  getDeviceByName,
  listDevices,
  updateDevice,
  updateDeviceByName,
  upsertDeviceByName,
} from "./repositories/deviceRepository.js";
import {
  createSensorReading,
  deleteSensorReading,
  getSensorReadingById,
  listSensorReadings,
} from "./repositories/sensorRepository.js";

const allowedEntities = new Set(["SensorData", "DeviceState", "AutomationRule", "Alert", "AlertThreshold"]);

function sortItems(items, sortBy) {
  if (!sortBy) return items;

  const isDesc = sortBy.startsWith("-");
  const key = isDesc ? sortBy.slice(1) : sortBy;

  return [...items].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av > bv) return isDesc ? -1 : 1;
    if (av < bv) return isDesc ? 1 : -1;
    return 0;
  });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function toLegacyDeviceState(device) {
  if (!device) return null;

  return {
    id: device.name,
    postgres_id: device.id,
    device_id: device.name,
    device_name: device.name,
    name: device.name,
    type: device.type,
    is_on: device.is_on,
    mode: device.mode,
    online: device.online,
    last_seen: device.last_seen_at,
    last_seen_at: device.last_seen_at,
    created_date: device.created_at,
    updated_date: device.updated_at,
    created_at: device.created_at,
    updated_at: device.updated_at,
  };
}

function toDeviceRepositoryData(data = {}) {
  const mapped = {
    ...data,
    name: data.name ?? data.device_id ?? data.id,
    type: data.type,
    is_on: data.is_on ?? data.isOn,
    mode: data.mode,
    online: data.online,
    last_seen_at: data.last_seen_at ?? data.lastSeenAt ?? data.last_seen,
  };

  for (const key of Object.keys(mapped)) {
    if (mapped[key] === undefined) delete mapped[key];
  }

  return mapped;
}

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toSensorRepositoryData(data = {}) {
  const mapped = {
    temperature: data.temperature ?? data.temp,
    humidity: data.humidity,
    soil_moisture: data.soil_moisture ?? data.soilMoisture ?? data.soil,
    light: data.light ?? data.lux,
    gas: data.gas ?? data.gasValue,
    created_at: data.created_at ?? data.createdAt ?? data.timestamp ?? data.created_date,
  };

  for (const key of Object.keys(mapped)) {
    if (mapped[key] === undefined) delete mapped[key];
  }

  return mapped;
}

function hasAnyValidSensorValue(data = {}) {
  return [
    data.temperature ?? data.temp,
    data.humidity,
    data.soil_moisture ?? data.soilMoisture ?? data.soil,
    data.light ?? data.lux,
    data.gas ?? data.gasValue,
  ].some((value) => toNumberOrNull(value) != null);
}

function toLegacySensorData(reading) {
  if (!reading) return null;

  return {
    id: reading.id,
    temperature: reading.temperature,
    humidity: reading.humidity,
    soil_moisture: reading.soil_moisture,
    soilMoisture: reading.soil_moisture,
    light: reading.light,
    gas: reading.gas,
    created_at: reading.created_at,
    created_date: reading.created_at,
  };
}

function getSensorSortOptions(url) {
  const rawSortBy = url.searchParams.get("sortBy");
  const sortOrderParam = url.searchParams.get("sortOrder");
  const isDesc = rawSortBy?.startsWith("-");
  const sortByValue = isDesc ? rawSortBy.slice(1) : rawSortBy;
  const sortFieldAliases = {
    created_date: "created_at",
    soilMoisture: "soil_moisture",
  };

  return {
    limit: url.searchParams.get("limit"),
    page: url.searchParams.get("page"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    sortBy: sortFieldAliases[sortByValue] || sortByValue || "created_at",
    sortOrder: isDesc ? "desc" : sortOrderParam,
  };
}

function toAlertRepositoryData(data = {}) {
  const mapped = {
    sensor_type: data.sensor_type ?? data.sensorType ?? data.type,
    level: data.level ?? data.severity,
    message: data.message ?? data.title ?? data.content,
    value: data.value ?? data.sensor_value ?? data.sensorValue,
    is_read: data.is_read ?? data.isRead,
    created_at: data.created_at ?? data.createdAt ?? data.created_date ?? data.timestamp ?? data.time ?? data.date,
  };

  for (const key of Object.keys(mapped)) {
    if (mapped[key] === undefined) delete mapped[key];
  }

  return mapped;
}

function hasValidAlertData(data = {}) {
  return Boolean(data.sensor_type ?? data.sensorType ?? data.type ?? data.message ?? data.title ?? data.content);
}

function getAlertSortOptions(url) {
  const rawSortBy = url.searchParams.get("sortBy");
  const sortOrderParam = url.searchParams.get("sortOrder");
  const isDesc = rawSortBy?.startsWith("-");
  const sortByValue = isDesc ? rawSortBy.slice(1) : rawSortBy;
  const sortFieldAliases = {
    created_date: "created_at",
    sensorType: "sensor_type",
    isRead: "is_read",
  };

  return {
    limit: url.searchParams.get("limit"),
    page: url.searchParams.get("page"),
    level: url.searchParams.get("level"),
    sensor_type: url.searchParams.get("sensor_type") ?? url.searchParams.get("sensorType"),
    is_read: url.searchParams.get("is_read") ?? url.searchParams.get("isRead"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    sortBy: sortFieldAliases[sortByValue] || sortByValue || "created_at",
    sortOrder: isDesc ? "desc" : sortOrderParam,
  };
}

function getConditionFromOperator(operator) {
  if (operator === ">") return "above";
  if (operator === "<") return "below";
  if (operator === "==") return "equals";
  if (operator === ">=") return "greater_than_or_equal";
  if (operator === "<=") return "less_than_or_equal";
  return operator || null;
}

function toLegacyAutomationRule(rule) {
  if (!rule) return null;

  return {
    id: rule.id,
    name: rule.name,
    sensor_type: rule.sensor_type,
    sensorType: rule.sensor_type,
    operator: rule.operator,
    condition: getConditionFromOperator(rule.operator),
    threshold: rule.threshold,
    device_id: rule.device_id,
    deviceId: rule.device_id,
    device_name: rule.device_name,
    deviceName: rule.device_name,
    target_device: rule.device_name,
    targetDevice: rule.device_name,
    action: rule.action,
    active: rule.active,
    is_active: rule.active,
    isActive: rule.active,
    last_triggered_at: rule.last_triggered_at,
    lastTriggeredAt: rule.last_triggered_at,
    last_triggered_date: rule.last_triggered_at,
    created_at: rule.created_at,
    created_date: rule.created_at,
    updated_at: rule.updated_at,
    updated_date: rule.updated_at,
  };
}

function toAutomationRepositoryData(data = {}) {
  const mapped = {
    name: data.name,
    sensor_type: data.sensor_type ?? data.sensorType ?? data.sensor,
    operator: data.operator,
    condition: data.condition,
    threshold: data.threshold,
    device_id: data.device_id ?? data.deviceId,
    device_name: data.device_name ?? data.deviceName ?? data.target_device ?? data.targetDevice ?? data.device,
    action: data.action,
    active: data.active ?? data.is_active ?? data.isActive,
    last_triggered_at: data.last_triggered_at ?? data.lastTriggeredAt ?? data.last_triggered_date,
    created_at: data.created_at ?? data.createdAt ?? data.created_date,
    updated_at: data.updated_at ?? data.updatedAt ?? data.updated_date,
  };

  for (const key of Object.keys(mapped)) {
    if (mapped[key] === undefined) delete mapped[key];
  }

  return mapped;
}

function getAutomationSortOptions(url) {
  const rawSortBy = url.searchParams.get("sortBy");
  const sortOrderParam = url.searchParams.get("sortOrder");
  const isDesc = rawSortBy?.startsWith("-");
  const sortByValue = isDesc ? rawSortBy.slice(1) : rawSortBy;
  const sortFieldAliases = {
    created_date: "created_at",
    updated_date: "updated_at",
    sensorType: "sensor_type",
    deviceName: "device_name",
    target_device: "device_name",
    targetDevice: "device_name",
    is_active: "active",
    isActive: "active",
    lastTriggeredAt: "last_triggered_at",
    last_triggered_date: "last_triggered_at",
  };

  return {
    limit: url.searchParams.get("limit"),
    page: url.searchParams.get("page"),
    active: url.searchParams.get("active") ?? url.searchParams.get("is_active") ?? url.searchParams.get("isActive"),
    sensor_type: url.searchParams.get("sensor_type") ?? url.searchParams.get("sensorType") ?? url.searchParams.get("sensor"),
    device_name: url.searchParams.get("device_name") ?? url.searchParams.get("deviceName") ??
      url.searchParams.get("target_device") ?? url.searchParams.get("targetDevice"),
    sortBy: sortFieldAliases[sortByValue] || sortByValue || "created_at",
    sortOrder: isDesc ? "desc" : sortOrderParam,
  };
}

async function runSensorSideEffects(sensorData) {
  const now = sensorData.created_date || new Date().toISOString();
  const createdAlerts = await createAlertsForSensorData(sensorData, now);
  const automationCommands = await runAutomationRulesForSensorData(sensorData, now);

  return { createdAlerts, automationCommands };
}

async function handleSensorData(req, res, url, id) {
  if (req.method === "GET" && !id) {
    const readings = await listSensorReadings(getSensorSortOptions(url));
    sendJson(res, 200, readings.map(toLegacySensorData));
    return true;
  }

  if (req.method === "GET" && id) {
    const reading = await getSensorReadingById(id);
    if (!reading) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, toLegacySensorData(reading));
    return true;
  }

  if (req.method === "POST" && !id) {
    const data = await readBody(req);

    if (!hasAnyValidSensorValue(data)) {
      sendJson(res, 400, { message: "SensorData must include at least one valid sensor value" });
      return true;
    }

    const reading = await createSensorReading(toSensorRepositoryData(data));
    const nextItem = toLegacySensorData(reading);
    const mutation = await runSensorSideEffects(nextItem);

    for (const alert of mutation.createdAlerts) {
      publishSim800lSmsRequest(alert).catch((error) => {
        console.error("[SIM800L SMS] Failed to publish alert:", error.message);
      });
    }

    for (const command of mutation.automationCommands) {
      publishAutomationCommand(command).catch((error) => {
        console.error("[Automation] Failed to publish command:", error.message);
      });
    }

    sendJson(res, 201, nextItem);
    return true;
  }

  if (req.method === "DELETE" && id) {
    const deleted = await deleteSensorReading(id);
    if (!deleted) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, { success: true, item: toLegacySensorData(deleted) });
    return true;
  }

  if (req.method === "DELETE" && !id) {
    sendJson(res, 400, { message: "SensorData id is required" });
    return true;
  }

  if (req.method === "PATCH" && id) {
    sendJson(res, 405, { message: "PATCH is not supported for SensorData" });
    return true;
  }

  return false;
}

async function handleAlert(req, res, url, id, action) {
  if (id && action === "read" && ["POST", "PATCH"].includes(req.method)) {
    const updatedAlert = await updateAlert(id, { is_read: true });
    if (!updatedAlert) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, toLegacyAlert(updatedAlert));
    return true;
  }

  if (req.method === "GET" && !id) {
    const alerts = await listAlerts(getAlertSortOptions(url));
    sendJson(res, 200, alerts.map(toLegacyAlert));
    return true;
  }

  if (req.method === "GET" && id) {
    const alert = await getAlertById(id);
    if (!alert) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, toLegacyAlert(alert));
    return true;
  }

  if (req.method === "POST" && !id) {
    const data = await readBody(req);

    if (!hasValidAlertData(data)) {
      sendJson(res, 400, { message: "Alert must include sensor_type or message" });
      return true;
    }

    const alert = toLegacyAlert(await createAlert(toAlertRepositoryData(data)));
    publishSim800lSmsRequest(alert).catch((error) => {
      console.error("[SIM800L SMS] Failed to publish alert:", error.message);
    });

    sendJson(res, 201, alert);
    return true;
  }

  if (req.method === "PATCH" && id) {
    const patch = await readBody(req);
    const alert = await updateAlert(id, toAlertRepositoryData(patch));
    if (!alert) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, toLegacyAlert(alert));
    return true;
  }

  if (req.method === "DELETE" && id) {
    const deleted = await deleteAlert(id);
    if (!deleted) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, { success: true, item: toLegacyAlert(deleted) });
    return true;
  }

  if (req.method === "DELETE" && !id) {
    sendJson(res, 400, { message: "Alert id is required" });
    return true;
  }

  return false;
}

async function handleAutomationRule(req, res, url, id) {
  if (req.method === "GET" && !id) {
    const rules = await listAutomationRules(getAutomationSortOptions(url));
    sendJson(res, 200, rules.map(toLegacyAutomationRule));
    return true;
  }

  if (req.method === "GET" && id) {
    const rule = await getAutomationRuleById(id);
    if (!rule) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, toLegacyAutomationRule(rule));
    return true;
  }

  if (req.method === "POST" && !id) {
    const data = await readBody(req);

    try {
      const rule = await createAutomationRule(toAutomationRepositoryData(data));
      sendJson(res, 201, toLegacyAutomationRule(rule));
    } catch (error) {
      sendJson(res, 400, { message: error.message || "Invalid automation rule" });
    }

    return true;
  }

  if (req.method === "PATCH" && id) {
    const patch = await readBody(req);

    try {
      const rule = await updateAutomationRule(id, toAutomationRepositoryData(patch));
      if (!rule) {
        sendJson(res, 404, { message: "Item not found" });
        return true;
      }

      sendJson(res, 200, toLegacyAutomationRule(rule));
    } catch (error) {
      sendJson(res, 400, { message: error.message || "Invalid automation rule" });
    }

    return true;
  }

  if (req.method === "DELETE" && id) {
    const deleted = await deleteAutomationRule(id);
    if (!deleted) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, { success: true, item: toLegacyAutomationRule(deleted) });
    return true;
  }

  if (req.method === "DELETE" && !id) {
    sendJson(res, 400, { message: "AutomationRule id is required" });
    return true;
  }

  return false;
}

async function handleDeviceState(req, res, url, id) {
  if (req.method === "GET" && !id) {
    const sortBy = url.searchParams.get("sortBy");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam == null ? null : Number(limitParam);
    const devices = (await listDevices()).map(toLegacyDeviceState);
    const sorted = sortItems(devices, sortBy);
    sendJson(res, 200, Number.isFinite(limit) ? sorted.slice(0, limit) : sorted);
    return true;
  }

  if (req.method === "POST" && !id) {
    const data = await readBody(req);
    const device = await upsertDeviceByName(toDeviceRepositoryData(data));
    sendJson(res, 201, toLegacyDeviceState(device));
    return true;
  }

  if (req.method === "PATCH" && id) {
    const patch = await readBody(req);
    const device = isUuid(id)
      ? await updateDevice(id, toDeviceRepositoryData(patch))
      : await updateDeviceByName(id, toDeviceRepositoryData(patch));

    if (!device) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    sendJson(res, 200, toLegacyDeviceState(device));
    return true;
  }

  if (req.method === "DELETE" && id) {
    const device = isUuid(id) ? await deleteDevice(id) : await getDeviceByName(id).then((item) => (
      item ? deleteDevice(item.id) : null
    ));

    sendJson(res, 200, { success: true, item: toLegacyDeviceState(device) });
    return true;
  }

  return false;
}

function toLegacyThreshold(row) {
  if (!row) return null;

  return {
    id: row.id,
    sensor_type: row.sensor_type,
    operator: row.operator,
    value: row.value == null ? null : Number(row.value),
    level: row.level,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function handleAlertThreshold(req, res, id) {
  if (req.method === "GET" && !id) {
    const result = await pool.query(
      "SELECT * FROM alert_thresholds ORDER BY sensor_type, level",
    );
    sendJson(res, 200, result.rows.map(toLegacyThreshold));
    return true;
  }

  if (req.method === "PATCH" && id) {
    const user = await requireUser(req, res);
    if (!user) return true;

    if (user.role !== "admin") {
      sendJson(res, 403, { message: "Không có quyền" });
      return true;
    }

    const body = await readBody(req);
    const fields = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(body, "value")) {
      const number = Number(body.value);
      if (!Number.isFinite(number)) {
        sendJson(res, 400, { message: "value phải là số" });
        return true;
      }
      values.push(number);
      fields.push(`value = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "active")) {
      if (typeof body.active !== "boolean") {
        sendJson(res, 400, { message: "active phải là boolean" });
        return true;
      }
      values.push(body.active);
      fields.push(`active = $${values.length}`);
    }

    if (fields.length === 0) {
      sendJson(res, 400, { message: "Không có field hợp lệ để cập nhật" });
      return true;
    }

    fields.push("updated_at = NOW()");
    values.push(id);

    const result = await pool.query(
      `UPDATE alert_thresholds SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      sendJson(res, 404, { message: "Item not found" });
      return true;
    }

    invalidateThresholdCache();
    sendJson(res, 200, toLegacyThreshold(result.rows[0]));
    return true;
  }

  sendJson(res, 405, { message: "Method not allowed" });
  return true;
}

export async function handleEntity(req, res, url, parts) {
  const entityName = parts[1];
  const id = parts[2];
  const action = parts[3];

  if (!allowedEntities.has(entityName)) {
    sendJson(res, 404, { message: "Entity not found" });
    return true;
  }

  if (entityName === "AlertThreshold") {
    return handleAlertThreshold(req, res, id);
  }

  const user = await requireUser(req, res);
  if (!user) return true;

  if (entityName === "DeviceState") {
    return handleDeviceState(req, res, url, id);
  }

  if (entityName === "SensorData") {
    return handleSensorData(req, res, url, id);
  }

  if (entityName === "Alert") {
    return handleAlert(req, res, url, id, action);
  }

  if (entityName === "AutomationRule") {
    return handleAutomationRule(req, res, url, id);
  }

  sendJson(res, 404, { message: "Entity not found" });
  return true;
}
