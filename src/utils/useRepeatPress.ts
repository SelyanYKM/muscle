import { useEffect, useRef } from 'react';

/**
 * Répétition à l'appui long pour les boutons − / + des steppers : un tap = un pas (onPress
 * habituel) ; maintenir = le pas se répète, de plus en plus vite (180 ms puis jusqu'à 50 ms),
 * jusqu'au relâchement. À brancher sur onLongPress (start) et onPressOut (stop).
 */
export function useRepeatPress() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const start = (step: () => void) => {
    stop();
    let delay = 180;
    const tick = () => {
      step();
      delay = Math.max(50, delay * 0.85);
      timerRef.current = setTimeout(tick, delay);
    };
    tick();
  };

  // Sécurité : jamais de répétition qui survit au démontage de l'écran.
  useEffect(() => stop, []);

  return { start, stop };
}
