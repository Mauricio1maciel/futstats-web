import { anchorClock, getLiveClock } from './liveClock';

const AT = '2026-10-23T23:06:56Z';
const at = Date.parse(AT);
const running = (clock_seconds: number, period: number, clock = '') => ({ clock, clock_seconds, clock_at: AT, clock_running: true, period });

describe('relógio ao vivo', () => {
  it('sem clock_seconds/clock_at (backend antigo): o texto da ESPN', () => {
    expect(getLiveClock({ clock: "35'" }, at).text).toBe("35'");
    expect(getLiveClock({ clock: "35'", clock_seconds: 2100 }, at)).toEqual({ text: "35'", nextChangeMs: null });
    expect(getLiveClock({ clock: 'pre' }, at).text).toBe('');
  });

  it('anda sozinho a partir da leitura da ESPN', () => {
    expect(getLiveClock(running(2100, 1), at).text).toBe("35'");
    expect(getLiveClock(running(2100, 1), at + 2 * 60_000 + 5_000).text).toBe("37'");
    // segundo tempo começa em 45 min
    expect(getLiveClock(running(2700, 2), at + 60_000).text).toBe("46'");
  });

  it('acréscimos depois do fim do período', () => {
    expect(getLiveClock(running(2700, 1), at).text).toBe("45'");
    expect(getLiveClock(running(2700, 1), at + 2 * 60_000).text).toBe("45+2'");
    expect(getLiveClock(running(5400, 2), at + 3 * 60_000).text).toBe("90+3'");
    expect(getLiveClock(running(6300, 3), at + 60_000).text).toBe("105+1'");
    expect(getLiveClock(running(7200, 4), at).text).toBe("120'");
  });

  it('nunca menos que a leitura nem mais que 15 min além do período', () => {
    expect(getLiveClock(running(2100, 1), at - 5 * 60_000).text).toBe("35'");
    expect(getLiveClock(running(2100, 1), at + 3 * 3600_000)).toEqual({ text: "45+15'", nextChangeMs: null });
  });

  it('agenda a próxima virada de minuto', () => {
    // 35:00 + 20 s -> faltam 40 s para o 36'
    expect(getLiveClock(running(2100, 1), at + 20_000).nextChangeMs).toBe(40_000);
    expect(getLiveClock(running(2130, 1), at).nextChangeMs).toBe(30_000);
  });

  it('parado: intervalo, pênaltis ou o texto da ESPN', () => {
    const stopped = (period: number) => ({ clock: "45'+3'", clock_seconds: 2700, clock_at: AT, clock_running: false, period });
    expect(getLiveClock(stopped(1), at + 600_000)).toEqual({ text: 'Intervalo', nextChangeMs: null });
    expect(getLiveClock(stopped(5), at).text).toBe('Pênaltis');
    expect(getLiveClock(stopped(2), at).text).toBe("45'+3'");
  });

  it('nos acréscimos a ESPN para o clock_seconds no fim do período: vale o texto', () => {
    // Dado real: "45'+1'" com clock_seconds 2700
    expect(getLiveClock(running(2700, 1, "45'+1'"), at).text).toBe("45+1'");
    expect(getLiveClock(running(2700, 1, "45'+1'"), at + 60_000).text).toBe("45+2'");
    expect(getLiveClock(running(5400, 2, "90'+4'"), at + 30_000).text).toBe("90+4'");
    // texto atrasado em relação aos segundos: valem os segundos
    expect(getLiveClock(running(1100, 1, "17'"), at).text).toBe("18'");
  });

  it('recarga com o relógio igual não volta a contagem para o começo do minuto', () => {
    // Dado real: 1140 lido às 23:19:53 e de novo às 23:20:24; 1200 às 23:20:54
    const read = (clock_seconds: number, clock: string, time: string) =>
      anchorClock('jogo-1', { clock, clock_seconds, clock_at: `2026-10-23T${time}Z`, clock_running: true, period: 1 });
    const first = Date.parse('2026-10-23T23:19:53Z');
    read(1140, "19'", '23:19:53');
    const second = read(1140, "19'", '23:20:24');
    expect(second.clock_at).toBe('2026-10-23T23:19:53Z');
    expect(getLiveClock(second, first + 61_000).text).toBe("20'");
    // Valor novo: a contagem parte da nova leitura
    expect(read(1200, "20'", '23:20:54').clock_at).toBe('2026-10-23T23:20:54Z');
    // Outro jogo não se mistura
    expect(anchorClock('jogo-2', { clock: "19'", clock_seconds: 1140, clock_at: '2026-10-23T23:20:24Z', clock_running: true, period: 1 }).clock_at).toBe(
      '2026-10-23T23:20:24Z',
    );
  });

  it('minuto estimado (a ESPN travou o relógio) vem com "~"', () => {
    const estimated = { clock: "26'", clock_seconds: 1560, clock_at: AT, clock_running: true, period: 1, clock_estimated: true };
    expect(getLiveClock(estimated, at).text).toBe("~26'");
    expect(getLiveClock(estimated, at + 6 * 60_000).text).toBe("~32'");
    expect(getLiveClock({ ...estimated, clock_seconds: 2700 }, at + 2 * 60_000).text).toBe("~45+2'");
    // parado no intervalo: sem "~"
    expect(getLiveClock({ ...estimated, clock_running: false }, at).text).toBe('Intervalo');
    // backend antigo (sem clock_at), só o texto: também com "~"
    expect(getLiveClock({ clock: "26'", clock_estimated: true }, at).text).toBe("~26'");
  });
});
