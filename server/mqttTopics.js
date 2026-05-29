const DEFAULT_TOPIC_PREFIX = "greenhouse/demo";

function normalizeTopicPart(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function topic(suffix) {
  const prefix = normalizeTopicPart(process.env.MQTT_TOPIC_PREFIX || DEFAULT_TOPIC_PREFIX);
  const normalizedSuffix = normalizeTopicPart(suffix);
  return normalizedSuffix ? `${prefix}/${normalizedSuffix}` : prefix;
}

export const MQTT_TOPIC_PREFIX = normalizeTopicPart(process.env.MQTT_TOPIC_PREFIX || DEFAULT_TOPIC_PREFIX);

export const SENSOR_DATA_TOPIC = process.env.SENSOR_DATA_TOPIC || topic("sensors");

export const DEVICE_STATUS_TOPIC = process.env.DEVICE_STATUS_TOPIC || topic("device/status");

export const SIM800L_SMS_TOPIC = process.env.SIM800L_SMS_TOPIC || topic("alerts/sms");

export const GATEWAY_CONTROL_TOPIC = process.env.GATEWAY_CONTROL_TOPIC || topic("control/gateway");

export const DEVICE_CONTROL_TOPICS = {
  pump: process.env.DEVICE_CONTROL_TOPIC_PUMP || topic("control/pump"),
  fan: process.env.DEVICE_CONTROL_TOPIC_FAN || topic("control/fan"),
  light: process.env.DEVICE_CONTROL_TOPIC_LIGHT || topic("control/light"),
};
