import { useSyncExternalStore } from 'react';
import { getAccountToken, getAccountUser, subscribeAccount, type AccountUser } from '@/lib/auth';

// Mesma referência enquanto a conta não muda (useSyncExternalStore compara por ===)
let cachedKey: string | null | undefined;
let cachedUser: AccountUser | null = null;

function snapshot() {
  const key = getAccountToken() ? JSON.stringify(getAccountUser()) : null;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedUser = key ? getAccountUser() : null;
  }
  return cachedUser;
}

/** A conta logada neste navegador, ou null (convidado) */
export function useAccount() {
  return useSyncExternalStore(subscribeAccount, snapshot, () => null);
}
