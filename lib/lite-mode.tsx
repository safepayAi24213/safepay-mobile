/**
 * SafePay Lite Mode — designed for low-bandwidth environments (Rwanda + USSD-like networks).
 *
 * - Lite mode: strips animations, simplifies UI, surfaces a USSD-style menu, reduces decoration
 * - Offline mode: queues outgoing transactions locally; flushes when back online
 *
 * Persistence: in-memory for this session. Plug AsyncStorage in when needed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createTransaction, type SendTransaction } from './send-store';

export type QueuedTransaction = {
  id: string;
  queuedAt: string;
  payload: Omit<SendTransaction, 'id' | 'createdAt' | 'reference' | 'status'>;
};

type LiteModeValue = {
  liteMode: boolean;
  setLiteMode: (v: boolean) => void;
  isOnline: boolean;
  setOnline: (v: boolean) => void;
  queue: QueuedTransaction[];
  queueTransaction: (payload: QueuedTransaction['payload']) => QueuedTransaction;
  flushQueue: () => SendTransaction[];
  clearQueue: () => void;
};

const LiteModeCtx = createContext<LiteModeValue>({
  liteMode: false,
  setLiteMode: () => {},
  isOnline: true,
  setOnline: () => {},
  queue: [],
  queueTransaction: () => {
    throw new Error('LiteModeProvider not mounted');
  },
  flushQueue: () => [],
  clearQueue: () => {},
});

export function LiteModeProvider({ children }: { children: ReactNode }) {
  const [liteMode, setLiteMode] = useState(false);
  const [isOnline, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedTransaction[]>([]);

  const queueTransaction = useCallback(
    (payload: QueuedTransaction['payload']) => {
      const q: QueuedTransaction = {
        id: `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
        queuedAt: new Date().toISOString(),
        payload,
      };
      setQueue((prev) => [...prev, q]);
      return q;
    },
    [],
  );

  const flushQueue = useCallback(() => {
    const created: SendTransaction[] = [];
    setQueue((prev) => {
      for (const q of prev) {
        created.push(createTransaction(q.payload));
      }
      return [];
    });
    return created;
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const value = useMemo<LiteModeValue>(
    () => ({
      liteMode,
      setLiteMode,
      isOnline,
      setOnline,
      queue,
      queueTransaction,
      flushQueue,
      clearQueue,
    }),
    [liteMode, isOnline, queue, queueTransaction, flushQueue, clearQueue],
  );

  return <LiteModeCtx.Provider value={value}>{children}</LiteModeCtx.Provider>;
}

export function useLiteMode() {
  return useContext(LiteModeCtx);
}
