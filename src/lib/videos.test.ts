import type { MatchVideo } from './types';
import { formatDuration, playbackMode, splitFeatured } from './videos';

const v = (id: string, highlights: boolean, extra: Partial<MatchVideo> = {}): MatchVideo => ({ id, title: id, duration_seconds: 60, highlights, ...extra });

describe('vídeos do jogo', () => {
  it('duração em mm:ss', () => {
    expect(formatDuration(242)).toBe('04:02');
    expect(formatDuration(59)).toBe('00:59');
    expect(formatDuration(3600)).toBe('60:00');
  });

  it('o primeiro com highlights vai em destaque', () => {
    expect(splitFeatured([v('a', false), v('b', true), v('c', true)])).toEqual({ featured: v('b', true), rest: [v('a', false), v('c', true)] });
    expect(splitFeatured([v('a', false)]).featured).toBeNull();
  });

  it('toca o HLS (nativo ou hls.js); sem HLS abre a página da ESPN', () => {
    const hls = v('a', true, { hls_url: 'x.m3u8', mp4_url: 'x.mp4' });
    expect(playbackMode(hls, true, true)).toBe('native');
    expect(playbackMode(hls, false, true)).toBe('hlsjs');
    expect(playbackMode(hls, false, false)).toBe('web');
    expect(playbackMode(v('b', true, { mp4_url: 'x.mp4' }), true, true)).toBe('web');
  });
});
