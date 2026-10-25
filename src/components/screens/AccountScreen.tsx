'use client';

import { Cloud, Eye, EyeOff, Loader2, LogOut, Trash2, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Pills } from '@/components/ui/Pills';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount } from '@/hooks/useAccount';
import { deleteAccount, fetchMe, login, logout, register, validateAccountForm } from '@/lib/account';

const inputClass =
  'w-full rounded-xl border border-line-2 bg-card-2 px-4 py-3.5 text-base text-ink outline-none placeholder:text-faint focus:border-accent';
const primaryButton =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[15px] font-bold text-white disabled:opacity-60';

function PasswordInput({ value, onChange, autoComplete, placeholder = 'Senha' }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        maxLength={72}
        onChange={e => onChange(e.target.value)}
        className={`${inputClass} pr-12`}
      />
      <button type="button" aria-label={show ? 'Esconder senha' : 'Mostrar senha'} onClick={() => setShow(!show)} className="absolute inset-y-0 right-2 px-2 text-muted">
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

// Entrar / Criar conta. A senha só vai para a API: nunca fica guardada
function SignInForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const invalid = validateAccountForm({ email, password, name: mode === 'register' ? name : '' });
    if (invalid) return setError(invalid);
    setLoading(true);
    setError('');
    const result = mode === 'login' ? await login(email, password) : await register(email, password, name);
    setLoading(false);
    setPassword('');
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="px-5 pt-4">
      <div className="mb-6 flex items-start gap-3 rounded-xl bg-card-2 p-4">
        <Cloud size={22} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-[13px] leading-snug text-ink-2">
          Com uma conta, os times, ligas e jogos que você segue (e os avisos escolhidos) ficam salvos e valem em todos os seus aparelhos. O que este
          aparelho já segue vai junto para a conta.
        </p>
      </div>
      <Pills
        variant="outline"
        value={mode}
        onChange={next => {
          setMode(next);
          setError('');
        }}
        options={[
          { value: 'login', label: 'Entrar' },
          { value: 'register', label: 'Criar conta' },
        ]}
        className="mb-5"
        label="Entrar ou criar conta"
      />
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        {mode === 'register' && (
          <input type="text" autoComplete="nickname" placeholder="Nome (opcional)" value={name} maxLength={60} onChange={e => setName(e.target.value)} className={inputClass} />
        )}
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inputClass}
        />
        <PasswordInput value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'register' && <p className="px-1 text-xs text-faint">A senha precisa ter de 8 a 72 caracteres.</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-live/10 px-3 py-2.5 text-[13px] text-live">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading && <Loader2 size={18} className="animate-spin" />}
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setError('');
    const result = await deleteAccount(password);
    setLoading(false);
    setPassword('');
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Apagar conta">
      <form onSubmit={submit} className="space-y-3.5 px-4 pb-4">
        <p className="text-[13px] leading-snug text-ink-2">
          A conta e <span className="font-bold text-white">tudo o que ela segue</span> (times, ligas, jogos e os avisos escolhidos) serão apagados para
          sempre, em todos os aparelhos. Este navegador volta a ser usado como convidado.
        </p>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" placeholder="Confirme com a sua senha" />
        {error && (
          <p role="alert" className="rounded-lg bg-live/10 px-3 py-2.5 text-[13px] text-live">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-live py-3.5 text-[15px] font-bold text-white disabled:opacity-60">
          {loading && <Loader2 size={18} className="animate-spin" />}
          Apagar minha conta
        </button>
      </form>
    </BottomSheet>
  );
}

function LogoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <BottomSheet open={open} onClose={onClose} title="Sair da conta">
      <div className="space-y-3.5 px-4 pb-4">
        <p className="text-[13px] leading-snug text-ink-2">
          Como convidado, este navegador começa sem nada seguido. O que você segue continua salvo na conta e volta quando você entrar de novo.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await logout();
            setLoading(false);
            onClose();
          }}
          className={primaryButton}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          Sair
        </button>
      </div>
    </BottomSheet>
  );
}

// Minha conta: nome e e-mail (GET /me), sair e apagar
function MyAccount() {
  const user = useAccount();
  const [sheet, setSheet] = useState<'logout' | 'delete' | null>(null);
  useEffect(() => {
    fetchMe();
  }, []);
  if (!user) return null;
  return (
    <div className="px-5 pt-6">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-18 w-18 items-center justify-center rounded-full bg-card-2 text-accent">
          <UserRound size={36} />
        </span>
        {user.display_name && <p className="mt-3 text-lg font-bold text-white">{user.display_name}</p>}
        <p className={`${user.display_name ? 'mt-0.5 text-sm text-muted' : 'mt-3 text-base font-bold text-white'}`}>{user.email}</p>
      </div>
      <p className="mt-6 flex items-start gap-3 rounded-xl bg-card-2 p-4 text-[13px] leading-snug text-ink-2">
        <Cloud size={20} className="mt-0.5 shrink-0 text-accent" />
        O que você segue fica salvo na conta e vale em todos os aparelhos em que você entrar.
      </p>
      <button type="button" onClick={() => setSheet('logout')} className="mt-6 flex w-full items-center gap-3 rounded-xl bg-card-2 px-4 py-3.5 text-[15px] font-bold text-ink active:bg-white/5">
        <LogOut size={20} className="text-muted" /> Sair
      </button>
      <button type="button" onClick={() => setSheet('delete')} className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-bold text-live active:bg-live/10">
        <Trash2 size={20} /> Apagar conta
      </button>
      <LogoutSheet open={sheet === 'logout'} onClose={() => setSheet(null)} />
      <DeleteAccountSheet open={sheet === 'delete'} onClose={() => setSheet(null)} />
    </div>
  );
}

export function AccountScreen() {
  const user = useAccount();
  return (
    <div className="pb-safe pb-10">
      <TopBar title={user ? 'Minha conta' : 'Entrar'} />
      {user ? <MyAccount /> : <SignInForm />}
    </div>
  );
}
