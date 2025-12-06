import { createContext, useContext, ReactNode } from 'react';

export type Theme = 'workyy-blue';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void; // Keep for backward compatibility, but does nothing
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme: Theme = 'workyy-blue';

  const setTheme = () => {
    // No-op: only one theme available
  };

  const toggleTheme = () => {
    // No-op: only one theme available
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
