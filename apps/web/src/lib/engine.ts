import type { UciEngine } from '@erpchess/engine';
import {
  createBrowserEngine,
  type DownloadProgress,
  EngineUnavailableError,
  engineSupport,
} from '@erpchess/engine/web';
import { useEffect, useState } from 'react';

/** Mạng NNUE: mặc định cùng origin (public/engine), production có thể trỏ sang CDN/Supabase Storage. */
const NETWORK_URL =
  (import.meta.env.VITE_ENGINE_NETWORK_URL as string | undefined) ??
  '/engine/arasanv8-20261005.nnue';

let enginePromise: Promise<UciEngine> | null = null;
const progressListeners = new Set<(p: DownloadProgress) => void>();

/** Một engine dùng chung cho cả app: khởi động lần đầu khi cần, các lần sau dùng lại. */
export function getEngine(): Promise<UciEngine> {
  enginePromise ??= createBrowserEngine({
    baseUrl: '/engine/',
    networkUrl: NETWORK_URL,
    onProgress: (p) => {
      for (const l of progressListeners) l(p);
    },
  }).catch((err: unknown) => {
    enginePromise = null; // cho phép thử lại
    throw err;
  });
  return enginePromise;
}

export type EngineState =
  | { status: 'unsupported'; reason: string }
  | { status: 'loading'; progress: DownloadProgress | null }
  | { status: 'ready'; engine: UciEngine }
  | { status: 'error'; message: string };

export function useEngine(): EngineState {
  const [state, setState] = useState<EngineState>(() => {
    const support = engineSupport();
    return support.ok
      ? { status: 'loading', progress: null }
      : { status: 'unsupported', reason: support.reason };
  });

  // Chỉ chạy một lần khi mount; khi trình duyệt không hỗ trợ thì state đầu đã là 'unsupported'
  const [supported] = useState(() => state.status !== 'unsupported');
  useEffect(() => {
    if (!supported) return;
    let active = true;
    const onProgress = (progress: DownloadProgress) => {
      if (active) setState({ status: 'loading', progress });
    };
    progressListeners.add(onProgress);
    getEngine()
      .then((engine) => active && setState({ status: 'ready', engine }))
      .catch((err: unknown) => {
        if (!active) return;
        setState(
          err instanceof EngineUnavailableError
            ? { status: 'unsupported', reason: err.reason }
            : { status: 'error', message: err instanceof Error ? err.message : String(err) },
        );
      });
    return () => {
      active = false;
      progressListeners.delete(onProgress);
    };
  }, [supported]);

  return state;
}
