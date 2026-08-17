import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, type AppError } from "../api/client";

interface ApiResourceState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

/** Fetch-on-mount + reload, mirroring Angular's `resource()` used throughout apps/web. */
export function useApiResource<T>(loader: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = useState<ApiResourceState<T>>({ data: null, loading: true, error: null });
  const requestSequence = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestSequence.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loader()
      .then((data) => {
        if (requestId === requestSequence.current) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (requestId !== requestSequence.current) return;
        const appError = err instanceof ApiClientError ? err.appError : { category: "UNKNOWN" as const, status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
        setState({ data: null, loading: false, error: appError });
      });
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
