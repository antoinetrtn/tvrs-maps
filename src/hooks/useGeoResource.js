import { useCallback, useEffect, useRef, useState } from "react";

export const RETRY_DELAYS_MS = [800, 2000];
export const FETCH_TIMEOUT_MS = 20000;

function validateFeatures(payload) {
  if (!payload || !Array.isArray(payload.features) || payload.features.length === 0) {
    throw new Error("invalid geodata");
  }
  return payload.features;
}

async function fetchWithTimeout(url, controller, timeoutMs) {
  let timeoutId = null;
  let timedOut = false;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error("Request timed out"));
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([fetch(url, { signal: controller.signal }), timeoutPromise]);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    return validateFeatures(json);
  } catch (err) {
    if (timedOut) {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

export function useGeoResource({ url, enabled = true, transform }) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState(enabled ? "loading" : "idle");
  const [error, setError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const readyRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const prevUrlRef = useRef(url);

  const retry = useCallback(() => {
    if (statusRef.current === "error") {
      setError(null);
      setStatus("loading");
      setRetryNonce((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    if (status !== "error") return undefined;
    const onOnline = () => retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status, retry]);

  useEffect(() => {
    if (prevUrlRef.current !== url) {
      prevUrlRef.current = url;
      readyRef.current = false;
      setData([]);
      setError(null);
    }
    if (!enabled) {
      if (!readyRef.current && statusRef.current !== "idle") setStatus("idle");
      return undefined;
    }
    if (readyRef.current) return undefined;

    setStatus("loading");
    setError(null);

    let cancelled = false;
    let activeController = null;
    let retryTimer = null;

    const executeAttempt = async (attemptIndex) => {
      if (cancelled) return;
      activeController = new AbortController();
      try {
        const features = await fetchWithTimeout(url, activeController, FETCH_TIMEOUT_MS);
        if (cancelled) return;
        const transformed = transformRef.current ? transformRef.current(features) : features;
        readyRef.current = true;
        setData(transformed);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        if (attemptIndex < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attemptIndex];
          retryTimer = setTimeout(() => executeAttempt(attemptIndex + 1), delay);
        } else {
          console.error(`Failed to load geo resource from ${url}:`, err);
          setError(err);
          setStatus("error");
        }
      }
    };

    executeAttempt(0);

    return () => {
      cancelled = true;
      if (retryTimer != null) clearTimeout(retryTimer);
      if (activeController != null) activeController.abort();
    };
  }, [url, enabled, retryNonce]);

  return { data, status, error, retry };
}
