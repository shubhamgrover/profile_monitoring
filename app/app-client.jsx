'use client';

import { useState, useEffect } from 'react';
import Dashboard from '../components/Dashboard';
import UploadPage from '../components/UploadPage';
import ProfilesPage from '../components/ProfilesPage';
import PollPage from '../components/PollPage';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabaseClient';
import { REAL_PROFILES, REAL_SIGNALS, REAL_CREDITS } from '../lib/realData';
import IpIntelligencePage from '../components/IpIntelligencePage';
import SignalFeedPage from '../components/SignalFeedPage';
import DailyBriefPage from '../components/DailyBriefPage';
import OnboardingWizard from '../components/OnboardingWizard';

const NAV_ITEMS = [
  { id: 'opportunity', label: 'Opportunity Dashboard', icon: '📊' },
  { id: 'profiles', label: 'Watchlist & Control', icon: '👥' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState('brief');
  const [profiles, setProfiles] = useState([]);
  const [signals, setSignals] = useState([]);
  const [trackerId, setTrackerId] = useState(null);
  const [visitorLogs, setVisitorLogs] = useState([]);
  const [recentSignalIds, setRecentSignalIds] = useState(new Set());
  const [apiKey, setApiKey] = useState('cwG38owB6JPGD6YMF5VhTfrAeBn2');
  const [toast, setToast] = useState(null);
  const [credits, setCredits] = useState(REAL_CREDITS);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [targetDept, setTargetDept] = useState('Marketing');
  const [targetSeniority, setTargetSeniority] = useState('VP');
  const [onboardingSettings, setOnboardingSettings] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Parent-level correlate cache: key = "companyName|dept|seniority", value = correlate API result
  // This prevents re-fetching (and burning credits) every time a user re-opens a company dossier.
  const [correlateCache, setCorrelateCache] = useState({});

  // Load Onboarding Settings on mount
  useEffect(() => {
    const stored = localStorage.getItem('onboarding_settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      setOnboardingSettings(parsed);
      if (parsed.targetDept) setTargetDept(parsed.targetDept);
      if (parsed.targetSeniority) setTargetSeniority(parsed.targetSeniority);
    } else {
      setShowOnboarding(true);
    }
  }, []);

  // Listen for Authentication state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapProfile = (p) => ({
    ...p,
    linkedinUrl: p.linkedinUrl || p.linkedin_url,
    companyLinkedinUrl: p.companyLinkedinUrl || p.company_linkedin_url,
    lastPolled: p.lastPolled || p.last_polled,
    addedAt: p.addedAt || p.added_at,
  });

  const mapSignal = (s) => ({
    ...s,
    linkedinUrl: s.linkedinUrl || s.linkedin_url,
    profileLinkedinUrl: s.profileLinkedinUrl || s.profile_linkedin_url,
    postUrl: s.postUrl || s.post_url,
    detectedAt: s.detectedAt || s.detected_at,
  });

  // Fetch data or seed default profiles if project tables are empty
  useEffect(() => {
    if (!session?.user?.id) {
      setProfiles([]);
      setSignals([]);
      setTrackerId(null);
      setVisitorLogs([]);
      return;
    }

    async function hydrateCache() {
      // Only show full screen loader on initial hydration (profiles empty)
      if (profiles.length === 0) {
        setLoadingData(true);
      }
      try {
        const [profilesRes, signalsRes, trackersRes, logsRes] = await Promise.all([
          supabase.from('profiles').select('*').order('added_at', { ascending: false }),
          supabase.from('signals').select('*').order('detected_at', { ascending: false }),
          supabase.from('client_trackers').select('*'),
          supabase.from('visitor_logs').select('*').order('created_at', { ascending: false })
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (signalsRes.error) throw signalsRes.error;
        if (trackersRes.error) throw trackersRes.error;
        if (logsRes.error) throw logsRes.error;

        // Merge DB profiles with REAL_PROFILES: DB wins if same id exists, else REAL_PROFILES fills gaps
        const dbProfileIds = new Set((profilesRes.data || []).map(p => p.id));
        const mergedProfiles = [
          ...(profilesRes.data || []).map(mapProfile),
          ...REAL_PROFILES.filter(rp => !dbProfileIds.has(rp.id))
        ];
        setProfiles(mergedProfiles);

        // Merge DB signals with REAL_SIGNALS: DB wins on id collision
        const dbSignalIds = new Set((signalsRes.data || []).map(s => s.id));
        const mergedSignals = [
          ...(signalsRes.data || []).map(mapSignal),
          ...REAL_SIGNALS.filter(rs => !dbSignalIds.has(rs.id))
        ];
        setSignals(mergedSignals);
        setVisitorLogs(logsRes.data || []);

        let currentTrackerId = null;
        if (trackersRes.data && trackersRes.data.length > 0) {
          currentTrackerId = trackersRes.data[0].id;
          setTrackerId(currentTrackerId);
        } else {
          // Auto-generate a default tracker token for the user if they don't have one
          const { data: newTracker, error: trackerCreateErr } = await supabase
            .from('client_trackers')
            .insert({
              user_id: session.user.id,
              site_url: ''
            })
            .select()
            .single();

          if (trackerCreateErr) throw trackerCreateErr;
          if (newTracker) {
            currentTrackerId = newTracker.id;
            setTrackerId(currentTrackerId);
          }
        }
      } catch (err) {
        console.error("Error hydrating Supabase data cache:", err.message);
        showToast("⚠️ Error loading database cache");
      } finally {
        setLoadingData(false);
      }
    }

    hydrateCache();
  }, [session?.user?.id]);

  const refreshData = async () => {
    if (!session) return;
    try {
      const [profilesRes, signalsRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('added_at', { ascending: false }),
        supabase.from('signals').select('*').order('detected_at', { ascending: false }),
        supabase.from('visitor_logs').select('*').order('created_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (signalsRes.error) throw signalsRes.error;
      if (logsRes.error) throw logsRes.error;

      // Re-merge with REAL_PROFILES / REAL_SIGNALS to preserve snapshot data
      const dbProfileIds = new Set((profilesRes.data || []).map(p => p.id));
      setProfiles([
        ...(profilesRes.data || []).map(mapProfile),
        ...REAL_PROFILES.filter(rp => !dbProfileIds.has(rp.id))
      ]);

      const dbSignalIds = new Set((signalsRes.data || []).map(s => s.id));
      setSignals([
        ...(signalsRes.data || []).map(mapSignal),
        ...REAL_SIGNALS.filter(rs => !dbSignalIds.has(rs.id))
      ]);
      setVisitorLogs(logsRes.data || []);
    } catch (err) {
      console.error("Error refreshing Supabase state:", err);
    }
  };

  const handleUploaded = async (newProfiles) => {
    if (!session) return;
    try {
      const records = newProfiles.map(p => ({
        id: p.id,
        name: p.name,
        linkedin_url: p.linkedinUrl,
        company: p.company,
        company_linkedin_url: p.companyLinkedinUrl || '',
        title: p.title || '',
        email: p.email || '',
        notes: p.notes || '',
        status: p.status || 'pending',
        last_polled: p.lastPolled || null,
        added_at: p.addedAt || new Date().toISOString(),
        snapshots: p.snapshots || [],
        user_id: session.user.id
      }));

      const { error } = await supabase
        .from('profiles')
        .upsert(records, { onConflict: 'linkedin_url' });

      if (error) throw error;

      const creditsNeeded = newProfiles.length;
      setCredits(prev => ({ ...prev, used: prev.used + creditsNeeded }));
      showToast(`✅ ${newProfiles.length} profiles added to monitoring`);
      await refreshData();
    } catch (err) {
      console.error("Error saving uploaded profiles:", err.message);
      showToast("⚠️ Failed to save uploaded profiles");
    }
  };

  const handleSignalsDetected = async (newSignals) => {
    if (!session) return;
    try {
      const records = newSignals.map(s => ({
        id: s.id,
        type: s.type,
        priority: s.priority,
        label: s.label,
        emoji: s.emoji || '',
        why: s.why,
        action: s.action || '',
        credits: s.credits || 1,
        profile: s.profile || '',
        company: s.company || '',
        linkedin_url: s.linkedinUrl || '',
        profile_linkedin_url: s.profileLinkedinUrl || '',
        post_url: s.postUrl || '',
        detected_at: s.detectedAt || new Date().toISOString(),
        evidence: s.evidence || '',
        dismissed: s.dismissed || false,
        user_id: session.user.id
      }));

      if (records.length > 0) {
        const { error } = await supabase
          .from('signals')
          .upsert(records, { onConflict: 'id' });

        if (error) throw error;
      }

      const freshIds = new Set(newSignals.map(s => s.id));
      setRecentSignalIds(freshIds);
      setPage('dashboard');
      if (newSignals.length > 0) {
        showToast(`🚀 ${newSignals.length} new signal${newSignals.length > 1 ? 's' : ''} detected!`);
      }
      await refreshData();
    } catch (err) {
      console.error("Error saving detected signals:", err.message);
      showToast("⚠️ Failed to save detected signals");
    }
  };

  const handleDismissSignal = async (id) => {
    try {
      const { error } = await supabase
        .from('signals')
        .update({ dismissed: true })
        .eq('id', id);

      if (error) throw error;
      setSignals(prev => prev.map(s => s.id === id ? { ...s, dismissed: true } : s));
    } catch (err) {
      console.error("Error dismissing signal in Supabase:", err.message);
      showToast("⚠️ Failed to dismiss signal");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        Loading session...
      </div>
    );
  }

  // If the user is not authenticated, render the login/registration page
  if (!session) {
    return <Auth />;
  }

  if (loadingData) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        Loading database cache...
      </div>
    );
  }

  const remainingCredits = credits.remaining !== undefined ? credits.remaining : (credits.total - credits.used);
  const displayTotal = credits.remaining !== undefined && credits.remaining > credits.total ? 25000 : credits.total;
  const displayUsed = credits.remaining !== undefined && credits.remaining > credits.total ? (displayTotal - credits.remaining) : credits.used;
  const creditsUsedPct = Math.round((displayUsed / displayTotal) * 100);

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-logo">
          <div className="logo-icon">⚡</div>
          <div className="logo-text">SignalEngine</div>
        </div>

        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const isActive = item.id === 'opportunity' 
              ? (page === 'brief' || page === 'feed') 
              : (page === item.id);
            const handleClick = () => {
              if (item.id === 'opportunity') {
                setPage('brief');
              } else {
                setPage(item.id);
              }
            };
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={handleClick}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.id === 'opportunity' && signals.filter(s => !s.dismissed).length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {signals.filter(s => !s.dismissed).length}
                  </span>
                )}
              </button>
            );
          })}

          {/* Log Out button at the bottom of the navigation */}
          <button
            className="nav-item"
            onClick={handleLogout}
            style={{
              marginTop: 'auto',
              color: 'var(--signal-red)',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <span className="nav-icon">🚪</span>
            Log Out
          </button>
        </nav>

        <div className="sidebar-credits">
          <div className="credits-card">
            <div className="credits-label">Credits</div>
            <div className="credits-count">{remainingCredits} remaining</div>
            <div className="credits-bar-bg">
              <div className="credits-bar-fill" style={{ width: `${creditsUsedPct}%` }} />
            </div>
            <div className="credits-sub">
              {credits.plan === 'Pay-as-you-go'
                ? `${displayUsed} used this period · Pay-as-you-go`
                : `${displayUsed} of ${displayTotal} used · ${credits.plan}`}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        {(page === 'brief' || page === 'feed') && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {/* Top Sub-Nav Switcher */}
            <div style={{
              background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              padding: '12px 28px',
              display: 'flex',
              gap: 24,
              alignItems: 'center'
            }}>
              <button
                onClick={() => setPage('brief')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 4px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: page === 'brief' ? '#132D7D' : '#718096',
                  borderBottom: page === 'brief' ? '2px solid #132D7D' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s'
                }}
              >
                🎯 Today's Targets
              </button>
              <button
                onClick={() => setPage('feed')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 4px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: page === 'feed' ? '#132D7D' : '#718096',
                  borderBottom: page === 'feed' ? '2px solid #132D7D' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s'
                }}
              >
                📡 Signal Center
              </button>
            </div>
            {page === 'brief' ? (
              <Dashboard
                signals={signals.filter(s => !s.dismissed)}
                profiles={profiles}
                credits={credits}
                onNavigate={setPage}
                recentSignalIds={recentSignalIds}
                onDismiss={handleDismissSignal}
                targetDept={targetDept}
                setTargetDept={setTargetDept}
                targetSeniority={targetSeniority}
                setTargetSeniority={setTargetSeniority}
                correlateCache={correlateCache}
                setCorrelateCache={setCorrelateCache}
                userId={session?.user?.id}
                onProfilesUpdated={refreshData}
              />
            ) : (
              <SignalFeedPage
                signals={signals}
                profiles={profiles}
                onNavigate={setPage}
                onDismiss={handleDismissSignal}
                targetDept={targetDept}
                setTargetDept={setTargetDept}
                targetSeniority={targetSeniority}
                setTargetSeniority={setTargetSeniority}
                trackerId={trackerId}
                visitorLogs={visitorLogs}
                onRefresh={refreshData}
                onboardingSettings={onboardingSettings}
                correlateCache={correlateCache}
                setCorrelateCache={setCorrelateCache}
                userId={session?.user?.id}
              />
            )}
          </div>
        )}
        {page === 'upload' && (
          <UploadPage
            onUploaded={async (newProfiles) => {
              await handleUploaded(newProfiles);
            }}
            onNavigate={setPage}
            credits={{ remaining: credits.total - credits.used }}
          />
        )}
        {page === 'profiles' && (
          <ProfilesPage
            profiles={profiles}
            onNavigate={setPage}
            targetDept={targetDept}
            setTargetDept={setTargetDept}
            targetSeniority={targetSeniority}
            setTargetSeniority={setTargetSeniority}
            onUploaded={handleUploaded}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onProfilesUpdated={refreshData}
            onSignalsDetected={handleSignalsDetected}
            credits={{ remaining: credits.total - credits.used }}
          />
        )}
        {page === 'poll' && (
          <PollPage
            profiles={profiles}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onProfilesUpdated={refreshData}
            onSignalsDetected={handleSignalsDetected}
            onNavigate={setPage}
            targetDept={targetDept}
            targetSeniority={targetSeniority}
          />
        )}
      </main>

      {/* Onboarding Wizard Modal Overlay */}
      {showOnboarding && (
        <OnboardingWizard
          onSave={(settings) => {
            setOnboardingSettings(settings);
            if (settings.targetDept) setTargetDept(settings.targetDept);
            if (settings.targetSeniority) setTargetSeniority(settings.targetSeniority);
            showToast("🚀 Workspace initialized successfully!");
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="toast">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
