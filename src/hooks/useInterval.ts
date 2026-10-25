import { useEffect, useRef } from 'react';

type Options = {
  /** Ao voltar para a aba, roda na hora (e o intervalo recomeça dali). Sem isso, só se já passou o tempo */
  runOnReturn?: boolean;
};

// Volta muito rápida (trocou de aba e voltou): não repete o que acabou de rodar
const MIN_GAP_ON_RETURN_MS = 2000;

// Intervalo que pausa com a aba em segundo plano (não gasta bateria nem internet escondido) e, ao
// voltar, roda na hora se já passou o tempo (ou sempre, com runOnReturn). delay null = parado
export function useInterval(callback: () => void, delay: number | null, { runOnReturn = false }: Options = {}) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  });

  useEffect(() => {
    if (delay == null) return;
    let lastRun = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (wait: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, wait);
    };
    const tick = () => {
      if (document.hidden) return; // escondida: para; a volta reagenda
      lastRun = Date.now();
      saved.current();
      schedule(delay);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        return;
      }
      const elapsed = Date.now() - lastRun;
      if (elapsed >= delay || (runOnReturn && elapsed >= MIN_GAP_ON_RETURN_MS)) tick();
      else schedule(delay - elapsed);
    };
    schedule(delay);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delay, runOnReturn]);
}
