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

const ok = async (res: Response) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const listPayments = (): Promise<Payment[]> =>
  fetch(`${BASE}/payments`).then(ok);

export const createPayment = (userId: string, userName: string, amount: number): Promise<{ processId: string }> =>
  fetch(`${BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName, amount }),
  }).then(ok);

export const listUsers = (): Promise<AppUser[]> =>
  fetch(`${BASE}/users`).then(ok);

export const createUser = (name: string, email: string): Promise<{ userId: string }> =>
  fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  }).then(ok);
