'use client';

import { ExternalLink, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { playbackMode } from '@/lib/videos';
import type { MatchVideo } from '@/lib/types';

const subscribeNothing = () => () => {};

// Player por cima da tela. Toca o hls_url (a qualidade se ajusta à conexão): direto no Safari/iPhone,
// com o hls.js nos outros (carregado só aqui). Nunca o mp4_url, que tem centenas de MB.
// Sem hls_url, ou se o vídeo falhar, fica o botão para abrir na ESPN
export function VideoPlayer({ video, onClose }: { video: MatchVideo; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video.hls_url) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    (async () => {
      const { default: Hls } = await import('hls.js').catch(() => ({ default: null }));
      if (destroyed) return;
      const mode = playbackMode(video, !!el.canPlayType('application/vnd.apple.mpegurl'), !!Hls?.isSupported());
      if (mode === 'native') {
        el.src = video.hls_url!;
      } else if (mode === 'hlsjs' && Hls) {
        const player = new Hls({ capLevelToPlayerSize: true });
        player.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setFailed(true);
        });
        player.loadSource(video.hls_url!);
        player.attachMedia(el);
        hls = player;
      } else {
        setFailed(true);
        return;
      }
      el.play().catch(() => {
        // autoplay bloqueado: fica o botão de play do próprio vídeo
      });
    })();
    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [video]);

  // Esc fecha; a página por trás não rola
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!mounted) return null;
  const unplayable = failed || !video.hls_url;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-0 sm:p-4" role="dialog" aria-modal aria-label={video.title} onClick={onClose}>
      <div className="w-full max-w-130" onClick={event => event.stopPropagation()}>
        <div className="flex items-start gap-3 px-4 pb-3">
          <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-white">{video.title}</p>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-2 -mt-1 rounded-full p-2 text-white active:bg-white/10">
            <X size={22} />
          </button>
        </div>
        <div className="relative aspect-video w-full bg-black">
          {unplayable ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-muted">Não foi possível tocar o vídeo aqui.</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                controls
                playsInline
                poster={video.thumbnail}
                className="h-full w-full"
                onCanPlay={() => setLoading(false)}
                onError={() => setFailed(true)}
              />
              {loading && <Loader2 size={28} className="pointer-events-none absolute left-1/2 top-1/2 -ml-3.5 -mt-3.5 animate-spin text-white/70" />}
            </>
          )}
        </div>
        {video.web_url && (
          <a
            href={video.web_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-4 mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-accent"
          >
            Abrir no site da ESPN <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>,
    document.body,
  );
}
