import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { appClient } from '@/api/appClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'profile', label: 'Hồ sơ' },
  { key: 'plants', label: 'Cây trồng' },
  { key: 'thresholds', label: 'Ngưỡng cảnh báo', adminOnly: true },
];

const ROLE_BADGES = {
  admin: { className: 'bg-green-100 text-green-700 hover:bg-green-100', label: 'admin' },
  operator: { className: 'bg-blue-100 text-blue-700 hover:bg-blue-100', label: 'operator' },
  viewer: { className: 'bg-slate-100 text-slate-700 hover:bg-slate-100', label: 'viewer' },
};

const SENSOR_LABELS = {
  temperature: 'Nhiệt độ',
  humidity: 'Độ ẩm KK',
  soil_moisture: 'Độ ẩm đất',
  light: 'Ánh sáng',
  gas: 'Khí gas',
};

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TOKEN_KEY = 'greenhouse_auth_token';
const EMPTY_PLANT_FORM = {
  name: '',
  location: '',
  plant_profile_id: '',
  planted_at: '',
  notes: '',
};
const MANUAL_PLANT_PROFILE_VALUE = 'manual';

async function changePasswordRequest({ currentPassword, newPassword }) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/auth/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.message || 'Đổi mật khẩu thất bại');
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

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

async function listPlantProfiles() {
  return appClient.entities.PlantProfile.list('name', 500, { active: true });
}

async function listUserPlants() {
  return appClient.entities.UserPlant.list('location', 500, {
    active: true,
    sortOrder: 'asc',
  });
}

async function saveUserPlant(data) {
  const payload = {
    name: data.name.trim(),
    location: data.location.trim() || null,
    plant_profile_id: data.plant_profile_id || null,
    planted_at: data.planted_at || null,
    notes: data.notes.trim() || null,
    active: true,
  };

  if (data.id) return appClient.entities.UserPlant.update(data.id, payload);
  return appClient.entities.UserPlant.create(payload);
}

async function deactivateUserPlant(id) {
  return appClient.entities.UserPlant.delete(id);
}

function RoleBadge({ role }) {
  const config = ROLE_BADGES[role] || ROLE_BADGES.viewer;
  return <Badge className={config.className}>{config.label}</Badge>;
}

function ProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState('');

  const mutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: () => {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setValidationError('');
      toast({
        title: 'Đổi mật khẩu thành công',
        description: 'Mật khẩu của bạn đã được cập nhật.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Đổi mật khẩu thất bại',
        description: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    },
  });

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError('');

    if (!form.currentPassword) {
      setValidationError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (form.newPassword.length < 6) {
      setValidationError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setValidationError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    mutation.mutate({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-0 shadow-sm">
        <h2 className="text-base font-semibold">Thông tin cá nhân</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Thông tin tài khoản đăng nhập hệ thống
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-username">Tên đăng nhập</Label>
            <Input
              id="profile-username"
              value={user?.username || ''}
              disabled
              readOnly
            />
          </div>

          <div className="space-y-2">
            <Label>Vai trò</Label>
            <div className="flex h-10 items-center">
              <RoleBadge role={user?.role} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-0 shadow-sm">
        <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cập nhật mật khẩu mới để bảo vệ tài khoản
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={handleChange('currentPassword')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={handleChange('newPassword')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
            />
          </div>

          {validationError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {validationError}
            </div>
          )}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function formatPlantLabel(plant) {
  const profileName = plant?.plant_profile?.name || plant?.plantProfile?.name || plant?.name || 'Cây nhập tay';
  if (!plant?.location) return profileName;
  return `${profileName} - ${plant.location}`;
}

function PlantsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_PLANT_FORM);
  const [editingId, setEditingId] = useState(null);

  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['plantProfiles', 'active'],
    queryFn: listPlantProfiles,
  });
  const { data: plants = [], isLoading: isLoadingPlants } = useQuery({
    queryKey: ['userPlants', 'active'],
    queryFn: listUserPlants,
  });

  const saveMutation = useMutation({
    mutationFn: saveUserPlant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPlants'] });
      queryClient.invalidateQueries({ queryKey: ['chatbotPlants'] });
      setForm(EMPTY_PLANT_FORM);
      setEditingId(null);
      toast({
        title: editingId ? 'Đã cập nhật cây trồng' : 'Đã thêm cây trồng',
        description: 'Danh sách cây đang trồng đã được cập nhật.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Lưu cây trồng thất bại',
        description: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUserPlant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPlants'] });
      queryClient.invalidateQueries({ queryKey: ['chatbotPlants'] });
      toast({
        title: 'Đã ngừng theo dõi cây trồng',
        description: 'Cây này không còn xuất hiện trong danh sách cây đang trồng.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Không thể ngừng theo dõi',
        description: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    },
  });

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Thiếu tên cây/khu vực',
        description: 'Vui lòng nhập tên để nhận diện cây đang trồng.',
      });
      return;
    }

    saveMutation.mutate({ ...form, id: editingId });
  };

  const startEdit = (plant) => {
    setEditingId(plant.id);
    setForm({
      name: plant.name || '',
      location: plant.location || '',
      plant_profile_id: plant.plant_profile_id || plant.plantProfileId || '',
      planted_at: plant.planted_at ? String(plant.planted_at).slice(0, 10) : '',
      notes: plant.notes || '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_PLANT_FORM);
  };

  const isSaving = saveMutation.isPending;
  const isLoading = isLoadingProfiles || isLoadingPlants;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <Card className="p-6 border-0 shadow-sm">
        <h2 className="text-base font-semibold">
          {editingId ? 'Sửa cây đang trồng' : 'Thêm cây đang trồng'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Chọn PlantProfile có sẵn hoặc nhập tên cây trực tiếp từ bàn phím
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plant-profile">PlantProfile hoặc nhập tay</Label>
            <Select
              value={form.plant_profile_id || MANUAL_PLANT_PROFILE_VALUE}
              onValueChange={(value) => setForm((prev) => ({
                ...prev,
                plant_profile_id: value === MANUAL_PLANT_PROFILE_VALUE ? '' : value,
              }))}
              disabled={isSaving || isLoadingProfiles}
            >
              <SelectTrigger id="plant-profile">
                <SelectValue placeholder="Chọn loại cây" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL_PLANT_PROFILE_VALUE}>
                  Nhập tên cây từ bàn phím
                </SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.plant_profile_id && (
              <p className="text-xs text-muted-foreground">
                Không dùng hồ sơ cây có sẵn; chatbot sẽ nhận diện theo tên bạn nhập và dùng kiến thức chăm sóc chung.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="plant-name">Tên cây/khu vực</Label>
            <Input
              id="plant-name"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="Ví dụ: Cà chua luống A"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plant-location">Vị trí</Label>
              <Input
                id="plant-location"
                value={form.location}
                onChange={handleChange('location')}
                placeholder="Luống A"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plant-date">Ngày trồng</Label>
              <Input
                id="plant-date"
                type="date"
                value={form.planted_at}
                onChange={handleChange('planted_at')}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plant-notes">Ghi chú</Label>
            <Input
              id="plant-notes"
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Tình trạng, giống cây, khu vực..."
              disabled={isSaving}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm cây'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                Hủy
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6 border-0 shadow-sm">
        <h2 className="text-base font-semibold">Danh sách cây đang trồng</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Các cây active sẽ xuất hiện trong dropdown chatbot
        </p>

        <div className="mt-5 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 rounded-md border bg-muted/40 animate-pulse" />
            ))
          ) : plants.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Chưa có cây đang trồng
            </div>
          ) : (
            plants.map((plant) => {
              const isDeleting =
                deactivateMutation.isPending && deactivateMutation.variables === plant.id;

              return (
                <div
                  key={plant.id}
                  className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{plant.name}</h3>
                      <Badge variant="outline">{plant.plant_profile?.name || 'Nhập tay'}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatPlantLabel(plant)}
                      {plant.planted_at && ` · Trồng ngày ${String(plant.planted_at).slice(0, 10)}`}
                    </div>
                    {plant.notes && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{plant.notes}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(plant)}
                      disabled={isSaving || isDeleting}
                    >
                      Sửa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => deactivateMutation.mutate(plant.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Đang tắt...' : 'Ngừng trồng'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
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
        : `${label}. Đã tạo ${created} cảnh báo mới — xem tại trang Cảnh báo.`,
    });
    return;
  }

  toast({
    title: 'Cập nhật ngưỡng thành công',
    description: `${label} đã được lưu. Chưa có cảnh báo mới (giá trị sensor gần nhất chưa vượt ngưỡng hoặc đang trong thời gian chờ 5 phút).`,
  });
}

function ThresholdsTab() {
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
    <Card className="p-6 border-0 shadow-sm">
      <h2 className="text-base font-semibold">Ngưỡng cảnh báo</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Quản lý ngưỡng kích hoạt cảnh báo cho từng cảm biến
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
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
                <tr key={`skel-${idx}`} className="border-b last:border-b-0 animate-pulse">
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

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  const [activeTab, setActiveTab] = useState('profile');
  const safeActiveTab = visibleTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key || 'profile';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quản lý cấu hình hệ thống
        </p>
      </div>

      <div className="flex items-center gap-1 border-b">
        {visibleTabs.map((tab) => {
          const isActive = safeActiveTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {safeActiveTab === 'thresholds' && <ThresholdsTab />}
      {safeActiveTab === 'plants' && <PlantsTab />}
      {safeActiveTab === 'profile' && <ProfileTab />}
    </div>
  );
}
