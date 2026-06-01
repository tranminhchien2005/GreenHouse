#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#define MQTT_USE_TLS 1

// Đổi giá trị này trên từng board: "node-1", "node-2", ...
const char* NODE_ID = "node-1";

const char* WIFI_SSID = "your-wifi-ssid";
const char* WIFI_PASSWORD = "your-wifi-password";

const char* MQTT_HOST = "your-cluster.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT = MQTT_USE_TLS ? 8883 : 1883;
const char* MQTT_USERNAME = "your_hivemq_username";
const char* MQTT_PASSWORD = "your_hivemq_password";
const char* MQTT_TOPIC_PREFIX = "greenhouse/your-project-id";

const char* SENSOR_TOPIC_SUFFIX = "sensors";
const unsigned long PUBLISH_INTERVAL_MS = 5000;

#if MQTT_USE_TLS
WiFiClientSecure net;
#else
WiFiClient net;
#endif

PubSubClient mqtt(net);
unsigned long lastPublishAt = 0;

void buildTopic(const char* suffix, char* output, size_t outputSize) {
  snprintf(output, outputSize, "%s/%s", MQTT_TOPIC_PREFIX, suffix);
}

void publishSensorReading() {
  char sensorTopic[128];
  buildTopic(SENSOR_TOPIC_SUFFIX, sensorTopic, sizeof(sensorTopic));

  StaticJsonDocument<256> doc;
  doc["node_id"] = NODE_ID;
  // Thay các giá trị dưới đây bằng đọc cảm biến thật (DHT, soil, LDR, ...)
  doc["temperature"] = 28.0 + (esp_random() % 50) / 10.0;
  doc["humidity"] = 60.0 + (esp_random() % 200) / 10.0;
  doc["soil_moisture"] = 35.0 + (esp_random() % 300) / 10.0;
  doc["light"] = 500 + (esp_random() % 500);

  char payload[256];
  serializeJson(doc, payload, sizeof(payload));
  mqtt.publish(sensorTopic, payload, false);
  Serial.printf("Published to %s: %s\n", sensorTopic, payload);
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
    String clientId = String("greenhouse_sensor_") + NODE_ID + "_" + String((uint32_t)ESP.getEfuseMac(), HEX);
    Serial.printf("Connecting MQTT as %s...\n", clientId.c_str());

    bool connected = strlen(MQTT_USERNAME) > 0
      ? mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)
      : mqtt.connect(clientId.c_str());

    if (connected) {
      Serial.println("MQTT connected");
      publishSensorReading();
      lastPublishAt = millis();
    } else {
      Serial.printf("MQTT failed, rc=%d. Retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  connectWifi();

#if MQTT_USE_TLS
  net.setInsecure();
#endif

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
}

void loop() {
  if (!mqtt.connected()) {
    connectMqtt();
  }

  mqtt.loop();

  if (millis() - lastPublishAt >= PUBLISH_INTERVAL_MS) {
    publishSensorReading();
    lastPublishAt = millis();
  }
}
