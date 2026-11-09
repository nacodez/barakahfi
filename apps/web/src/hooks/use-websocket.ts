'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { RealtimeTicketDto } from '@barakahfi/shared';
import { api } from '@/lib/api';

export type SocketStatus = 'idle' | 'connecting' | 'live' | 'offline';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/** 1s, 2s, 4s ... capped at 30s, with a little jitter so many tabs don't reconnect in lockstep. */
export const backoffDelay = (attempt: number, random = Math.random): number =>
  Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt) * (0.75 + random() * 0.5);

type Handlers = Record<string, (payload: unknown) => void>;

/**
 * Owns one Socket.IO connection for as long as `enabled` is true. It fetches a fresh one-time
 * ticket for EVERY (re)connect, because tickets expire after 60s, and reconnects with
 * exponential backoff. `handlers` can change on every render without reconnecting.
 */
export function useWebSocket(enabled: boolean, handlers: Handlers): SocketStatus {
  // Starts as "connecting": the socket opens as soon as the effect runs, and every later state
  // change comes from a socket event, so no state is set synchronously inside the effect.
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const socket: Socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: BASE_DELAY_MS,
      reconnectionDelayMax: MAX_DELAY_MS,
      randomizationFactor: 0.5,
      auth: (cb) => {
        api<RealtimeTicketDto>('/realtime/ticket', { method: 'POST' })
          .then((t) => cb({ ticket: t.ticket }))
          .catch(() => cb({}));
      },
    });

    socket.on('ready', () => {
      attempt = 0;
      setStatus('live');
    });
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('disconnect', (reason) => {
      setStatus('offline');
      // When the server hangs up (for example an expired ticket) the client does not retry by
      // itself, so do it here, with backoff.
      if (reason === 'io server disconnect' && !closed) {
        retry = setTimeout(() => socket.connect(), backoffDelay(attempt++));
      }
    });

    for (const event of Object.keys(latest.current)) {
      socket.on(event, (payload: unknown) => latest.current[event]?.(payload));
    }

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket.close();
    };
  }, [enabled]);

  return enabled ? status : 'idle';
}
