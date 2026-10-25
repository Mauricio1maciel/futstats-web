'use client';

import { useEffect } from 'react';
import { refreshAccount } from '@/lib/account';
import { refreshWebPush } from '@/lib/webPush';

// Ao abrir o site com as notificações ativadas: a inscrição do navegador pode ter mudado,
// então inscreve e registra de novo (sem pedir nada ao usuário)
export function PushBootstrap() {
  useEffect(() => {
    refreshWebPush();
    // Logado: troca o token da conta por um novo (401 = expirou: volta ao convidado)
    refreshAccount();
  }, []);
  return null;
}
