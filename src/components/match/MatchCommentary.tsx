'use client';

import { Flag, FlagTriangleRight, MessageSquareText, MonitorPlay, OctagonAlert, Target } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/hooks/useApi';
import { useInterval } from '@/hooks/useInterval';
import { useOnSignal } from '@/hooks/useOnSignal';
import { buildEndpoint } from '@/lib/api';
import { commentaryKind, type CommentaryKind } from '@/lib/commentary';
import { asArray, type CommentaryItem } from '@/lib/types';

const LIVE_REFRESH_MS = 30000;
// Quanto tempo um lance novo fica em destaque
const FRESH_MS = 12000;

const ICONS: Partial<Record<CommentaryKind, ReactNode>> = {
  goal: <span className="text-[15px] leading-none">⚽</span>,
  yellow: <span className="text-[15px] leading-none">🟨</span>,
  red: <span className="text-[15px] leading-none">🟥</span>,
  substitution: <span className="text-[15px] leading-none">🔁</span>,
  shot: <Target size={16} className="text-accent" aria-label="Finalização" />,
  corner: <FlagTriangleRight size={16} className="text-muted" aria-label="Escanteio" />,
  foul: <OctagonAlert size={16} className="text-gold" aria-label="Falta" />,
  offside: <Flag size={16} className="text-muted" aria-label="Impedimento" />,
  var: <MonitorPlay size={16} className="text-ink-2" aria-label="VAR" />,
};

function Row({ item, fresh }: { item: CommentaryItem; fresh: boolean }) {
  const kind = commentaryKind(item.type);
  const highlight = fresh ? 'bg-accent/15' : '';
  if (kind === 'milestone') {
    return (
      <li className={`mx-4 my-2 rounded-lg bg-card-2 px-3 py-2.5 text-center transition-colors duration-1000 ${highlight}`}>
        {item.minute && <span className="mr-2 text-xs font-bold text-muted">{item.minute}</span>}
        <span className="text-[13px] font-bold text-white">{item.text}</span>
      </li>
    );
  }
  const goal = kind === 'goal';
  return (
    <li className={`flex gap-2.5 px-4 py-2.5 transition-colors duration-1000 ${goal ? 'bg-emerald-500/10' : ''} ${highlight}`}>
      <span className="w-11 shrink-0 pt-px text-right text-xs font-bold tabular-nums text-muted">{item.minute}</span>
      <span className="flex w-5 shrink-0 justify-center pt-px">{ICONS[kind]}</span>
      <span className={`min-w-0 flex-1 text-[13px] leading-snug ${goal ? 'font-bold text-white' : 'text-ink-2'}`}>{item.text}</span>
    </li>
  );
}

type Props = {
  /** ID da ESPN (o mesmo do /match/history) */
  espnId: string;
  live: boolean;
  /** Já começou (ao vivo ou encerrado)? Muda o texto da lista vazia */
  started: boolean;
  /** Aba aberta? Só ela recarrega ao vivo */
  active: boolean;
  refreshSignal?: number;
  /** 404 (rota fora do ar ou jogo sem narração): a tela esconde a aba */
  onUnavailable?: () => void;
};

// Lance a lance (/match/commentary), do mais recente para o mais antigo. Ao vivo, recarrega a cada
// 30 s com a aba aberta (a etiqueta faz a resposta igual voltar 304) e destaca os lances novos
export function MatchCommentary({ espnId, live, started, active, refreshSignal = 0, onUnavailable }: Props) {
  const { data, loading, error, status, refresh } = useApi(buildEndpoint('/match/commentary', { id: espnId }), {
    parse: raw => asArray<CommentaryItem>(raw),
  });
  useOnSignal(refreshSignal, () => refresh());
  useInterval(() => refresh(), live && active ? LIVE_REFRESH_MS : null);

  // Lances que chegaram depois da primeira carga ficam em destaque por alguns segundos
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!data) return;
    const seqs = data.map(item => item.seq);
    const previous = seen.current;
    seen.current = new Set(seqs);
    if (!previous) return;
    const added = seqs.filter(seq => !previous.has(seq));
    if (added.length === 0) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), FRESH_MS);
    return () => clearTimeout(timer);
  }, [data]);

  const unavailable = status === 404 && !data;
  useEffect(() => {
    if (unavailable) onUnavailable?.();
  }, [unavailable, onUnavailable]);

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-5" aria-label="Carregando lance a lance">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    );
  }
  if (unavailable) return <EmptyState compact icon={MessageSquareText} text="Narração indisponível para este jogo." />;
  if (error || !data) return <ErrorState onRetry={() => refresh()} />;
  if (data.length === 0) {
    const text = started ? 'A narração deste jogo ainda não está disponível.' : 'A narração aparece quando o jogo começar.';
    return <EmptyState compact icon={MessageSquareText} text={text} />;
  }

  return (
    <ol className="py-3">
      {data.map(item => (
        <Row key={item.seq} item={item} fresh={fresh.has(item.seq)} />
      ))}
    </ol>
  );
}
