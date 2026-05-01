import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Zap, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { DEVICE_LABELS, SENSOR_LABELS } from '@/config/greenhouse';
import { automationService } from '@/services/automationService';

const conditionLabels = { above: 'Lớn hơn', below: 'Nhỏ hơn', equals: 'Bằng' };
const actionLabels = { turn_on: 'Bật', turn_off: 'Tắt' };

export default function Automation() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', sensor_type: '', condition: '', threshold: '', target_device: '', action: '', is_active: true });
  const queryClient = useQueryClient();

  const { data: rules = [] } = useQuery({
    queryKey: ['automationRules', 'list'],
    queryFn: () => automationService.listRules(),
    refetchOnMount: 'always',
  });

  const createMutation = useMutation({
    mutationFn: (data) => automationService.createRule(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['automationRules'] });
      setOpen(false);
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => automationService.updateRule(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automationRules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => automationService.deleteRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automationRules'] }),
  });

  const resetForm = () => setForm({ name: '', sensor_type: '', condition: '', threshold: '', target_device: '', action: '', is_active: true });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, threshold: Number(form.threshold) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tự động hóa</h1>
          <p className="text-muted-foreground text-sm mt-1">Thiết lập quy tắc điều khiển tự động</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Thêm quy tắc</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tạo quy tắc mới</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Tên quy tắc</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Tự động tưới khi đất khô" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cảm biến</Label>
                  <Select value={form.sensor_type} onValueChange={(v) => setForm({ ...form, sensor_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SENSOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Điều kiện</Label>
                  <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Lớn hơn</SelectItem>
                      <SelectItem value="below">Nhỏ hơn</SelectItem>
                      <SelectItem value="equals">Bằng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Ngưỡng giá trị</Label>
                <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="VD: 30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Thiết bị</Label>
                  <Select value={form.target_device} onValueChange={(v) => setForm({ ...form, target_device: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEVICE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hành động</Label>
                  <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="turn_on">Bật</SelectItem>
                      <SelectItem value="turn_off">Tắt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo quy tắc'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card className="p-12 border-0 shadow-sm text-center">
          <Zap className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Chưa có quy tắc tự động nào</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Nhấn "Thêm quy tắc" để bắt đầu</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {rules.map((rule, i) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={cn("p-5 border-0 shadow-sm transition-opacity", !rule.is_active && "opacity-50")}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{rule.name}</h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="px-2 py-0.5 bg-muted rounded-md">{SENSOR_LABELS[rule.sensor_type]}</span>
                        <span>{conditionLabels[rule.condition]}</span>
                        <span className="font-semibold text-foreground">{rule.threshold}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                          {actionLabels[rule.action]} {DEVICE_LABELS[rule.target_device]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, is_active: checked })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
