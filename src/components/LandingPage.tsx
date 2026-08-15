import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquarePlus,
  ShieldCheck,
  Zap,
  Sparkles,
  Headphones,
  Gamepad2,
  Tv,
  Code2,
  Globe,
  Globe2,
  Languages,
  RefreshCw,
  User,
  Cpu,
  Trophy,
  GraduationCap,
  Compass,
  Palette,
  Smile,
  BookOpen,
  Dumbbell,
  MessageSquare,
  Check,
  SlidersHorizontal,
  Users,
  AlertTriangle,
  Shield,
  Lock,
} from 'lucide-react';
import { UserProfile, OnlineStats } from '../types';
import { generateAnonymousUsername, validateUsername } from '../utils/username';
import { LANGUAGE_OPTIONS, COUNTRY_OPTIONS } from '../utils/options';

interface LandingPageProps {
  profile: UserProfile;
  onlineStats?: OnlineStats;
  hasConfirmedAge?: boolean;
  hasAcceptedRules?: boolean;
  isMaintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceEstimatedTime?: string;
  onOpenSafetyRules?: () => void;
  onOpenAdmin?: () => void;
  onOpenMaintenanceModal?: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onStartChat: (selectedTopic?: string, profile?: UserProfile) => void;
  onNavigateToChat?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  profile,
  onlineStats,
  hasConfirmedAge = false,
  hasAcceptedRules = false,
  isMaintenanceMode = false,
  maintenanceMessage,
  maintenanceEstimatedTime,
  onOpenSafetyRules,
  onOpenAdmin,
  onOpenMaintenanceModal,
  onUpdateProfile,
  onStartChat,
}) => {
  const [usernameInput, setUsernameInput] = useState<string>(profile.username);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile.interests || []);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(profile.language || 'Any');
  const [selectedCountry, setSelectedCountry] = useState<string>(profile.country || 'Any country');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const interestOptions = [
    { id: 'Gaming', label: 'Gaming', icon: Gamepad2 },
    { id: 'Music', label: 'Music', icon: Headphones },
    { id: 'Movies', label: 'Movies', icon: Tv },
    { id: 'Coding', label: 'Coding', icon: Code2 },
    { id: 'Technology', label: 'Technology', icon: Cpu },
    { id: 'Sports', label: 'Sports', icon: Trophy },
    { id: 'Study', label: 'Study', icon: GraduationCap },
    { id: 'Travel', label: 'Travel', icon: Compass },
    { id: 'Art', label: 'Art', icon: Palette },
    { id: 'Memes', label: 'Memes', icon: Smile },
    { id: 'Books', label: 'Books', icon: BookOpen },
    { id: 'Anime', label: 'Anime', icon: Sparkles },
    { id: 'Fitness', label: 'Fitness', icon: Dumbbell },
    { id: 'General Chat', label: 'General Chat', icon: MessageSquare },
  ];

  const handleShuffleUsername = () => {
    const newName = generateAnonymousUsername();
    setUsernameInput(newName);
    setUsernameError(null);
    onUpdateProfile({
      username: newName,
      interests: selectedInterests,
      language: selectedLanguage,
      country: selectedCountry,
    });
  };

  const handleUsernameChange = (val: string) => {
    setUsernameInput(val);
    const { sanitized } = validateUsername(val);
    if (!val.trim()) {
      setUsernameError('Username cannot be empty');
    } else if (val.trim().length < 2) {
      setUsernameError('Min 2 characters');
    } else if (val.trim().length > 20) {
      setUsernameError('Max 20 characters');
    } else {
      setUsernameError(null);
      onUpdateProfile({
        username: sanitized,
        interests: selectedInterests,
        language: selectedLanguage,
        country: selectedCountry,
      });
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    const { sanitized } = validateUsername(usernameInput);
    const validName = sanitized.length >= 2 ? sanitized : profile.username;
    onUpdateProfile({
      username: validName,
      interests: selectedInterests,
      language: lang,
      country: selectedCountry,
    });
  };

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    const { sanitized } = validateUsername(usernameInput);
    const validName = sanitized.length >= 2 ? sanitized : profile.username;
    onUpdateProfile({
      username: validName,
      interests: selectedInterests,
      language: selectedLanguage,
      country,
    });
  };

  const toggleInterest = (interestId: string) => {
    let updated: string[];
    if (selectedInterests.includes(interestId)) {
      updated = selectedInterests.filter((i) => i !== interestId);
    } else {
      updated = [...selectedInterests, interestId];
    }
    setSelectedInterests(updated);
    const { sanitized } = validateUsername(usernameInput);
    const validName = sanitized.length >= 2 ? sanitized : profile.username;
    onUpdateProfile({
      username: validName,
      interests: updated,
      language: selectedLanguage,
      country: selectedCountry,
    });
  };

  const isSafetyComplete = hasConfirmedAge && hasAcceptedRules;

  const handleStart = () => {
    if (isMaintenanceMode) {
      if (onOpenMaintenanceModal) {
        onOpenMaintenanceModal();
      } else {
        onStartChat('all', profile);
      }
      return;
    }
    if (!isSafetyComplete) {
      if (onOpenSafetyRules) onOpenSafetyRules();
      return;
    }
    const { sanitized } = validateUsername(usernameInput);
    const finalName = sanitized.length >= 2 ? sanitized : profile.username;
    const finalProfile: UserProfile = {
      username: finalName,
      interests: selectedInterests,
      language: selectedLanguage,
      country: selectedCountry,
    };
    onUpdateProfile(finalProfile);
    onStartChat('all', finalProfile);
  };

  const onlineCount = onlineStats?.onlineCount;
  const waitingCount = onlineStats?.waitingCount;

  return (
    <div className="relative min-h-[calc(100vh-60px)] flex flex-col items-center px-4 py-6 sm:py-8 max-w-4xl mx-auto overflow-x-hidden space-y-6 sm:space-y-8">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Maintenance Mode Alert Card */}
      {isMaintenanceMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-xl p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border border-amber-500/40 text-amber-100 flex items-start gap-3.5 shadow-xl shadow-amber-950/20 backdrop-blur-md z-20"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-amber-300 text-sm sm:text-base flex items-center gap-2">
              <span>StrangerChat Maintenance Active</span>
              <span className="text-[10px] uppercase font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                System Paused
              </span>
            </div>
            <p className="text-zinc-200 leading-relaxed">
              We are performing essential system updates. Matchmaking and live chat connections are temporarily disabled. Please check back shortly.
            </p>
          </div>
        </motion.div>
      )}

      {/* 1. HERO SECTION */}
      <section className="w-full flex flex-col items-center text-center space-y-4 z-10 pt-1 sm:pt-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-2.5 max-w-2xl"
        >
          {/* 1. Title */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Stranger<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">Chat</span>
          </h1>

          {/* 2. Tagline */}
          <p className="text-xl sm:text-2xl font-semibold text-zinc-200 tracking-tight">
            Talk to someone new.
          </p>

          {/* 3. Short Description */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Instant 1-on-1 anonymous text, voice, and video chat with people around the world. No registration required.
          </p>
        </motion.div>

        {/* 4. Start Chat Button (Single Main CTA) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="pt-1 flex flex-col items-center gap-2 w-full max-w-xs"
        >
          <button
            onClick={handleStart}
            disabled={!!usernameError}
            className={`group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-base sm:text-lg font-bold text-white rounded-2xl shadow-lg transition-all duration-200 w-full min-h-[48px] ${
              isMaintenanceMode
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-extrabold shadow-amber-500/20 active:scale-95'
                : isSafetyComplete
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25 hover:shadow-indigo-500/35 active:scale-95'
                : 'bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-zinc-200 border border-zinc-700 active:scale-95'
            }`}
            aria-label="Start Chat"
            title={isMaintenanceMode ? 'StrangerChat is under maintenance - Click to view status' : 'Start Chat'}
          >
            <MessageSquarePlus className="w-5 h-5 transition-transform group-hover:scale-110 shrink-0" />
            <span>{isMaintenanceMode ? 'Under Maintenance' : 'Start Chat'}</span>
            {isMaintenanceMode ? (
              <AlertTriangle className="w-4 h-4 text-slate-950 animate-pulse shrink-0 ml-0.5" />
            ) : (
              <Zap className="w-4 h-4 text-amber-300 animate-pulse shrink-0 ml-0.5" />
            )}
          </button>

          {isMaintenanceMode ? (
            <div
              onClick={handleStart}
              className="flex flex-col items-center gap-1 text-center bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 max-w-xs text-xs text-amber-200 cursor-pointer transition-colors"
            >
              <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Maintenance Active — Click for details</span>
              </span>
              <p className="text-[11px] text-amber-200/90 leading-tight">
                {maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.'}
              </p>
              {maintenanceEstimatedTime && (
                <span className="mt-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Return: {maintenanceEstimatedTime}
                </span>
              )}
            </div>
          ) : (
            !isSafetyComplete && (
              <span
                onClick={onOpenSafetyRules}
                className="text-[11px] font-medium text-amber-400/90 hover:text-amber-300 cursor-pointer underline underline-offset-2 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Complete Safety Check to Start</span>
              </span>
            )
          )}
        </motion.div>

        {/* 5. Real Online Count */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="pt-1"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-semibold text-zinc-200 shadow-sm">
            {onlineCount !== undefined ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>
                  <strong className="text-white font-bold">{onlineCount}</strong>{' '}
                  {onlineCount === 1 ? 'person' : 'people'} online
                </span>
                {waitingCount !== undefined && waitingCount > 0 && (
                  <span className="text-zinc-400 border-l border-zinc-800 pl-2 ml-1">
                    <strong className="text-indigo-300 font-bold">{waitingCount}</strong> looking
                  </span>
                )}
              </>
            ) : (
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                <span>Online count unavailable</span>
              </span>
            )}
          </div>
        </motion.div>
      </section>

      {/* 2. PROFILE CARD */}
      <section className="w-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-2xl mx-auto p-4 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 shadow-xl backdrop-blur-md text-left space-y-4"
        >
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
              <User className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Your Anonymous Profile</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Session Only
            </span>
          </div>

          {/* Temporary Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Temporary Username</span>
              {usernameError && <span className="text-rose-400 text-[10px] normal-case">{usernameError}</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => handleUsernameChange(e.target.value)}
                maxLength={20}
                placeholder="e.g. BlueFox42"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-100 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-600 min-h-[44px]"
              />
              <button
                type="button"
                onClick={handleShuffleUsername}
                title="Generate new username"
                className="flex items-center justify-center p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 active:scale-95 transition-all shrink-0 min-h-[44px] min-w-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Language & Country Dropdowns */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Match Preferences</span>
              </label>
              <span className="text-[10px] text-zinc-500">Optional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Language Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Languages className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>Language</span>
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-100 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer min-h-[44px]"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang} className="bg-zinc-900 text-zinc-100">
                      {lang === 'Any' ? 'Any language' : lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Country Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                  <Globe2 className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>Country</span>
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-100 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer min-h-[44px]"
                >
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country} className="bg-zinc-900 text-zinc-100">
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Interests Selection */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Interests</span>
              </label>
              <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                {selectedInterests.length} selected
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {interestOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedInterests.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleInterest(opt.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border min-h-[36px] ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-xs'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-zinc-400'}`} />
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-indigo-400 ml-0.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. SAFETY CHECK (Directly after profile/preferences) */}
      <section className="w-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="w-full max-w-2xl mx-auto p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Safety Check</span>
            </div>
            <button
              onClick={onOpenSafetyRules}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors min-h-[32px]"
            >
              Review Rules
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
            <div
              onClick={onOpenSafetyRules}
              className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all min-h-[44px] ${
                hasConfirmedAge
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              {hasConfirmedAge ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{hasConfirmedAge ? '✓ 18+ confirmed' : '⚠ 18+ confirmation required'}</span>
            </div>

            <div
              onClick={onOpenSafetyRules}
              className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all min-h-[44px] ${
                hasAcceptedRules
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              {hasAcceptedRules ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{hasAcceptedRules ? '✓ Community rules accepted' : '⚠ Community rules acceptance required'}</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 4. FEATURE CARDS */}
      <section id="about-section" className="w-full z-10 pt-1 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="w-full max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col items-start text-left space-y-1.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100">100% Anonymous</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              No registration or personal details required. Temporary session setup.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col items-start text-left space-y-1.5">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100">Instant Pairing</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Fast server-side matching queue connects you with online strangers globally.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col items-start text-left space-y-1.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100">Built-in Safety</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Instant report and block controls, anti-spam protection, and 18+ enforcement.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Footer Link for Admin */}
      <footer className="w-full text-center pt-2 pb-6 border-t border-zinc-800/40 z-10 text-[11px] text-zinc-500 flex items-center justify-center gap-4">
        <span>© {new Date().getFullYear()} StrangerChat</span>
        <span>•</span>
        <button
          onClick={onOpenAdmin || (() => { window.location.hash = 'admin'; })}
          className="hover:text-zinc-300 transition-colors font-medium underline underline-offset-2"
        >
          Admin Portal
        </button>
      </footer>

    </div>
  );
};
