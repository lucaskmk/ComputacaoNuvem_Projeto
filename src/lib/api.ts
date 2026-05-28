const BASE = (import.meta.env.VITE_API_URL as string || '').replace(/\/$/, '');

export interface Payment {
  processId: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt?: string;
  error?: string;
}

export interface AppUser {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CurrentUser {
  userId: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

const ok = async (res: Response) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
};

export const login = (email: string, password: string): Promise<CurrentUser> =>
  fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(ok);

export const listPayments = (userId?: string): Promise<Payment[]> =>
  fetch(`${BASE}/payments${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`).then(ok);

export const createPayment = (userId: string, userName: string, amount: number): Promise<{ processId: string }> =>
  fetch(`${BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName, amount }),
  }).then(ok);

export const listUsers = (): Promise<AppUser[]> =>
  fetch(`${BASE}/users`).then(ok);

export const createUser = (name: string, email: string, password?: string): Promise<{ userId: string }> =>
  fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, ...(password ? { password } : {}) }),
  }).then(ok);
