import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import {
  LayoutDashboard, CreditCard, Users, Activity,
  ArrowRight, Database, Clock, UserPlus, Layers, GitBranch
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { format } from 'date-fns';

import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import {
  createPaymentRequest, startSimulatedWorker, createUser,
  Payment, AppUser, QueueItem
} from './services/paymentService';

type Tab = 'dashboard' | 'users' | 'transactions' | 'architecture';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';
type WorkerStatus = 'idle' | 'processing';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>('idle');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [amount, setAmount] = useState('');
  const [selectedPaymentUserId, setSelectedPaymentUserId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userSuccess, setUserSuccess] = useState(false);

  const metrics = useMemo(() => {
    const finished = payments.filter(p => p.status === 'completed' || p.status === 'failed');
    const completed = payments.filter(p => p.status === 'completed');
    const failed = payments.filter(p => p.status === 'failed');
    const successRate = finished.length > 0 ? (completed.length / finished.length * 100) : 0;
    const totalVolume = completed.reduce((sum, p) => sum + p.amount, 0);
    return { completed: completed.length, failed: failed.length, successRate, totalVolume };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    return payments.filter(p => p.status === statusFilter);
  }, [payments, statusFilter]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-[#c19a6b]';
      case 'processing': return 'text-blue-400 animate-pulse';
      case 'failed': return 'text-rose-400';
      default: return 'text-amber-500';
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/popup-blocked' || e.message?.includes('popup-blocked')) {
        setAuthError('Pop-up bloqueado pelo navegador. Habilite pop-ups ou abra em nova aba.');
      } else if (e.code === 'auth/cancelled-popup-request' || e.message?.includes('closed-by-user')) {
        setAuthError('Autenticação cancelada. Tente novamente.');
      } else {
        setAuthError(e.message || 'Erro inesperado. Tente abrir em modo externo.');
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const stopWorker = startSimulatedWorker((status) => setWorkerStatus(status));

    const qPayments = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(50));
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });

    const qQueue = query(collection(db, 'queue'), orderBy('createdAt', 'asc'));
    const unsubQueue = onSnapshot(qQueue, (snap) => {
      setQueueItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as QueueItem)));
    });

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setAppUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    });

    return () => {
      stopWorker();
      unsubPayments();
      unsubQueue();
      unsubUsers();
    };
  }, [user]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;
    setIsProcessing(true);
    try {
      const selectedUser = selectedPaymentUserId
        ? appUsers.find(u => u.id === selectedPaymentUserId)
        : null;
      const uid = selectedUser?.id || user.uid;
      const uname = selectedUser?.name || user.displayName || 'Anonymous';
      await createPaymentRequest(uid, uname, parseFloat(amount));
      setAmount('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    setIsCreatingUser(true);
    try {
      await createUser(newUserName, newUserEmail);
      setNewUserName('');
      setNewUserEmail('');
      setUserSuccess(true);
      setTimeout(() => setUserSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-[#c19a6b] animate-spin" />
          <p className="text-[#888] font-mono text-[10px] tracking-widest uppercase">System Initialization</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] overflow-hidden relative">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-[#c19a6b]/5 rounded-full blur-[120px]" />
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
          className="w-full max-w-xl p-16 relative z-10"
        >
          <div className="flex flex-col">
            <div className="mb-12">
              <div className="w-10 h-10 border border-[#c19a6b] flex items-center justify-center rotate-45 mb-6">
                <span className="-rotate-45 text-[10px] font-bold text-[#c19a6b]">CP</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.4em] text-[#c19a6b]">CloudPay — Plataforma de Pagamentos</span>
            </div>
            <h1 className="text-[72px] leading-[0.9] font-serif italic text-white mb-8 tracking-tight">
              Escalável.<br /><span className="text-[#c19a6b] not-italic">Assíncrono.</span>
            </h1>
            <p className="max-w-sm text-[#888] leading-relaxed text-sm mb-12">
              MVP de meios de pagamento com arquitetura distribuída em nuvem — processamento assíncrono via SQS + Lambda, persistência NoSQL e painel operacional em tempo real.
            </p>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleLogin}
                className="w-fit py-4 px-12 border border-[#ffffff15] hover:border-[#c19a6b] text-white font-medium text-xs uppercase tracking-widest transition-all hover:bg-[#c19a6b] hover:text-black active:scale-95"
              >
                Autenticar
              </button>
              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="w-fit py-2 text-[#888] hover:text-[#c19a6b] text-[10px] uppercase tracking-widest transition-all font-mono flex items-center gap-2"
              >
                <span>↗</span> Abrir em nova aba
              </button>
            </div>
            {authError && (
              <div className="mt-8 p-5 bg-rose-950/20 border border-rose-950 text-rose-200 text-xs font-mono leading-relaxed max-w-md">
                <span className="text-rose-400 font-bold uppercase tracking-widest block mb-2">[Security Notice]</span>
                {authError}
              </div>
            )}
            <div className="mt-16 flex gap-8 items-center pt-8 border-t border-[#ffffff10]">
              <span className="text-[9px] uppercase tracking-widest text-[#555]">Stack: Firebase + React + TypeScript</span>
              <span className="text-[9px] uppercase tracking-widest text-[#555]">Região: US-EAST-1</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'users',     icon: Users,           label: 'Usuários' },
    { id: 'transactions', icon: CreditCard,   label: 'Transações' },
    { id: 'architecture', icon: Layers,       label: 'Arquitetura' },
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
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-4 text-[10px] uppercase tracking-[0.25em] transition-all duration-500 py-2 group ${
                activeTab === item.id ? 'text-white' : 'text-[#888] hover:text-[#e0e0e0]'
              }`}
            >
              <div className={`w-[2px] h-4 transition-all duration-500 mr-2 ${activeTab === item.id ? 'bg-[#c19a6b]' : 'bg-transparent group-hover:bg-[#ffffff10]'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Worker Status */}
        <div className="mb-8 p-4 border border-[#ffffff10] bg-[#0d0d0f]">
          <div className="text-[9px] uppercase tracking-widest text-[#555] mb-2">Lambda Worker</div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${workerStatus === 'processing' ? 'bg-blue-400 animate-pulse' : 'bg-[#c19a6b]'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-widest ${workerStatus === 'processing' ? 'text-blue-400' : 'text-[#c19a6b]'}`}>
              {workerStatus === 'processing' ? 'Processando' : 'Aguardando'}
            </span>
          </div>
        </div>

        <div className="border-t border-[#ffffff10] pt-8">
          <div className="flex items-center gap-4 mb-8">
            <img
              src={user.photoURL || ''}
              alt={user.displayName || ''}
              className="w-8 h-8 rounded-full border border-[#ffffff15]"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-white text-[10px] font-bold uppercase tracking-widest leading-none">{user.displayName}</p>
              <p className="text-[#555] text-[9px] uppercase tracking-widest mt-1">Admin</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-[#888] hover:text-white transition-colors text-[9px] uppercase tracking-[0.3em]"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-80 p-20 max-w-[1400px]">
        <header className="mb-20 flex justify-between items-end">
          <div>
            <div className="mb-4">
              <span className="text-[10px] uppercase tracking-[0.25em] px-3 py-1 border border-[#ffffff10] text-[#c19a6b]">
                {activeTab === 'dashboard'    && 'Sistema Operacional'}
                {activeTab === 'users'        && 'Gestão de Usuários'}
                {activeTab === 'transactions' && 'Ledger Imutável'}
                {activeTab === 'architecture' && 'Documentação Técnica'}
              </span>
            </div>
            <h2 className="text-[56px] leading-[1] font-serif italic text-white tracking-tight">
              {activeTab === 'dashboard'    && 'Dashboard.'}
              {activeTab === 'users'        && 'Usuários.'}
              {activeTab === 'transactions' && 'Transações.'}
              {activeTab === 'architecture' && 'Arquitetura.'}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#888] mb-1">Fila SQS</div>
            <div className="font-mono text-[#c19a6b] text-sm tracking-tighter">
              {queueItems.length > 0
                ? `${queueItems.length} msg pendente${queueItems.length > 1 ? 's' : ''}`
                : 'Vazia — OPTIMAL'}
            </div>
          </div>
        </header>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-20">
            {/* Real Metrics */}
            <div className="grid grid-cols-4 gap-12 border-b border-[#ffffff10] pb-16">
              {[
                { label: 'Transações Concluídas', value: metrics.completed },
                { label: 'Transações Falhas',     value: metrics.failed },
                { label: 'Taxa de Sucesso',        value: `${metrics.successRate.toFixed(1)}%` },
                { label: 'Volume Processado',      value: `R$ ${metrics.totalVolume.toFixed(0)}` },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                  className="flex flex-col gap-4 group"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase tracking-widest text-[#888]">{stat.label}</span>
                    <span className="font-serif text-[#c19a6b] text-2xl italic group-hover:scale-110 transition-transform cursor-default">
                      {stat.value}
                    </span>
                  </div>
                  <div className="h-px w-full bg-[#ffffff10]">
                    <div className="h-full bg-[#c19a6b] w-full" />
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-16">
              {/* Payment Form */}
              <div className="col-span-5">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-6">01 / Nova Transação</h3>
                <p className="text-xs text-[#888] leading-relaxed mb-8 max-w-xs">
                  Disparo assíncrono via fila SQS — a requisição é enfileirada e o worker Lambda processa independentemente.
                </p>
                <form onSubmit={handleCreatePayment} className="space-y-8">
                  <div className="group">
                    <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                      Valor (BRL)
                    </label>
                    <div className="flex items-baseline gap-4 border-b border-[#ffffff15] focus-within:border-[#c19a6b] transition-all pb-4">
                      <span className="text-2xl font-serif italic text-[#c19a6b]">R$</span>
                      <input
                        type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent w-full text-4xl font-serif italic text-white placeholder:text-[#222] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* User Selector */}
                  {appUsers.length > 0 && (
                    <div>
                      <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3">
                        Pagar em nome de
                      </label>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentUserId('')}
                          className={`w-full text-left px-4 py-2 text-[9px] uppercase tracking-widest transition-all border ${
                            !selectedPaymentUserId
                              ? 'border-[#c19a6b] text-white bg-[#c19a6b]/10'
                              : 'border-[#ffffff10] text-[#555] hover:border-[#ffffff20]'
                          }`}
                        >
                          {user.displayName} (Admin)
                        </button>
                        {appUsers.map(u => (
                          <button
                            type="button" key={u.id}
                            onClick={() => setSelectedPaymentUserId(u.id || '')}
                            className={`w-full text-left px-4 py-2 text-[9px] uppercase tracking-widest transition-all border ${
                              selectedPaymentUserId === u.id
                                ? 'border-[#c19a6b] text-white bg-[#c19a6b]/10'
                                : 'border-[#ffffff10] text-[#555] hover:border-[#ffffff20]'
                            }`}
                          >
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit" disabled={isProcessing || !amount}
                    className="w-full h-16 border border-[#c19a6b] text-white hover:bg-[#c19a6b] hover:text-black text-[10px] font-bold uppercase tracking-[0.5em] transition-all duration-300 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4 group"
                  >
                    {isProcessing ? 'Enfileirando...' : 'Criar Pagamento'}
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-2" />
                  </button>
                </form>
              </div>

              {/* Chart */}
              <div className="col-span-7 flex flex-col justify-end border-l border-[#ffffff10] pl-16">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-10">02 / Volume por Transação</h3>
                <div className="h-64 opacity-80 filter grayscale hover:grayscale-0 transition-all duration-500">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payments.slice(0, 15)}>
                      <XAxis hide dataKey="processId" />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #c19a6b30', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                      />
                      <Bar dataKey="amount" radius={[0, 0, 0, 0]}>
                        {payments.slice(0, 15).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.status === 'completed' ? '#c19a6b' :
                            entry.status === 'failed'    ? '#f43f5e' : '#333'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-4">
                  <span className="flex items-center gap-2 text-[9px] text-[#555] uppercase tracking-widest">
                    <span className="w-2 h-2 bg-[#c19a6b] inline-block" /> Concluído
                  </span>
                  <span className="flex items-center gap-2 text-[9px] text-[#555] uppercase tracking-widest">
                    <span className="w-2 h-2 bg-rose-500 inline-block" /> Falhou
                  </span>
                  <span className="flex items-center gap-2 text-[9px] text-[#555] uppercase tracking-widest">
                    <span className="w-2 h-2 bg-[#333] inline-block" /> Processando
                  </span>
                </div>
              </div>
            </div>

            {/* Queue Items (SQS visualization) */}
            {queueItems.length > 0 && (
              <div className="pt-20 border-t border-[#ffffff10]">
                <div className="flex justify-between items-baseline mb-12">
                  <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">03 / Mensagens na Fila SQS</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping" />
                    <span className="text-[10px] uppercase tracking-widest text-blue-400">
                      {queueItems.length} aguardando processamento
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-[#ffffff10]">
                  {queueItems.map((item) => (
                    <motion.div
                      key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="py-6 grid grid-cols-12 items-center"
                    >
                      <div className="col-span-4 text-[10px] font-mono text-blue-400 uppercase">{item.processId}</div>
                      <div className="col-span-3 text-[10px] text-[#888] uppercase tracking-widest">{item.userName}</div>
                      <div className="col-span-3 font-serif italic text-lg text-white">R$ {item.amount?.toFixed(2)}</div>
                      <div className="col-span-2 text-right">
                        <span className="text-[9px] uppercase tracking-widest text-amber-400 animate-pulse">Aguardando</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* System Logs */}
            <div className="pt-20 border-t border-[#ffffff10]">
              <div className="flex justify-between items-baseline mb-12">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">
                  {queueItems.length > 0 ? '04' : '03'} / Logs do Sistema
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-[#c19a6b] rounded-full animate-ping" />
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Real-time Telemetry Active</span>
                </div>
              </div>
              <div className="divide-y divide-[#ffffff10]">
                {payments.slice(0, 10).map((payment) => (
                  <motion.div
                    key={payment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-8 grid grid-cols-12 items-center hover:bg-white/[0.02] transition-colors px-4 -mx-4 group"
                  >
                    <div className="col-span-4">
                      <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest group-hover:text-[#c19a6b] transition-colors">
                        {payment.processId}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[9px] uppercase tracking-[0.3em] font-black ${statusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </div>
                    <div className="col-span-3 font-serif italic text-xl text-white">
                      R$ {payment.amount.toFixed(2)}
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-[10px] font-mono text-[#444] uppercase">
                        {format(payment.createdAt?.toDate() || new Date(), 'HH:mm:ss.SSS')}
                      </span>
                    </div>
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
              {/* Registration Form */}
              <div className="col-span-5">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-6">01 / Cadastrar Usuário</h3>
                <p className="text-xs text-[#888] leading-relaxed mb-10 max-w-xs">
                  Registra um novo usuário na plataforma. Os dados são persistidos no Firestore (equivalente ao DynamoDB) e ficam disponíveis para associar a pagamentos.
                </p>
                <form onSubmit={handleCreateUser} className="space-y-8">
                  <div className="group">
                    <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                      Nome Completo
                    </label>
                    <input
                      type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="João Silva"
                      className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-lg pb-3 focus:outline-none transition-all placeholder:text-[#333]"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                      Email
                    </label>
                    <input
                      type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="joao@exemplo.com"
                      className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-lg pb-3 focus:outline-none transition-all placeholder:text-[#333]"
                    />
                  </div>
                  <button
                    type="submit" disabled={isCreatingUser || !newUserName || !newUserEmail}
                    className="w-full h-16 border border-[#c19a6b] text-white hover:bg-[#c19a6b] hover:text-black text-[10px] font-bold uppercase tracking-[0.5em] transition-all duration-300 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4"
                  >
                    {isCreatingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
                    <UserPlus size={14} />
                  </button>
                  {userSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="p-4 bg-[#c19a6b]/10 border border-[#c19a6b]/30 text-[#c19a6b] text-[10px] uppercase tracking-widest"
                    >
                      Usuário cadastrado com sucesso.
                    </motion.div>
                  )}
                </form>
              </div>

              {/* Users List */}
              <div className="col-span-7 border-l border-[#ffffff10] pl-16">
                <div className="flex justify-between items-baseline mb-10">
                  <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">02 / Usuários Registrados</h3>
                  <span className="text-[10px] font-mono text-[#c19a6b]">{appUsers.length} total</span>
                </div>
                <div className="divide-y divide-[#ffffff10]">
                  {appUsers.length === 0 && (
                    <p className="text-[#555] text-xs py-8">Nenhum usuário cadastrado ainda. Use o formulário ao lado.</p>
                  )}
                  {appUsers.map((u) => {
                    const userPayments = payments.filter(p => p.userId === u.id);
                    const userCompleted = userPayments.filter(p => p.status === 'completed').length;
                    return (
                      <motion.div
                        key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="py-8 grid grid-cols-12 items-center hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="col-span-1">
                          <div className="w-8 h-8 border border-[#ffffff15] flex items-center justify-center text-[10px] text-[#c19a6b] font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="col-span-5">
                          <p className="text-white text-[10px] font-bold uppercase tracking-widest">{u.name}</p>
                          <p className="text-[#555] text-[9px] mt-1 font-mono">{u.email}</p>
                        </div>
                        <div className="col-span-3 text-[#888] text-[9px] uppercase tracking-widest">
                          {u.createdAt ? format(u.createdAt.toDate(), 'dd/MM/yyyy') : '—'}
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-[10px] font-mono text-[#c19a6b]">
                            {userCompleted}/{userPayments.length} pagtos
                          </span>
                        </div>
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
                {(['all', 'pending', 'processing', 'completed', 'failed'] as StatusFilter[]).map((s) => (
                  <button
                    key={s} onClick={() => setStatusFilter(s)}
                    className={`px-4 py-2 text-[9px] uppercase tracking-widest transition-all ${
                      statusFilter === s
                        ? 'bg-[#c19a6b] text-black font-bold'
                        : 'border border-[#ffffff10] text-[#888] hover:border-[#c19a6b] hover:text-white'
                    }`}
                  >
                    {s === 'all' ? 'Todos' : s}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#ffffff10]">
              {filteredPayments.length === 0 && (
                <p className="text-[#555] text-xs py-8">Nenhuma transação com status "{statusFilter}".</p>
              )}
              {filteredPayments.map((p) => (
                <motion.div
                  key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-8 grid grid-cols-12 items-center group cursor-default hover:bg-white/[0.02] transition-colors"
                >
                  <div className="col-span-1 text-[10px] font-mono text-[#333] group-hover:text-[#c19a6b] transition-colors">
                    #{p.processId.slice(-4)}
                  </div>
                  <div className="col-span-3">
                    <p className="text-white text-[10px] font-bold uppercase tracking-widest">{p.userName}</p>
                    <p className="text-[#333] text-[9px] mt-1 font-mono">{p.processId}</p>
                  </div>
                  <div className="col-span-3 text-2xl font-serif italic text-[#c19a6b]">
                    {p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div className="col-span-3">
                    <div className="flex gap-1 h-1 w-24 bg-[#111] rounded-full overflow-hidden mb-2">
                      <div className={`h-full transition-all duration-1000 ${
                        p.status === 'completed' ? 'w-full bg-[#c19a6b]' :
                        p.status === 'failed'    ? 'w-full bg-rose-500' :
                        'w-1/3 animate-pulse bg-[#888]'
                      }`} />
                    </div>
                    <span className={`text-[9px] uppercase tracking-[0.2em] italic ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                    {p.error && (
                      <p className="text-[9px] text-rose-400/60 mt-1 font-mono">{p.error}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-[10px] font-mono text-[#333]">
                    {format(p.createdAt?.toDate() || new Date(), 'dd/MM HH:mm:ss')}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── ARCHITECTURE ── */}
        {activeTab === 'architecture' && (
          <div className="space-y-24 animate-in fade-in duration-500">
            {/* Overview */}
            <div className="max-w-3xl">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-[#c19a6b] mb-6">Visão Geral</h3>
              <p className="text-[#888] leading-loose text-sm mb-4">
                Plataforma MVP de meios de pagamento com arquitetura orientada a eventos, processamento assíncrono e armazenamento distribuído.
                A solução simula padrões AWS usando Firebase como infraestrutura gerenciada, mantendo total fidelidade conceitual com a arquitetura de referência.
              </p>
              <p className="text-[#666] leading-loose text-sm">
                O foco está em desacoplamento de componentes, resiliência via fila e observabilidade em tempo real — princípios centrais de sistemas de pagamento em produção.
              </p>
            </div>

            {/* Data Flow */}
            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">01 / Fluxo de Dados</h3>
              <div className="flex items-start gap-0 overflow-x-auto pb-4">
                {[
                  { label: 'Browser',        sublabel: '≈ Client App',     color: '#c19a6b', desc: 'React + TypeScript' },
                  { label: 'Firebase Auth',  sublabel: '≈ AWS Cognito',    color: '#888',    desc: 'Google OAuth 2.0' },
                  { label: 'Collection Queue', sublabel: '≈ AWS SQS',      color: '#60a5fa', desc: 'Fila assíncrona' },
                  { label: 'Lambda Worker',  sublabel: 'onSnapshot trigger', color: '#a78bfa', desc: 'Processamento' },
                  { label: 'Collection Payments', sublabel: '≈ DynamoDB',  color: '#c19a6b', desc: 'Persistência NoSQL' },
                  { label: 'Dashboard',      sublabel: '≈ CloudWatch',     color: '#34d399', desc: 'Observabilidade' },
                ].map((node, i, arr) => (
                  <div key={i} className="flex items-center flex-shrink-0">
                    <div className="w-36 p-4 border border-[#ffffff10] bg-[#0d0d0f] text-center hover:border-[#c19a6b]/50 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: node.color }}>{node.label}</div>
                      <div className="text-[8px] text-[#555] font-mono">{node.sublabel}</div>
                      <div className="text-[8px] text-[#444] mt-2">{node.desc}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex items-center mx-1 text-[#333]">
                        <div className="w-4 h-px bg-[#ffffff20]" />
                        →
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Services & Rationale */}
            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">02 / Serviços e Justificativas Técnicas</h3>
              <div className="grid grid-cols-2 gap-px bg-[#ffffff10] border border-[#ffffff10]">
                {[
                  {
                    aws: 'AWS SQS', impl: 'Firestore /queue',
                    why: 'Desacopla a recepção do pagamento do seu processamento efetivo. A API retorna imediatamente após enfileirar, sem bloquear na resposta do worker. Permite absorver picos de carga sem degradação e garante que nenhuma mensagem seja perdida em caso de falha do consumidor.',
                    trade: 'Firestore não garante FIFO estrito sem índice composto — para o MVP é aceitável.'
                  },
                  {
                    aws: 'AWS Lambda', impl: 'startSimulatedWorker()',
                    why: 'Worker stateless que reage a eventos da fila via onSnapshot. Simula o modelo SQS→Lambda: processa independentemente da camada de API, atualiza status com latência simulada de 2s e implementa taxa de falha de 20% para demonstrar resiliência.',
                    trade: 'Sem escalabilidade horizontal real — instância única no browser. Produção usaria Lambda concorrente.'
                  },
                  {
                    aws: 'DynamoDB', impl: 'Firestore /payments',
                    why: 'NoSQL com schema flexível ideal para dados de transação que evoluem com o negócio. Suporta alta taxa de escrita, consultas por processId via índice composto e atualizações atômicas de status. Real-time via onSnapshot elimina polling.',
                    trade: 'Sem transações ACID nativas — para MVP sem reversão financeira real, aceitável.'
                  },
                  {
                    aws: 'API Gateway', impl: 'Firebase SDK direto',
                    why: 'O SDK do Firebase substitui um gateway HTTP convencional, provendo autenticação, roteamento e serialização automaticamente via Firestore Security Rules. Reduz complexidade operacional do MVP.',
                    trade: 'Em produção, API Gateway adicionaria rate limiting, caching e contract versioning.'
                  },
                  {
                    aws: 'AWS Cognito', impl: 'Firebase Authentication',
                    why: 'Gerencia identidade com Google OAuth 2.0. Tokens JWT validados automaticamente pelo Firestore Security Rules — sem implementar lógica de autenticação manual. Separa autenticação de autorização.',
                    trade: 'Apenas Google como IdP — produto real precisaria múltiplos providers e MFA.'
                  },
                  {
                    aws: 'CloudWatch', impl: 'Dashboard em tempo real',
                    why: 'Métricas calculadas dinamicamente (taxa de sucesso, volume total, falhas, status do worker) via onSnapshot. Observabilidade end-to-end sem infraestrutura adicional. Logs de transação visíveis em tempo real.',
                    trade: 'Sem alertas automáticos ou retenção de histórico além de 50 transações carregadas.'
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-[#0a0a0c] p-8 hover:bg-[#c19a6b]/5 transition-colors">
                    <div className="text-[10px] uppercase tracking-widest text-[#c19a6b] mb-1">Node.0{i + 1}</div>
                    <h4 className="text-lg font-serif italic text-white mb-1">{item.aws}</h4>
                    <p className="text-[9px] font-mono text-[#555] uppercase tracking-widest mb-4">{item.impl}</p>
                    <p className="text-[11px] text-[#888] leading-relaxed mb-3">{item.why}</p>
                    <p className="text-[10px] text-rose-400/60 leading-relaxed font-mono">⚠ Trade-off: {item.trade}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System Layers */}
            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">03 / Camadas do Sistema</h3>
              <div className="space-y-0">
                {[
                  {
                    name: 'Camada de Entrada',
                    desc: 'Firebase SDK + React Forms — recebe requisições, valida inputs e chama a camada de serviço. Responsável por autenticação e autorização via JWT.',
                    icon: GitBranch
                  },
                  {
                    name: 'Camada de Aplicação',
                    desc: 'paymentService.ts + App.tsx — lógica de negócio encapsulada em funções de serviço com responsabilidade única. Separa handlers de UI da lógica de domínio.',
                    icon: Layers
                  },
                  {
                    name: 'Camada Assíncrona',
                    desc: 'Firestore /queue + startSimulatedWorker() — desacopla recepção de processamento via padrão event-driven. Worker escuta a fila e processa independentemente com taxa de falha simulada.',
                    icon: Activity
                  },
                  {
                    name: 'Camada de Persistência',
                    desc: 'Firestore /payments + /users + /queue — collections com schema documentado em firebase-blueprint.json, regras de segurança por role em firestore.rules.',
                    icon: Database
                  },
                  {
                    name: 'Camada de Observabilidade',
                    desc: 'Dashboard em tempo real com métricas calculadas (taxa de sucesso, volume, falhas), logs de transação, status do worker Lambda e visualização da fila SQS.',
                    icon: Clock
                  },
                ].map((layer, i) => (
                  <div key={i} className="flex items-start gap-8 py-6 border-b border-[#ffffff10]">
                    <span className="text-[10px] font-mono text-[#c19a6b] uppercase tracking-widest shrink-0 w-8 pt-1">0{i + 1}</span>
                    <div>
                      <h4 className="text-sm text-white font-bold uppercase tracking-wider mb-2">{layer.name}</h4>
                      <p className="text-[11px] text-[#666] leading-relaxed">{layer.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">04 / Stack Tecnológico</h3>
              <div className="grid grid-cols-3 gap-8">
                {[
                  { cat: 'Frontend', items: ['React 19', 'TypeScript', 'Vite 6', 'Tailwind CSS 4', 'Recharts', 'Motion'] },
                  { cat: 'Backend / Nuvem', items: ['Firebase Firestore', 'Firebase Auth', 'Google OAuth 2.0', 'Firestore Security Rules'] },
                  { cat: 'Padrões Arquiteturais', items: ['Event-Driven Architecture', 'Async Queue Processing', 'Real-time Subscriptions', 'Serverless Functions', 'NoSQL Document Store'] },
                ].map((col, i) => (
                  <div key={i}>
                    <h4 className="text-[9px] uppercase tracking-widest text-[#c19a6b] mb-4">{col.cat}</h4>
                    <ul className="space-y-2">
                      {col.items.map((item) => (
                        <li key={item} className="text-[11px] text-[#666] flex items-center gap-2">
                          <span className="w-1 h-1 bg-[#c19a6b] inline-block shrink-0" />
                          {item}
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
        CloudPay MVP v2.0
      </footer>
    </div>
  );
}
