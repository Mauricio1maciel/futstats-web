'use client';

import { useEffect, useMemo, useState } from 'react';
import { getStandingsLegend, hasStandingsTable } from '@/config/leagues';
import { RefreshBar } from '@/components/ui/RefreshBar';
import { ErrorState } from '@/components/ui/States';
import { useApi } from '@/hooks/useApi';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useLiveStandings } from '@/hooks/useLiveStandings';
import { useOnSignal } from '@/hooks/useOnSignal';
import { buildEndpoint, refreshParams } from '@/lib/api';
import { groupStandings, hasZones, isHighlighted, type TeamRef } from '@/lib/standings';
import { asArray, type StandingRow } from '@/lib/types';
import { Legend, LiveToggle, StandingsSkeleton, StandingsTable } from './StandingsTable';

/** Recortes da tabela (/standings?view=): só em casa, só fora, 1º ou 2º turno */
export type StandingsView = 'home' | 'away' | 'first' | 'second';

type Props = {
  league: string;
  /** Recorte da tabela; vazio = geral */
  view?: StandingsView;
  /** A API não tem o recorte (404/400, ou backend antigo que ignora o view) */
  onViewUnavailable?: () => void;
  /** Vazio = temporada atual */
  season?: string;
  /** Temporada antiga não tem jogo ao vivo: sem o botão "Ao vivo" */
  isCurrentSeason?: boolean;
  /** Times em destaque (o time da tela, os dois times do jogo) */
  highlight?: TeamRef[];
  /** Abre só o grupo dos times em destaque e recolhe os outros */
  focusHighlighted?: boolean;
  /** Aba visível? Escondida, a tabela ao vivo para de recarregar */
  active?: boolean;
  /** Muda quando o "atualizar" do cabeçalho é tocado */
  refreshSignal?: number;
};

// Classificação completa: tabela (com a cópia local na hora), botão "Ao vivo", legenda e atualizar
// (com admin logado, o atualizar manda update=true para recalcular no servidor)
export function StandingsSection({
  league,
  view,
  onViewUnavailable,
  season = '',
  isCurrentSeason = true,
  highlight = [],
  focusHighlighted = false,
  active = true,
  refreshSignal = 0,
}: Props) {
  const isAdmin = useIsAdmin();
  const { data, loading, error, refreshing, status, refresh } = useApi(buildEndpoint('/standings', { league, season, view }), {
    parse: asArray<StandingRow>,
  });
  // O botão "Ao vivo" é da tabela geral
  const live = useLiveStandings({ league, season, enabled: !view && isCurrentSeason && hasStandingsTable(league), active });
  const rows = live.rows ?? data ?? [];

  // Atualizar recarrega as duas tabelas (a normal e a ao vivo)
  useOnSignal(refreshSignal, () => {
    refresh(refreshParams(isAdmin));
    live.refresh();
  });

  // Grupos recolhidos: na tela do time/jogo só o grupo deles fica aberto; o toque do usuário prevalece
  const highlightKey = JSON.stringify(highlight);
  const initialCollapsed = useMemo(() => {
    const teams = JSON.parse(highlightKey) as TeamRef[];
    const groups = groupStandings(data ?? []);
    if (!focusHighlighted || groups.length <= 1 || teams.length === 0) return {};
    const result: Record<string, boolean> = {};
    groups.forEach(group => {
      if (group.name && !group.rows.some(row => isHighlighted(row, teams))) result[group.name] = true;
    });
    // Nenhum grupo com os times (ex: eliminados antes dos grupos): deixa todos abertos
    return Object.keys(result).length === groups.length ? {} : result;
  }, [data, focusHighlighted, highlightKey]);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const collapsed = { ...initialCollapsed, ...toggled };
  const toggleGroup = (name: string) => setToggled(prev => ({ ...prev, [name]: !collapsed[name] }));

  // Recorte: as vagas (zonas) são da tabela geral, então não pinta. Backend antigo ignora o view e
  // devolve a geral, com zonas: aí o recorte não existe
  const viewUnavailable = !!view && (status === 404 || status === 400 || (data ?? []).some(row => !!row.zone));
  useEffect(() => {
    if (viewUnavailable) onViewUnavailable?.();
  }, [viewUnavailable, onViewUnavailable]);
  const zones = !view && hasZones(rows);

  return (
    <div>
      <RefreshBar active={refreshing} />
      {live.available && (
        <div className="flex items-center justify-between gap-3 pb-3 pt-1">
          <p className="text-xs text-muted">{live.on ? 'Como fica se os jogos em andamento acabarem agora' : 'Há times jogando agora'}</p>
          <LiveToggle on={live.on} onToggle={live.toggle} />
        </div>
      )}
      {loading ? (
        <StandingsSkeleton />
      ) : error ? (
        <ErrorState onRetry={() => refresh()} />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Classificação não disponível no momento.</p>
      ) : (
        <>
          <StandingsTable rows={rows} highlight={highlight} showZones={zones} collapsed={collapsed} onToggleGroup={toggleGroup} />
          {/* Temporadas antigas vêm sem zonas: sem cores e sem legenda */}
          {zones && <Legend items={getStandingsLegend(league)} />}
        </>
      )}
    </div>
  );
}
