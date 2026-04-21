import { useEffect, useState } from 'react';

export function useClock(): string {
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 8));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
}
