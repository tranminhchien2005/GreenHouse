import mqtt from 'mqtt';

// HiveMQ Public Broker via WebSocket
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_PREFIX = (import.meta.env.VITE_MQTT_TOPIC_PREFIX || 'greenhouse/demo')
  .trim()
  .replace(/^\/+|\/+$/g, '');

function topic(suffix) {
  return `${TOPIC_PREFIX}/${suffix.replace(/^\/+|\/+$/g, '')}`;
}

// MQTT Topics
export const TOPICS = {
  SENSORS: topic('sensors'),
  CONTROL_PUMP: topic('control/pump'),
  CONTROL_FAN: topic('control/fan'),
  CONTROL_MIST: topic('control/mist'),
  CONTROL_LIGHT: topic('control/light'),
};

let client = null;
let listeners = {};

export function getMqttClient() {
  if (client) return client;

  client = mqtt.connect(BROKER_URL, {
    clientId: `greenhouse_web_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connected to HiveMQ broker');
    Object.keys(listeners)
      .filter((topic) => topic !== '*')
      .forEach((topic) => client.subscribe(topic, { qos: 1 }));
  });

  client.on('message', (topic, payload) => {
    const message = payload.toString();
    if (listeners[topic]) {
      listeners[topic].forEach(cb => cb(message));
    }
    // Notify wildcard listeners
    if (listeners['*']) {
      listeners['*'].forEach(cb => cb(topic, message));
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  return client;
}

export function subscribeTopic(topic, callback) {
  if (!listeners[topic]) listeners[topic] = [];
  listeners[topic].push(callback);

  const c = getMqttClient();
  if (c.connected) c.subscribe(topic, { qos: 1 });

  return () => {
    listeners[topic] = listeners[topic].filter(cb => cb !== callback);
  };
}

export function publishCommand(topic, payload) {
  const c = getMqttClient();
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  c.publish(topic, message, { qos: 1 });
}

export function getMqttStatus() {
  if (!client) return 'disconnected';
  if (client.connected) return 'connected';
  if (client.reconnecting) return 'reconnecting';
  return 'disconnected';
}
