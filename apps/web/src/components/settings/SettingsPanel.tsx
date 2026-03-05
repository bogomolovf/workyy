'use client';

import { X } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  CURSOR_COLORS,
  DEFAULT_CURSOR,
  useCursorSettingsStore,
} from '../../state/cursorSettingsStore';
import { useSettingsStore, NICKNAME_MAX, NAME_MAX } from '../../state/settingsStore';
import { useToastStore } from '../../state/toastStore';
type SettingsPanelProps = {
  onClose: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, locale } = useTranslation();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);
  const setCursorColor = useCursorSettingsStore((s) => s.setCursorColor);
  const showToast = useToastStore((s) => s.show);

  const [nickname, setNickname] = useState(profile.nickname);
  const [name, setName] = useState(profile.name);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(profile.nickname);
    setName(profile.name);
  }, [profile.nickname, profile.name]);

  const handleProfileSave = useCallback(() => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setNicknameError(locale === 'ru' ? 'Никнейм не должен быть пустым' : 'Nickname is required');
      return;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setNicknameError(
        locale === 'ru' ? `Максимум ${NICKNAME_MAX} символов` : `Max ${NICKNAME_MAX} characters`,
      );
      return;
    }
    setNicknameError(null);
    setProfile({
      nickname: trimmed,
      name: name.trim().slice(0, NAME_MAX),
    });
    showToast(t.saved, 'success');
  }, [nickname, name, setProfile, showToast, t, locale]);

  const handleProfileCancel = useCallback(() => {
    setNickname(profile.nickname);
    setName(profile.name);
    setNicknameError(null);
  }, [profile.nickname, profile.name]);

  const handleReset = useCallback(() => {
    if (window.confirm(t.resetSettingsConfirm)) {
      resetSettings();
      setNickname('');
      setName('');
      setNicknameError(null);
      showToast(t.saved, 'success');
    }
  }, [resetSettings, showToast, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl sm:w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="settings-title" className="text-xl font-semibold text-slate-900">
            {t.settingsTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label={t.cancel}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Profile */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.settingsProfile}
            </h3>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div>
                <label
                  htmlFor="settings-nickname"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  {t.settingsNickname}
                </label>
                <input
                  id="settings-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value.slice(0, NICKNAME_MAX));
                    setNicknameError(null);
                  }}
                  maxLength={NICKNAME_MAX}
                  placeholder={t.settingsNickname}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <p className="mt-1 text-xs text-slate-500">{t.nicknameHint}</p>
                {nicknameError && <p className="mt-1 text-xs text-rose-600">{nicknameError}</p>}
              </div>
              <div>
                <label
                  htmlFor="settings-name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  {t.settingsName}
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                  maxLength={NAME_MAX}
                  placeholder={t.settingsName}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleProfileSave}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {t.save}
                </button>
                <button
                  type="button"
                  onClick={handleProfileCancel}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </section>

          {/* System */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.settingsSystem}
            </h3>
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t.settingsTheme}
                </label>
                <div className="flex gap-2">
                  {(['light', 'dark', 'system'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTheme(v)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                        theme === v
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {v === 'light' ? t.themeLight : v === 'dark' ? t.themeDark : t.themeSystem}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t.settingsCursorColor}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCursorColor(DEFAULT_CURSOR)}
                    className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                      cursorColor === DEFAULT_CURSOR
                        ? 'border-slate-800 ring-2 ring-slate-300'
                        : 'border-slate-200 bg-white'
                    }`}
                    title={t.defaultCursor}
                    aria-label={t.defaultCursor}
                  />
                  {CURSOR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCursorColor(color)}
                      className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                        cursorColor === color
                          ? 'border-slate-800 ring-2 ring-slate-300'
                          : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color }}
                      title={t.selectColor(color)}
                      aria-label={t.selectColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Other */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.settingsOther}
            </h3>
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t.reduceMotion}</p>
                  <p className="text-xs text-slate-500">{t.reduceMotionHint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reduceMotion}
                  onClick={() => setReduceMotion(!reduceMotion)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${
                    reduceMotion ? 'bg-indigo-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                      reduceMotion ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {t.resetSettings}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Backdrop click to close */}
      <button
        type="button"
        className="absolute inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
