import type { MatchVideo } from './types';

// 242 -> "04:02"
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// O primeiro com highlights (melhores momentos / gols) vai em destaque; o resto na lista, na ordem da API
export function splitFeatured(videos: MatchVideo[]) {
  const index = videos.findIndex(v => v.highlights);
  if (index === -1) return { featured: null, rest: videos };
  return { featured: videos[index], rest: videos.filter((_, i) => i !== index) };
}

/** Como tocar aqui: HLS nativo (Safari/iPhone), hls.js (Chrome, Firefox...) ou abrir a página da ESPN */
export type PlaybackMode = 'native' | 'hlsjs' | 'web';

export function playbackMode(video: MatchVideo, canPlayHlsNatively: boolean, hlsJsSupported: boolean): PlaybackMode {
  if (!video.hls_url) return 'web';
  if (canPlayHlsNatively) return 'native';
  return hlsJsSupported ? 'hlsjs' : 'web';
}
