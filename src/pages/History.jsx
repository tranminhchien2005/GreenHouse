import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sensorService } from "@/services/sensorService";

export default function History() {
  const { data: history = [] } = useQuery({
    queryKey: ["sensorData", "history", 50],
    queryFn: () => sensorService.listLatest(50),
    refetchOnMount: "always",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lịch sử cảm biến</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Theo dõi dữ liệu môi trường đã ghi nhận
        </p>
      </div>

      <div className="space-y-3">
        {history.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            Chưa có dữ liệu lịch sử.
          </Card>
        ) : (
          history.map((item) => (
            <Card
              key={item.id}
              className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="text-sm text-muted-foreground">
                {item.created_date
                  ? format(new Date(item.created_date), "dd/MM/yyyy HH:mm:ss")
                  : "Không rõ thời gian"}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Nhiet do: {item.temperature ?? "--"} C</Badge>
                <Badge variant="secondary">Do am KK: {item.humidity ?? "--"} %</Badge>
                <Badge variant="secondary">Do am dat: {item.soil_moisture ?? "--"} %</Badge>
                <Badge variant="secondary">Anh sang: {item.light ?? "--"} lux</Badge>
                <Badge variant="secondary">Gas: {item.gas ?? "--"} ppm</Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
