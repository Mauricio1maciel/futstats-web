'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import type { MatchVideo } from '@/lib/types';
import { formatDuration, splitFeatured } from '@/lib/videos';
import { VideoPlayer } from './VideoPlayer';

function Duration({ seconds }: { seconds: number }) {
  if (!seconds) return null;
  return <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{formatDuration(seconds)}</span>;
}

function Thumb({ video, big = false }: { video: MatchVideo; big?: boolean }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-card-2 ${big ? 'aspect-video w-full' : 'aspect-video w-32'}`}>
      {video.thumbnail && (
        <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={`flex items-center justify-center rounded-full bg-black/55 text-white ${big ? 'h-14 w-14' : 'h-9 w-9'}`}>
          <Play size={big ? 26 : 16} className="ml-0.5 fill-white" />
        </span>
      </span>
      <Duration seconds={video.duration_seconds} />
    </span>
  );
}

// Vídeos do jogo: os melhores momentos em destaque, maior, e o resto em lista. Tocar abre o player
export function MatchVideos({ videos }: { videos: MatchVideo[] }) {
  const [playing, setPlaying] = useState<MatchVideo | null>(null);
  const { featured, rest } = splitFeatured(videos);
  // Sem HLS não toca aqui (o mp4 tem centenas de MB): abre a página do vídeo na ESPN
  const open = (video: MatchVideo) => {
    if (video.hls_url) setPlaying(video);
    else if (video.web_url) window.open(video.web_url, '_blank', 'noopener');
  };
  return (
    <div className="px-4 py-4">
      {featured && (
        <button type="button" onClick={() => open(featured)} className="mb-4 block w-full text-left active:opacity-80">
          <Thumb video={featured} big />
          <span className="mt-2 block text-[15px] font-bold leading-snug text-white">{featured.title}</span>
        </button>
      )}
      <ul className="space-y-3">
        {rest.map(video => (
          <li key={video.id}>
            <button type="button" onClick={() => open(video)} className="flex w-full gap-3 text-left active:opacity-80">
              <Thumb video={video} />
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{video.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {playing && <VideoPlayer video={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
