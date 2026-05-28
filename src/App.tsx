import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import {
  LayoutDashboard, CreditCard, Users, Activity,
  ArrowRight, Database, Clock, UserPlus, Layers, GitBranch
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import {
  listPayments, listUsers, createPayment, createUser,
  type Payment, type AppUser,
} from './lib/api';

type Tab = 'dashboard' | 'users' | 'transactions' | 'architecture';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

export default function App() {
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('cloudpay_user'));
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [amount, setAmount] = useState('');
  const [selectedPaymentUserId, setSelectedPaymentUserId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
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

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    return payments.filter(p => p.status === statusFilter);
  }, [payments, statusFilter]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed':  return 'text-[#c19a6b]';
      case 'processing': return 'text-blue-400 animate-pulse';
      case 'failed':     return 'text-rose-400';
      default:           return 'text-amber-500';
    }
  };

  // Polling — substitui onSnapshot do Firebase
  useEffect(() => {
    if (!userName) { setLoading(false); return; }

    let cancelled = false;
    const poll = async () => {
      try {
        const [pays, users] = await Promise.all([listPayments(), listUsers()]);
        if (!cancelled) {
          setPayments(pays.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          setAppUsers(users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userName]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('cloudpay_user', name);
    setUserName(name);
    setLoading(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('cloudpay_user');
    setUserName(null);
    setPayments([]);
    setAppUsers([]);
  };

  const handleCreatePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!userName || !amount) return;
    setIsProcessing(true);
    try {
      const selectedUser = selectedPaymentUserId ? appUsers.find(u => u.userId === selectedPaymentUserId) : null;
      const uid = selectedUser?.userId || 'admin';
      const uname = selectedUser?.name || userName;
      await createPayment(uid, uname, parseFloat(amount));
      setAmount('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
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

  if (loading && userName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-[#c19a6b] animate-spin" />
          <p className="text-[#888] font-mono text-[10px] tracking-widest uppercase">Connecting to AWS</p>
        </div>
      </div>
    );
  }

  if (!userName) {
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
              MVP de meios de pagamento com arquitetura distribuída em nuvem — processamento assíncrono via SQS + Lambda, persistência NoSQL no DynamoDB e painel operacional em tempo real.
            </p>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="group">
                <label className="block text-[9px] font-bold text-[#555] uppercase tracking-[0.3em] mb-3 group-focus-within:text-[#c19a6b] transition-colors">
                  Seu nome
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Ex: Lucas Kenji"
                  className="w-full bg-transparent border-b border-[#ffffff15] focus:border-[#c19a6b] text-white text-lg pb-3 focus:outline-none transition-all placeholder:text-[#333]"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-fit py-4 px-12 border border-[#ffffff15] hover:border-[#c19a6b] text-white font-medium text-xs uppercase tracking-widest transition-all hover:bg-[#c19a6b] hover:text-black active:scale-95 disabled:opacity-20 flex items-center gap-4"
              >
                Entrar
                <ArrowRight size={14} />
              </button>
            </form>
            <div className="mt-16 flex gap-8 items-center pt-8 border-t border-[#ffffff10]">
              <span className="text-[9px] uppercase tracking-widest text-[#555]">Stack: AWS SQS + Lambda + DynamoDB</span>
              <span className="text-[9px] uppercase tracking-widest text-[#555]">Região: US-EAST-2</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'users',        icon: Users,           label: 'Usuários' },
    { id: 'transactions', icon: CreditCard,       label: 'Transações' },
    { id: 'architecture', icon: Layers,           label: 'Arquitetura' },
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

        {/* Lambda Status */}
        <div className="mb-8 p-4 border border-[#ffffff10] bg-[#0d0d0f]">
          <div className="text-[9px] uppercase tracking-widest text-[#555] mb-2">Lambda Worker</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c19a6b]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#c19a6b]">AWS — Ativo</span>
          </div>
        </div>

        <div className="border-t border-[#ffffff10] pt-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-8 h-8 border border-[#ffffff15] flex items-center justify-center text-[10px] text-[#c19a6b] font-bold bg-[#0d0d0f]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-[10px] font-bold uppercase tracking-widest leading-none">{userName}</p>
              <p className="text-[#555] text-[9px] uppercase tracking-widest mt-1">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
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
              {pendingItems.length > 0
                ? `${pendingItems.length} msg pendente${pendingItems.length > 1 ? 's' : ''}`
                : 'Vazia — OPTIMAL'}
            </div>
          </div>
        </header>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-20">
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
                  Disparo assíncrono via SQS — a requisição é enviada ao API Gateway, o Lambda cria a mensagem na fila e o Worker Lambda processa independentemente.
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
                          {userName} (Admin)
                        </button>
                        {appUsers.map(u => (
                          <button
                            type="button" key={u.userId}
                            onClick={() => setSelectedPaymentUserId(u.userId)}
                            className={`w-full text-left px-4 py-2 text-[9px] uppercase tracking-widest transition-all border ${
                              selectedPaymentUserId === u.userId
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
                    {isProcessing ? 'Enviando ao SQS...' : 'Criar Pagamento'}
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
                    <span className="w-2 h-2 bg-[#333] inline-block" /> Pendente / Processando
                  </span>
                </div>
              </div>
            </div>

            {/* Pending SQS items */}
            {pendingItems.length > 0 && (
              <div className="pt-20 border-t border-[#ffffff10]">
                <div className="flex justify-between items-baseline mb-12">
                  <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">03 / Mensagens na Fila SQS</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping" />
                    <span className="text-[10px] uppercase tracking-widest text-blue-400">
                      {pendingItems.length} aguardando processamento
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-[#ffffff10]">
                  {pendingItems.map((item) => (
                    <motion.div
                      key={item.processId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
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

            {/* Logs */}
            <div className="pt-20 border-t border-[#ffffff10]">
              <div className="flex justify-between items-baseline mb-12">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">
                  {pendingItems.length > 0 ? '04' : '03'} / Logs do Sistema
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-[#c19a6b] rounded-full animate-ping" />
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Polling 3s · DynamoDB</span>
                </div>
              </div>
              <div className="divide-y divide-[#ffffff10]">
                {payments.slice(0, 10).map((payment) => (
                  <motion.div
                    key={payment.processId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
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
                        {format(new Date(payment.createdAt), 'HH:mm:ss.SSS')}
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
              <div className="col-span-5">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-6">01 / Cadastrar Usuário</h3>
                <p className="text-xs text-[#888] leading-relaxed mb-10 max-w-xs">
                  Registra um novo usuário via API Gateway → Lambda → DynamoDB. Os dados ficam disponíveis para associar a pagamentos.
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

              <div className="col-span-7 border-l border-[#ffffff10] pl-16">
                <div className="flex justify-between items-baseline mb-10">
                  <h3 className="text-[10px] uppercase tracking-[0.4em] text-white">02 / Usuários Registrados</h3>
                  <span className="text-[10px] font-mono text-[#c19a6b]">{appUsers.length} total</span>
                </div>
                <div className="divide-y divide-[#ffffff10]">
                  {appUsers.length === 0 && (
                    <p className="text-[#555] text-xs py-8">Nenhum usuário cadastrado ainda.</p>
                  )}
                  {appUsers.map((u) => {
                    const userPayments = payments.filter(p => p.userId === u.userId);
                    const userCompleted = userPayments.filter(p => p.status === 'completed').length;
                    return (
                      <motion.div
                        key={u.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
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
                          {format(new Date(u.createdAt), 'dd/MM/yyyy')}
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
                  key={p.processId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
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
                    {p.error && <p className="text-[9px] text-rose-400/60 mt-1 font-mono">{p.error}</p>}
                  </div>
                  <div className="col-span-2 text-right text-[10px] font-mono text-[#333]">
                    {format(new Date(p.createdAt), 'dd/MM HH:mm:ss')}
                  </div>
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
                Plataforma MVP de meios de pagamento com arquitetura orientada a eventos, 100% serverless na AWS.
                O frontend React consome uma HTTP API (API Gateway) que delega para funções Lambda.
                O processamento assíncrono ocorre via SQS — o Lambda Worker é acionado automaticamente pela fila.
              </p>
              <p className="text-[#666] leading-loose text-sm">
                Dados são persistidos no DynamoDB. O frontend faz polling a cada 3 segundos para refletir o estado
                em tempo real sem necessidade de WebSockets.
              </p>
            </div>

            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">01 / Fluxo de Dados</h3>
              <div className="flex items-start gap-0 overflow-x-auto pb-4">
                {[
                  { label: 'Browser',             sublabel: 'React + fetch()',     color: '#c19a6b', desc: 'Polling 3s' },
                  { label: 'API Gateway',          sublabel: 'HTTP API',           color: '#888',    desc: 'CORS + Routes' },
                  { label: 'Lambda createPayment', sublabel: 'POST /payments',     color: '#60a5fa', desc: 'Publica no SQS' },
                  { label: 'SQS',                  sublabel: 'cloudpay-payments',  color: '#a78bfa', desc: 'Fila assíncrona' },
                  { label: 'Lambda Worker',        sublabel: 'SQS Trigger',        color: '#a78bfa', desc: 'Processa pagamento' },
                  { label: 'DynamoDB',             sublabel: 'cloudpay-payments',  color: '#c19a6b', desc: 'Persistência NoSQL' },
                ].map((node, i, arr) => (
                  <div key={i} className="flex items-center flex-shrink-0">
                    <div className="w-36 p-4 border border-[#ffffff10] bg-[#0d0d0f] text-center hover:border-[#c19a6b]/50 transition-colors">
                      <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: node.color }}>{node.label}</div>
                      <div className="text-[8px] text-[#555] font-mono">{node.sublabel}</div>
                      <div className="text-[8px] text-[#444] mt-2">{node.desc}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex items-center mx-1 text-[#333]">
                        <div className="w-4 h-px bg-[#ffffff20]" />→
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">02 / Serviços AWS e Justificativas</h3>
              <div className="grid grid-cols-2 gap-px bg-[#ffffff10] border border-[#ffffff10]">
                {[
                  {
                    aws: 'AWS SQS', impl: 'cloudpay-payments queue',
                    why: 'Desacopla a recepção do pagamento do seu processamento efetivo. O API Gateway retorna 202 Accepted imediatamente após enfileirar, sem bloquear na resposta do Worker. Absorve picos de carga sem degradação e garante entrega mesmo em caso de falha do consumidor.',
                    trade: 'Sem FIFO estrito na fila Standard — para MVP com volume baixo, aceitável.',
                  },
                  {
                    aws: 'AWS Lambda (Worker)', impl: 'cloudpay-worker — SQS Trigger',
                    why: 'Worker stateless acionado automaticamente pelo SQS. Escala horizontalmente por padrão: se houver 1000 mensagens na fila, AWS executa 1000 instâncias do Lambda concorrentemente. Implementa taxa de falha de 20% para demonstrar resiliência.',
                    trade: 'Timeout máximo de 15 minutos — transações longas precisariam de Step Functions.',
                  },
                  {
                    aws: 'DynamoDB', impl: 'cloudpay-payments + cloudpay-users',
                    why: 'NoSQL com schema flexível e alta taxa de escrita. PK por processId permite leitura O(1). Suporta milhões de transações por segundo com latência de milissegundos. Sem servidor para gerenciar.',
                    trade: 'Sem transações ACID nativas entre tabelas — aceitável para MVP sem estorno financeiro.',
                  },
                  {
                    aws: 'API Gateway (HTTP API)', impl: 'POST /payments, GET /payments, POST /users, GET /users',
                    why: 'Expõe as funções Lambda como endpoints HTTP REST com CORS configurado. Gerencia throttling, autenticação (Cognito-ready) e roteamento. O frontend nunca acessa AWS diretamente.',
                    trade: 'Sem cache de resposta configurado — GET /payments faz Scan no DynamoDB a cada chamada.',
                  },
                  {
                    aws: 'Lambda (createPayment)', impl: 'POST /payments → SQS + DynamoDB',
                    why: 'Valida o payload, gera o processId único, escreve no DynamoDB com status pending e publica no SQS. Separa a camada de recepção da camada de processamento — padrão produtor/consumidor clássico.',
                    trade: 'Em produção adicionaria idempotency key para evitar duplicatas em retry do cliente.',
                  },
                  {
                    aws: 'Polling (Frontend)', impl: 'setInterval 3s → GET /payments',
                    why: 'Substitui os onSnapshot do Firestore. Simples, sem infra adicional e suficiente para a demo. O DynamoDB retorna sempre o estado mais recente. Latência máxima de visibilidade: 3 segundos.',
                    trade: 'Produção usaria API Gateway WebSockets ou AppSync para real-time sem polling.',
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

            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">03 / Camadas do Sistema</h3>
              <div className="space-y-0">
                {[
                  { name: 'Camada de Entrada',       desc: 'API Gateway HTTP API — recebe requisições do browser, valida CORS, roteia para o Lambda correto. Rate limiting e autenticação (Cognito) são configurados aqui.', icon: GitBranch },
                  { name: 'Camada de Aplicação',      desc: 'Lambda createPayment + Lambda createUser — lógica de negócio stateless. Cada função tem responsabilidade única: valida input, grava no DynamoDB e publica no SQS.', icon: Layers },
                  { name: 'Camada Assíncrona',        desc: 'SQS cloudpay-payments → Lambda Worker — desacopla recepção de processamento. O Worker atualiza o status no DynamoDB após processar, com 20% de taxa de falha simulada.', icon: Activity },
                  { name: 'Camada de Persistência',   desc: 'DynamoDB cloudpay-payments (PK: processId) + cloudpay-users (PK: userId). Scan com sort no Lambda para listagem. Sem servidor para gerenciar.', icon: Database },
                  { name: 'Camada de Observabilidade',desc: 'Dashboard React com polling 3s. Métricas calculadas client-side (taxa de sucesso, volume, falhas). CloudWatch Logs automático em todas as Lambdas.', icon: Clock },
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

            <div className="border-t border-[#ffffff10] pt-16">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white mb-12">04 / Stack Tecnológico</h3>
              <div className="grid grid-cols-3 gap-8">
                {[
                  { cat: 'Frontend', items: ['React 19', 'TypeScript', 'Vite 6', 'Tailwind CSS 4', 'Recharts', 'Motion'] },
                  { cat: 'AWS Cloud', items: ['API Gateway HTTP API', 'Lambda Node.js 22.x', 'SQS Standard Queue', 'DynamoDB', 'IAM Roles', 'CloudWatch Logs'] },
                  { cat: 'Padrões Arquiteturais', items: ['Event-Driven Architecture', 'Async Queue Processing', 'Serverless Functions', 'Producer/Consumer Pattern', 'NoSQL Document Store', 'Polling for real-time'] },
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
        CloudPay MVP v3.0 · AWS
      </footer>
    </div>
  );
}
