import { useCallback } from "react";
import { useAudioPlayer } from "expo-audio";

/**
 * Optional sound effects for La Bombe (tic-tac + explosion). Sound is
 * off by default (see settings) and every call is best-effort: any failure
 * (e.g. web preview, missing native module) is swallowed so it never blocks
 * gameplay. Haptics remain the primary feedback channel.
 */
export function useBombeSounds(enabled: boolean) {
  const tick = useAudioPlayer(require("@/assets/sounds/tick.wav"));
  const boom = useAudioPlayer(require("@/assets/sounds/boom.wav"));

  const playTick = useCallback(() => {
    if (!enabled) return;
    try {
      tick.seekTo(0);
      tick.play();
    } catch {}
  }, [enabled, tick]);

  const playBoom = useCallback(() => {
    if (!enabled) return;
    try {
      boom.seekTo(0);
      boom.play();
    } catch {}
  }, [enabled, boom]);

  return { playTick, playBoom };
}
