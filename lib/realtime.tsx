import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { API_BASE_URL, transactions as apiTransactions } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF } from '@/lib/format';
import { ensurePermission, fireLocal, hasPermission } from '@/lib/notifications';

/**
 * Realtime channel for incoming money.
 *
 * Primary path: a WebSocket to /ws/notifications — the server pushes a
 * `transaction_received` event the instant a transfer credits this user, so the
 * notification + balance update are effectively immediate while the app is open.
 *
 * Fallback path: a slow poll of /transactions/received covers the gap if the
 * socket is down (no network, server restart). Both share one `seen` set so a
 * transfer never notifies twice.
 *
 * `tick` increments on every new incoming transfer; screens add it to their
 * fetch dependencies to refresh themselves instantly.
 */

type RealtimeValue = { tick: number };

const RealtimeContext = createContext<RealtimeValue>({ tick: 0 });

export function useRealtimeTick() {
  return useContext(RealtimeContext).tick;
}

const FALLBACK_POLL_MS = 20_000;
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 20_000;

function wsUrl(token: string) {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws/notifications?token=${encodeURIComponent(token)}`;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [tick, setTick] = useState(0);

  const seen = useRef<Set<string>>(new Set());
  const polledOnce = useRef(false);

  // Ask for notification permission once on login so incoming-money banners can
  // actually display — critical on Android 13+, which is silent until granted.
  useEffect(() => {
    if (token) void ensurePermission();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let closed = false;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const announceReceived = async (item: { id: string; amount: string; sender_name: string }) => {
      if (seen.current.has(item.id)) return;
      seen.current.add(item.id);
      setTick((t) => t + 1);
      if (await hasPermission()) {
        await fireLocal({
          title: 'Money received',
          body: `You received RWF ${formatRWF(parseFloat(item.amount), {
            hideSign: true,
          })} from ${item.sender_name}.`,
          kind: 'transaction_received',
        });
      }
    };

    // ── Fallback poll ──────────────────────────────────────────────────────
    const poll = async () => {
      try {
        const r = await apiTransactions.received(token, { limit: 20 });
        if (closed) return;
        if (!polledOnce.current) {
          r.items.forEach((i) => seen.current.add(i.id)); // baseline, no notify
          polledOnce.current = true;
        } else {
          for (const item of [...r.items].reverse()) {
            await announceReceived(item);
          }
        }
      } catch {
        // ignore — try again next tick
      }
      if (!closed) pollTimer = setTimeout(poll, FALLBACK_POLL_MS);
    };

    // ── WebSocket ──────────────────────────────────────────────────────────
    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl(token));
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
          if (msg?.type === 'transaction_received' && msg.id) {
            announceReceived({
              id: String(msg.id),
              amount: String(msg.amount ?? '0'),
              sender_name: String(msg.sender_name ?? 'someone'),
            });
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (!closed) scheduleReconnect();
      };
      ws.onerror = () => {
        // onclose fires next and handles reconnect
      };
    };

    const scheduleReconnect = () => {
      if (closed) return;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    poll();
    connect();

    return () => {
      closed = true;
      clearTimeout(pollTimer);
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
          ws.close();
        } catch {
          // already closing
        }
      }
    };
  }, [token]);

  return <RealtimeContext.Provider value={{ tick }}>{children}</RealtimeContext.Provider>;
}
