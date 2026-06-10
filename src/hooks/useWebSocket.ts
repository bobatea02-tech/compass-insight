import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage } from '@/types/compass';
import type { ConnStatus } from './useMockWebSocket';

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const [status, setStatus] = useState<ConnStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  const connect = useCallback((payload: { content: string; filename: string }) => {
    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws/analyze';
    setStatus('connecting');
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus('open');
        ws.send(JSON.stringify(payload));
        console.log('Connected');
      };
      ws.onmessage = (ev) => {
        try {
          cbRef.current(JSON.parse(ev.data) as WsMessage);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => setStatus('closed');
      ws.onerror = () => setStatus('error');
    } catch {
      setStatus('error');
    }
  }, []);

  const close = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('closed');
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);
  return { status, connect, close };
}
