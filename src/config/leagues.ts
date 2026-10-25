// Cadastro único das ligas. Para adicionar uma liga nova, basta uma entrada em LEAGUES:
// favoritos, home, tela de admin, classificação e mata-mata leem daqui.
// Liga que não está aqui (ex: vinda da busca) funciona como pontos corridos, com o nome que a API mandar.

export type LegendItem = { color: string; label: string };

export type PhaseConfig = {
  /** Valor de stage (e de round=<FASE> em /matches) */
  key: string;
  label: string;
  /** Fase com rodadas numeradas 1..N: mostra "Rodada N" */
  rounds?: number;
  /** Busca com stage=<FASE>&round=N, uma rodada por vez (fase de liga da Champions) */
  fetchByRound?: boolean;
};

export type BracketSlot = 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'FINAL';

export type LeagueConfig = {
  code: string;
  name: string;
  icon: string;
  /** Copa: grupos + mata-mata */
  isCup?: boolean;
  /** A aba Jogos navega por fase em vez de por data/rodada */
  phases?: PhaseConfig[];
  /** Valor de round de cada coluna do chaveamento (padrão: LAST_16, QUARTER_FINALS, SEMI_FINALS, FINAL) */
  bracketRounds?: Partial<Record<BracketSlot, string>>;
  /** Ida e volta viram um card só no chaveamento */
  twoLeggedTies?: boolean;
  /** Tem a fase de 16 avos (LAST_32)? Padrão: sim, para copas */
  hasLast32?: boolean;
  /** Legenda das zonas da classificação de copa */
  cupLegend?: LegendItem[];
  /** Tem classificação? Padrão: sim (a Copa do Brasil é só mata-mata) */
  hasStandings?: boolean;
  /** Legenda própria de liga de pontos corridos */
  leagueLegend?: LegendItem[];
};

export const ZONE_COLORS = {
  qualified: '#eab308',
  playoff: '#f97316',
  bestThird: '#8b5cf6',
  secondary: '#06b6d4',
  eliminated: '#ef4444',
  promotion: '#22c55e',
};

// Cor da faixa na classificação, a partir do texto da zona que a API manda.
// Atenção ao acento: "Pré-Libertadores" e "Playoffs (pré-oitavas)" têm "pré"
export const getZoneColor = (zone: unknown) => {
  const z = String(zone || '').toLowerCase();
  if (z.includes('acesso')) return ZONE_COLORS.promotion;
  if (z.includes('playoff') || z.includes('pre') || z.includes('pré') || z.includes('europa')) return ZONE_COLORS.playoff;
  if (z.includes('libertadores') || z.includes('champions') || z.includes('oitavas')) return ZONE_COLORS.qualified;
  if (z.includes('sul') || z.includes('conference')) return ZONE_COLORS.secondary;
  if (z.includes('rebaixamento') || z.includes('reb')) return ZONE_COLORS.eliminated;
  if (z.includes('melhor 3')) return ZONE_COLORS.bestThird;
  if (z.includes('elimin')) return ZONE_COLORS.eliminated;
  return 'transparent';
};

const DEFAULT_CUP_LEGEND: LegendItem[] = [
  { color: ZONE_COLORS.qualified, label: 'Classificado' },
  { color: ZONE_COLORS.bestThird, label: 'Melhor 3º' },
  { color: ZONE_COLORS.eliminated, label: 'Eliminado' },
];

// Legenda das ligas de pontos corridos sem legenda própria (as europeias)
const DEFAULT_LEAGUE_LEGEND: LegendItem[] = [
  { color: ZONE_COLORS.qualified, label: 'Champions League' },
  { color: ZONE_COLORS.playoff, label: 'Europa League' },
  { color: ZONE_COLORS.secondary, label: 'Conference League' },
  { color: ZONE_COLORS.eliminated, label: 'Rebaixamento' },
];

const KO = {
  qf: { key: 'QUARTER_FINALS', label: 'Quartas de final' },
  sf: { key: 'SEMI_FINALS', label: 'Semifinal' },
  f: { key: 'FINAL', label: 'Final' },
};

export const LEAGUES: LeagueConfig[] = [
  {
    code: 'BSA',
    name: 'Brasileirão - Série A',
    icon: '🇧🇷',
    // No app esta legenda era um if (league === 'BSA') nas telas; aqui ela vem do cadastro
    leagueLegend: [
      { color: ZONE_COLORS.qualified, label: 'Libertadores' },
      { color: ZONE_COLORS.playoff, label: 'Pré-Libertadores' },
      { color: ZONE_COLORS.secondary, label: 'Sul-Americana' },
      { color: ZONE_COLORS.eliminated, label: 'Rebaixamento' },
    ],
  },
  {
    code: 'BSB',
    name: 'Brasileirão - Série B',
    icon: '🇧🇷',
    leagueLegend: [
      { color: ZONE_COLORS.promotion, label: 'Acesso à Série A' },
      { color: ZONE_COLORS.playoff, label: 'Playoff de acesso' },
      { color: ZONE_COLORS.eliminated, label: 'Rebaixamento' },
    ],
  },
  { code: 'PL', name: 'Premier League', icon: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { code: 'PD', name: 'La Liga', icon: '🇪🇸' },
  { code: 'BL1', name: 'Bundesliga', icon: '🇩🇪' },
  { code: 'SA', name: 'Serie A (Itália)', icon: '🇮🇹' },
  { code: 'FL1', name: 'Ligue 1', icon: '🇫🇷' },
  {
    code: 'CL',
    name: 'Champions League',
    icon: '⭐',
    isCup: true,
    twoLeggedTies: true,
    hasLast32: false,
    phases: [
      // Fase de liga: tabela única de 36 times, 8 rodadas. round=N sozinho misturaria ida/volta do mata-mata
      { key: 'LEAGUE_STAGE', label: 'Fase de Liga', rounds: 8, fetchByRound: true },
      { key: 'PLAYOFFS', label: 'Playoffs' },
      { key: 'LAST_16', label: 'Oitavas de final' },
      KO.qf,
      KO.sf,
      KO.f,
    ],
    cupLegend: [
      { color: ZONE_COLORS.qualified, label: 'Oitavas' },
      { color: ZONE_COLORS.playoff, label: 'Playoffs' },
      { color: ZONE_COLORS.eliminated, label: 'Eliminado' },
    ],
  },
  { code: 'WC', name: 'Copa do Mundo', icon: '🏆', isCup: true },
  { code: 'UNL', name: 'Liga das Nações UEFA', icon: '🇪🇺', isCup: true },
  {
    code: 'CLI',
    name: 'Copa Libertadores',
    icon: '🌎',
    isCup: true,
    twoLeggedTies: true,
    hasLast32: false,
    bracketRounds: { LAST_16: 'PLAY_OFFS' },
    phases: [
      { key: 'ROUND_1', label: 'Primeira Fase' },
      { key: 'ROUND_2', label: 'Segunda Fase' },
      { key: 'ROUND_3', label: 'Terceira Fase' },
      { key: 'GROUP_STAGE', label: 'Fase de Grupos', rounds: 6 },
      { key: 'PLAY_OFFS', label: 'Oitavas de final' },
      KO.qf,
      KO.sf,
      KO.f,
    ],
    cupLegend: [
      { color: ZONE_COLORS.qualified, label: 'Oitavas' },
      { color: ZONE_COLORS.secondary, label: 'Sul-Americana' },
      { color: ZONE_COLORS.eliminated, label: 'Eliminado' },
    ],
  },
  {
    code: 'CSU',
    name: 'Copa Sul-Americana',
    icon: '🌎',
    isCup: true,
    twoLeggedTies: true,
    hasLast32: false,
    phases: [
      { key: 'ROUND_1', label: 'Primeira Fase' },
      { key: 'GROUP_STAGE', label: 'Fase de Grupos' },
      { key: 'PLAYOFFS', label: 'Playoffs' },
      { key: 'LAST_16', label: 'Oitavas de final' },
      KO.qf,
      KO.sf,
      KO.f,
    ],
    cupLegend: [
      { color: ZONE_COLORS.qualified, label: 'Oitavas' },
      { color: ZONE_COLORS.playoff, label: 'Playoffs' },
      { color: ZONE_COLORS.eliminated, label: 'Eliminado' },
    ],
  },
  {
    code: 'CDB',
    name: 'Copa do Brasil',
    icon: '🏆',
    isCup: true,
    hasStandings: false,
    twoLeggedTies: true,
    hasLast32: false,
    phases: [
      { key: 'ROUND_1', label: '1ª Fase' },
      { key: 'ROUND_2', label: '2ª Fase' },
      { key: 'ROUND_3', label: '3ª Fase' },
      { key: 'ROUND_4', label: '4ª Fase' },
      { key: 'ROUND_5', label: '5ª Fase' },
      { key: 'LAST_16', label: 'Oitavas de final' },
      KO.qf,
      KO.sf,
      KO.f,
    ],
  },
];

export const LEAGUE_CODES = LEAGUES.map(l => l.code);

export const getLeague = (code: unknown) => LEAGUES.find(l => l.code === String(code || '').toUpperCase());

/** Nome do cadastro; senão o que a API mandou; senão o código */
export const getLeagueName = (code: unknown, fallback?: string) =>
  getLeague(code)?.name || fallback || String(code || '');

export const isCupLeague = (code: unknown) => !!getLeague(code)?.isCup;

// Fases de tabela (todos contra todos): sem ida e volta, sem agregado
export const isTableStage = (stage: unknown) => ['GROUP_STAGE', 'LEAGUE_STAGE'].includes(String(stage || '').toUpperCase());

// Nome da tabela da copa: "Fase de Liga" na Champions (tabela única), "Grupos" nas demais
export const getTableLabel = (code: unknown) =>
  getLeague(code)?.phases?.find(p => p.key === 'LEAGUE_STAGE')?.label || 'Grupos';

export const getCupLegend = (code: unknown) => getLeague(code)?.cupLegend || DEFAULT_CUP_LEGEND;

// Legenda da classificação: a própria da liga, a da copa ou a padrão de pontos corridos
export const getStandingsLegend = (code: unknown) =>
  getLeague(code)?.leagueLegend || (isCupLeague(code) ? getCupLegend(code) : DEFAULT_LEAGUE_LEGEND);

export const hasLast32 = (code: unknown) => getLeague(code)?.hasLast32 !== false;

export const hasStandingsTable = (code: unknown) => getLeague(code)?.hasStandings !== false;

// Chances (/standings/chances): só tabela de pontos corridos. Nas copas, só a fase de liga (Champions);
// grupos (Copa do Mundo, Libertadores) e Liga das Nações dão 404
export const hasChances = (code: unknown) =>
  hasStandingsTable(code) && (!isCupLeague(code) || !!getLeague(code)?.phases?.some(p => p.key === 'LEAGUE_STAGE'));

// Nome de uma zona (valor de zone da /standings) igual ao da legenda da tabela, pela cor
export function getZoneLabel(code: unknown, zone: string) {
  const color = getZoneColor(zone);
  const item = getStandingsLegend(code).find(i => i.color === color);
  if (item) return item.label;
  const text = zone.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const getBracketRounds = (code: unknown): Record<BracketSlot, string> => ({
  LAST_16: 'LAST_16',
  QUARTER_FINALS: 'QUARTER_FINALS',
  SEMI_FINALS: 'SEMI_FINALS',
  FINAL: 'FINAL',
  ...getLeague(code)?.bracketRounds,
});

export const getPhaseConfig = (code: unknown, stage: unknown) =>
  getLeague(code)?.phases?.find(p => p.key === String(stage || '').toUpperCase());

// Posição no cadastro (ordem das competições); desconhecidas no fim
export const leagueOrder = (code: unknown) => {
  const index = LEAGUES.findIndex(l => l.code === String(code || '').toUpperCase());
  return index === -1 ? 999 : index;
};
