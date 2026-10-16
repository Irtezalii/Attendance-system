import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api";

interface Result<T> {
  /** Which request (path + reload count) this result belongs to. */
  key: string;
  data: T | null;
  error: Error | null;
}

/** Loads a GET endpoint and re-loads when the path changes or reload() is called. */
export function useApi<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = `${path}#${version}`;

  useEffect(() => {
    let cancelled = false;
    apiRequest<T>(path)
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((error: Error) => !cancelled && setResult({ key, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = result?.key !== key;
  // While reloading the same path, keep showing the previous data instead of flashing a spinner.
  const samePath = result?.key.startsWith(`${path}#`) ?? false;
  return {
    data: samePath ? (result?.data ?? null) : null,
    error: loading ? null : (result?.error ?? null),
    loading,
    reload,
  };
}
