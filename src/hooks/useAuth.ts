import { useState, useEffect, useCallback } from 'react';

export interface AuthState {
  isAuthenticated: boolean | null; // null while checking
  isLoading: boolean;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    // Optimistic fast check from localStorage
    return localStorage.getItem('madfin_auth') === '1' ? true : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check server session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await fetch('/api/session', {
          credentials: 'same-origin',
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.authenticated) {
              setIsAuthenticated(true);
              localStorage.setItem('madfin_auth', '1');
            } else {
              // If auth is not enabled at all (e.g. open local dev mode), allow entry
              if (data.enabled === false) {
                setIsAuthenticated(true);
              } else {
                setIsAuthenticated(false);
                localStorage.removeItem('madfin_auth');
              }
            }
          }
        } else {
          // If 404 or backend not responding, fallback to localStorage state
          if (isMounted) {
            setIsAuthenticated(localStorage.getItem('madfin_auth') === '1');
          }
        }
      } catch (err) {
        if (isMounted) {
          // Offline fallback
          setIsAuthenticated(localStorage.getItem('madfin_auth') === '1');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.error || 'Mot de passe incorrect ou erreur de connexion.';
        setError(errorMsg);
        setIsLoading(false);
        return false;
      }

      localStorage.setItem('madfin_auth', '1');
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Impossible de joindre le serveur. Vérifiez votre connexion.');
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (_) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('madfin_auth');
      setIsAuthenticated(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };
}
