'use client';

import { useState, useEffect } from 'react';
import { synthesizeCompanyAccount } from '../lib/synthesisEngine';
import { MOCK_SIGNALS, MOCK_CREDITS, MOCK_PROFILES } from '../lib/mockData';
import { supabase } from '../lib/supabaseClient';
import { reweightSignal } from '../lib/signalEngine';

export function cleanDomain(companyName, linkedinUrl) {
  if (linkedinUrl && linkedinUrl.includes('linkedin.com/company/')) {
    const handle = linkedinUrl.split('/company/')[1]?.split('?')[0]?.replace(/\/+$/, '') || '';
    if (handle) {
      let cleanHandle = handle.toLowerCase()
        .replace(/-?(inc|llc|ltd|co|corp|corporation|group|consultancy|agency|technologies|systems|solutions|software|services|datadrivenbuildingoperations|digitalmarketingconsultancy)\b/gi, '')
        .replace(/[^a-z0-9\-]/g, '')
        .replace(/^-+|-+$/g, '');
      if (cleanHandle) {
        if (cleanHandle === 'factors-ai') return 'factorsai.com';
        if (cleanHandle === 'coram-ai' || cleanHandle === 'coram') return 'coramai.com';
        if (cleanHandle === 'moengageinc' || cleanHandle === 'moengage') return 'moengage.com';
        if (cleanHandle === 'facilioinc' || cleanHandle === 'facilio') return 'facilio.com';
        if (cleanHandle === 'digldnadigitalmarketingconsultancy' || cleanHandle === 'digidna') return 'digidna.in';
        return `${cleanHandle}.com`;
      }
    }
  }

  if (!companyName || companyName === 'Unknown') return 'unknown.com';
  const domainMatch = companyName.toLowerCase().match(/\b([a-z0-9\-]+\.(com|ai|io|in|co|org|net|us|dev))\b/i);
  if (domainMatch) return domainMatch[1];

  let clean = companyName.split(/[:\-|]/)[0].trim();
  clean = clean.replace(/\b(inc|llc|ltd|co|corp|corporation|group|consultancy|agency|technologies|systems|solutions|software|services)\b/gi, '').trim();
  clean = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean.includes('facilio')) return 'facilio.com';
  if (clean.includes('moengage')) return 'moengage.com';
  if (clean.includes('factors')) return 'factorsai.com';
  if (clean.includes('coram')) return 'coramai.com';
  if (clean.includes('digidna') || clean.includes('digldna')) return 'digidna.in';

  return clean ? `${clean}.com` : 'unknown.com';
}

const CONTEXT_DEV_CLIENT_ID = 'brandLL_46718e0a71177164dc42031e8c8e55e16d4561aeedbe4bd7';

// --- Utility: logo URL ---
export function getLogoUrl(domain) {
  if (!domain) return 'https://logo.clearbit.com/linkedin.com';
  return `https://logos.context.dev/?publicClientId=${CONTEXT_DEV_CLIENT_ID}&domain=${domain}`;
}

// --- Priority config ---
const PRIORITY_CONFIG = {
  urgent: { label: 'Act Now',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
  week:   { label: 'This Week', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  watch:  { label: 'Watch',     color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.15)' },
};

// --- Mission Target Card ---
function MissionTarget({ rank, group, isDone, isSkipped, onDone, onSkip, onOpenDetail, targetDept, dynamicContact }) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const pCfg = PRIORITY_CONFIG[group.priority] || PRIORITY_CONFIG.watch;
  const logoUrl = getLogoUrl(group.domain);

  const primaryContact   = group.signals[0];
  const isPersonProfile = primaryContact?.profile && primaryContact.profile.toLowerCase() !== group.company?.toLowerCase();

  const alternateContact = isPersonProfile ? null : (dynamicContact || group.alternateContacts?.[0]);
  // Try to get the real title from multiple sources: snapData, uploaded profile, or alternateContact
  const uploadedProfile = group.snapData?.currentTitle || group.snapData?.title || null;
  const contactName  = isPersonProfile 
    ? primaryContact?.profile 
    : (alternateContact?.name
       || (primaryContact?.profile && primaryContact.profile.toLowerCase() !== group.company.toLowerCase()
           ? primaryContact.profile : 'Key Decision Maker'));
  const contactTitle = isPersonProfile 
    ? (uploadedProfile || alternateContact?.title || null)
    : (alternateContact?.title || (primaryContact?.label?.includes('Hiring') ? 'HR / Hiring Director' : null));
  const contactUrl = isPersonProfile
    ? (primaryContact?.profileLinkedinUrl || primaryContact?.linkedinUrl || 'https://www.linkedin.com')
    : (alternateContact?.url || primaryContact?.profileLinkedinUrl || primaryContact?.linkedinUrl || 'https://www.linkedin.com');
  const isFallbackContact = isPersonProfile ? false : (alternateContact?.isFallback || false);

  const topSignal   = group.signals[0];
  const signalEmoji  = topSignal?.emoji || group.synthesis?.emoji || '\u{1F4CA}';
  const signalReason = topSignal?.label || group.synthesis?.conclusion || 'Signal detected';
  const signalDetail = group.synthesis?.strategicShift || '';

  const handleCopyEmail = () => {
    const t = group.synthesis?.templates?.email;
    if (!t) return;
    navigator.clipboard.writeText(`Subject: ${t.subject}\n\n${t.body}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div style={{
      background: isDone ? 'rgba(16,185,129,0.04)' : 'var(--bg-surface)',
      border: isDone ? '1px solid rgba(16,185,129,0.3)' : `1px solid ${pCfg.border}`,
      borderRadius: 0,
      padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
      opacity: isSkipped ? 0.5 : 1,
      transition: 'all 0.2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* left ribbon */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: isDone ? 'var(--signal-green)' : pCfg.color, borderRadius: 0 }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8 }}>
        {/* rank badge */}
        <div style={{ width: 26, height: 26, borderRadius: 0, background: isDone ? 'var(--signal-green-bg)' : pCfg.bg, border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : pCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: isDone ? 'var(--signal-green)' : pCfg.color, flexShrink: 0 }}>
          {isDone ? '\u2713' : rank}
        </div>

        {/* logo */}
        <div style={{ width: 34, height: 34, borderRadius: 0, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 3, flexShrink: 0 }}>
          <img src={logoUrl} alt="" onError={e => { e.target.src = `https://logo.clearbit.com/${group.domain || 'linkedin.com'}`; }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        {/* company + contact */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{group.company}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{'\u2192'} {contactName}{contactTitle ? ` \u00B7 ${contactTitle}` : ''}</span>
            {isFallbackContact && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '1px 5px',
                borderRadius: 0,
                display: 'inline-flex',
                alignItems: 'center'
              }}>
                ⚠️ No {targetDept} lead — showing CEO
              </span>
            )}
          </div>
        </div>

        {/* priority badge */}
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: isDone ? 'var(--signal-green-bg)' : pCfg.bg, color: isDone ? 'var(--signal-green)' : pCfg.color, border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : pCfg.border}`, borderRadius: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {isDone ? '\u2713 Done' : `\u26A1 ${pCfg.label}`}
        </span>
      </div>

      {/* signal reason */}
      <div style={{ paddingLeft: 8, display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{signalEmoji}</span>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{signalReason}</span>
          {signalDetail && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
              {signalDetail.length > 130 ? signalDetail.slice(0, 130) + '\u2026' : signalDetail}
            </div>
          )}
        </div>
      </div>

      {/* action buttons */}
      {!isDone && !isSkipped && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingLeft: 8 }}>
          <button onClick={handleCopyEmail} style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600, borderRadius: 0, background: copiedEmail ? 'var(--signal-green-bg)' : 'var(--accent-blue-glow)', border: `1px solid ${copiedEmail ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`, color: copiedEmail ? 'var(--signal-green)' : 'var(--accent-blue)', cursor: 'pointer' }}>
            {copiedEmail ? '\u2705 Copied!' : '\u{1F4E7} Copy Email'}
          </button>
          <a href={contactUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600, borderRadius: 0, background: 'rgba(19, 45, 125, 0.08)', border: '1px solid rgba(19, 45, 125, 0.2)', color: '#132D7D', textDecoration: 'none' }}>
            {'\u{1F4BC}'} LinkedIn
          </a>
          <button onClick={() => onOpenDetail(group)} style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600, borderRadius: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {'\u{1F50D}'} Why {'\u2192'}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={onDone} style={{ padding: '6px 13px', fontSize: 12, fontWeight: 700, borderRadius: 0, background: 'var(--signal-green-bg)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--signal-green)', cursor: 'pointer' }}>
              {'\u2713'} Done
            </button>
            <button onClick={onSkip} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 0, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {'\u23ED'}
            </button>
          </div>
        </div>
      )}
      {isDone && (
        <div style={{ paddingLeft: 8, fontSize: 12, color: 'var(--signal-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {'\u2713'} Reached out today
          <button onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>Undo</button>
        </div>
      )}
    </div>
  );
}

// --- Signal Feed Row ---
function SignalFeedRow({ signal, onDismiss, onOpenDetail }) {
  const [isHovered, setIsHovered] = useState(false);
  const pCfg = PRIORITY_CONFIG[signal.priority] || PRIORITY_CONFIG.watch;
  const ms = Date.now() - new Date(signal.detectedAt).getTime();
  const h  = Math.floor(ms / 3600000);
  const elapsed = h < 1 ? `${Math.floor(ms / 60000)}m ago` : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;

  return (
    <div 
      onClick={() => onOpenDetail && onOpenDetail()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: '9px 12px', 
        borderRadius: 0, 
        background: isHovered ? 'var(--bg-card)' : 'var(--bg-elevated)', 
        border: isHovered ? '1px solid var(--border-light)' : '1px solid var(--border)', 
        transition: 'all 0.15s ease',
        cursor: onOpenDetail ? 'pointer' : 'default'
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{signal.emoji || '\u{1F4E2}'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{signal.company}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>{signal.label}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{signal.source} {'\u00B7'} {elapsed}</div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}`, borderRadius: 0, flexShrink: 0 }}>{pCfg.label}</span>
      <button onClick={(e) => { e.stopPropagation(); onDismiss(signal.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 5px', fontSize: 15, flexShrink: 0 }}>{'\u00D7'}</button>
    </div>
  );
}

// --- Main Dashboard ---
export default function Dashboard({ signals: propSignals, profiles: propProfiles, credits, onNavigate, recentSignalIds, onDismiss, targetDept = 'Marketing', setTargetDept, targetSeniority = 'VP', setTargetSeniority, correlateCache = {}, setCorrelateCache, userId, onProfilesUpdated }) {
  const [signals, setSignals]       = useState(propSignals || MOCK_SIGNALS);
  const profiles = propProfiles || MOCK_PROFILES;
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [triggerCategoryFilter, setTriggerCategoryFilter] = useState('all');
  const [doneSet, setDoneSet]       = useState(new Set());
  const [skipSet, setSkipSet]       = useState(new Set());
  const [detailGroup, setDetailGroup] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress]     = useState('');
  const [emailStatus, setEmailStatus]       = useState(null);
  const [sendingEmail, setSendingEmail]     = useState(false);
  const [feedExpanded, setFeedExpanded]     = useState(true);
  const [dynamicContacts, setDynamicContacts] = useState({});
  const [resolvingStatus, setResolvingStatus] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [viewedCompanies, setViewedCompanies] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('viewed_companies');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const markCompanyAsViewed = (companyName) => {
    if (!viewedCompanies.includes(companyName)) {
      const updated = [...viewedCompanies, companyName];
      setViewedCompanies(updated);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('viewed_companies', JSON.stringify(updated));
      }
    }
  };

  // Disabled automatic pre-fetching loop to prevent Exa search credit waste and load delays.
  // Contacts are loaded dynamically on demand when dossiers are opened.
  useEffect(() => {}, []);

  useEffect(() => { if (propSignals) setSignals(propSignals); }, [propSignals]);

  const handleOpenDetail = (grp, index) => {
    setDetailGroup(grp);
    setSelectedIndex(index);
    markCompanyAsViewed(grp.company);
  };

  const handleDismiss = (id) => {
    setSignals(prev => prev.filter(s => s.id !== id));
    if (onDismiss) onDismiss(id);
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailAddress) return;
    setSendingEmail(true); setEmailStatus(null);
    try {
      const res  = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: emailAddress, signals: filtered }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setEmailStatus({ type: 'success', message: 'Email sent!' });
      setTimeout(() => { setShowEmailModal(false); setEmailStatus(null); }, 2000);
    } catch (err) {
      setEmailStatus({ type: 'error', message: err.message });
    } finally { setSendingEmail(false); }
  };

  // ----- Filtering -----
  const activeReweightedSignals = signals.map(s => reweightSignal(s, targetDept));

  const filtered = activeReweightedSignals.filter(s => {
    if (s.dismissed) return false;
    if (filter !== 'all' && s.priority !== filter) return false;
    if (triggerCategoryFilter !== 'all') {
      const typeLower = (s.type || s.signal_type || '').toLowerCase();
      const categoryLower = triggerCategoryFilter.toLowerCase();
      if (!typeLower.includes(categoryLower)) return false;
    }
    if (search && !s.profile?.toLowerCase().includes(search.toLowerCase()) && !s.company?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const validFiltered = filtered.map(s => {
    let comp = (s.company || '').trim();
    if (!comp || comp.toLowerCase() === 'unknown' || comp.toLowerCase() === 'unknown company') {
      const profile = profiles.find(p => (p.name || '').toLowerCase() === (s.profile || '').toLowerCase());
      if (profile && profile.company && profile.company !== 'Unknown' && profile.company !== '') {
        return { ...s, company: profile.company };
      }
      return { ...s, company: s.profile || 'Unresolved Lead' };
    }
    return s;
  });

  // ----- Snapshot lookup -----
  const getSnap = (companyName) => {
    if (!companyName || companyName.toLowerCase() === 'unknown') return { jobOpenings: [], sitemapLinks: [], prMentions: [] };
    const p = profiles.find(p => (p.company || '').toLowerCase() === companyName.toLowerCase() || (p.name || '').toLowerCase() === companyName.toLowerCase());
    if (p?.snapshots?.length > 0) return p.snapshots[p.snapshots.length - 1];
    const cs = signals.filter(s => s.company?.toLowerCase() === companyName.toLowerCase());
    return { jobOpenings: cs.filter(s => s.type === 'hiring_surge').map(s => ({ title: s.label })), sitemapLinks: [], prMentions: [] };
  };

  // ----- Group by company -----
  const companyGroups = {};
  validFiltered.forEach(s => {
    const comp = s.company;
    if (!companyGroups[comp]) {
      const snapData  = getSnap(comp);
      const synthesis = snapData.synthesis || synthesizeCompanyAccount(comp, snapData, targetDept);
      const profile   = profiles.find(p => (p.company || '').toLowerCase() === comp.toLowerCase() || (p.name || '').toLowerCase() === comp.toLowerCase());
      const domain = cleanDomain(comp, snapData.resolvedDomain || profile?.companyLinkedinUrl || profile?.linkedinUrl);
      companyGroups[comp] = { company: comp, domain, signals: [], latestDetectedAt: s.detectedAt, priority: s.priority, synthesis, alternateContacts: snapData.alternateContacts || [], snapData };
    }
    
    // Deduplicate identical signals for this company
    const isDuplicate = companyGroups[comp].signals.some(existing => 
      existing.type === s.type && 
      existing.label === s.label && 
      existing.why === s.why &&
      existing.profile === s.profile
    );
    
    if (!isDuplicate) {
      companyGroups[comp].signals.push(s);
    }
    
    if (s.priority === 'urgent') companyGroups[comp].priority = 'urgent';
    else if (s.priority === 'week' && companyGroups[comp].priority !== 'urgent') companyGroups[comp].priority = 'week';
    if (new Date(s.detectedAt) > new Date(companyGroups[comp].latestDetectedAt)) companyGroups[comp].latestDetectedAt = s.detectedAt;
  });

  const groupedCompanies = Object.values(companyGroups).sort((a, b) => {
    const p = { urgent: 0, week: 1, watch: 2 };
    const d = (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
    return d !== 0 ? d : new Date(b.latestDetectedAt) - new Date(a.latestDetectedAt);
  });

  // Keyboard navigation for global prioritized table/drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!groupedCompanies.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev < groupedCompanies.length - 1 ? prev + 1 : 0;
          setDetailGroup(groupedCompanies[next]);
          markCompanyAsViewed(groupedCompanies[next].company);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev > 0 ? prev - 1 : groupedCompanies.length - 1;
          setDetailGroup(groupedCompanies[next]);
          markCompanyAsViewed(groupedCompanies[next].company);
          return next;
        });
      } else if (e.key === 'Escape') {
        setDetailGroup(null);
        setSelectedIndex(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [groupedCompanies]);

  const missionTargets = groupedCompanies.filter(g => !skipSet.has(g.company) || doneSet.has(g.company)).slice(0, 3);
  const doneCount   = [...doneSet].filter(c => groupedCompanies.some(g => g.company === c)).length;
  const missionTotal = Math.min(groupedCompanies.length, 3);

  const urgentCount = activeReweightedSignals.filter(s => s.priority === 'urgent' && !s.dismissed).length;
  const signalCount = activeReweightedSignals.filter(s => !s.dismissed).length;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr  = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <>
      {/* Top Bar */}
      <div className="topbar" style={{ padding: '0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Signal Dashboard</div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--signal-green)', background: 'var(--signal-green-bg)', padding: '2px 9px', borderRadius: 0, border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="live-dot" /> Live
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {urgentCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '3px 9px', borderRadius: 0, border: '1px solid rgba(239,68,68,0.2)' }}>
              {'\u{1F534}'} {urgentCount} urgent
            </span>
          )}
          <button className="btn btn-secondary" style={{ padding: '6px 13px', fontSize: 12 }} onClick={() => setShowEmailModal(true)}>
            {'\u{1F4E7}'} Email Digest
          </button>
          <button className="btn btn-primary" style={{ padding: '6px 13px', fontSize: 12 }} onClick={() => onNavigate('poll')}>
            {'\u26A1'} Run Poll
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

        {/* === Executive Header === */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {greeting}, Shubham {'\u{1F44B}'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {dateStr}
          </p>
        </div>

        {/* === Executive Metrics Dashboard Bar === */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            padding: '14px 18px',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monitored Targets</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{profiles.length}</span>
          </div>
          
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            padding: '14px 18px',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Signals</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{signalCount}</span>
          </div>

          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            padding: '14px 18px',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Surging Today</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#FF2A00' }}>
              {groupedCompanies.filter(grp => 
                (grp.synthesis?.surgeScore && grp.synthesis.surgeScore > 75) || 
                grp.priority === 'urgent'
              ).length}
            </span>
          </div>
        </div>

        {/* Consolidated Horizontal Filter Toolbar */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          padding: '12px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          {/* Left search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px' }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts/contacts..."
              style={{
                fontSize: 12,
                padding: '6px 10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                maxWidth: 240
              }}
            />
          </div>

          {/* Right filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Urgency */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>Urgency:</span>
              {[['all','All'], ['urgent','Urgent'], ['week','Week'], ['watch','Watch']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    background: filter === val ? '#132D7D' : 'rgba(19, 45, 125, 0.05)',
                    border: `1px solid ${filter === val ? '#132D7D' : 'rgba(19, 45, 125, 0.15)'}`,
                    color: filter === val ? 'white' : '#132D7D',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Trigger Category */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trigger:</span>
              <select
                value={triggerCategoryFilter}
                onChange={(e) => setTriggerCategoryFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="all">All Triggers</option>
                <option value="product">Product / Sitemaps</option>
                <option value="funding">Funding</option>
                <option value="hiring">Hiring</option>
                <option value="media">Media Push</option>
                <option value="thought">Thought Leadership</option>
              </select>
            </div>

            {/* Dept */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dept:</span>
              <select 
                value={targetDept} 
                onChange={(e) => setTargetDept(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {['Marketing', 'Sales', 'HR', 'Engineering', 'Operations', 'Product'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Seniority */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Seniority:</span>
              <select 
                value={targetSeniority} 
                onChange={(e) => setTargetSeniority(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {['C-Suite', 'VP', 'Director', 'Manager', 'All'].map(s => (
                  <option key={s} value={s}>{s === 'All' ? 'All Tiers' : s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* === Global Active Intent Feed (Prioritized Table) === */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          overflow: 'hidden',
          marginBottom: 32
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Prioritized Accounts</h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FF2A00', background: 'rgba(255, 42, 0, 0.08)', padding: '2px 8px', border: '1px solid rgba(255, 42, 0, 0.15)' }}>
                {groupedCompanies.length} Active Accounts
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Use <kbd style={{ background: '#eee', padding: '2px 4px', border: '1px solid #ccc', borderRadius: 2 }}>&darr;</kbd> / <kbd style={{ background: '#eee', padding: '2px 4px', border: '1px solid #ccc', borderRadius: 2 }}>&uarr;</kbd> arrow keys to scan dossiers
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', width: 40 }}>Read</th>
                  <th style={{ padding: '12px 16px' }}>Account Name</th>
                  <th style={{ padding: '12px 16px', width: 100 }}>Urgency</th>
                  <th style={{ padding: '12px 16px', width: 110 }}>Surge Score</th>
                  <th style={{ padding: '12px 16px' }}>Primary Trigger</th>
                  <th style={{ padding: '12px 16px' }}>Contact Alignment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', width: 120 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedCompanies.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No active accounts matching current filters.
                    </td>
                  </tr>
                ) : (
                  groupedCompanies.map((grp, index) => {
                    const isViewed = viewedCompanies.includes(grp.company);
                    const isSelected = selectedIndex === index;
                    const pCfg = PRIORITY_CONFIG[grp.priority] || PRIORITY_CONFIG.watch;
                    
                    const dynamicContact = dynamicContacts[`${grp.company}-${targetDept}-${targetSeniority}`];
                    const topSignal = grp.signals[0];
                    const isPersonProfile = topSignal?.profile && topSignal.profile.toLowerCase() !== grp.company?.toLowerCase();
                    const alternateContact = isPersonProfile ? null : (dynamicContact || grp.alternateContacts?.[0]);
                    const contactName = isPersonProfile 
                      ? topSignal?.profile 
                      : (alternateContact?.name || (topSignal?.profile && topSignal.profile.toLowerCase() !== grp.company.toLowerCase() ? topSignal.profile : 'Key Stakeholder'));
                    const contactTitle = isPersonProfile ? (grp.snapData?.currentTitle || grp.snapData?.title || alternateContact?.title || null) : (alternateContact?.title || null);

                    const surgeColor = (grp.synthesis?.surgeScore || 50) > 80 ? '#FF2A00' : ((grp.synthesis?.surgeScore || 50) > 50 ? '#f59e0b' : '#3b82f6');

                    return (
                      <tr 
                        key={grp.company}
                        onClick={() => handleOpenDetail(grp, index)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isSelected ? 'rgba(19, 45, 125, 0.06)' : (isViewed ? 'rgba(255,255,255,0.01)' : 'rgba(255, 42, 0, 0.02)'),
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Status / Checkbox */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <span 
                            title={isViewed ? 'Viewed dossier' : 'Unviewed company'}
                            style={{ 
                              display: 'inline-flex', 
                              width: 16, 
                              height: 16, 
                              borderRadius: '50%', 
                              background: isViewed ? 'var(--signal-green-bg)' : '#FF2A00', 
                              color: isViewed ? 'var(--signal-green)' : 'white',
                              border: isViewed ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255, 42, 0, 0.2)',
                              fontSize: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold'
                            }}
                          >
                            {isViewed ? '✓' : '•'}
                          </span>
                        </td>

                        {/* Account Name */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 0, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2, flexShrink: 0 }}>
                              <img src={getLogoUrl(grp.domain)} alt="" onError={e => { e.target.src = `https://logo.clearbit.com/${grp.domain || 'linkedin.com'}`; }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            <div>
                              <div>{grp.company}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{grp.domain}</div>
                            </div>
                          </div>
                        </td>

                        {/* Urgency */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}`, borderRadius: 0 }}>
                            {pCfg.label}
                          </span>
                        </td>

                        {/* Surge Score / Velocity */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, color: surgeColor }}>{grp.synthesis?.surgeScore || 50}</span>
                            <div style={{ flex: 1, minWidth: 40, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${grp.synthesis?.surgeScore || 50}%`, height: '100%', background: surgeColor }} />
                            </div>
                          </div>
                        </td>

                        {/* Primary Trigger Category */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span style={{ fontSize: 14, marginRight: 4 }}>{grp.synthesis?.emoji}</span>
                          {grp.synthesis?.conclusion || 'Active Signal'}
                        </td>

                        {/* Contact Alignment */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <a 
                            href={isPersonProfile ? (topSignal?.profileLinkedinUrl || topSignal?.linkedinUrl || 'https://www.linkedin.com') : (alternateContact?.url || topSignal?.profileLinkedinUrl || topSignal?.linkedinUrl || 'https://www.linkedin.com')}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <div style={{ fontWeight: 600, color: '#132D7D' }}>
                              {contactName} <span style={{ fontSize: 9 }}>↗</span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{contactTitle}</div>
                          </a>
                        </td>

                        {/* Action */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600 }}
                            onClick={(e) => { e.stopPropagation(); handleOpenDetail(grp, index); }}
                          >
                            Dossier &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* === Detail Drawer === */}
      {detailGroup && (
        <div 
          className="modal-overlay" 
          onClick={() => { setDetailGroup(null); setSelectedIndex(-1); }} 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 999,
            display: 'flex',
            justifyContent: 'flex-end', 
            alignItems: 'stretch'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ 
              width: '50vw', 
              minWidth: '480px',
              maxWidth: '90vw', 
              height: '100vh', 
              background: 'var(--bg-surface)', 
              borderLeft: '1px solid var(--border)', 
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex', 
              flexDirection: 'column', 
              overflowY: 'auto'
            }}
          >
            <CompanyDetailDrawer 
              group={detailGroup} 
              profiles={profiles} 
              onClose={() => { setDetailGroup(null); setSelectedIndex(-1); }} 
              onDismiss={handleDismiss} 
              targetDept={targetDept} 
              targetSeniority={targetSeniority}
              dynamicContacts={dynamicContacts}
              correlateCache={correlateCache}
              setCorrelateCache={setCorrelateCache}
              userId={userId}
              onProfilesUpdated={onProfilesUpdated}
            />
          </div>
        </div>
      )}

      {/* === Email Modal === */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
            <div className="modal-title">✉️ Email Daily Digest</div>
            <div className="modal-desc" style={{ marginTop: 6 }}>Send <strong>{filtered.length} signals</strong> to your inbox.</div>
            <form onSubmit={handleSendEmail} style={{ marginTop: 16 }}>
              <div className="form-group">
                <label className="form-label">Recipient Email</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} required disabled={sendingEmail} style={{ width: '100%' }} />
              </div>
              {emailStatus && (
                <div style={{ padding: '10px 14px', borderRadius: 0, fontSize: 13, marginBottom: 12, background: emailStatus.type === 'success' ? 'var(--signal-green-bg)' : 'var(--signal-red-bg)', border: `1px solid ${emailStatus.type === 'success' ? 'var(--signal-green-border)' : 'var(--signal-red-border)'}`, color: emailStatus.type === 'success' ? 'var(--signal-green)' : 'var(--signal-red)' }}>
                  {emailStatus.message}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmailModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sendingEmail || !emailAddress}>{sendingEmail ? 'Sending...' : 'Send'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// --- StatCard (kept for other pages) ---
function StatCard({ label, value, sub, badge }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {badge && <span className={`stat-badge ${badge.type}`}>{badge.text}</span>}
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// --- Extract PR Date from URL ---
function extractDateFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  // Match YYYY/MM/DD or YYYY-MM-DD
  const slashMatch = url.match(/\/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if (slashMatch) {
    const [_, y, m, d] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Match YYYYMMDD
  const yymmddMatch = url.match(/\b(20\d{2})([01]\d)([0-3]\d)\b/);
  if (yymmddMatch) {
    const [_, y, m, d] = yymmddMatch;
    return `${y}-${m}-${d}`;
  }
  return null;
}

// --- Company Detail Drawer ---
export function CompanyDetailDrawer({ group, profiles, onClose, onDismiss, targetDept = 'Marketing', targetSeniority = 'VP', dynamicContacts = {}, correlateCache = {}, setCorrelateCache, userId, onProfilesUpdated }) {
  const profile = profiles.find(p => (p.company || '').toLowerCase() === group.company.toLowerCase() || (p.name || '').toLowerCase() === group.company.toLowerCase());
  const snapData = (profile?.snapshots?.length > 0) ? profile.snapshots[profile.snapshots.length - 1] : (group.snapData || {});

  const cacheKey = `${group.company}|${targetDept}|${targetSeniority}`;
  const [activeTab, setActiveTab]         = useState('correlations');
  const [postsSubTab, setPostsSubTab]     = useState('contacts');
  const [synthesis, setSynthesis]         = useState(() => correlateCache[cacheKey] || snapData.synthesis || group.synthesis);
  const [loadingAI, setLoadingAI]         = useState(false);
  const [autoboundSignals, setAutoboundSignals] = useState(snapData.autoboundSignals || []);
  const [copiedEmail, setCopiedEmail]     = useState(false);
  const [copiedLinkedin, setCopiedLinkedin] = useState(false);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState(1);
  const [copiedScriptIndex, setCopiedScriptIndex] = useState(-1);
  const [fetchingProfiles, setFetchingProfiles] = useState(false);
  const [profileActivity, setProfileActivity] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editTitle, setEditTitle] = useState('');
  const [editNarrative, setEditNarrative] = useState('');
  const [editScript, setEditScript] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async (idx) => {
    setSavingEdit(true);
    try {
      const updatedCorrelations = [...(synthesis.strategicCorrelations || [])];
      updatedCorrelations[idx] = {
        ...updatedCorrelations[idx],
        title: editTitle,
        narrative: editNarrative,
        script: editScript,
        reviewed: true
      };

      const updatedSynthesis = {
        ...synthesis,
        strategicCorrelations: updatedCorrelations
      };

      setSynthesis(updatedSynthesis);

      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`company.ilike."${group.company}",name.ilike."${group.company}"`);
      
      let targetProfile = null;
      if (existingProfiles && existingProfiles.length > 0) {
        targetProfile = existingProfiles.find(p => (p.company || '').toLowerCase() === group.company.toLowerCase()) || existingProfiles[0];
      }

      if (targetProfile && Array.isArray(targetProfile.snapshots) && targetProfile.snapshots.length > 0) {
        const updatedSnapshots = [...targetProfile.snapshots];
        const lastIdx = updatedSnapshots.length - 1;
        updatedSnapshots[lastIdx] = {
          ...updatedSnapshots[lastIdx],
          synthesis: updatedSynthesis
        };

        const { error } = await supabase
          .from('profiles')
          .update({ snapshots: updatedSnapshots })
          .eq('id', targetProfile.id);

        if (error) throw error;
      }
      
      setEditingIndex(-1);
      if (onProfilesUpdated) {
        onProfilesUpdated();
      }
    } catch (err) {
      console.error('Error saving play edit:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleReviewed = async (idx) => {
    try {
      const updatedCorrelations = [...(synthesis.strategicCorrelations || [])];
      const isReviewed = !updatedCorrelations[idx].reviewed;
      updatedCorrelations[idx] = {
        ...updatedCorrelations[idx],
        reviewed: isReviewed
      };

      const updatedSynthesis = {
        ...synthesis,
        strategicCorrelations: updatedCorrelations
      };

      setSynthesis(updatedSynthesis);

      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`company.ilike."${group.company}",name.ilike."${group.company}"`);
      
      let targetProfile = null;
      if (existingProfiles && existingProfiles.length > 0) {
        targetProfile = existingProfiles.find(p => (p.company || '').toLowerCase() === group.company.toLowerCase()) || existingProfiles[0];
      }

      if (targetProfile && Array.isArray(targetProfile.snapshots) && targetProfile.snapshots.length > 0) {
        const updatedSnapshots = [...targetProfile.snapshots];
        const lastIdx = updatedSnapshots.length - 1;
        updatedSnapshots[lastIdx] = {
          ...updatedSnapshots[lastIdx],
          synthesis: updatedSynthesis
        };

        await supabase
          .from('profiles')
          .update({ snapshots: updatedSnapshots })
          .eq('id', targetProfile.id);
      }
      
      if (onProfilesUpdated) {
        onProfilesUpdated();
      }
    } catch (err) {
      console.error('Error reviewing play:', err);
    }
  };

  // Sync synthesis and autoboundSignals state when profiles/snapData updates from the backend/polling save
  useEffect(() => {
    const freshSnap = (profile?.snapshots?.length > 0) ? profile.snapshots[profile.snapshots.length - 1] : null;
    if (freshSnap?.synthesis) {
      setSynthesis(freshSnap.synthesis);
      if (freshSnap.synthesis.recommendedFrameworkId) {
        setSelectedFrameworkId(freshSnap.synthesis.recommendedFrameworkId);
      }
    }
    if (freshSnap?.autoboundSignals) {
      setAutoboundSignals(freshSnap.autoboundSignals);
    }
  }, [profiles, group.company]);

  const snapPosts  = (snapData.posts && snapData.posts.length > 0)
    ? snapData.posts 
    : ((synthesis?.companyPosts && synthesis.companyPosts.length > 0) ? synthesis.companyPosts : (snapData.recentPosts || []));
  const snapJobs   = (snapData.jobOpenings && snapData.jobOpenings.length > 0)
    ? snapData.jobOpenings 
    : (synthesis?.jobOpenings || []);
  const snapPR     = (snapData.prMentions && snapData.prMentions.length > 0)
    ? snapData.prMentions 
    : (synthesis?.prMentions || []);
  const snapReddit = (snapData.redditMentions && snapData.redditMentions.length > 0)
    ? snapData.redditMentions 
    : (synthesis?.redditMentions || []);

  const dynamicContact = dynamicContacts[`${group.company}-${targetDept}-${targetSeniority}`];
  const primaryContact   = group.signals[0];
  const isPersonProfile = primaryContact?.profile && primaryContact.profile.toLowerCase() !== group.company?.toLowerCase();
  const alternateContact = isPersonProfile ? null : (dynamicContact || group.alternateContacts?.[0]);
  
  const contactName = synthesis?.recommendedContact?.name || (isPersonProfile 
    ? primaryContact?.profile 
    : (alternateContact?.name || (primaryContact?.profile && primaryContact.profile.toLowerCase() !== group.company.toLowerCase() ? primaryContact.profile : 'Key Decision Maker')));
  
  const contactTitle = synthesis?.recommendedContact?.title || (isPersonProfile 
    ? (group.snapData?.currentTitle || synthesis?.resolvedContacts?.[0]?.title || 'Executive') 
    : (alternateContact?.title || synthesis?.resolvedContacts?.[0]?.title || 'Target Stakeholder'));
  
  const contactUrl = synthesis?.recommendedContact?.url || alternateContact?.url || primaryContact?.profileLinkedinUrl || primaryContact?.linkedinUrl || 'https://www.linkedin.com';

  useEffect(() => {
    // If we have a cached result in client state or pre-fetched in database snapshot, use it immediately
    const cached = correlateCache[cacheKey] || snapData.synthesis;
    if (cached) {
      setSynthesis(cached);
      if (cached.recommendedFrameworkId) setSelectedFrameworkId(cached.recommendedFrameworkId);
      setAutoboundSignals(cached.autoboundSignals || snapData.autoboundSignals || []);
      setLoadingAI(false);
      return; // Skip API call
    } else {
      setSynthesis(group.synthesis || null);
      setAutoboundSignals(snapData.autoboundSignals || []);
    }

    let active = true;
    (async () => {
      setLoadingAI(true);
      try {
        let gtmSettings = null;
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem('gtm_product_settings');
            if (stored) {
              gtmSettings = JSON.parse(stored);
            }
          } catch (e) {
            console.error('Failed to load gtm settings:', e);
          }
        }

        const res = await fetch('/api/correlate', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            companyName: group.company, 
            domain: group.domain, 
            snapData: snapData, 
            targetDept, 
            targetSeniority,
            gtmSettings
          }) 
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data && active) {
            setSynthesis(data);
            if (data.recommendedFrameworkId) setSelectedFrameworkId(data.recommendedFrameworkId);
            if (data.autoboundSignals?.length > 0) setAutoboundSignals(data.autoboundSignals);
            
            // Store in parent-level cache so next click uses this result instantly
            if (setCorrelateCache) {
              setCorrelateCache(prev => ({ ...prev, [cacheKey]: data }));
            }

            // Save/Cache this synthesis and all resolved feeds in Supabase
            try {
              const { data: existingProfiles } = await supabase
                .from('profiles')
                .select('*')
                .or(`company.ilike."${group.company}",name.ilike."${group.company}"`);
              
              let targetProfile = null;
              if (existingProfiles && existingProfiles.length > 0) {
                targetProfile = existingProfiles.find(p => (p.company || '').toLowerCase() === group.company.toLowerCase()) || existingProfiles[0];
              }

              const newSnapshot = {
                currentCompany: group.company,
                currentTitle: data.recommendedContact?.title || 'Executive',
                polledAt: new Date().toISOString(),
                synthesis: data,
                jobOpenings: data.jobOpenings || [],
                prMentions: data.prMentions || [],
                redditMentions: data.redditMentions || [],
                twitterMentions: data.twitterMentions || [],
                companyPosts: data.companyPosts || [],
                resolvedContacts: data.resolvedContacts || [],
                founderContact: data.founderContact || null,
                marketingContact: data.marketingContact || null,
                autoboundSignals: data.autoboundSignals || []
              };

              if (targetProfile) {
                let updatedSnapshots = [];
                if (Array.isArray(targetProfile.snapshots)) {
                  updatedSnapshots = [...targetProfile.snapshots];
                  if (updatedSnapshots.length > 0) {
                    updatedSnapshots[updatedSnapshots.length - 1] = {
                      ...updatedSnapshots[updatedSnapshots.length - 1],
                      ...newSnapshot
                    };
                  } else {
                    updatedSnapshots.push(newSnapshot);
                  }
                } else {
                  updatedSnapshots = [newSnapshot];
                }

                await supabase
                  .from('profiles')
                  .update({ snapshots: updatedSnapshots })
                  .eq('id', targetProfile.id);
              } else {
                const newProfileId = group.company.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-profile';
                const newRecord = {
                  id: newProfileId,
                  name: group.company,
                  company: group.company,
                  linkedin_url: `https://www.linkedin.com/company/${group.company.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-')}`,
                  company_linkedin_url: group.domain ? `https://www.linkedin.com/company/${group.company.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-')}` : '',
                  title: 'Monitored Company',
                  status: 'active',
                  added_at: new Date().toISOString(),
                  snapshots: [newSnapshot],
                  user_id: userId || profiles?.[0]?.user_id
                };

                await supabase
                  .from('profiles')
                  .insert([newRecord]);
              }
              if (onProfilesUpdated) {
                onProfilesUpdated();
              }
            } catch (cacheErr) {
              console.error('[Supabase Cache] Failed to cache synthesis:', cacheErr);
            }
          }
        }
      } catch (err) { console.error('[Correlate Effect Error]', err); }
      finally { if (active) setLoadingAI(false); }
    })();
    return () => { active = false; };
  }, [cacheKey]);

  const logoUrl = getLogoUrl(group.domain);
  const pCfg   = PRIORITY_CONFIG[group.priority] || PRIORITY_CONFIG.watch;

  const handleCopyEmail = () => {
    const frameworks = synthesis?.frameworks || [];
    const activeFramework = frameworks.find(f => f.id === selectedFrameworkId) || frameworks[0];
    if (!activeFramework) return;

    const firstName = contactName ? contactName.split(' ')[0] : 'there';
    const emailBody = activeFramework.body
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/%signature%/g, 'Best,\nShubham');

    navigator.clipboard.writeText(`Subject: ${activeFramework.subject}\n\n${emailBody}`);
    setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000);
  };
  const handleCopyLinkedin = () => {
    const note = synthesis?.templates?.linkedin;
    if (!note) return;
    navigator.clipboard.writeText(note);
    setCopiedLinkedin(true); setTimeout(() => setCopiedLinkedin(false), 2000);
  };

  const twitterCount = (snapData.twitterMentions && snapData.twitterMentions.length > 0)
    ? snapData.twitterMentions.length 
    : (synthesis?.twitterMentions || []).length;
  const youtubeCount = (snapData.youtubeVideos && snapData.youtubeVideos.length > 0)
    ? snapData.youtubeVideos.length 
    : (synthesis?.youtubeVideos || []).length;
  const totalNewsCount = snapPR.length + snapReddit.length + twitterCount + youtubeCount;

  const contactFeeds = [];
  if (synthesis?.founderContact) contactFeeds.push(synthesis.founderContact);
  if (synthesis?.marketingContact) contactFeeds.push(synthesis.marketingContact);
  (synthesis?.resolvedContacts || []).forEach(rc => {
    if (!contactFeeds.some(cf => cf.url === rc.url)) {
      contactFeeds.push(rc);
    }
  });
  if (profileActivity) {
    profileActivity.forEach(pa => {
      const match = contactFeeds.find(cf => cf.url === pa.url || cf.name === pa.name);
      if (match) {
        match.posts = pa.posts;
      } else {
        contactFeeds.push(pa);
      }
    });
  }
  const contactPostsCount = contactFeeds.reduce((acc, c) => acc + (c.posts?.length || 0), 0);
  const totalFeedsCount = snapPosts.length + contactPostsCount;

  const tabs = [
    { id: 'correlations', label: '🧠 Correlations' },
    { id: 'signals',  label: `📢 Signals (${group.signals.length + autoboundSignals.length})` },
    { id: 'outreach', label: '✍️ Outreach' },
    { id: 'posts',    label: `📝 Feeds (${totalFeedsCount})` },
    { id: 'jobs',     label: `💼 Jobs (${snapJobs.length})` },
    { id: 'news',     label: `📰 News (${totalNewsCount})` },
  ];
  if (snapData.cmsIntel) tabs.push({ id: 'cms', label: '\u{1F6E0}\uFE0F CMS' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 0, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 3 }}>
          <img src={logoUrl} alt="" onError={e => { e.target.src = `https://logo.clearbit.com/${group.domain || 'linkedin.com'}`; }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{group.company}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {synthesis?.emoji} {synthesis?.conclusion}
            {loadingAI && <span style={{ marginLeft: 6, color: '#132D7D', fontSize: 11 }}>{'\u00B7'} AI analyzing&hellip;</span>}
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}`, borderRadius: 0 }}>{pCfg.label}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 19, padding: '0 4px', lineHeight: 1 }}>{'\u00D7'}</button>
      </div>

      {/* strategic shift */}
      {synthesis?.strategicShift && (
        <div style={{ padding: '10px 18px', background: 'linear-gradient(135deg,rgba(59,130,246,0.04),rgba(99,102,241,0.04))', borderBottom: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, flexShrink: 0 }}>
          <span style={{ color: '#132D7D', fontWeight: 700 }}>Strategic shift: </span>{synthesis.strategicShift}
        </div>
      )}

      {/* contact + CTAs */}
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{contactName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{contactTitle}</div>
        </div>
        <button onClick={handleCopyEmail} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 0, background: copiedEmail ? 'var(--signal-green-bg)' : 'var(--accent-blue-glow)', border: `1px solid ${copiedEmail ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`, color: copiedEmail ? 'var(--signal-green)' : 'var(--accent-blue)', cursor: 'pointer' }}>
          {copiedEmail ? '\u2705 Copied!' : '\u{1F4E7} Copy Email'}
        </button>
        <a href={contactUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 0, background: 'rgba(19, 45, 125, 0.08)', border: '1px solid rgba(19, 45, 125, 0.2)', color: '#132D7D', textDecoration: 'none' }}>
          {'\u{1F4BC}'} LinkedIn
        </a>
      </div>

      {/* Key Contacts (Founder & Marketing Lead) */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\u{1F465}'} Key Contacts</div>
          <button
            onClick={async () => {
              const contacts = [];
              if (synthesis?.founderContact?.url) {
                contacts.push({ url: synthesis.founderContact.url, name: synthesis.founderContact.name, role: synthesis.founderContact.title || 'Founder / CEO' });
              }
              if (synthesis?.marketingContact?.url) {
                contacts.push({ url: synthesis.marketingContact.url, name: synthesis.marketingContact.name, role: synthesis.marketingContact.title || `${targetDept} Lead` });
              }
              if (contacts.length === 0 && synthesis?.resolvedContacts) {
                synthesis.resolvedContacts.slice(0, 2).forEach(c => {
                  if (c.url) contacts.push({ url: c.url, name: c.name, role: c.title || 'Executive' });
                });
              }
              if (contacts.length === 0) return;
              setFetchingProfiles(true);
              try {
                const results = await Promise.all(
                  contacts.map(c =>
                    fetch('/api/collectors/buying-committee', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        profileUrl: c.url, 
                        companyName: group.company,
                        userId: userId || profiles?.[0]?.user_id 
                      })
                    }).then(r => r.ok ? r.json() : null)
                  )
                );
                const activity = contacts.map((c, i) => ({
                  name: c.name,
                  title: results[i]?.title || c.role,
                  url: c.url,
                  posts: results[i]?.posts || []
                }));
                setProfileActivity(activity);
              } catch(e) { console.error('Profile activity fetch failed:', e); }
              finally { setFetchingProfiles(false); }
            }}
            style={{
              fontSize: 10, padding: '3px 8px', fontWeight: 700,
              background: fetchingProfiles ? 'var(--signal-green-bg)' : 'rgba(19, 45, 125, 0.06)',
              border: '1px solid rgba(19, 45, 125, 0.2)',
              color: fetchingProfiles ? 'var(--signal-green)' : '#132D7D',
              cursor: 'pointer', borderRadius: 0
            }}
          >
            {fetchingProfiles ? '\u23F3 Fetching...' : '\u{1F504} Refresh CRO/CMO Activity'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Founder/CEO */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{'\u{1F451}'} Founder / CEO</span>
            {loadingAI ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Resolving contact...</span>
            ) : synthesis?.founderContact ? (
              <>
                <a href={synthesis.founderContact.url || 'https://www.linkedin.com'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#132D7D', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {synthesis.founderContact.name} <span style={{ fontSize: 9 }}>{'>>'}</span>
                </a>
                {synthesis.founderContact.title && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{synthesis.founderContact.title}</span>
                )}
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Not found</span>
            )}
          </div>
          {/* Marketing / Sales Lead */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{'\u{1F4E2}'} {targetDept} Lead</span>
            {loadingAI ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Resolving contact...</span>
            ) : synthesis?.marketingContact ? (
              <>
                <a href={synthesis.marketingContact.url || 'https://www.linkedin.com'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#132D7D', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {synthesis.marketingContact.name} <span style={{ fontSize: 9 }}>{'>>'}</span>
                </a>
                {synthesis.marketingContact.title && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{synthesis.marketingContact.title}</span>
                )}
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Not found</span>
            )}
          </div>
        </div>

        {/* Profile Activity (CRO/CMO recent posts — fetched on demand) */}
        {profileActivity && profileActivity.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{'\u{1F5E3}'} Recent LinkedIn Activity</div>
            {profileActivity.map((p, i) => (
              <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: '#132D7D', textDecoration: 'none' }}>
                    {p.name} {'\u2197'}
                  </a>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.title}</span>
                </div>
                {p.posts && p.posts.length > 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    &ldquo;{p.posts[0].text?.slice(0, 140)}...&rdquo;
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No recent posts found.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 0, background: activeTab === t.id ? 'var(--accent-blue-glow)' : 'transparent', border: `1px solid ${activeTab === t.id ? 'var(--accent-blue)' : 'transparent'}`, color: activeTab === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {activeTab === 'correlations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Below are identified B2B correlations connecting intent spikes, hiring patterns, and social media signals. Use these scripts as targeted outreach hooks.
            </div>
            
            {(!synthesis?.strategicCorrelations || synthesis.strategicCorrelations.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                No active correlations generated for this account.
              </div>
            ) : (
              synthesis.strategicCorrelations.map((corr, idx) => (
                <div 
                  key={idx} 
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border)',
                    borderLeft: corr.reviewed ? '4px solid #10B981' : '4px solid #132D7D',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    borderRadius: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    marginBottom: 14
                  }}
                >
                  {/* Trigger Event Header */}
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 850, color: '#FF2A00', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        ⚡ TRIGGER EVENT (X, Y, Z)
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {corr.reviewed && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                            ✓ Approved Play
                          </span>
                        )}
                        <span style={{ fontSize: 8.5, fontWeight: 700, padding: '2px 6px', background: 'rgba(19, 45, 125, 0.06)', color: '#132D7D', borderRadius: 0 }}>
                          SYNTHESIS PLAY #{idx + 1}
                        </span>
                      </div>
                    </div>
                    {editingIndex === idx ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>PLAY TITLE</label>
                        <input 
                          type="text" 
                          value={editTitle} 
                          onChange={e => setEditTitle(e.target.value)} 
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)' }}
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{corr.title}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <strong>Channels:</strong> {corr.evidence}
                    </div>
                  </div>

                  {editingIndex === idx ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>WHAT IT GENERALLY MEANS (A)</label>
                        <textarea 
                          rows={2}
                          value={editNarrative} 
                          onChange={e => setEditNarrative(e.target.value)} 
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: '#132D7D' }}>OUTBOUND PITCH (P)</label>
                        <textarea 
                          rows={3}
                          value={editScript} 
                          onChange={e => setEditScript(e.target.value)} 
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button 
                          onClick={() => handleSaveEdit(idx)} 
                          disabled={savingEdit}
                          style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, background: '#10B981', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                          {savingEdit ? 'Saving...' : '💾 Save Play'}
                        </button>
                        <button 
                          onClick={() => setEditingIndex(-1)} 
                          style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Logical Shift (A) */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 850, color: '#64748B', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                          💡 WHAT IT GENERALLY MEANS (A)
                        </div>
                        <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>
                          {corr.narrative}
                        </div>
                        {corr.friction && (
                          <div style={{ fontSize: 12, color: '#D97706', background: '#FEF3C7', padding: '6px 10px', borderLeft: '3px solid #D97706', marginTop: 8 }}>
                            <strong>Immediate Headache:</strong> {corr.friction}
                          </div>
                        )}
                      </div>

                      {/* Pitch (P) */}
                      {corr.script && (
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 850, color: '#132D7D', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              💬 OUR OUTBOUND PITCH
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => {
                                  setEditingIndex(idx);
                                  setEditTitle(corr.title || '');
                                  setEditNarrative(corr.narrative || '');
                                  setEditScript(corr.script || '');
                                }}
                                style={{
                                  fontSize: 9,
                                  padding: '2px 8px',
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  color: '#1E293B',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                              >
                                ✏️ Edit Play
                              </button>
                              <button
                                onClick={() => handleToggleReviewed(idx)}
                                style={{
                                  fontSize: 9,
                                  padding: '2px 8px',
                                  background: corr.reviewed ? '#F3F4F6' : '#FFFFFF',
                                  border: `1px solid ${corr.reviewed ? '#D1D5DB' : '#CBD5E1'}`,
                                  color: corr.reviewed ? '#6B7280' : '#047857',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                              >
                                {corr.reviewed ? 'Unmark Approved' : '✓ Approve Play'}
                              </button>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(corr.script);
                                  setCopiedScriptIndex(idx);
                                  setTimeout(() => setCopiedScriptIndex(-1), 2000);
                                }}
                                style={{
                                  fontSize: 9,
                                  padding: '2px 8px',
                                  background: copiedScriptIndex === idx ? '#10B981' : '#FFFFFF',
                                  border: `1px solid ${copiedScriptIndex === idx ? '#10B981' : '#CBD5E1'}`,
                                  color: copiedScriptIndex === idx ? '#FFFFFF' : '#1E293B',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                              >
                                {copiedScriptIndex === idx ? '✓ Copied' : 'Copy Pitch'}
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: 12.5, color: '#0F172A', fontStyle: 'italic', lineHeight: 1.5 }}>
                            {corr.script}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Target Contact (U) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(19, 45, 125, 0.03)', border: '1px solid rgba(19, 45, 125, 0.1)', padding: '8px 12px', fontSize: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 850, color: '#132D7D', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      👤 TARGET CONTACT (U):
                    </span>
                    <span style={{ color: '#1E293B', fontWeight: 700 }}>{contactName}</span>
                    <span style={{ color: '#64748B' }}>({contactTitle})</span>
                    <a 
                      href={contactUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#132D7D', textDecoration: 'none' }}
                    >
                      Open LinkedIn ↗
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 350 }}>
            {/* Left Column: Company Intention */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid var(--border)', paddingRight: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#132D7D', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>🏢 Company Intention</div>
              
              {/* Autobound Signals */}
              {autoboundSignals.map((sig, i) => {
                const rawTitle = sig.signal_name || sig.signal_subtype || sig.signal_type || 'Buying Signal';
                // Inline formatting for camelCase/kebab-case/snake_case
                const title = (() => {
                  if (!rawTitle) return 'Buying Signal';
                  let formatted = rawTitle.replace(/[-_]+/g, ' ');
                  formatted = formatted.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
                  return formatted
                    .split(/\s+/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                })();
                const description = sig.data?.takeaway || sig.data?.summary || sig.data?.detail || sig.description || 'Buying intent signal detected.';
                const link = sig.data?.source_url || sig.data?.glassdoor_url || null;
                return (
                  <div key={`ab-${i}`} style={{ padding: '8px 10px', borderRadius: 0, background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      📢 {title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {description}
                    </div>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent-blue)', textDecoration: 'underline', width: 'fit-content' }}>
                        Source Link ↗
                      </a>
                    )}
                  </div>
                );
              })}
              
              {/* Standard System Triggers */}
              {group.signals.map(s => (
                <div key={s.id} style={{ padding: '8px 10px', borderRadius: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.emoji} {s.label}</div>
                  {s.why && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }} dangerouslySetInnerHTML={{ __html: s.why }} />}
                </div>
              ))}

              {/* Sitemap & Job Vacancies Summary */}
              {snapJobs.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>💼 Active Vacancies</div>
                  {snapJobs.slice(0, 3).map((job, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0' }}>• {job.title} ({job.location || 'Remote'})</div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Executive Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--signal-green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>👤 Executive Action</div>
              
              {/* Target Contacts Y & Z */}
              {synthesis?.resolvedContacts && synthesis.resolvedContacts.length > 0 ? (
                synthesis.resolvedContacts.map((contact, i) => (
                  <a 
                    key={i} 
                    href={contact.url || 'https://www.linkedin.com'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ 
                      display: 'block',
                      padding: '8px 10px', 
                      borderRadius: 0, 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border)',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#132D7D'; e.currentTarget.style.background = 'rgba(19, 45, 125, 0.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {contact.name} <span style={{ fontSize: 10 }}>↗</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{contact.title}</div>
                    {contact.posts && contact.posts.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic', background: 'var(--bg-base)', padding: '4px 6px', borderRadius: 0}}>
                        "{contact.posts[0].text.slice(0, 120)}..."
                      </div>
                    )}
                  </a>
                ))
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Resolving decision makers (Y & Z)...</div>
              )}

              {/* Founder/CEO posts */}
              {synthesis?.founderContact && (
                <a 
                  href={synthesis.founderContact.url || 'https://www.linkedin.com'} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'block',
                    padding: '8px 10px', 
                    borderRadius: 0, 
                    background: 'rgba(16,185,129,0.03)', 
                    border: '1px solid rgba(16,185,129,0.15)', 
                    marginTop: 4,
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--signal-green)'; e.currentTarget.style.background = 'rgba(16,185,129,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.15)'; e.currentTarget.style.background = 'rgba(16,185,129,0.03)'; }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    👑 {synthesis.founderContact.title || 'Founder/CEO'}: {synthesis.founderContact.name} <span style={{ fontSize: 10 }}>↗</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{synthesis.founderContact.title || 'Executive'}</div>
                  {synthesis.founderContact.posts && synthesis.founderContact.posts.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic', background: 'var(--bg-base)', padding: '4px 6px', borderRadius: 0}}>
                      "{synthesis.founderContact.posts[0].text.slice(0, 120)}..."
                    </div>
                  )}
                </a>
              )}

              {/* Company posts */}
              {synthesis?.companyPosts && synthesis.companyPosts.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>📢 Company Updates</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: 0, border: '1px solid var(--border)' }}>
                    "{synthesis.companyPosts[0].text.slice(0, 100)}..."
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'outreach' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ✨ AI Recommended Play Banner */}
            {synthesis?.recommendedContact && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: 0,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: '0 0 12px rgba(168, 85, 247, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>✨ AI Recommended Play</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Reach out to <span style={{ color: '#132D7D' }}>{synthesis.recommendedContact.name}</span> ({synthesis.recommendedContact.title})
                </div>
                {synthesis.strategicReason && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {synthesis.strategicReason}
                  </div>
                )}
                {synthesis.recommendedFrameworkId && (
                  <button
                    onClick={() => setSelectedFrameworkId(synthesis.recommendedFrameworkId)}
                    style={{
                      marginTop: 4,
                      alignSelf: 'flex-start',
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 0,
                      background: '#FF2A00',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 0 8px rgba(168, 85, 247, 0.3)'
                    }}
                  >
                    Apply Recommended Framework (F{synthesis.recommendedFrameworkId})
                  </button>
                )}
              </div>
            )}

            {synthesis?.frameworks && synthesis.frameworks.length > 0 && (() => {
              const frameworks = synthesis.frameworks;
              const activeFramework = frameworks.find(f => f.id === selectedFrameworkId) || frameworks[0];
              const firstName = contactName ? contactName.split(' ')[0] : 'there';
              return (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{'\u{1F4E7}'} Cold Email</span>
                    <button onClick={handleCopyEmail} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 0, background: copiedEmail ? 'var(--signal-green-bg)' : 'var(--accent-blue-glow)', border: `1px solid ${copiedEmail ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)'}`, color: copiedEmail ? 'var(--signal-green)' : 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}>{copiedEmail ? '\u2705 Copied!' : '\u{1F4CB} Copy'}</button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, padding: '6px 12px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                    {frameworks.map(f => (
                      <button
                        key={f.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFrameworkId(f.id);
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: 0,
                          background: selectedFrameworkId === f.id ? 'var(--accent-blue-glow)' : 'transparent',
                          border: `1px solid ${selectedFrameworkId === f.id ? 'var(--accent-blue)' : 'transparent'}`,
                          color: selectedFrameworkId === f.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: selectedFrameworkId === f.id ? 700 : 500
                        }}
                        title={f.name}
                      >
                        F{f.id}
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Subject:</strong> {activeFramework.subject}
                    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
                    {activeFramework.body
                      .replace(/\{\{first_name\}\}/g, firstName)
                      .replace(/%signature%/g, 'Best,\nShubham')
                    }
                  </div>
                </div>
              );
            })()}
            {synthesis?.templates?.linkedin && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{'\u{1F4BC}'} LinkedIn Note</span>
                  <button onClick={handleCopyLinkedin} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 0, background: copiedLinkedin ? 'var(--signal-green-bg)' : 'var(--accent-blue-glow)', border: `1px solid ${copiedLinkedin ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)'}`, color: copiedLinkedin ? 'var(--signal-green)' : 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}>{copiedLinkedin ? '\u2705 Copied!' : '\u{1F4CB} Copy'}</button>
                </div>
                <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{synthesis.templates.linkedin}</div>
              </div>
            )}
            {!synthesis?.templates?.email && !synthesis?.templates?.linkedin && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No outreach templates yet.</div>}
          </div>
        )}

        {activeTab === 'posts' && (() => {
          const cFeeds = [];
          if (synthesis?.founderContact) cFeeds.push({ ...synthesis.founderContact, isFounder: true });
          if (synthesis?.marketingContact) cFeeds.push({ ...synthesis.marketingContact, isMarketing: true });
          (synthesis?.resolvedContacts || []).forEach(rc => {
            if (!cFeeds.some(cf => cf.url === rc.url)) {
              cFeeds.push(rc);
            }
          });
          if (profileActivity) {
            profileActivity.forEach(pa => {
              const match = cFeeds.find(cf => cf.url === pa.url || cf.name === pa.name);
              if (match) {
                match.posts = pa.posts;
              } else {
                cFeeds.push(pa);
              }
            });
          }
          const cPostsCount = cFeeds.reduce((acc, c) => acc + (c.posts?.length || 0), 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Segmented control at the top */}
              <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 8, flexShrink: 0 }}>
                <button 
                  onClick={() => setPostsSubTab('contacts')} 
                  style={{ 
                    padding: '5px 12px', 
                    fontSize: 11.5, 
                    fontWeight: 600, 
                    borderRadius: 0,
                    border: '1px solid ' + (postsSubTab === 'contacts' ? 'var(--accent-blue)' : 'var(--border)'), 
                    background: postsSubTab === 'contacts' ? 'var(--accent-blue-glow)' : 'transparent', 
                    color: postsSubTab === 'contacts' ? 'var(--accent-blue)' : 'var(--text-secondary)', 
                    cursor: 'pointer' 
                  }}
                >
                  👥 Contact Feeds ({cPostsCount})
                </button>
                <button 
                  onClick={() => setPostsSubTab('company')} 
                  style={{ 
                    padding: '5px 12px', 
                    fontSize: 11.5, 
                    fontWeight: 600, 
                    borderRadius: 0,
                    border: '1px solid ' + (postsSubTab === 'company' ? 'var(--accent-blue)' : 'var(--border)'), 
                    background: postsSubTab === 'company' ? 'var(--accent-blue-glow)' : 'transparent', 
                    color: postsSubTab === 'company' ? 'var(--accent-blue)' : 'var(--text-secondary)', 
                    cursor: 'pointer' 
                  }}
                >
                  🏢 Company Feed ({snapPosts.length})
                </button>
              </div>

              {/* Toggled Content */}
              {postsSubTab === 'contacts' ? (
                cFeeds.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                    No contact feeds found in snapshot. Use "Refresh CRO/CMO Activity" above to pull live profiles.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {cFeeds.map((contact, cIdx) => {
                      const posts = contact.posts || [];
                      return (
                        <div key={cIdx} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {contact.isFounder ? '👑 ' : contact.isMarketing ? '📢 ' : '👥 '} 
                                {contact.name}
                              </div>
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{contact.title || 'Executive'}</div>
                            </div>
                            {contact.url && (
                              <a href={contact.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#132D7D', textDecoration: 'none', fontWeight: 600 }}>
                                Profile ↗
                              </a>
                            )}
                          </div>
                          {posts.length === 0 ? (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                              No recent posts found.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {posts.map((post, pIdx) => (
                                <div key={pIdx} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 10 }}>
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {post.text || post.title || post.content}
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                    {post.link && <a href={post.link} target="_blank" rel="noopener noreferrer" style={{ color: '#132D7D', textDecoration: 'none' }}>View on LinkedIn ↗</a>}
                                    {post.datePublished && <span>&bull; {new Date(post.datePublished).toLocaleDateString()}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                snapPosts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                    No company LinkedIn posts found.
                  </div>
                ) : (
                  snapPosts.map((post, i) => (
                    <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5 }}>
                      <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{post.text || post.title || post.content}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <a href={post.link || 'https://www.linkedin.com'} target="_blank" rel="noopener noreferrer" style={{ color: '#132D7D', textDecoration: 'none' }}>View on LinkedIn ↗</a>
                        {post.datePublished && <span>&bull; {new Date(post.datePublished).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          );
        })()}

        {activeTab === 'jobs' && (
          snapJobs.length === 0
            ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No active job openings found.</div>
            : snapJobs.map((job, i) => (
                <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{job.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{'\u{1F4CD}'} {job.location || 'Remote'} {'\u00B7'} {job.source || 'Careers'}</div>
                  </div>
                  {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: '3px 9px', borderRadius: 0, background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>View {'\u2197'}</a>}
                </div>
              ))
        )}

        {activeTab === 'news' && (() => {
          const snapTwitter = (group.snapData?.twitterMentions && group.snapData.twitterMentions.length > 0)
            ? group.snapData.twitterMentions
            : (synthesis?.twitterMentions || []);
          const snapYoutube = (group.snapData?.youtubeVideos && group.snapData.youtubeVideos.length > 0)
            ? group.snapData.youtubeVideos
            : (synthesis?.youtubeVideos || []);

          const merged = [
            ...snapPR.map(p => {
              if (typeof p === 'string') return { title: p, link: null, pubDate: null, src: 'Press' };
              const link = p.link || p.url;
              let pubDate = p.pubDate || p.date || p.datePublished;
              if (!pubDate && link) {
                pubDate = extractDateFromUrl(link);
              }
              if (!pubDate) {
                pubDate = new Date().toISOString();
              }
              return { title: p.title || p.text, link, pubDate, src: 'Press' };
            }),
            ...snapReddit.map(r => {
              if (typeof r === 'string') return { title: r, link: null, pubDate: null, src: 'Reddit' };
              return { title: r.title || r.text, link: r.link || r.url, author: r.author, content: r.content || r.description, pubDate: r.pubDate || r.date || r.datePublished, src: 'Reddit' };
            }),
            ...snapTwitter.map(t => {
              if (typeof t === 'string') return { title: t, link: null, pubDate: null, src: 'Twitter/X' };
              return { title: t.title || t.text, link: t.url || t.link, src: 'Twitter/X', content: t.content || t.description, pubDate: t.pubDate || t.date || t.datePublished };
            }),
            ...snapYoutube.map(y => {
              if (typeof y === 'string') return { title: y, link: null, pubDate: null, src: 'YouTube' };
              return { title: y.title, link: y.url || y.link, src: 'YouTube', pubDate: y.pubDate || y.date || y.datePublished };
            }),
          ];
          if (!merged.length) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No news or social mentions.</div>;
          return merged.map((item, i) => {
            const srcColor = { Press: 'var(--accent-blue)', Reddit: 'var(--signal-orange)', YouTube: '#EF4444', 'Twitter/X': '#1DA1F2' }[item.src] || 'var(--accent-blue)';
            return (
              <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: srcColor, padding: '1px 5px', borderRadius: 0, background: `${srcColor}18` }}>{item.src}</span>
                  {item.pubDate && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(item.pubDate).toLocaleDateString()}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                {item.content && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, fontStyle: 'italic' }}>&ldquo;{item.content}&rdquo;</div>}
                {item.link && <div style={{ marginTop: 5, fontSize: 11 }}><a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#132D7D', textDecoration: 'none' }}>Read {'\u2197'}</a></div>}
              </div>
            );
          });
        })()}

        {activeTab === 'cms' && group.snapData?.cmsIntel && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 0, padding: '12px 14px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>{'\u{1F4BB}'} {group.snapData.cmsIntel.cms?.toUpperCase()} Detected</h4>
            {(group.snapData.cmsIntel.wpUsers || []).map((u, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 8px', background: 'var(--bg-base)', borderRadius: 0, border: '1px solid var(--border)', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{u.description || 'Contributor'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
