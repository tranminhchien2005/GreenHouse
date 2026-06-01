import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SENSOR_LABELS } from '@/config/greenhouse';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TOKEN_KEY = 'greenhouse_auth_token';

const OPERATOR_LABELS = {
  '>': 'Lớn hơn',
  '>=': 'Lớn hơn hoặc bằng',
  '<': 'Nhỏ hơn',
  '<=': 'Nhỏ hơn hoặc bằng',
  '==': 'Bằng',
};

const LEVEL_BADGES = {
  danger: { className: 'bg-red-100 text-red-700 hover:bg-red-100', label: 'Nguy hiểm' },
  warning: { className: 'bg-amber-100 text-amber-700 hover:bg-amber-100', label: 'Cảnh báo' },
  info: { className: 'bg-blue-100 text-blue-700 hover:bg-blue-100', label: 'Thông tin' },
};

async function listThresholds() {
  const response = await fetch(`${API_BASE_URL}/api/AlertThreshold`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Không tải được danh sách ngưỡng');
  }
  return response.json();
}

async function patchThreshold(id, body) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/api/AlertThreshold/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.message || 'Cập nhật ngưỡng thất bại');
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function formatThresholdLabel(threshold) {
  if (!threshold) return 'ngưỡng';
  const sensor = SENSOR_LABELS[threshold.sensor_type] || threshold.sensor_type;
  const op = OPERATOR_LABELS[threshold.operator] || threshold.operator;
  return `${sensor} ${op} ${threshold.value}`;
}

function toastAfterThresholdUpdate(toast, queryClient, threshold, result) {
  queryClient.invalidateQueries({ queryKey: ['alertThresholds'] });
  queryClient.invalidateQueries({ queryKey: ['alerts'] });

  const merged = threshold && result ? { ...threshold, ...result } : (result || threshold);
  const label = formatThresholdLabel(merged);
  const created = Number(result?.alerts_created ?? 0);

  if (created > 0) {
    const firstMessage = result?.alerts?.[0]?.message;
    toast({
      title: 'Đã lưu ngưỡng và tạo cảnh báo',
      description: firstMessage
        ? `${label}. ${firstMessage}`
        : `${label}. Đã tạo ${created} cảnh báo mới — xem tab Cảnh báo.`,
    });
    return;
  }

  toast({
    title: 'Cập nhật ngưỡng thành công',
    description: `${label} đã được lưu. Chưa có cảnh báo mới (giá trị sensor gần nhất chưa vượt ngưỡng hoặc đang trong thời gian chờ 5 phút).`,
  });
}

export default function AlertThresholdsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const { data: thresholds = [], isLoading } = useQuery({
    queryKey: ['alertThresholds'],
    queryFn: listThresholds,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => patchThreshold(id, { active }),
    onSuccess: (result, variables) => {
      const threshold = thresholds.find((t) => t.id === variables.id);
      toastAfterThresholdUpdate(toast, queryClient, threshold, result);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Cập nhật trạng thái thất bại',
        description: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    },
  });

  const valueMutation = useMutation({
    mutationFn: ({ id, value }) => patchThreshold(id, { value }),
    onSuccess: (result, variables) => {
      setEditingId(null);
      setEditingValue('');
      const threshold = thresholds.find((t) => t.id === variables.id);
      toastAfterThresholdUpdate(toast, queryClient, threshold, result);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Cập nhật ngưỡng thất bại',
        description: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    },
  });

  const handleEdit = (threshold) => {
    setEditingId(threshold.id);
    setEditingValue(String(threshold.value ?? ''));
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleSave = (id) => {
    const number = Number(editingValue);
    if (!Number.isFinite(number)) {
      toast({
        variant: 'destructive',
        title: 'Giá trị không hợp lệ',
        description: 'Ngưỡng phải là số.',
      });
      return;
    }
    valueMutation.mutate({ id, value: number });
  };

  return (
    <Card className="border-0 p-6 shadow-sm">
      <h2 className="text-base font-semibold">Ngưỡng cảnh báo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quản lý ngưỡng kích hoạt cảnh báo cho từng cảm biến
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5">Cảm biến</th>
              <th className="px-3 py-2.5">Điều kiện</th>
              <th className="px-3 py-2.5">Ngưỡng</th>
              <th className="px-3 py-2.5">Mức</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`skel-${idx}`} className="animate-pulse border-b last:border-b-0">
                  {Array.from({ length: 6 }).map((__, c) => (
                    <td key={c} className="px-3 py-3">
                      <div className="h-3 rounded bg-muted/70" />
                    </td>
                  ))}
                </tr>
              ))
            ) : thresholds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Chưa có ngưỡng nào
                </td>
              </tr>
            ) : (
              thresholds.map((threshold) => {
                const isEditing = editingId === threshold.id;
                const levelConfig = LEVEL_BADGES[threshold.level] || LEVEL_BADGES.warning;
                const isTogglingThis =
                  toggleMutation.isPending && toggleMutation.variables?.id === threshold.id;
                const isSavingThis =
                  valueMutation.isPending && valueMutation.variables?.id === threshold.id;

                return (
                  <tr key={threshold.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2.5 font-medium">
                      {SENSOR_LABELS[threshold.sensor_type] || threshold.sensor_type}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {OPERATOR_LABELS[threshold.operator] || threshold.operator}
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          className="h-8 w-28"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{threshold.value}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={levelConfig.className}>{levelConfig.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Switch
                        checked={Boolean(threshold.active)}
                        disabled={isTogglingThis}
                        onCheckedChange={(next) =>
                          toggleMutation.mutate({ id: threshold.id, active: next })
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSavingThis}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSave(threshold.id)}
                            disabled={isSavingThis}
                          >
                            {isSavingThis ? 'Đang lưu...' : 'Lưu'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(threshold)}
                        >
                          Sửa
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
