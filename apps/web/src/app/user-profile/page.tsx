'use client';

import { User } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { RequireAuth } from '../../components/RequireAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../state/authStore';
import {
  CURSOR_COLORS,
  DEFAULT_CURSOR,
  useCursorSettingsStore,
} from '../../state/cursorSettingsStore';
import { useLocaleStore } from '../../state/localeStore';
import type { Locale } from '../../state/localeStore';
import { useNotificationsStore } from '../../state/notificationsStore';
import { useSettingsStore, NICKNAME_MAX } from '../../state/settingsStore';
import { useToastStore } from '../../state/toastStore';

type TabId = 'profile' | 'notifications' | 'preferences';

const INDUSTRY_OPTIONS: { value: string; labelEn: string; labelRu: string }[] = [
  { value: '', labelEn: '—', labelRu: '—' },
  { value: 'education', labelEn: 'Education', labelRu: 'Образование' },
  { value: 'technology', labelEn: 'Technology', labelRu: 'Технологии' },
  { value: 'finance', labelEn: 'Finance', labelRu: 'Финансы' },
  { value: 'healthcare', labelEn: 'Healthcare', labelRu: 'Здравоохранение' },
  { value: 'retail', labelEn: 'Retail', labelRu: 'Ритейл' },
  { value: 'other', labelEn: 'Other', labelRu: 'Другое' },
];

const ROLE_OPTIONS: { value: string; labelEn: string; labelRu: string }[] = [
  { value: '', labelEn: '—', labelRu: '—' },
  { value: 'teacher_student', labelEn: 'Teacher / Student', labelRu: 'Преподаватель / Студент' },
  { value: 'designer', labelEn: 'Designer', labelRu: 'Дизайнер' },
  { value: 'developer', labelEn: 'Developer', labelRu: 'Разработчик' },
  { value: 'manager', labelEn: 'Manager', labelRu: 'Менеджер' },
  { value: 'other', labelEn: 'Other', labelRu: 'Другое' },
];

function UserProfileContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, locale } = useTranslation();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const showToast = useToastStore((s) => s.show);

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [nickname, setNickname] = useState(profile.nickname);
  const [name, setName] = useState(profile.name || user?.name || '');
  const [organization, setOrganization] = useState(profile.organization);
  const [industry, setIndustry] = useState(profile.industry);
  const [role, setRole] = useState(profile.role);

  useEffect(() => {
    setNickname(profile.nickname);
    setName(profile.name || user?.name || '');
    setOrganization(profile.organization);
    setIndustry(profile.industry);
    setRole(profile.role);
  }, [
    profile.nickname,
    profile.name,
    profile.organization,
    profile.industry,
    profile.role,
    user?.name,
  ]);

  const handleProfileSave = () => {
    setProfile({ nickname, name, organization, industry, role });
    showToast(t.saved, 'success');
  };

  const handleSignOutEverywhere = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm(t.deleteAccountConfirm)) {
      showToast(t.changeEmailSoon, 'info');
      // TODO: integrate with backend delete account API
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            {t.goToBoards}
          </Link>
          <span className="text-slate-300">|</span>
          <h1 className="text-lg font-semibold text-slate-900">{t.profileSettings}</h1>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user && (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User size={20} weight="bold" />
              )}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white px-6">
        <nav className="flex gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`border-b-2 py-4 text-sm font-medium transition ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.settingsProfile}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`border-b-2 py-4 text-sm font-medium transition ${
              activeTab === 'notifications'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.notifications}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`border-b-2 py-4 text-sm font-medium transition ${
              activeTab === 'preferences'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.settingsSystem}
          </button>
        </nav>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            profile={profile}
            setProfile={setProfile}
            nickname={nickname}
            setNickname={setNickname}
            name={name}
            setName={setName}
            organization={organization}
            setOrganization={setOrganization}
            industry={industry}
            setIndustry={setIndustry}
            role={role}
            setRole={setRole}
            locale={locale}
            onSave={handleProfileSave}
            onSignOutEverywhere={handleSignOutEverywhere}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
      </main>
    </div>
  );
}

type ProfileTabProps = {
  user: { id: string; email: string; name?: string } | null;
  profile: ReturnType<typeof useSettingsStore.getState>['profile'];
  setProfile: ReturnType<typeof useSettingsStore.getState>['setProfile'];
  nickname: string;
  setNickname: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  organization: string;
  setOrganization: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  locale: Locale;
  onSave: () => void;
  onSignOutEverywhere: () => void;
  onDeleteAccount: () => void;
};

function ProfileTab({
  user,
  profile,
  setProfile,
  nickname,
  setNickname,
  name,
  setName,
  organization,
  setOrganization,
  industry,
  setIndustry,
  role,
  setRole,
  locale,
  onSave,
  onSignOutEverywhere,
  onDeleteAccount,
}: ProfileTabProps) {
  const { t } = useTranslation();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const showToast = useToastStore((s) => s.show);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setProfile({ avatarUrl: url.slice(0, 4096) });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      {/* Nickname, Name, Organization, Industry, Role */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.settingsNickname}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, NICKNAME_MAX))}
              maxLength={NICKNAME_MAX}
              placeholder={t.settingsNickname}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <p className="mt-1 text-xs text-slate-500">{t.nicknameHint}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t.organization}
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.industry}</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {locale === 'ru' ? o.labelRu : o.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.role}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {locale === 'ru' ? o.labelRu : o.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Profile picture */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">{t.profilePicture}</h3>
        <div className="flex items-start gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <User size={40} weight="bold" />
            )}
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-500">{t.defaultAvatar}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t.upload}
            </button>
          </div>
        </div>
      </section>

      {/* Language, Email, Password */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.language}</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  locale === 'en' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLocale('ru')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  locale === 'ru' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Русский
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.email}</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-900">{user?.email ?? '—'}</span>
              <button
                type="button"
                onClick={() => showToast(t.changeEmailSoon, 'info')}
                className="text-sm text-indigo-600 hover:underline"
              >
                {t.changeEmail}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t.password}</label>
            <button
              type="button"
              onClick={() => showToast(t.changePasswordSoon, 'info')}
              className="text-sm text-indigo-600 hover:underline"
            >
              {t.changePassword}
            </button>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t.privacy}</h3>
        <p className="mb-4 text-sm text-slate-500">{t.privacyHint}</p>
        <p className="text-xs text-slate-400">{t.changeEmailSoon}</p>
      </section>

      {/* Sign out, Delete */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <button
              type="button"
              onClick={onSignOutEverywhere}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              {t.signOutEverywhere}
            </button>
            <p className="mt-1 text-xs text-slate-500">{t.signOutEverywhereHint}</p>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onDeleteAccount}
              className="text-sm font-medium text-rose-600 hover:text-rose-700"
            >
              {t.deleteProfile}
            </button>
            <p className="mt-1 text-xs text-slate-500">{t.deleteProfileHint}</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { t } = useTranslation();
  const prefs = useNotificationsStore();
  const set = useNotificationsStore((s) => s.set);

  const Toggle = ({
    id,
    label,
    desc,
    checked,
    onChange,
  }: {
    id: string;
    label: string;
    desc?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${
          checked ? 'bg-indigo-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          {t.communicationPreferences}
        </h3>

        <div className="border-b border-slate-100 pb-4">
          <h4 className="mb-2 text-sm font-medium text-slate-700">{t.boardActivityConversation}</h4>
          <div className="divide-y divide-slate-100">
            <Toggle
              id="boardSharedWithMe"
              label={t.whenBoardSharedWithMe}
              checked={prefs.boardSharedWithMe}
              onChange={(v) => set('boardSharedWithMe', v)}
            />
            <Toggle
              id="boardSharedWithTeam"
              label={t.whenBoardSharedWithTeam}
              checked={prefs.boardSharedWithTeam}
              onChange={(v) => set('boardSharedWithTeam', v)}
            />
            <Toggle
              id="someoneRequestsAccessToMyBoard"
              label={t.whenSomeoneRequestsAccessToMyBoard}
              checked={prefs.someoneRequestsAccessToMyBoard}
              onChange={(v) => set('someoneRequestsAccessToMyBoard', v)}
            />
            <Toggle
              id="someoneCommentsInThreadsFollowing"
              label={t.whenSomeoneCommentsInThreadsFollowing}
              checked={prefs.someoneCommentsInThreadsFollowing}
              onChange={(v) => set('someoneCommentsInThreadsFollowing', v)}
            />
            <Toggle
              id="someoneMentionsMe"
              label={t.whenSomeoneMentionsMe}
              checked={prefs.someoneMentionsMe}
              onChange={(v) => set('someoneMentionsMe', v)}
            />
          </div>
        </div>

        <div className="border-b border-slate-100 py-4">
          <h4 className="mb-2 text-sm font-medium text-slate-700">{t.talktrackUpdates}</h4>
          <div className="flex items-center gap-4">
            <Toggle
              id="talktrackSummary"
              label={t.summaryOfChangesOnBoards}
              checked={prefs.talktrackSummaryEnabled}
              onChange={(v) => set('talktrackSummaryEnabled', v)}
            />
          </div>
        </div>

        <div className="border-b border-slate-100 py-4">
          <h4 className="mb-2 text-sm font-medium text-slate-700">{t.tables}</h4>
          <Toggle
            id="recordAssignedToMe"
            label={t.whenRecordAssignedToMe}
            checked={prefs.recordAssignedToMe}
            onChange={(v) => set('recordAssignedToMe', v)}
          />
        </div>

        <div className="border-b border-slate-100 py-4">
          <h4 className="mb-2 text-sm font-medium text-slate-700">{t.spaceActivity}</h4>
          <Toggle
            id="someoneAddsMeToSpace"
            label={t.whenSomeoneAddsMeToSpace}
            checked={prefs.someoneAddsMeToSpace}
            onChange={(v) => set('someoneAddsMeToSpace', v)}
          />
        </div>

        <div className="border-b border-slate-100 py-4">
          <h4 className="mb-2 text-sm font-medium text-slate-700">{t.teamActivity}</h4>
          <div className="divide-y divide-slate-100">
            <Toggle
              id="inviteesSignUp"
              label={t.whenInviteesSignUp}
              checked={prefs.inviteesSignUp}
              onChange={(v) => set('inviteesSignUp', v)}
            />
            <Toggle
              id="someoneRequestsAccessToTeam"
              label={t.whenSomeoneRequestsAccessToTeam}
              checked={prefs.someoneRequestsAccessToTeam}
              onChange={(v) => set('someoneRequestsAccessToTeam', v)}
            />
            <Toggle
              id="someoneInvitesMeToTeam"
              label={t.whenSomeoneInvitesMeToTeam}
              checked={prefs.someoneInvitesMeToTeam}
              onChange={(v) => set('someoneInvitesMeToTeam', v)}
            />
          </div>
        </div>

        <div className="py-4">
          <h4 className="mb-2 text-sm font-medium text-slate-700">{t.otherEmailUpdates}</h4>
          <div className="divide-y divide-slate-100">
            <Toggle
              id="tipsHowTos"
              label={t.tipsHowTos}
              desc={t.tipsHowTosDesc}
              checked={prefs.tipsAndHowTos}
              onChange={(v) => set('tipsAndHowTos', v)}
            />
            <Toggle
              id="productFeatureUpdates"
              label={t.productFeatureUpdates}
              desc={t.productFeatureUpdatesDesc}
              checked={prefs.productFeatureUpdates}
              onChange={(v) => set('productFeatureUpdates', v)}
            />
            <Toggle
              id="eventsPromotions"
              label={t.eventsPromotions}
              desc={t.eventsPromotionsDesc}
              checked={prefs.eventsPromotions}
              onChange={(v) => set('eventsPromotions', v)}
            />
            <Toggle
              id="surveysProductTesting"
              label={t.surveysProductTesting}
              desc={t.surveysProductTestingDesc}
              checked={prefs.surveysProductTesting}
              onChange={(v) => set('surveysProductTesting', v)}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => prefs.reset()}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            {t.unsubscribeFromAll}
          </button>
          <p className="mt-1 text-xs text-slate-500">{t.unsubscribeNote}</p>
        </div>
      </section>
    </div>
  );
}

function PreferencesTab() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);
  const setCursorColor = useCursorSettingsStore((s) => s.setCursorColor);
  const showToast = useToastStore((s) => s.show);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-800">{t.settingsSystem}</h3>
        <div className="space-y-4">
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
                />
              ))}
            </div>
          </div>
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
              onClick={() => {
                resetSettings();
                showToast(t.saved, 'success');
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t.resetSettings}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <RequireAuth>
      <UserProfileContent />
    </RequireAuth>
  );
}
