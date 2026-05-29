import React, { useState } from 'react';
import { Leaf, Lock, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await login(form);
    } catch (err) {
      setError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        username: registerForm.username,
        password: registerForm.password,
      });
      setSuccess(result?.message || 'Đăng ký thành công. Vui lòng chờ admin duyệt tài khoản.');
      setRegisterForm({ username: '', password: '', confirmPassword: '' });
      setMode('login');
      setForm((prev) => ({ ...prev, username: registerForm.username, password: '' }));
    } catch (err) {
      setError(err?.message || 'Đăng ký thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 border-0 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">GreenHouse</h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản mới'}
            </p>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            {success}
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Tài khoản</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <Lock className="w-4 h-4" />
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-username">Tài khoản</Label>
              <Input
                id="register-username"
                value={registerForm.username}
                onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-password">Mật khẩu</Label>
              <Input
                id="register-password"
                type="password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-confirm-password">Xác nhận mật khẩu</Label>
              <Input
                id="register-confirm-password"
                type="password"
                value={registerForm.confirmPassword}
                onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => switchMode(isLogin ? 'register' : 'login')}
          disabled={isSubmitting}
        >
          {isLogin ? 'Tạo tài khoản mới' : 'Quay lại đăng nhập'}
        </Button>

        <div className="mt-5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {isLogin
            ? 'Tài khoản mặc định: admin / admin123'
            : 'Tài khoản mới cần admin duyệt trước khi đăng nhập.'}
        </div>
      </Card>
    </div>
  );
}
