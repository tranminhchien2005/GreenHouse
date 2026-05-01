import { ALERT_THRESHOLDS } from '@/config/greenhouse';

export function getSensorWarning(type, value) {
  if (value == null) return null;
  if (type === 'temperature' && value > ALERT_THRESHOLDS.temperatureHigh) return 'Nhiệt độ quá cao!';
  if (type === 'soil_moisture' && value < ALERT_THRESHOLDS.soilMoistureLow) return 'Đất quá khô!';
  if (type === 'gas' && value > ALERT_THRESHOLDS.gasHigh) return 'Phát hiện khí gas!';
  return null;
}

export function createSensorAlerts(data) {
  const alerts = [];

  if (data.soil_moisture != null && data.soil_moisture < ALERT_THRESHOLDS.soilMoistureLow) {
    alerts.push({
      type: 'warning',
      message: 'Độ ẩm đất thấp, cần tưới nước',
      sensor_type: 'soil_moisture',
      value: data.soil_moisture,
      is_read: false,
    });
  }

  if (data.temperature != null && data.temperature > ALERT_THRESHOLDS.temperatureHigh) {
    alerts.push({
      type: 'warning',
      message: 'Nhiệt độ vượt ngưỡng cho phép',
      sensor_type: 'temperature',
      value: data.temperature,
      is_read: false,
    });
  }

  if (data.gas != null && data.gas > ALERT_THRESHOLDS.gasHigh) {
    alerts.push({
      type: 'danger',
      message: 'Nguy hiểm! Phát hiện khí gas hoặc cháy',
      sensor_type: 'gas',
      value: data.gas,
      is_read: false,
    });
  }

  return alerts;
}
