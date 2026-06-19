'use client';

import { useState, useEffect } from 'react';
import Dashboard from '../components/Dashboard';
import UploadPage from '../components/UploadPage';
import ProfilesPage from '../components/ProfilesPage';
import PollPage from '../components/PollPage';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabaseClient';
import { REAL_PROFILES, REAL_SIGNALS, REAL_CREDITS } from '../lib/realData';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Signal Dashboard', icon: '⚡' },
  { id: 'upload', label: 'Upload Profiles', icon: '📁' },
  { id: 'profiles', label: 'Monitored Profiles', icon: '👥' },
  { id: 'poll', label: 'Run Poll', icon: '🔄' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [profiles, setProfiles] = useState([]);
  const [signals, setSignals] = useState([]);
  const [recentSignalIds, setRecentSignalIds] = useState(new Set());
  const [apiKey, setApiKey] = useState('cwG38owB6JPGD6YMF5VhTfrAeBn2');
  const [toast, setToast] = useState(null);
  const [credits, setCredits] = useState(REAL_CREDITS);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

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
    if (!session) {
      setProfiles([]);
      setSignals([]);
      return;
    }

    async function hydrateCache() {
      setLoadingData(true);
      try {
        const [profilesRes, signalsRes] = await Promise.all([
          supabase.from('profiles').select('*').order('added_at', { ascending: false }),
          supabase.from('signals').select('*').order('detected_at', { ascending: false })
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (signalsRes.error) throw signalsRes.error;

        setProfiles((profilesRes.data || []).map(mapProfile));
        setSignals((signalsRes.data || []).map(mapSignal));
      } catch (err) {
        console.error("Error hydrating Supabase data cache:", err.message);
        showToast("⚠️ Error loading database cache");
      } finally {
        setLoadingData(false);
      }
    }

    hydrateCache();
  }, [session]);

  const refreshData = async () => {
    if (!session) return;
    try {
      const [profilesRes, signalsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('added_at', { ascending: false }),
        supabase.from('signals').select('*').order('detected_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (signalsRes.error) throw signalsRes.error;

      setProfiles((profilesRes.data || []).map(mapProfile));
      setSignals((signalsRes.data || []).map(mapSignal));
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
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'dashboard' && signals.filter(s => s.priority === 'urgent' && !s.dismissed).length > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--signal-red)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {signals.filter(s => s.priority === 'urgent' && !s.dismissed).length}
                </span>
              )}
            </button>
          ))}

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
        {page === 'dashboard' && (
          <Dashboard
            signals={signals.filter(s => !s.dismissed)}
            profiles={profiles}
            credits={credits}
            onNavigate={setPage}
            recentSignalIds={recentSignalIds}
            onDismiss={handleDismissSignal}
          />
        )}
        {page === 'upload' && (
          <UploadPage
            onUploaded={handleUploaded}
            onNavigate={setPage}
            credits={{ remaining: credits.total - credits.used }}
          />
        )}
        {page === 'profiles' && (
          <ProfilesPage
            profiles={profiles}
            onNavigate={setPage}
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
          />
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <div className="toast">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
