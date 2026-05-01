import { publishMqtt } from "./mqtt.js";
import { getActiveAutomationRules, updateAutomationRule } from "./repositories/automationRepository.js";
import { upsertDeviceByName } from "./repositories/deviceRepository.js";

export const AUTOMATION_COOLDOWN_MS = Number(process.env.AUTOMATION_COOLDOWN_MS || 60_000);

export const DEVICE_CONTROL_TOPICS = {
  pump: "greenhouse/control/pump",
  fan: "greenhouse/control/fan",
  mist: "greenhouse/control/mist",
  light: "greenhouse/control/light",
};

const conditionOperators = {
  above: ">",
  below: "<",
  equals: "==",
};
const validOperators = new Set([">", ">=", "<", "<=", "=="]);
const validActions = new Set(["turn_on", "turn_off"]);

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isInCooldown(date, now) {
  if (!date) return false;

  const previousTime = new Date(date).getTime();
  const nowTime = new Date(now).getTime();
  if (!Number.isFinite(previousTime) || !Number.isFinite(nowTime)) return false;

  return nowTime - previousTime < AUTOMATION_COOLDOWN_MS;
}

function getRuleOperator(rule) {
  if (validOperators.has(rule?.operator)) return rule.operator;
  return conditionOperators[rule?.condition] || null;
}

function getTargetDevice(rule) {
  return String(rule?.target_device || rule?.device_name || rule?.device_id || "").trim();
}

function isRuleActive(rule) {
  return rule?.is_active !== false && rule?.active !== false;
}

function getLastTriggeredDate(rule) {
  return rule?.last_triggered_date || rule?.last_triggered_at;
}

function matchesCondition(value, rule, threshold) {
  const operator = getRuleOperator(rule);
  if (!operator) return false;

  const numericValue = toNumber(value);
  const numericThreshold = toNumber(threshold);
  if (numericValue == null || numericThreshold == null) return false;

  if (operator === ">") return numericValue > numericThreshold;
  if (operator === ">=") return numericValue >= numericThreshold;
  if (operator === "<") return numericValue < numericThreshold;
  if (operator === "<=") return numericValue <= numericThreshold;
  return numericValue === numericThreshold;
}

async function updateDeviceStateForAutomation(rule) {
  const targetDevice = getTargetDevice(rule);
  const isOn = rule.action === "turn_on";

  return upsertDeviceByName({
    name: targetDevice,
    type: targetDevice,
    is_on: isOn,
  });
}

function shouldSkipDeviceCooldown(rule, now, triggeredDeviceNames) {
  const targetDevice = getTargetDevice(rule);
  if (triggeredDeviceNames.has(targetDevice)) return true;

  return isInCooldown(getLastTriggeredDate(rule), now);
}

export async function runAutomationRulesForSensorData(sensorData, now = new Date().toISOString()) {
  const rules = await getActiveAutomationRules();
  const commands = [];
  const triggeredDeviceNames = new Set();

  for (const rule of rules) {
    const targetDevice = getTargetDevice(rule);

    if (!isRuleActive(rule)) {
      continue;
    }
    if (!validActions.has(rule.action)) {
      continue;
    }
    if (!DEVICE_CONTROL_TOPICS[targetDevice]) {
      continue;
    }
    if (isInCooldown(getLastTriggeredDate(rule), now)) {
      continue;
    }
    if (shouldSkipDeviceCooldown(rule, now, triggeredDeviceNames)) {
      continue;
    }

    const sensorValue = sensorData[rule.sensor_type];
    if (!matchesCondition(sensorValue, rule, rule.threshold)) {
      continue;
    }

    await updateDeviceStateForAutomation(rule);
    await updateAutomationRule(rule.id, { last_triggered_at: now });
    triggeredDeviceNames.add(targetDevice);

    commands.push({
      topic: DEVICE_CONTROL_TOPICS[targetDevice],
      payload: {
        device_id: targetDevice,
        action: rule.action,
        source: "automation",
        rule_id: rule.id,
        sensor_type: rule.sensor_type,
        value: sensorValue,
        threshold: Number(rule.threshold),
      },
    });
  }

  return commands;
}

export async function publishAutomationCommand(command) {
  await publishMqtt(command.topic, command.payload, { qos: 1 });
  console.log(`[Automation] Published ${command.payload.action} to ${command.topic}`);
}
