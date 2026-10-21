import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { useScreenActive } from './focus';
import { supabase } from './supabase';

// supabase-js returns the existing channel for a topic, including one still
// leaving after `removeChannel`; reopening it right away would silently die.
// Every subscription gets its own topic (the app only uses postgres_changes,
// whose filters do not depend on the topic).
let channelSeq = 0;

interface RealtimeOptions {
  /** Extra condition (e.g. a user id is known). Defaults to true. */
  enabled?: boolean;
  /** Called after (re)subscribing — refetch here, events were missed while closed. */
  onSubscribed?: () => void;
}

/**
 * Opens a Supabase realtime channel only while the calling screen is focused
 * and the app is in the foreground, and always removes it on blur, background
 * or unmount. `configure` attaches the `.on(...)` listeners; it may change
 * between renders without reopening the channel.
 */
export function useRealtimeChannel(
  name: string | null,
  configure: (channel: RealtimeChannel) => RealtimeChannel,
  { enabled = true, onSubscribed }: RealtimeOptions = {},
) {
  const active = useScreenActive();
  const configureRef = useRef(configure);
  const onSubscribedRef = useRef(onSubscribed);
  useEffect(() => {
    configureRef.current = configure;
    onSubscribedRef.current = onSubscribed;
  });

  const open = active && enabled && name !== null;

  useEffect(() => {
    if (!open || !name) return;
    channelSeq += 1;
    const channel = configureRef.current(supabase.channel(`${name}:${channelSeq}`)).subscribe((status) => {
      if (status === 'SUBSCRIBED') onSubscribedRef.current?.();
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, name]);
}
