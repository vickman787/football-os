import { useEffect, useRef, useState, useCallback } from 'react';

export function useFetch(fn, { deps = [], pollMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (signal) => {
    try {
      setError(null);
      const result = await fnRef.current({ signal });
      if (!signal?.aborted) {
        setData(result);
        setLoading(false);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    run(ctrl.signal);

    let id;
    if (pollMs > 0) {
      id = setInterval(() => run(ctrl.signal), pollMs);
    }
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => {
    const ctrl = new AbortController();
    setLoading(true);
    run(ctrl.signal);
  }, [run]);

  return { data, error, loading, refetch };
}
