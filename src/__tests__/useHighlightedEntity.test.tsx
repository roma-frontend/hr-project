/**
 * Tests for src/hooks/useHighlightedEntity.ts
 *
 * Drives the URL poll, the highlight lifespan, the pulse flip and the
 * scroll-into-view retry loop with fake timers.
 */
import { renderHook, act } from '@testing-library/react';
import { useHighlightedEntity } from '@/hooks/useHighlightedEntity';

const HIGHLIGHT_MS = 4000;
const PULSE_MS = 600;
const URL_POLL_MS = 500;
const SCROLL_RETRY_MS = 250;

let scrollIntoView: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  window.history.replaceState({}, '', '/');
  scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as () => void;
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  document.body.innerHTML = '';
});

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`);
}

describe('useHighlightedEntity', () => {
  it('returns null when no highlight parameter is present', () => {
    const { result } = renderHook(() => useHighlightedEntity());
    expect(result.current.highlightId).toBeNull();
  });

  it('reads the highlight id on mount', () => {
    setSearch('?highlight=task-1');
    const { result } = renderHook(() => useHighlightedEntity());
    expect(result.current.highlightId).toBe('task-1');
  });

  it('honours a custom parameter name', () => {
    setSearch('?focus=leave-9');
    const { result } = renderHook(() => useHighlightedEntity({ param: 'focus' }));
    expect(result.current.highlightId).toBe('leave-9');
  });

  it('ignores a custom parameter when the default is used', () => {
    setSearch('?focus=leave-9');
    const { result } = renderHook(() => useHighlightedEntity());
    expect(result.current.highlightId).toBeNull();
  });

  it('clears the highlight after HIGHLIGHT_MS', () => {
    setSearch('?highlight=task-1');
    const { result } = renderHook(() => useHighlightedEntity());

    expect(result.current.highlightId).toBe('task-1');
    act(() => {
      jest.advanceTimersByTime(HIGHLIGHT_MS);
    });
    expect(result.current.highlightId).toBeNull();
  });

  it('pulses on and off while a highlight is active', () => {
    setSearch('?highlight=task-1');
    const { result } = renderHook(() => useHighlightedEntity());

    expect(result.current.pulse).toBe(true);
    act(() => {
      jest.advanceTimersByTime(PULSE_MS);
    });
    expect(result.current.pulse).toBe(false);
    act(() => {
      jest.advanceTimersByTime(PULSE_MS);
    });
    expect(result.current.pulse).toBe(true);
  });

  it('picks up a query-string change while mounted', () => {
    const { result } = renderHook(() => useHighlightedEntity());
    expect(result.current.highlightId).toBeNull();

    setSearch('?highlight=task-2');
    act(() => {
      jest.advanceTimersByTime(URL_POLL_MS);
    });

    expect(result.current.highlightId).toBe('task-2');
  });

  it('does not re-trigger when the query string is unchanged', () => {
    setSearch('?highlight=task-1');
    const { result } = renderHook(() => useHighlightedEntity());

    act(() => {
      jest.advanceTimersByTime(URL_POLL_MS * 3);
    });

    expect(result.current.highlightId).toBe('task-1');
  });

  it('scrolls the matching element into view', () => {
    setSearch('?highlight=task-1');
    const el = document.createElement('div');
    el.setAttribute('data-highlight-id', 'task-1');
    document.body.appendChild(el);

    renderHook(() => useHighlightedEntity());

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('supports a custom attribute for the scroll target', () => {
    setSearch('?highlight=task-7');
    const el = document.createElement('div');
    el.setAttribute('data-task-id', 'task-7');
    document.body.appendChild(el);

    renderHook(() => useHighlightedEntity({ attribute: 'data-task-id' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('retries until the element appears', () => {
    setSearch('?highlight=task-late');
    renderHook(() => useHighlightedEntity());

    expect(scrollIntoView).not.toHaveBeenCalled();

    const el = document.createElement('div');
    el.setAttribute('data-highlight-id', 'task-late');
    document.body.appendChild(el);

    act(() => {
      jest.advanceTimersByTime(SCROLL_RETRY_MS);
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('prefers a laid-out element over a hidden duplicate', () => {
    setSearch('?highlight=dup');
    const hidden = document.createElement('div');
    hidden.setAttribute('data-highlight-id', 'dup');
    const visible = document.createElement('div');
    visible.setAttribute('data-highlight-id', 'dup');
    Object.defineProperty(visible, 'offsetParent', { value: document.body });
    document.body.append(hidden, visible);

    renderHook(() => useHighlightedEntity());

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('tolerates ids containing quotes', () => {
    setSearch(`?highlight=${encodeURIComponent('a"b')}`);
    renderHook(() => useHighlightedEntity());
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(SCROLL_RETRY_MS);
      });
    }).not.toThrow();
  });
});
