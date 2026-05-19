#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#define MQTT_USE_TLS 1

const char* WIFI_SSID = "your-wifi-ssid";
const char* WIFI_PASSWORD = "your-wifi-password";

const char* MQTT_HOST = "your-cluster.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT = MQTT_USE_TLS ? 8883 : 1883;
const char* MQTT_USERNAME = "your_hivemq_username";
const char* MQTT_PASSWORD = "your_hivemq_password";
const char* MQTT_TOPIC_PREFIX = "greenhouse/your-project-id";

const char* DEVICE_STATUS_TOPIC_SUFFIX = "device/status";
const uint8_t RELAY_ON_LEVEL = LOW;
const uint8_t RELAY_OFF_LEVEL = HIGH;

struct Device {
  const char* id;
  const char* controlTopicSuffix;
  uint8_t relayPin;
  bool isOn;
};

Device devices[] = {
  {"pump", "control/pump", 25, false},
  {"fan", "control/fan", 26, false},
  {"mist", "control/mist", 27, false},
  {"light", "control/light", 14, false},
};

#if MQTT_USE_TLS
WiFiClientSecure net;
#else
WiFiClient net;
#endif

PubSubClient mqtt(net);

void buildTopic(const char* suffix, char* output, size_t outputSize) {
  snprintf(output, outputSize, "%s/%s", MQTT_TOPIC_PREFIX, suffix);
}

Device* findDeviceById(const char* id) {
  for (Device& device : devices) {
    if (strcmp(device.id, id) == 0) {
      return &device;
    }
  }

  return nullptr;
}

bool isExpectedControlTopic(const char* topic, const Device& device) {
  char expectedTopic[128];
  buildTopic(device.controlTopicSuffix, expectedTopic, sizeof(expectedTopic));
  return strcmp(topic, expectedTopic) == 0;
}

void publishDeviceStatus(const Device& device, const char* mode = "manual") {
  char statusTopic[128];
  buildTopic(DEVICE_STATUS_TOPIC_SUFFIX, statusTopic, sizeof(statusTopic));

  StaticJsonDocument<192> doc;
  doc["device"] = device.id;
  doc["is_on"] = device.isOn;
  doc["mode"] = mode;
  doc["online"] = true;

  char payload[192];
  serializeJson(doc, payload, sizeof(payload));
  mqtt.publish(statusTopic, payload, false);
  Serial.printf("Published status to %s: %s\n", statusTopic, payload);
}

void setDeviceRelay(Device& device, bool isOn, const char* mode = "manual") {
  device.isOn = isOn;
  digitalWrite(device.relayPin, device.isOn ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
  publishDeviceStatus(device, mode);
}

void handleMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error || !doc.is<JsonObject>()) {
    Serial.printf("Ignored command on %s: payload must be a JSON object\n", topic);
    return;
  }

  if (!doc["device"].is<const char*>() || !doc["is_on"].is<bool>()) {
    Serial.printf("Ignored command on %s: required fields are device and boolean is_on\n", topic);
    return;
  }

  const char* deviceId = doc["device"];
  Device* device = findDeviceById(deviceId);
  if (device == nullptr) {
    Serial.printf("Ignored command on %s: unknown device %s\n", topic, deviceId);
    return;
  }

  if (!isExpectedControlTopic(topic, *device)) {
    Serial.printf("Ignored command on %s: topic does not match device %s\n", topic, deviceId);
    return;
  }

  const char* source = doc["source"] | "manual";
  const char* mode = strcmp(source, "automation") == 0 ? "auto" : "manual";
  setDeviceRelay(*device, doc["is_on"].as<bool>(), mode);
}

void subscribeControlTopics() {
  for (Device& device : devices) {
    char topic[128];
    buildTopic(device.controlTopicSuffix, topic, sizeof(topic));
    mqtt.subscribe(topic, 1);
    Serial.printf("Subscribed to %s\n", topic);
  }
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.printf("\nWiFi connected: %s\n", WiFi.localIP().toString().c_str());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String clientId = "greenhouse_esp32_" + String((uint32_t)ESP.getEfuseMac(), HEX);
    Serial.printf("Connecting MQTT as %s...\n", clientId.c_str());

    bool connected = strlen(MQTT_USERNAME) > 0
      ? mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)
      : mqtt.connect(clientId.c_str());

    if (connected) {
      Serial.println("MQTT connected");
      subscribeControlTopics();
      for (Device& device : devices) {
        publishDeviceStatus(device);
      }
    } else {
      Serial.printf("MQTT failed, rc=%d. Retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  for (Device& device : devices) {
    pinMode(device.relayPin, OUTPUT);
    digitalWrite(device.relayPin, RELAY_OFF_LEVEL);
  }

  connectWifi();

#if MQTT_USE_TLS
  net.setInsecure();
#endif

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleMqttMessage);
  mqtt.setBufferSize(512);
}

void loop() {
  if (!mqtt.connected()) {
    connectMqtt();
  }

  mqtt.loop();
}
