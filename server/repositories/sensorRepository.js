import { query } from "../database.js";

const sensorColumns = "id, temperature, humidity, soil_moisture, light, gas, created_at";
const sortableFields = new Set(["created_at", "temperature", "humidity", "soil_moisture", "light", "gas"]);

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLimit(value) {
  const limit = Number(value ?? 50);
  if (!Number.isFinite(limit) || limit <= 0) return 50;
  return Math.min(Math.trunc(limit), 500);
}

function normalizePage(value) {
  const page = Number(value ?? 1);
  if (!Number.isFinite(page) || page <= 0) return 1;
  return Math.trunc(page);
}

function normalizeSortBy(value) {
  return sortableFields.has(value) ? value : "created_at";
}

function normalizeSortOrder(value) {
  return String(value || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
}

function addDateFilters(where, values, options = {}) {
  if (options.from) {
    values.push(options.from);
    where.push(`created_at >= $${values.length}`);
  }

  if (options.to) {
    values.push(options.to);
    where.push(`created_at <= $${values.length}`);
  }
}

function normalizeSensorReading(data = {}) {
  return {
    temperature: toNumberOrNull(data.temperature ?? data.temp),
    humidity: toNumberOrNull(data.humidity),
    soil_moisture: toNumberOrNull(data.soil_moisture ?? data.soilMoisture ?? data.soil),
    light: toNumberOrNull(data.light ?? data.lux),
    gas: toNumberOrNull(data.gas ?? data.gasValue),
    created_at: data.created_at ?? data.createdAt ?? data.timestamp ?? data.created_date ?? null,
  };
}

export async function listSensorReadings(options = {}) {
  const limit = normalizeLimit(options.limit);
  const page = normalizePage(options.page);
  const offset = (page - 1) * limit;
  const sortBy = normalizeSortBy(options.sortBy);
  const sortOrder = normalizeSortOrder(options.sortOrder);
  const where = [];
  const values = [];

  addDateFilters(where, values, options);

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await query(
    `
      SELECT ${sensorColumns}
      FROM sensor_readings
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    values,
  );

  return result.rows;
}

export async function getSensorReadingById(id) {
  const result = await query(
    `SELECT ${sensorColumns} FROM sensor_readings WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function getLatestSensorReading() {
  const result = await query(
    `
      SELECT ${sensorColumns}
      FROM sensor_readings
      ORDER BY created_at DESC
      LIMIT 1
    `,
  );
  return result.rows[0] || null;
}

export async function createSensorReading(data) {
  const reading = normalizeSensorReading(data);
  const columns = ["temperature", "humidity", "soil_moisture", "light", "gas"];
  const values = [reading.temperature, reading.humidity, reading.soil_moisture, reading.light, reading.gas];

  if (reading.created_at) {
    columns.push("created_at");
    values.push(reading.created_at);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`);
  const result = await query(
    `
      INSERT INTO sensor_readings (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING ${sensorColumns}
    `,
    values,
  );

  return result.rows[0];
}

export async function findDuplicateSensorReading(data) {
  const reading = normalizeSensorReading(data);

  if (!reading.created_at) {
    return null;
  }

  const result = await query(
    `
      SELECT ${sensorColumns}
      FROM sensor_readings
      WHERE created_at = $1
        AND temperature IS NOT DISTINCT FROM $2
        AND humidity IS NOT DISTINCT FROM $3
        AND soil_moisture IS NOT DISTINCT FROM $4
        AND light IS NOT DISTINCT FROM $5
        AND gas IS NOT DISTINCT FROM $6
      LIMIT 1
    `,
    [
      reading.created_at,
      reading.temperature,
      reading.humidity,
      reading.soil_moisture,
      reading.light,
      reading.gas,
    ],
  );

  return result.rows[0] || null;
}

export async function deleteSensorReading(id) {
  const result = await query(
    `DELETE FROM sensor_readings WHERE id = $1 RETURNING ${sensorColumns}`,
    [id],
  );
  return result.rows[0] || null;
}

export async function getDailyStats(options = {}) {
  const where = [];
  const values = [];

  addDateFilters(where, values, options);

  const result = await query(
    `
      SELECT
        created_at::date AS date,
        AVG(temperature) AS avg_temperature,
        MIN(temperature) AS min_temperature,
        MAX(temperature) AS max_temperature,
        AVG(humidity) AS avg_humidity,
        MIN(humidity) AS min_humidity,
        MAX(humidity) AS max_humidity,
        AVG(soil_moisture) AS avg_soil_moisture,
        MIN(soil_moisture) AS min_soil_moisture,
        MAX(soil_moisture) AS max_soil_moisture,
        AVG(light) AS avg_light,
        MIN(light) AS min_light,
        MAX(light) AS max_light,
        AVG(gas) AS avg_gas,
        MIN(gas) AS min_gas,
        MAX(gas) AS max_gas
      FROM sensor_readings
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY created_at::date
      ORDER BY date DESC
    `,
    values,
  );

  return result.rows;
}
