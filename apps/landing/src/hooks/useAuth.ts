import { useState, useEffect } from 'react';
import { fetchCurrentUser, logoutUser, type AuthUser } from '../lib/apiClient';
import { PRODUCT_LOGIN_URL } from '../config/appConfig';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    
    const init = async () => {
      setLoading(true);
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    init();
  }, [initialized]);

  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
      // Redirect to login page
      window.location.href = PRODUCT_LOGIN_URL;
    } catch (err) {
      console.error('Logout error:', err);
      // Still clear user state and redirect
      setUser(null);
      window.location.href = PRODUCT_LOGIN_URL;
    }
  };

  return {
    user,
    loading,
    initialized,
    logout,
  };
}

