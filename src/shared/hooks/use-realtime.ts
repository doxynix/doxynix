"use client";

import { useChannel } from "ably/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRealtimeSubscription<T = any>(
  channelName: string | null | undefined,
  eventName: string,
  onMessage: (data: T) => void
) {
  const shouldSkip = channelName === null || channelName === undefined;

  useChannel(
    {
      channelName: shouldSkip ? "pending" : channelName,
      skip: shouldSkip,
    },
    (message) => {
      if (message.name === eventName) {
        onMessage(message.data as T);
      }
    }
  );
}
