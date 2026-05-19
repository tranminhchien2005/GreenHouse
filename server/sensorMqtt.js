import { subscribeMqtt } from "./mqtt.js";
import { SENSOR_DATA_TOPIC } from "./mqttTopics.js";
import { ingestSensorReading } from "./sensorIngestion.js";

let unsubscribeSensorData = null;

function parseSensorPayload(message) {
  const payload = JSON.parse(message);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Sensor payload must be a JSON object");
  }

  return payload;
}

export function startSensorMqttListener() {
  if (unsubscribeSensorData) return unsubscribeSensorData;

  unsubscribeSensorData = subscribeMqtt(SENSOR_DATA_TOPIC, async (message) => {
    let payload;
    try {
      payload = parseSensorPayload(message);
    } catch (error) {
      console.error(`[SensorMQTT] Invalid JSON on ${SENSOR_DATA_TOPIC}:`, error.message);
      return;
    }

    try {
      const { reading, createdAlerts, automationCommands } = await ingestSensorReading(payload);
      console.log(
        `[SensorMQTT] Saved reading ${reading.id} from ${SENSOR_DATA_TOPIC}. ` +
          `alerts=${createdAlerts.length}, automation=${automationCommands.length}`,
      );
    } catch (error) {
      console.error("[SensorMQTT] Failed to ingest sensor payload:", error.message);
    }
  });

  return unsubscribeSensorData;
}
