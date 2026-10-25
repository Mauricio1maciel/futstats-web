import { renderHook } from '@testing-library/react';
import { useInterval } from './useInterval';

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useInterval', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    setHidden(false);
    vi.useRealTimers();
  });

  it('roda a cada intervalo e para com a aba escondida', () => {
    const fn = vi.fn();
    renderHook(() => useInterval(fn, 15000));
    vi.advanceTimersByTime(30000);
    expect(fn).toHaveBeenCalledTimes(2);
    setHidden(true);
    vi.advanceTimersByTime(60000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('runOnReturn: na volta roda na hora e o intervalo recomeça dali', () => {
    const fn = vi.fn();
    renderHook(() => useInterval(fn, 15000, { runOnReturn: true }));
    vi.advanceTimersByTime(5000);
    setHidden(true);
    vi.advanceTimersByTime(3000);
    setHidden(false);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(14000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('sem runOnReturn: na volta só roda se já passou o tempo', () => {
    const fn = vi.fn();
    renderHook(() => useInterval(fn, 15000));
    vi.advanceTimersByTime(5000);
    setHidden(true);
    vi.advanceTimersByTime(3000);
    setHidden(false);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(7000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('delay null: parado', () => {
    const fn = vi.fn();
    renderHook(() => useInterval(fn, null));
    vi.advanceTimersByTime(60000);
    expect(fn).not.toHaveBeenCalled();
  });
});
