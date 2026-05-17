# GreenHouse

Ứng dụng web giám sát và điều khiển nhà kính.

## Công nghệ

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js HTTP server
- Database: PostgreSQL (kết nối qua `DATABASE_URL`)
- Chatbot: Gemini API qua backend
- File `server/data/db.json` chỉ còn là **nguồn import một lần** qua `npm run db:import:*`, không còn dùng làm database runtime.
- Realtime thiết bị: MQTT qua HiveMQ public broker

## Phân chia Frontend và Backend

### Frontend

Frontend là phần giao diện web cho người dùng thao tác và theo dõi nhà kính.

Các chức năng chính:

- Hiển thị dashboard dữ liệu cảm biến theo thời gian thực.
- Hiển thị biểu đồ và lịch sử dữ liệu cảm biến.
- Bật/tắt thiết bị thủ công như máy bơm, quạt, phun sương, đèn.
- Tạo, bật/tắt và xóa quy tắc tự động hóa.
- Hiển thị danh sách cảnh báo và trạng thái đã đọc/chưa đọc.
- Gửi lệnh điều khiển thiết bị qua MQTT khi người dùng thao tác.
- Nhận dữ liệu cảm biến MQTT để cập nhật giao diện và lưu vào backend.
- Hiển thị trạng thái kết nối MQTT.

Các thư mục/file liên quan:

- `src/pages/Dashboard.jsx`: màn hình tổng quan.
- `src/pages/Controls.jsx`: màn hình điều khiển thiết bị.
- `src/pages/Automation.jsx`: màn hình cấu hình tự động hóa.
- `src/pages/Alerts.jsx`: màn hình cảnh báo.
- `src/pages/History.jsx`: màn hình lịch sử cảm biến.
- `src/lib/mqttClient.js`: cấu hình MQTT phía web.
- `src/lib/useMqtt.js`: nhận dữ liệu cảm biến realtime.
- `src/services/*`: gọi API backend.

### Backend

Backend là phần API trung gian để lưu dữ liệu, quản lý đăng nhập, cảnh báo và giao tiếp với các dịch vụ phía server.

Các chức năng chính:

- Cung cấp API đăng nhập và kiểm tra người dùng (bcryptjs + JWT, dữ liệu user lưu PostgreSQL).
- Lưu dữ liệu cảm biến vào PostgreSQL.
- Lưu trạng thái thiết bị vào PostgreSQL.
- Lưu quy tắc tự động hóa vào PostgreSQL.
- Lưu và cập nhật cảnh báo trong PostgreSQL.
- Publish yêu cầu gửi SMS qua MQTT khi có cảnh báo nguy hiểm.
- Cung cấp API CRUD chung cho các entity:
  - `SensorData`
  - `DeviceState`
  - `AutomationRule`
  - `Alert`

Các thư mục/file liên quan:

- `server/index.js`: khởi động HTTP server, kiểm tra kết nối + schema PostgreSQL, khai báo route chính.
- `server/auth.js`: xử lý đăng nhập và token (bcryptjs + JWT).
- `server/entities.js`: API CRUD cho dữ liệu chính (đều đọc/ghi PostgreSQL).
- `server/database.js`: khởi tạo connection pool PostgreSQL.
- `server/repositories/*`: query layer cho từng bảng PostgreSQL.
- `server/migrations/*`: SQL migration tạo schema.
- `server/scripts/import*FromJson.js`: nạp dữ liệu một lần từ `server/data/db.json` vào PostgreSQL.
- `server/mqtt.js`: publish MQTT phía backend.
- `server/sim800l.js`: publish yêu cầu gửi SMS cho ESP32/SIM800L.
- `server/data/db.json`: nguồn import (legacy JSON), backend runtime không đọc/ghi file này.

### Phần cứng

Phần cứng do ESP32/ESP8266 xử lý. Web không cần viết firmware, nhưng cần thống nhất topic và payload MQTT để hai bên giao tiếp đúng.

Trách nhiệm phần cứng:

- Đọc cảm biến và publish dữ liệu lên topic `greenhouse/sensors`.
- Subscribe các topic điều khiển như `greenhouse/control/pump`, `greenhouse/control/fan`, `greenhouse/control/mist`, `greenhouse/control/light`.
- Bật/tắt relay hoặc thiết bị thật khi nhận lệnh.
- Publish trạng thái thật của thiết bị về topic `greenhouse/device/status` nếu có hỗ trợ.
- ESP32 gắn SIM800L subscribe topic `greenhouse/alerts/sms` để gửi SMS.
- Chatbot Gemini đọc ngữ cảnh cảm biến, thiết bị, cảnh báo và luật tự động hóa từ PostgreSQL.
- Chatbot ưu tiên hồ sơ cây trong `plant_profiles`; nếu chưa có hồ sơ cây, chatbot dùng kiến thức nông nghiệp phổ thông để tư vấn chung.

## Cài đặt

```bash
npm install
```

## Cấu hình database

Backend yêu cầu PostgreSQL. Tạo file `.env` ở thư mục gốc:

```bash
DATABASE_URL=postgres://greenhouse:greenhouse123@localhost:5432/greenhouse
JWT_SECRET=greenhouse_dev_secret_change_me
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

`GEMINI_API_KEY` chỉ dùng ở backend. Không đặt key này trong biến `VITE_...` vì frontend sẽ bị lộ key ra trình duyệt.
Mặc định dùng `gemini-3.1-flash-lite` để phù hợp dự án cá nhân và free tier.

Tạo schema lần đầu (bắt buộc trước khi start server):

```bash
npm run db:migrate
```

(Tuỳ chọn) Nạp dữ liệu mẫu từ `server/data/db.json` vào PostgreSQL:

```bash
npm run db:import:devices
npm run db:import:sensors
npm run db:import:alerts
npm run db:import:automation
npm run db:import:users
```

Server khi start sẽ:

- Warm-up connection pool và in `[Database] Connection pool ready.`
- Kiểm tra các bảng bắt buộc (`devices`, `sensor_readings`, `alerts`, `automation_rules`, `users`) và in `[Database] Schema OK.`
- Nếu kết nối DB thất bại hoặc thiếu bảng, server sẽ exit và hướng dẫn chạy `npm run db:migrate`.

## Hồ sơ cây trồng cho chatbot

Chatbot dùng bảng `plant_profiles` để nhận diện cây theo tên hoặc alias trong câu hỏi, ví dụ `cà chua`, `ca chua`, `tomato`.
Chatbot cũng dùng bảng `user_plants` để biết các cây/khu vực đang trồng trong nhà kính.

Seed mặc định có một số cây phổ biến:

```text
Cà chua, xà lách, dâu tây, rau cải, dưa leo, ớt, rau muống, húng quế, bạc hà, cải thìa
```

Seed mặc định cho cây đang trồng:

```text
Khay 1: Cà chua
Khay 2: Xà lách
Chậu 1: Dâu tây
```

Luồng xử lý:

- Nếu câu hỏi khớp cây/khu vực trong `user_plants`, chatbot hiểu đó là cây đang được hỏi.
- Nếu cây có trong `plant_profiles`, chatbot dùng ngưỡng nhiệt độ, độ ẩm, độ ẩm đất và ánh sáng từ database.
- Nếu cây chưa có trong database, chatbot vẫn trả lời bằng kiến thức nông nghiệp phổ thông và nói rõ đó là khuyến nghị chung.
- Widget chatbot có dropdown chọn cây/khu vực. Frontend gọi `GET /chatbot/plants` và gửi `plantId` trong `POST /chatbot/message`.
- Khi chatbot đề xuất bật/tắt thiết bị, widget chỉ hiện nút xác nhận. Lệnh thật chỉ được gửi sau khi người dùng bấm xác nhận qua `POST /chatbot/device-action`.

Sau khi pull/cập nhật code có migration mới, chạy:

```bash
npm run db:migrate
```

## Chạy app

Mở terminal 1 để chạy backend:

```bash
npm run server
```

Mở terminal 2 để chạy frontend:

```bash
npm run dev
```

Frontend mặc định gọi backend tại:

```text
http://localhost:3001
```

Nếu muốn đổi URL backend, tạo file `.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

## Đăng nhập

Tài khoản mặc định sau khi chạy `npm run db:import:users`:

```text
admin / admin123
```

Mật khẩu được hash bằng bcryptjs, token cấp qua JWT (`JWT_SECRET` trong `.env`). Khi đưa lên production hãy đổi mật khẩu admin và cấp `JWT_SECRET` riêng.

## Gửi SMS cảnh báo bằng SIM800L

Hệ thống dùng ESP32 gắn module SIM800L để gửi SMS. Backend không gửi SMS trực tiếp, mà publish yêu cầu gửi SMS qua MQTT. ESP32 subscribe topic đó rồi điều khiển SIM800L bằng AT command.

Luồng hoạt động:

```text
Backend tạo Alert warning/danger
-> Publish MQTT topic greenhouse/alerts/sms
-> ESP32 nhận message
-> ESP32 gửi AT command cho SIM800L
-> SIM800L gửi SMS tới điện thoại
```

Cấu hình mặc định:

```bash
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883
SIM800L_SMS_TOPIC=greenhouse/alerts/sms
SIM800L_PHONE_NUMBERS=+849xxxxxxxx,+849yyyyyyyy
```

Trên Windows PowerShell có thể đặt nhanh:

```powershell
$env:MQTT_BROKER_URL="mqtt://broker.hivemq.com:1883"
$env:SIM800L_SMS_TOPIC="greenhouse/alerts/sms"
$env:SIM800L_PHONE_NUMBERS="+849xxxxxxxx"
npm run server
```

Payload backend gửi cho ESP32:

```json
{
  "id": "alert-id",
  "type": "danger",
  "message": "[GreenHouse] DANGER: Nguy hiểm! Phát hiện khí gas hoặc cháy. Giá trị: 350",
  "sensor_type": "gas",
  "value": 350,
  "phone_numbers": ["+849xxxxxxxx"],
  "created_date": "2026-04-29T00:00:00.000Z"
}
```

Nếu không đặt `SIM800L_PHONE_NUMBERS`, backend vẫn publish MQTT. Khi đó ESP32 nên dùng số điện thoại mặc định được nạp trong firmware.

## Gợi ý chia phần cứng

- ESP32: làm gateway chính, đọc/gom dữ liệu cảm biến quan trọng và publish `greenhouse/sensors`.
- ESP8266 #1: điều khiển nhóm tưới nước, ví dụ máy bơm và phun sương.
- ESP8266 #2: điều khiển nhóm môi trường, ví dụ quạt và đèn.

Topic MQTT gợi ý:

```text
greenhouse/sensors
greenhouse/alerts/sms
greenhouse/control/pump
greenhouse/control/mist
greenhouse/control/fan
greenhouse/control/light
greenhouse/device/status
```

Mỗi ESP nên publish trạng thái thật về `greenhouse/device/status` sau khi nhận lệnh để web biết thiết bị đã chạy thành công.

Kết nối SIM800L với ESP32:

```text
SIM800L VCC -> nguồn riêng 3.7V-4.2V, dòng đỉnh tối thiểu 2A
SIM800L GND -> GND ESP32 và GND nguồn
SIM800L TX  -> RX ESP32
SIM800L RX  -> TX ESP32 qua chia áp
```

Không cấp nguồn SIM800L trực tiếp từ chân 3.3V/5V của ESP32 vì module dễ bị sụt áp và reset khi gửi SMS.

## API chính

- `GET /health`
- `GET /auth/me`
- `POST /chatbot/message`
- `GET /api/:entity`
- `POST /api/:entity`
- `PATCH /api/:entity/:id`
- `DELETE /api/:entity/:id`

Các entity đang có:

- `SensorData`
- `DeviceState`
- `AutomationRule`
- `Alert`
