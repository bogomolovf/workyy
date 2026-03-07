import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCursorSettingsStore, CURSOR_COLORS } from './cursorSettingsStore';

// Profile schema for localStorage
export type ProfileData = {
  nickname: string;
  name: string;
  organization: string;
  industry: string;
  role: string;
  avatarUrl: string;
};

const PROFILE_DEFAULTS: ProfileData = {
  nickname: '',
  name: '',
  organization: '',
  industry: '',
  role: '',
  avatarUrl: '',
};

// Theme: light | dark | system
export type ThemeValue = 'light' | 'dark' | 'system';

const THEME_DEFAULT: ThemeValue = 'system';

// Validation limits
const NICKNAME_MAX = 32;
const NAME_MAX = 64;
const ORG_MAX = 128;

function clampStr(s: string, max: number): string {
  return s.slice(0, max);
}

type PersistedSettings = {
  profile: ProfileData;
  theme: ThemeValue;
  reduceMotion: boolean;
};

type SettingsState = PersistedSettings & {
  setProfile: (p: Partial<ProfileData>) => void;
  setTheme: (t: ThemeValue) => void;
  setReduceMotion: (v: boolean) => void;
  resetSettings: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      profile: PROFILE_DEFAULTS,
      theme: THEME_DEFAULT,
      reduceMotion: false,

      setProfile: (p) =>
        set((s) => ({
          profile: {
            nickname:
              p.nickname !== undefined ? clampStr(p.nickname, NICKNAME_MAX) : s.profile.nickname,
            name: p.name !== undefined ? clampStr(p.name, NAME_MAX) : s.profile.name,
            organization:
              p.organization !== undefined
                ? clampStr(p.organization, ORG_MAX)
                : s.profile.organization,
            industry: p.industry !== undefined ? clampStr(p.industry, 64) : s.profile.industry,
            role: p.role !== undefined ? clampStr(p.role, 64) : s.profile.role,
            avatarUrl:
              p.avatarUrl !== undefined ? String(p.avatarUrl).slice(0, 4096) : s.profile.avatarUrl,
          },
        })),

      setTheme: (t) => set({ theme: t }),

      setReduceMotion: (v) => set({ reduceMotion: v }),

      resetSettings: () => {
        set({
          profile: { ...PROFILE_DEFAULTS },
          theme: THEME_DEFAULT,
          reduceMotion: false,
        });
        useCursorSettingsStore.getState().setCursorColor(CURSOR_COLORS[5]);
      },
    }),
    {
      name: 'workyy.settings',
      partialize: (s) => ({
        profile: s.profile,
        theme: s.theme,
        reduceMotion: s.reduceMotion,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedSettings> | undefined;
        if (!p) return current;
        const raw = p.profile as Partial<ProfileData> | undefined;
        const profile =
          raw && typeof raw === 'object'
            ? {
                nickname: clampStr(String(raw.nickname ?? ''), NICKNAME_MAX),
                name: clampStr(String(raw.name ?? ''), NAME_MAX),
                organization: clampStr(String(raw.organization ?? ''), ORG_MAX),
                industry: clampStr(String(raw.industry ?? ''), 64),
                role: clampStr(String(raw.role ?? ''), 64),
                avatarUrl: String(raw.avatarUrl ?? '').slice(0, 4096),
              }
            : PROFILE_DEFAULTS;
        const theme =
          p.theme === 'light' || p.theme === 'dark' || p.theme === 'system'
            ? p.theme
            : THEME_DEFAULT;
        const reduceMotion = p.reduceMotion === true;
        return {
          ...current,
          profile,
          theme,
          reduceMotion,
        };
      },
    },
  ),
);

// Resolve effective theme (light/dark) from system preference when theme is 'system'
export function getEffectiveTheme(theme: ThemeValue): 'light' | 'dark' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Cursor color getter — single place for presence integration
export function getCursorColor(): string {
  const color = useCursorSettingsStore.getState().cursorColor;
  return color === 'default' ? '#94a3b8' : color;
}

export { NICKNAME_MAX, NAME_MAX, ORG_MAX };
