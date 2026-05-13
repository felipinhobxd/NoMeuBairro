import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that listens for double Escape keypress and triggers a panic callback.
 * Used for the anonymous denúncias page safety feature.
 */
export function usePanicButton(callback: () => void) {
  const lastEscRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const now = Date.now();
      if (now - lastEscRef.current < 600) {
        callbackRef.current();
        lastEscRef.current = 0;
      } else {
        lastEscRef.current = now;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Executes the panic action: clears session data and redirects to a safe page.
 */
export function executePanic() {
  try {
    // Clear any session-sensitive data (not login/theme preferences)
    sessionStorage.clear();
    // Clear denuncia-specific form data if any
    localStorage.removeItem('anb-denuncia-draft');
  } catch {}
  // Use replace to prevent back-button navigation to this page
  window.location.replace('https://www.google.com');
}
