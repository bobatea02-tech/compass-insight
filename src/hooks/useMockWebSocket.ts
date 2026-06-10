import { useCallback, useEffect, useRef, useState } from 'react';
import { runMockStream } from '@/mock/mockAnalysis';
import type { WsMessage } from '@/types/compass';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export function useMockWebSocket(onMessage: (msg: WsMessage) => void) {
  const [status, setStatus] = useState<ConnStatus>('idle');
  const cancelRef = useRef<(() => void) | null>(null);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  const connect = useCallback((_payload: { content: string; filename: string }) => {
    setStatus('connecting');
    setTimeout(() => setStatus('open'), 100);
    cancelRef.current?.();
    cancelRef.current = runMockStream((m) => cbRef.current(m));
  }, []);

  const close = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus('closed');
  }, []);

  useEffect(() => () => cancelRef.current?.(), []);
  return { status, connect, close };
}
