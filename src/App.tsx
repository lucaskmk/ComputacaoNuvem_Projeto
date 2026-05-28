import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import {
  LayoutDashboard, CreditCard, Users, Activity,
  ArrowRight, Database, Clock, UserPlus, Layers, GitBranch, LogOut
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import {
  login, listPayments, listUsers, createPayment, createUser,
  type Payment, type AppUser, type CurrentUser,
} from './lib/api';

type Tab = 'dashboard' | 'users' | 'transactions' | 'architecture';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('cloudpay_user') || 'null'); }
    catch { return null; }
  });

  // auth form
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // shared data
  const [payments, setPayments] = useState<Payment[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  // polling
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const poll = async () => {
      try {
        if (currentUser.role === 'admin') {
          const [pays, users] = await Promise.all([listPayments(), listUsers()]);
          if (!cancelled) {
            setPayments(pays.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setAppUsers(users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        } else {
          const pays = await listPayments(currentUser.userId);
          if (!cancelled) setPayments(pays.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    try {
      const user = await login(authEmail, authPassword);
      localStorage.setItem('cloudpay_user', JSON.stringify(user));
      setCurrentUser(user);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    try {
      await createUser(authName, authEmail, authPassword);
      const user = await login(authEmail, authPassword);
      localStorage.setItem('cloudpay_user', JSON.stringify(user));
      setCurrentUser(user);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('cloudpay_user');
    setCurrentUser(null);
    setPayments([]);
    setAppUsers([]);
    setAuthEmail(''); setAuthPassword(''); setAuthName(''); setAuthError('');
  };

  if (!currentUser) return (
    <AuthScreen
      mode={authMode} onModeChange={setAuthMode}
      name={authName} onName={setAuthName}
      email={authEmail} onEmail={setAuthEmail}
      password={authPassword} onPassword={setAuthPassword}
      error={authError} loading={authLoading}
      onLogin={handleLogin} onRegister={handleRegister}
    />
  );

  if (currentUser.role === 'user') return (
    <UserDashboard user={currentUser} payments={payments} onLogout={handleLogout} />
  );

  return (
    <AdminPanel
      user={currentUser} payments={payments} appUsers={appUsers}
      onLogout={handleLogout}
      onPaymentsUpdate={setPayments}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Screen
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ mode, onModeChange, name, onName, email, onEmail, password, onPassword, error, loading, onLogin, onRegister }: {
  mode: 'login' | 'register';
  onModeChange: (m: 'login' | 'register') => void;
  name: string; onName: (v: string) => void;
  email: string; onEmail: (v: string) => void;
  password: string; onPassword: (v: string) => void;
  error: string; loading: boolean;
  onLogin: (e: FormEvent) => void;
  onRegister: (e: FormEvent) => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex">
      {/* Left — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
          <div className="mb-12">
            <div className="w-10 h-10 border border-[#c19a6b] flex items-center justify-center rotate-45 mb-6">
              <span className="-rotate-45 text-[10px] font-bold text-[#c19a6b]">CP</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.4em] text-[#c19a6b]">CloudPay</span>
          </div>

          <h1 className="text-[48px] leading-[0.9] font-serif italic text-white mb-3 tracking-tight">
            {mode === 'login' ? 'Bem-vindo.' : 'Criar conta.'}
          </h1>
          <p className="text-[#555] text-xs mb-10">
            {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
            <button onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
              className="text-[#c19a6b] hover:underline transition-all">
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>

          <form onSubmit={mode === 'login' ? onLogin : onRegister} className="space-y-7">
            {mode === 'register' && (
              <div className="group">
                <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                  Nome Completo
                </label>
                <input type="text" value={name} onChange={e => onName(e.target.value)} required
                  placeholder="Edinaldo Pereira"
                  className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-base pb-3 focus:outline-none transition-all placeholder:text-[#333]" />
              </div>
            )}
            <div className="group">
              <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                Email
              </label>
              <input type="email" value={email} onChange={e => onEmail(e.target.value)} required
                placeholder="voce@exemplo.com"
                className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-base pb-3 focus:outline-none transition-all placeholder:text-[#333]" />
            </div>
            <div className="group">
              <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                Senha
              </label>
              <input type="password" value={password} onChange={e => onPassword(e.target.value)} required
                placeholder="••••••••"
                className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-base pb-3 focus:outline-none transition-all placeholder:text-[#333]" />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 bg-rose-950/20 border border-rose-950 text-rose-300 text-xs font-mono">
                {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-14 border border-[#c19a6b] text-white hover:bg-[#c19a6b] hover:text-black text-[10px] font-bold uppercase tracking-[0.5em] transition-all duration-300 active:scale-95 disabled:opacity-30 flex items-center justify-center gap-4 group mt-4">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
              {!loading && <ArrowRight size={14} className="transition-transform group-hover:translate-x-2" />}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-[#ffffff10]">
            <p className="text-[9px] text-[#333] uppercase tracking-widest mb-1">Acesso admin</p>
            <p className="text-[9px] font-mono text-[#444]">admin@cloudpay.com · admin123</p>
          </div>
        </motion.div>
      </div>

      {/* Right — decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center border-l border-[#ffffff08] p-16 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[#c19a6b]/3 rounded-full blur-[200px]" />
        <div className="relative z-10 max-w-md">
          <h2 className="text-[72px] leading-[0.9] font-serif italic text-white tracking-tight mb-8">
            Escalável.<br /><span className="text-[#c19a6b] not-italic">Assíncrono.</span>
          </h2>
          <p className="text-[#555] text-sm leading-relaxed mb-8">
            Plataforma de meios de pagamento com arquitetura distribuída em nuvem — processamento assíncrono via SQS + Lambda, persistência NoSQL no DynamoDB.
          </p>
          <div className="flex gap-8 pt-8 border-t border-[#ffffff10]">
            <span className="text-[9px] uppercase tracking-widest text-[#444]">AWS SQS + Lambda</span>
            <span className="text-[9px] uppercase tracking-widest text-[#444]">DynamoDB</span>
            <span className="text-[9px] uppercase tracking-widest text-[#444]">us-east-2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function UserDashboard({ user, payments, onLogout }: {
  user: CurrentUser;
  payments: Payment[];
  onLogout: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const metrics = useMemo(() => {
    const completed = payments.filter(p => p.status === 'completed');
    const failed = payments.filter(p => p.status === 'failed');
    const total = completed.reduce((s, p) => s + p.amount, 0);
    return { completed: completed.length, failed: failed.length, total };
  }, [payments]);

  const statusColor = (s: string) => {
    if (s === 'completed') return 'text-[#c19a6b]';
    if (s === 'processing') return 'text-blue-400 animate-pulse';
    if (s === 'failed') return 'text-rose-400';
    return 'text-amber-500';
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setIsProcessing(true);
    try {
      await createPayment(user.userId, user.name, parseFloat(amount));
      setAmount('');
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] font-sans">
      {/* Header */}
      <header className="border-b border-[#ffffff10] px-12 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-[#c19a6b] flex items-center justify-center rotate-45">
            <span className="-rotate-45 text-[9px] font-bold text-[#c19a6b]">CP</span>
          </div>
          <span className="text-[10px] tracking-[0.3em] font-medium uppercase text-[#c19a6b]">CloudPay</span>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-white text-[10px] font-bold uppercase tracking-widest leading-none">{user.name}</p>
            <p className="text-[#555] text-[9px] mt-1 font-mono">{user.email}</p>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-[9px] uppercase tracking-widest">
            <LogOut size={12} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-12 py-16">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-10 mb-20 pb-16 border-b border-[#ffffff10]">
          {[
            { label: 'Concluídas', value: metrics.completed },
            { label: 'Falhas', value: metrics.failed },
            { label: 'Volume Total', value: `R$ ${metrics.total.toFixed(2)}` },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
              className="flex flex-col gap-3 group">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-widest text-[#888]">{s.label}</span>
                <span className="font-serif text-[#c19a6b] text-2xl italic">{s.value}</span>
              </div>
              <div className="h-px w-full bg-[#ffffff10]" />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-16">
          {/* Payment form */}
          <div className="col-span-5">
            <h2 className="text-[10px] uppercase tracking-[0.4em] text-white mb-6">Nova Transação</h2>
            <p className="text-xs text-[#888] leading-relaxed mb-8">
              Envio assíncrono via SQS — retorno imediato, processamento em background pelo Lambda Worker.
            </p>
            <form onSubmit={handlePay} className="space-y-8">
              <div className="group">
                <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                  Valor (BRL)
                </label>
                <div className="flex items-baseline gap-4 border-b border-[#ffffff15] focus-within:border-[#c19a6b] transition-all pb-4">
                  <span className="text-2xl font-serif italic text-[#c19a6b]">R$</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" min="0.01" step="0.01"
                    className="bg-transparent w-full text-4xl font-serif italic text-white placeholder:text-[#222] focus:outline-none" />
                </div>
              </div>
              <button type="submit" disabled={isProcessing || !amount}
                className="w-full h-16 border border-[#c19a6b] text-white hover:bg-[#c19a6b] hover:text-black text-[10px] font-bold uppercase tracking-[0.5em] transition-all duration-300 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4 group">
                {isProcessing ? 'Enviando...' : 'Pagar'}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-2" />
              </button>
            </form>
          </div>

          {/* Transaction history */}
          <div className="col-span-7 border-l border-[#ffffff10] pl-16">
            <div className="flex justify-between items-baseline mb-10">
              <h2 className="text-[10px] uppercase tracking-[0.4em] text-white">Minhas Transações</h2>
              <span className="text-[10px] font-mono text-[#c19a6b]">{payments.length} total</span>
            </div>
            {payments.length === 0 && (
              <p className="text-[#555] text-xs py-8">Nenhuma transação ainda. Crie sua primeira!</p>
            )}
            <div className="divide-y divide-[#ffffff10] max-h-[500px] overflow-y-auto">
              {payments.map(p => (
                <motion.div key={p.processId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-6 grid grid-cols-12 items-center">
                  <div className="col-span-5">
                    <p className="text-[9px] font-mono text-[#555] uppercase">{p.processId.slice(-8)}</p>
                    <p className="text-[9px] text-[#444] mt-1">{format(new Date(p.createdAt), 'dd/MM HH:mm:ss')}</p>
                  </div>
                  <div className="col-span-4 font-serif italic text-xl text-white">
                    R$ {p.amount.toFixed(2)}
                  </div>
                  <div className="col-span-3 text-right">
                    <span className={`text-[9px] uppercase tracking-widest font-bold ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                    {p.error && <p className="text-[8px] text-rose-400/60 mt-1 font-mono">{p.error}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Panel
// ─────────────────────────────────────────────────────────────────────────────
function AdminPanel({ user, payments, appUsers, onLogout, onPaymentsUpdate }: {
  user: CurrentUser;
  payments: Payment[];
  appUsers: AppUser[];
  onLogout: () => void;
  onPaymentsUpdate: (p: Payment[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [amount, setAmount] = useState('');
  const [selectedPaymentUserId, setSelectedPaymentUserId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userSuccess, setUserSuccess] = useState(false);

  const pendingItems = useMemo(() => payments.filter(p => p.status === 'pending'), [payments]);

  const metrics = useMemo(() => {
    const finished = payments.filter(p => p.status === 'completed' || p.status === 'failed');
    const completed = payments.filter(p => p.status === 'completed');
    const failed = payments.filter(p => p.status === 'failed');
    const successRate = finished.length > 0 ? (completed.length / finished.length * 100) : 0;
    const totalVolume = completed.reduce((sum, p) => sum + p.amount, 0);
    return { completed: completed.length, failed: failed.length, successRate, totalVolume };
  }, [payments]);

  const filteredPayments = useMemo(() =>
    statusFilter === 'all' ? payments : payments.filter(p => p.status === statusFilter),
    [payments, statusFilter]);

  const statusColor = (s: string) => {
    if (s === 'completed') return 'text-[#c19a6b]';
    if (s === 'processing') return 'text-blue-400 animate-pulse';
    if (s === 'failed') return 'text-rose-400';
    return 'text-amber-500';
  };

  const handleCreatePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setIsProcessing(true);
    try {
      const selectedUser = selectedPaymentUserId ? appUsers.find(u => u.userId === selectedPaymentUserId) : null;
      const uid = selectedUser?.userId || user.userId;
      const uname = selectedUser?.name || user.name;
      await createPayment(uid, uname, parseFloat(amount));
      setAmount('');
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) return;
    setIsCreatingUser(true);
    try {
      await createUser(newUserName, newUserEmail, newUserPassword);
      setNewUserName(''); setNewUserEmail(''); setNewUserPassword('');
      setUserSuccess(true);
      setTimeout(() => setUserSuccess(false), 3000);
    } catch (err) { console.error(err); }
    finally { setIsCreatingUser(false); }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'users', icon: Users, label: 'Usuários' },
    { id: 'transactions', icon: CreditCard, label: 'Transações' },
    { id: 'architecture', icon: Layers, label: 'Arquitetura' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex font-sans text-[#e0e0e0]">
      {/* Sidebar */}
      <aside className="w-80 bg-[#0a0a0c] border-r border-[#ffffff10] flex flex-col fixed inset-y-0 z-50 p-12">
        <div className="flex items-center gap-3 mb-20">
          <div className="w-8 h-8 border border-[#c19a6b] flex items-center justify-center rotate-45">
            <span className="-rotate-45 text-[10px] font-bold text-[#c19a6b]">CP</span>
          </div>
          <span className="text-[11px] tracking-[0.3em] font-medium uppercase text-[#c19a6b]">CloudPay</span>
        </div>

        <nav className="flex-1 space-y-6">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-4 text-[10px] uppercase tracking-[0.25em] transition-all duration-500 py-2 group ${activeTab === item.id ? 'text-white' : 'text-[#888] hover:text-[#e0e0e0]'}`}>
              <div className={`w-[2px] h-4 transition-all duration-500 mr-2 ${activeTab === item.id ? 'bg-[#c19a6b]' : 'bg-transparent group-hover:bg-[#ffffff10]'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mb-8 p-4 border border-[#ffffff10] bg-[#0d0d0f]">
          <div className="text-[9px] uppercase tracking-widest text-[#555] mb-2">Lambda Worker</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c19a6b]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#c19a6b]">AWS — Ativo</span>
          </div>
        </div>

        <div className="border-t border-[#ffffff10] pt-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-8 h-8 border border-[#c19a6b]/50 flex items-center justify-center text-[10px] text-[#c19a6b] font-bold bg-[#0d0d0f]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-[10px] font-bold uppercase tracking-widest leading-none">{user.name}</p>
              <p className="text-[#555] text-[9px] uppercase tracking-widest mt-1">Admin</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-[#888] hover:text-white transition-colors text-[9px] uppercase tracking-[0.3em]">
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-80 p-20 max-w-[1400px]">
        <header className="mb-20 flex justify-between items-end">
          <div>
            <div className="mb-4">
              <span className="text-[10px] uppercase tracking-[0.25em] px-3 py-1 border border-[#ffffff10] text-[#c19a6b]">
                {activeTab === 'dashboard' && 'Sistema Operacional'}
                {activeTab === 'users' && 'Gestão de Usuários'}
                {activeTab === 'transactions' && 'Ledger Imutável'}
                {activeTab === 'architecture' && 'Documentação Técnica'}
              </span>
            </div>
            <h2 className="text-[56px] leading-[1] font-serif italic text-white tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard.'}
              {activeTab === 'users' && 'Usuários.'}
              {activeTab === 'transactions' && 'Transações.'}
              {activeTab === 'architecture' && 'Arquitetura.'}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#888] mb-1">Fila SQS</div>
            <div className="font-mono text-[#c19a6b] text-sm tracking-tighter">
              {pendingItems.length > 0 ? `${pendingItems.length} msg pendente${pendingItems.length > 1 ? 's' : ''}` : 'Vazia — OPTIMAL'}
            </div>
          </div>
        </header>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-20">
            <div className="grid grid-cols-4 gap-12 border-b border-[#ffffff10] pb-16">
              {[
                { label: 'Transações Concluídas', value: metrics.completed },
                { label: 'Transações Falhas', value: metrics.failed },
                { label: 'Taxa de Sucesso', value: `${metrics.successRate.toFixed(1)}%` },
                { label: 'Volume Processado', value: `R$ ${metrics.totalVolume.toFixed(0)}` },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                  className="flex flex-col gap-4 group">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase tracking-widest text-[#888]">{stat.label}</span>
                    <span className="font-serif text-[#c19a6b] text-2xl italic">{stat.value}</span>
                  </div>
                  <div className="h-px w-full bg-[#ffffff10]" />
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-16">
              <div className="col-span-5">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-6">01 / Nova Transação</h3>
                <p className="text-xs text-[#888] leading-relaxed mb-8 max-w-xs">
                  Disparo assíncrono via SQS — a requisição é enviada ao API Gateway, o Lambda cria a mensagem na fila e o Worker Lambda processa independentemente.
                </p>
                <form onSubmit={handleCreatePayment} className="space-y-8">
                  <div className="group">
                    <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">Valor (BRL)</label>
                    <div className="flex items-baseline gap-4 border-b border-[#ffffff15] focus-within:border-[#c19a6b] transition-all pb-4">
                      <span className="text-2xl font-serif italic text-[#c19a6b]">R$</span>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                        className="bg-transparent w-full text-4xl font-serif italic text-white placeholder:text-[#222] focus:outline-none" />
                    </div>
                  </div>
                  {appUsers.length > 0 && (
                    <div>
                      <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3">Pagar em nome de</label>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        <button type="button" onClick={() => setSelectedPaymentUserId('')}
                          className={`w-full text-left px-4 py-2 text-[9px] uppercase tracking-widest transition-all border ${!selectedPaymentUserId ? 'border-[#c19a6b] text-white bg-[#c19a6b]/10' : 'border-[#ffffff10] text-[#555] hover:border-[#ffffff20]'}`}>
                          {user.name} (Admin)
                        </button>
                        {appUsers.map(u => (
                          <button type="button" key={u.userId} onClick={() => setSelectedPaymentUserId(u.userId)}
                            className={`w-full text-left px-4 py-2 text-[9px] uppercase tracking-widest transition-all border ${selectedPaymentUserId === u.userId ? 'border-[#c19a6b] text-white bg-[#c19a6b]/10' : 'border-[#ffffff10] text-[#555] hover:border-[#ffffff20]'}`}>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="submit" disabled={isProcessing || !amount}
                    className="w-full h-16 border border-[#c19a6b] text-white hover:bg-[#c19a6b] hover:text-black text-[10px] font-bold uppercase tracking-[0.5em] transition-all duration-300 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4 group">
                    {isProcessing ? 'Enviando ao SQS...' : 'Criar Pagamento'}
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-2" />
                  </button>
                </form>
              </div>

              <div className="col-span-7 flex flex-col justify-end border-l border-[#ffffff10] pl-16">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-10">02 / Volume por Transação</h3>
                <div className="h-64 opacity-80 filter grayscale hover:grayscale-0 transition-all duration-500">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payments.slice(0, 15)}>
                      <XAxis hide dataKey="processId" />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #c19a6b30', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                      <Bar dataKey="amount">
                        {payments.slice(0, 15).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.status === 'completed' ? '#c19a6b' : entry.status === 'failed' ? '#f43f5e' : '#333'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="pt-20 border-t border-[#ffffff10]">
              <div className="flex justify-between items-baseline mb-12">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">03 / Logs do Sistema</h3>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-[#c19a6b] rounded-full animate-ping" />
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Polling 3s · DynamoDB</span>
                </div>
              </div>
              <div className="divide-y divide-[#ffffff10]">
                {payments.slice(0, 10).map(payment => (
                  <motion.div key={payment.processId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-8 grid grid-cols-12 items-center hover:bg-white/[0.02] transition-colors px-4 -mx-4 group">
                    <div className="col-span-3"><p className="text-[10px] font-mono text-[#555] uppercase tracking-widest group-hover:text-[#c19a6b] transition-colors">{payment.processId}</p></div>
                    <div className="col-span-2"><span className={`text-[9px] uppercase tracking-[0.3em] font-black ${statusColor(payment.status)}`}>{payment.status}</span></div>
                    <div className="col-span-2 text-[10px] text-[#666] uppercase tracking-widest">{payment.userName}</div>
                    <div className="col-span-2 font-serif italic text-xl text-white">R$ {payment.amount.toFixed(2)}</div>
                    <div className="col-span-3 text-right"><span className="text-[10px] font-mono text-[#444] uppercase">{format(new Date(payment.createdAt), 'HH:mm:ss.SSS')}</span></div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div className="space-y-20">
            <div className="grid grid-cols-12 gap-16">
              <div className="col-span-5">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-6">01 / Cadastrar Usuário</h3>
                <p className="text-xs text-[#888] leading-relaxed mb-10 max-w-xs">
                  Cria um usuário com senha via API Gateway → Lambda → DynamoDB. O usuário pode fazer login no painel.
                </p>
                <form onSubmit={handleCreateUser} className="space-y-7">
                  {[
                    { label: 'Nome Completo', value: newUserName, setter: setNewUserName, type: 'text', placeholder: 'João Silva' },
                    { label: 'Email', value: newUserEmail, setter: setNewUserEmail, type: 'email', placeholder: 'joao@exemplo.com' },
                    { label: 'Senha', value: newUserPassword, setter: setNewUserPassword, type: 'password', placeholder: '••••••••' },
                  ].map(field => (
                    <div key={field.label} className="group">
                      <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">{field.label}</label>
                      <input type={field.type} value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder}
                        className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-lg pb-3 focus:outline-none transition-all placeholder:text-[#333]" />
                    </div>
                  ))}
                  <button type="submit" disabled={isCreatingUser || !newUserName || !newUserEmail || !newUserPassword}
                    className="w-full h-16 border border-[#c19a6b] text-white hover:bg-[#c19a6b] hover:text-black text-[10px] font-bold uppercase tracking-[0.5em] transition-all duration-300 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4">
                    {isCreatingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
                    <UserPlus size={14} />
                  </button>
                  {userSuccess && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="p-4 bg-[#c19a6b]/10 border border-[#c19a6b]/30 text-[#c19a6b] text-[10px] uppercase tracking-widest">
                      Usuário cadastrado. Já pode fazer login.
                    </motion.div>
                  )}
                </form>
              </div>

              <div className="col-span-7 border-l border-[#ffffff10] pl-16">
                <div className="flex justify-between items-baseline mb-10">
                  <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">02 / Usuários Registrados</h3>
                  <span className="text-[10px] font-mono text-[#c19a6b]">{appUsers.length} total</span>
                </div>
                <div className="divide-y divide-[#ffffff10]">
                  {appUsers.length === 0 && <p className="text-[#555] text-xs py-8">Nenhum usuário cadastrado ainda.</p>}
                  {appUsers.map(u => {
                    const up = payments.filter(p => p.userId === u.userId);
                    const uc = up.filter(p => p.status === 'completed').length;
                    return (
                      <motion.div key={u.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="py-8 grid grid-cols-12 items-center hover:bg-white/[0.02] transition-colors group">
                        <div className="col-span-1">
                          <div className="w-8 h-8 border border-[#ffffff15] flex items-center justify-center text-[10px] text-[#c19a6b] font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="col-span-5">
                          <p className="text-white text-[10px] font-bold uppercase tracking-widest">{u.name}</p>
                          <p className="text-[#555] text-[9px] mt-1 font-mono">{u.email}</p>
                        </div>
                        <div className="col-span-3 text-[#888] text-[9px] uppercase tracking-widest">{format(new Date(u.createdAt), 'dd/MM/yyyy')}</div>
                        <div className="col-span-3 text-right"><span className="text-[10px] font-mono text-[#c19a6b]">{uc}/{up.length} pagtos</span></div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {activeTab === 'transactions' && (
          <div className="space-y-12">
            <div className="flex items-center justify-between border-b border-[#ffffff10] pb-12">
              <div>
                <span className="text-[10px] uppercase tracking-[0.4em] text-[#c19a6b]">Ledger Imutável</span>
                <p className="text-xs text-[#888] mt-2">{payments.length} transações · mostrando {filteredPayments.length}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {(['all', 'pending', 'processing', 'completed', 'failed'] as StatusFilter[]).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-4 py-2 text-[9px] uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-[#c19a6b] text-black font-bold' : 'border border-[#ffffff10] text-[#888] hover:border-[#c19a6b] hover:text-white'}`}>
                    {s === 'all' ? 'Todos' : s}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-[#ffffff10]">
              {filteredPayments.length === 0 && <p className="text-[#555] text-xs py-8">Nenhuma transação com status "{statusFilter}".</p>}
              {filteredPayments.map(p => (
                <motion.div key={p.processId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-8 grid grid-cols-12 items-center group cursor-default hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-1 text-[10px] font-mono text-[#333] group-hover:text-[#c19a6b] transition-colors">#{p.processId.slice(-4)}</div>
                  <div className="col-span-3">
                    <p className="text-white text-[10px] font-bold uppercase tracking-widest">{p.userName}</p>
                    <p className="text-[#333] text-[9px] mt-1 font-mono">{p.processId}</p>
                  </div>
                  <div className="col-span-2 text-2xl font-serif italic text-[#c19a6b]">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <div className="col-span-3">
                    <div className="flex gap-1 h-1 w-24 bg-[#111] rounded-full overflow-hidden mb-2">
                      <div className={`h-full transition-all duration-1000 ${p.status === 'completed' ? 'w-full bg-[#c19a6b]' : p.status === 'failed' ? 'w-full bg-rose-500' : 'w-1/3 animate-pulse bg-[#888]'}`} />
                    </div>
                    <span className={`text-[9px] uppercase tracking-[0.2em] italic ${statusColor(p.status)}`}>{p.status}</span>
                    {p.error && <p className="text-[9px] text-rose-400/60 mt-1 font-mono">{p.error}</p>}
                  </div>
                  <div className="col-span-3 text-right text-[10px] font-mono text-[#333]">{format(new Date(p.createdAt), 'dd/MM HH:mm:ss')}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── ARCHITECTURE ── */}
        {activeTab === 'architecture' && (
          <div className="space-y-24 animate-in fade-in duration-500">
            <div className="max-w-3xl">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-[#c19a6b] mb-6">Visão Geral</h3>
              <p className="text-[#888] leading-loose text-sm mb-4">
                Plataforma MVP de meios de pagamento 100% serverless na AWS. Autenticação via email/senha com hash SHA-256 — admin hardcoded, usuários no DynamoDB. Frontend React consome HTTP API (API Gateway) que delega para Lambdas Node.js 22.x.
              </p>
              <p className="text-[#666] leading-loose text-sm">
                Processamento assíncrono via SQS: o Lambda createPayment publica na fila e retorna 202 imediatamente. O Lambda Worker consome a fila e atualiza o DynamoDB. Frontend faz polling a cada 3 segundos.
              </p>
            </div>

            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">01 / Fluxo de Dados</h3>
              <div className="flex items-start gap-0 overflow-x-auto pb-4">
                {[
                  { label: 'Browser', sublabel: 'React + fetch()', color: '#c19a6b', desc: 'Polling 3s' },
                  { label: 'API Gateway', sublabel: 'HTTP API', color: '#888', desc: 'CORS + Routes' },
                  { label: 'Lambda createPayment', sublabel: 'POST /payments', color: '#60a5fa', desc: 'DynamoDB + SQS' },
                  { label: 'SQS', sublabel: 'cloudpay-payments', color: '#a78bfa', desc: 'Fila assíncrona' },
                  { label: 'Lambda Worker', sublabel: 'SQS Trigger', color: '#a78bfa', desc: 'Processa pagamento' },
                  { label: 'DynamoDB', sublabel: 'cloudpay-payments', color: '#c19a6b', desc: 'Persistência NoSQL' },
                ].map((node, i, arr) => (
                  <div key={i} className="flex items-center flex-shrink-0">
                    <div className="w-36 p-4 border border-[#ffffff10] bg-[#0d0d0f] text-center hover:border-[#c19a6b]/50 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: node.color }}>{node.label}</div>
                      <div className="text-[8px] text-[#555] font-mono">{node.sublabel}</div>
                      <div className="text-[8px] text-[#444] mt-2">{node.desc}</div>
                    </div>
                    {i < arr.length - 1 && <div className="flex items-center mx-1 text-[#333]"><div className="w-4 h-px bg-[#ffffff20]" />→</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">02 / Stack Tecnológico</h3>
              <div className="grid grid-cols-3 gap-8">
                {[
                  { cat: 'Frontend', items: ['React 19', 'TypeScript', 'Vite 6', 'Tailwind CSS 4', 'Recharts', 'Motion'] },
                  { cat: 'AWS Cloud', items: ['API Gateway HTTP API', 'Lambda Node.js 22.x', 'SQS Standard Queue', 'DynamoDB', 'IAM Roles', 'S3 Static Hosting'] },
                  { cat: 'Padrões', items: ['Event-Driven Architecture', 'Async Queue Processing', 'Serverless Functions', 'Producer/Consumer', 'NoSQL Document Store', 'SHA-256 Auth'] },
                ].map((col, i) => (
                  <div key={i}>
                    <h4 className="text-[9px] uppercase tracking-widest text-[#c19a6b] mb-4">{col.cat}</h4>
                    <ul className="space-y-2">
                      {col.items.map(item => (
                        <li key={item} className="text-[11px] text-[#666] flex items-center gap-2">
                          <span className="w-1 h-1 bg-[#c19a6b] inline-block shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 w-80 p-12 text-[9px] uppercase tracking-[0.4em] text-[#333] border-t border-[#ffffff05] pointer-events-none">
        CloudPay MVP v3.0 · AWS
      </footer>
    </div>
  );
}
