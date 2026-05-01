import { closePool } from "../database.js";
import {
  createSensorReading,
  getDailyStats,
  getLatestSensorReading,
  listSensorReadings,
} from "../repositories/sensorRepository.js";

try {
  const created = await createSensorReading({
    temperature: 28.5,
    humidity: 65,
    soilMoisture: 42,
    light: 1000,
    gas: 120,
  });
  console.log("[SensorRepository] Created:", created);

  const latest = await getLatestSensorReading();
  console.log("[SensorRepository] Latest:", latest);

  const readings = await listSensorReadings({ limit: 5, page: 1 });
  console.log("[SensorRepository] Recent readings:");
  console.table(readings);

  const dailyStats = await getDailyStats();
  console.log("[SensorRepository] Daily stats:");
  console.table(dailyStats);
} catch (error) {
  console.error("[SensorRepository] Test failed:", error.message);
  process.exitCode = 1;
} finally {
  await closePool().catch(() => {});
}
