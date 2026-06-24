'use client';

import { useState, useEffect, Fragment } from 'react';
import { synthesizeCompanyAccount } from '../lib/synthesisEngine';
import { CompanyDetailDrawer, getLogoUrl } from './Dashboard';
import { reweightSignal } from '../lib/signalEngine';

const PRIORITY_CONFIG = {
  urgent: { label: 'Act Now',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
  week:   { label: 'This Week', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  watch:  { label: 'Watch',     color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.15)' },
};

export default function SignalFeedPage({ signals, profiles, onNavigate, onDismiss, targetDept = 'Marketing', setTargetDept, targetSeniority = 'VP', setTargetSeniority, trackerId, visitorLogs = [], onRefresh, correlateCache = {}, setCorrelateCache, userId }) {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedSignals, setExpandedSignals] = useState(new Set());
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [doneSignals, setDoneSignals] = useState(new Set());
  const [copiedStates, setCopiedStates] = useState({});
  const [dynamicContacts, setDynamicContacts] = useState({});
  const [resolvingStatus, setResolvingStatus] = useState({});

  const [selectedFrameworks, setSelectedFrameworks] = useState({});

  const [activeTab, setActiveTab] = useState('companies'); // 'companies', 'leads', 'visitors'
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const trackingCode = `<!-- B2B Visitor Tracking Script by SignalEngine -->
<script 
  async 
  src="${origin}/tracker.js" 
  data-app-id="${trackerId || ''}"
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Analytics Calculations
  const totalHits = visitorLogs.length;
  const uniqueCompaniesSet = new Set(visitorLogs.map(log => log.company_domain));
  const uniqueCompanies = uniqueCompaniesSet.size;

  // Top Page Path
  const paths = {};
  visitorLogs.forEach(log => {
    paths[log.page_path] = (paths[log.page_path] || 0) + 1;
  });
  const topPage = Object.entries(paths).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Background contact resolution when department changes
  useEffect(() => {
    signals.forEach(s => {
      let comp = (s.company || '').trim();
      if (!comp || comp.toLowerCase() === 'unknown' || comp.toLowerCase() === 'unknown company') {
        comp = s.profile;
      }
      if (!comp) return;

      const profile = profiles.find(
        p => (p.company || '').toLowerCase() === comp.toLowerCase() ||
             (p.name || '').toLowerCase() === comp.toLowerCase()
      );

      const isPersonProfile = profile && (
        profile.company === 'Unknown' ||
        profile.name.toLowerCase() === comp.toLowerCase()
      );
      if (isPersonProfile) return;

      const cacheKey = `${comp}-${targetDept}-${targetSeniority}`;
      if (dynamicContacts[cacheKey] || resolvingStatus[cacheKey]) return;

      setResolvingStatus(prev => ({ ...prev, [cacheKey]: true }));
      fetch('/api/collectors/buying-committee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: comp, department: targetDept, seniority: targetSeniority })
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.contacts && data.contacts.length > 0) {
          setDynamicContacts(prev => ({ ...prev, [cacheKey]: data.contacts[0] }));
        }
      })
      .catch(err => console.error(`Error resolving contact for ${comp}:`, err))
      .finally(() => {
        setResolvingStatus(prev => ({ ...prev, [cacheKey]: false }));
      });
    });
  }, [signals, targetDept, targetSeniority, profiles]);

  // Get snapshots helper
  const getSnap = (companyName) => {
    if (!companyName || companyName.toLowerCase() === 'unknown') {
      return { jobOpenings: [], sitemapLinks: [], prMentions: [] };
    }
    const p = profiles.find(
      p => (p.company || '').toLowerCase() === companyName.toLowerCase() ||
           (p.name || '').toLowerCase() === companyName.toLowerCase()
    );
    if (p?.snapshots?.length > 0) return p.snapshots[p.snapshots.length - 1];
    const cs = signals.filter(s => s.company?.toLowerCase() === companyName.toLowerCase());
    return { jobOpenings: cs.filter(s => s.type === 'hiring_surge').map(s => ({ title: s.label })), sitemapLinks: [], prMentions: [] };
  };

  // Helper to open company drawer
  const handleOpenDrawer = (companyName) => {
    const comp = (companyName || '').trim();
    if (!comp || comp.toLowerCase() === 'unknown') return;

    const snapData = getSnap(comp);
    const synthesis = synthesizeCompanyAccount(comp, snapData, targetDept);
    const profile = profiles.find(
      p => (p.company || '').toLowerCase() === comp.toLowerCase() ||
           (p.name || '').toLowerCase() === comp.toLowerCase()
    );

    let domain = snapData.resolvedDomain || profile?.companyLinkedinUrl || '';
    if (!domain && profile?.linkedinUrl?.includes('/company/')) domain = profile.linkedinUrl;
    if (domain.includes('linkedin.com/company/')) {
      const h = domain.split('/company/')[1]?.split('?')[0]?.replace(/\/+$/, '') || '';
      domain = h ? `${h}.com` : '';
    }
    if (!domain && comp) domain = comp.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';

    const companySignals = signals.filter(s => s.company?.toLowerCase() === comp.toLowerCase());

    const cacheKey = `${comp}-${targetDept}-${targetSeniority}`;
    const dynamicContact = dynamicContacts[cacheKey];

    const group = {
      company: comp,
      domain,
      signals: companySignals,
      latestDetectedAt: companySignals[0]?.detectedAt || new Date().toISOString(),
      priority: companySignals.some(s => s.priority === 'urgent') ? 'urgent' : companySignals.some(s => s.priority === 'week') ? 'week' : 'watch',
      synthesis,
      alternateContacts: dynamicContact ? [dynamicContact, ...(snapData.alternateContacts || [])] : (snapData.alternateContacts || []),
      snapData
    };

    setSelectedGroup(group);
  };

  // Toggle row expansion
  const toggleRow = (id) => {
    const next = new Set(expandedSignals);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSignals(next);
  };

  // Handle Mark Done
  const handleToggleDone = (id, e) => {
    e.stopPropagation();
    const next = new Set(doneSignals);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setDoneSignals(next);
  };

  // Copy Template Outreach helpers
  const handleCopyEmail = (e, id, companyName, contactName) => {
    e.stopPropagation();
    const snapData = getSnap(companyName);
    const synthesis = synthesizeCompanyAccount(companyName, snapData, targetDept);
    
    const activeFrameworkId = selectedFrameworks[id] || 1;
    const frameworks = synthesis?.frameworks || [];
    const activeFramework = frameworks.find(f => f.id === activeFrameworkId) || frameworks[0];
    if (!activeFramework) return;

    const firstName = contactName ? contactName.split(' ')[0] : 'there';
    const emailBody = activeFramework.body
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/%signature%/g, 'Best,\nShubham');

    navigator.clipboard.writeText(`Subject: ${activeFramework.subject}\n\n${emailBody}`);
    setCopiedStates(prev => ({ ...prev, [`email-${id}`]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [`email-${id}`]: false }));
    }, 2000);
  };

  const handleCopyLinkedin = (e, id, companyName) => {
    e.stopPropagation();
    const snapData = getSnap(companyName);
    const synthesis = synthesizeCompanyAccount(companyName, snapData, targetDept);
    const t = synthesis?.templates?.linkedin;
    if (!t) return;

    navigator.clipboard.writeText(t);
    setCopiedStates(prev => ({ ...prev, [`li-${id}`]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [`li-${id}`]: false }));
    }, 2000);
  };

  // Filter signals
  const activeSignals = signals.filter(s => !s.dismissed).map(s => {
    let comp = (s.company || '').trim();
    if (!comp || comp.toLowerCase() === 'unknown' || comp.toLowerCase() === 'unknown company') {
      return { ...s, company: s.profile || 'Unresolved Lead' };
    }
    return s;
  });

  const reweightedSignals = activeSignals.map(s => reweightSignal(s, targetDept));

  const filteredSignals = reweightedSignals.filter(s => {
    // Priority filter
    if (priorityFilter !== 'all' && s.priority !== priorityFilter) return false;

    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'hiring' && s.type !== 'hiring_surge') return false;
      if (typeFilter === 'funding' && s.type !== 'funding') return false;
      if (typeFilter === 'product' && !s.type?.includes('product') && !s.label?.toLowerCase().includes('product') && !s.label?.toLowerCase().includes('launch')) return false;
      if (typeFilter === 'social' && s.type !== 'post' && s.type !== 'linkedin_post') return false;
      if (typeFilter === 'news' && s.type !== 'pr' && s.type !== 'news' && s.type !== 'press') return false;
      if (typeFilter === 'cms' && s.type !== 'cms' && !s.label?.toLowerCase().includes('wordpress') && !s.label?.toLowerCase().includes('shopify')) return false;
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCompany = s.company?.toLowerCase().includes(q);
      const matchLabel = s.label?.toLowerCase().includes(q);
      const matchProfile = s.profile?.toLowerCase().includes(q);
      const matchWhy = s.why?.toLowerCase().includes(q);
      if (!matchCompany && !matchLabel && !matchProfile && !matchWhy) return false;
    }

    return true;
  });

  // Calculate statistics based on current active tab ('companies' or 'leads')
  const activeTabSignals = reweightedSignals.filter(s => {
    const profile = profiles.find(
      p => (p.company || '').toLowerCase() === s.company?.toLowerCase() ||
           (p.name || '').toLowerCase() === s.company?.toLowerCase()
    );
    const isPersonProfile = profile && (
      profile.company === 'Unknown' ||
      profile.name.toLowerCase() === s.company?.toLowerCase()
    );
    if (activeTab === 'companies') return !isPersonProfile;
    if (activeTab === 'leads') return isPersonProfile || s.profile;
    return true;
  });

  const totalCount = activeTabSignals.length;
  const urgentCount = activeTabSignals.filter(s => s.priority === 'urgent').length;
  const weekCount = activeTabSignals.filter(s => s.priority === 'week').length;
  const watchCount = activeTabSignals.filter(s => s.priority === 'watch').length;

  // Further filter active tab signals with search & options
  const finalFilteredSignals = activeTabSignals.filter(s => {
    // Priority filter
    if (priorityFilter !== 'all' && s.priority !== priorityFilter) return false;

    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'hiring' && s.type !== 'hiring_surge') return false;
      if (typeFilter === 'funding' && s.type !== 'funding') return false;
      if (typeFilter === 'product' && !s.type?.includes('product') && !s.label?.toLowerCase().includes('product') && !s.label?.toLowerCase().includes('launch')) return false;
      if (typeFilter === 'social' && s.type !== 'post' && s.type !== 'linkedin_post') return false;
      if (typeFilter === 'news' && s.type !== 'pr' && s.type !== 'news' && s.type !== 'press') return false;
      if (typeFilter === 'cms' && s.type !== 'cms' && !s.label?.toLowerCase().includes('wordpress') && !s.label?.toLowerCase().includes('shopify')) return false;
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCompany = s.company?.toLowerCase().includes(q);
      const matchLabel = s.label?.toLowerCase().includes(q);
      const matchProfile = s.profile?.toLowerCase().includes(q);
      const matchWhy = s.why?.toLowerCase().includes(q);
      if (!matchCompany && !matchLabel && !matchProfile && !matchWhy) return false;
    }

    return true;
  });

  return (
    <>
      {/* Top Header Bar */}
      <div className="topbar" style={{ padding: '0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Signal Center</div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#132D7D', background: 'rgba(19, 45, 125, 0.08)', padding: '2px 9px', borderRadius: 0, border: '1px solid rgba(59,130,246,0.2)' }}>
            📡 Live Feed
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary" style={{ padding: '6px 13px', fontSize: 12 }} onClick={() => onNavigate('brief')}>
            📋 Daily Targets
          </button>
          <button className="btn btn-primary" style={{ padding: '6px 13px', fontSize: 12, background: '#132D7D', color: 'white' }} onClick={() => onNavigate('profiles')}>
            👥 Monitored Accounts
          </button>
        </div>
      </div>

      {/* Sub Tabs Selection Bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '16px 28px 12px',
        borderBottom: '1px solid var(--border)',
        maxWidth: 1000,
        margin: '0 auto',
        width: '95%'
      }}>
        {[
          { id: 'companies', label: '🏢 Company Intel', count: signals.filter(s => {
            const p = profiles.find(pr => (pr.company || '').toLowerCase() === s.company?.toLowerCase() || (pr.name || '').toLowerCase() === s.company?.toLowerCase());
            return !(p && (p.company === 'Unknown' || p.name.toLowerCase() === s.company?.toLowerCase())) && !s.dismissed;
          }).length },
          { id: 'leads', label: '👤 Lead Activity', count: signals.filter(s => {
            const p = profiles.find(pr => (pr.company || '').toLowerCase() === s.company?.toLowerCase() || (pr.name || '').toLowerCase() === s.company?.toLowerCase());
            return (p && (p.company === 'Unknown' || p.name.toLowerCase() === s.company?.toLowerCase())) && !s.dismissed;
          }).length },
          { id: 'visitors', label: '🌐 Website Visitors', count: visitorLogs.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 0,
              background: activeTab === tab.id ? 'var(--accent-blue-glow)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--accent-blue)' : '1px solid transparent',
              color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: 10,
                background: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                color: 'white',
                padding: '1px 6px',
                borderRadius: 0,
                fontWeight: 700
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="page-content" style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
        {activeTab !== 'visitors' ? (
          <>
            {/* Intro */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                {activeTab === 'companies' ? 'Company Intelligence Feed' : 'Lead Activity & Shift Audit'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {activeTab === 'companies' 
                  ? 'Audit of strategic reorganizations, hiring surges, funding, and growth actions across corporate targets.'
                  : 'Social posts, LinkedIn content campaigns, and specific direct professional profile updates for monitored leads.'
                }
              </p>
            </div>

            {/* Outreach Settings Bar */}
            <div style={{
              background: '#F8F9FA',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)',
              borderRadius: 0,
              padding: '12px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🎯</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Outreach Target Persona</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Configure target department and seniority level for contact discovery</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Department:</span>
                  <select 
                    value={targetDept} 
                    onChange={(e) => setTargetDept(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 0,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                  >
                    {['Marketing', 'Sales', 'HR', 'Engineering', 'Operations', 'Product'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Seniority:</span>
                  <select 
                    value={targetSeniority} 
                    onChange={(e) => setTargetSeniority(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 0,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                  >
                    {['C-Suite', 'VP', 'Director', 'Manager', 'All'].map(s => (
                      <option key={s} value={s}>{s === 'All' ? 'All Tiers' : s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 28
            }}>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 0,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL ACTIVE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{totalCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Pending outreach action</div>
                <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 48, opacity: 0.05 }}>📡</div>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 0,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔴 ACT NOW</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{urgentCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Critical 30-day window</div>
                <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 48, opacity: 0.05, color: '#ef4444' }}>⚡</div>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: 0,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🟡 THIS WEEK</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{weekCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Target outreach sequence</div>
                <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 48, opacity: 0.05, color: '#f59e0b' }}>📅</div>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid rgba(107, 114, 128, 0.15)',
                borderRadius: 0,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚪ WATCH</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{watchCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Monitored signals</div>
                <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 48, opacity: 0.05 }}>👁️</div>
              </div>
            </div>

            {/* Filter Controls Card */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 0,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {/* Row 1: Search & Priority Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)' }}>🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by company, signal, contact name..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      fontSize: 13,
                      borderRadius: 0,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'border-color 0.15s'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { val: 'all', label: 'All Priorities' },
                    { val: 'urgent', label: '🔴 Urgent' },
                    { val: 'week', label: '🟡 This Week' },
                    { val: 'watch', label: '⚪ Watch' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setPriorityFilter(opt.val)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 0,
                        background: priorityFilter === opt.val ? 'var(--accent-blue-glow)' : 'var(--bg-elevated)',
                        border: `1px solid ${priorityFilter === opt.val ? 'var(--accent-blue)' : 'var(--border)'}`,
                        color: priorityFilter === opt.val ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Row 2: Type Filters */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 6 }}>Trigger Type:</span>
                {[
                  { val: 'all', label: 'All Types' },
                  { val: 'hiring', label: '💼 Hiring Surge' },
                  { val: 'funding', label: '💰 Funding' },
                  { val: 'product', label: '🚀 Product Launch' },
                  { val: 'social', label: '🧠 Social Posts' },
                  { val: 'news', label: '📰 News/PR' },
                  { val: 'cms', label: '🛠️ CMS/Shopify' }
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setTypeFilter(opt.val)}
                    style={{
                      padding: '5px 10px',
                      fontSize: 11.5,
                      borderRadius: 0,
                      background: typeFilter === opt.val ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      border: '1px solid transparent',
                      color: typeFilter === opt.val ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: typeFilter === opt.val ? 700 : 500,
                      transition: 'all 0.15s'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Signals List Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {finalFilteredSignals.length === 0 ? (
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>No signals found matching your filters</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing search criteria or changing filters.</div>
                  {(search || priorityFilter !== 'all' || typeFilter !== 'all') && (
                    <button
                      onClick={() => { setSearch(''); setPriorityFilter('all'); setTypeFilter('all'); }}
                      style={{
                        marginTop: 16,
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 0,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                finalFilteredSignals.map(s => {
                  const isExpanded = expandedSignals.has(s.id);
                  const isDone = doneSignals.has(s.id);
                  const pCfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.watch;
                  const logoDomain = s.company?.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
                  const logo = getLogoUrl(logoDomain);

                  // Generate email synthesis data dynamically
                  const snapData = getSnap(s.company);
                  const synthesis = synthesizeCompanyAccount(s.company, snapData, targetDept);

                  // Find contact profile from database mapping
                  const profile = profiles.find(
                    p => (p.company || '').toLowerCase() === s.company?.toLowerCase() ||
                         (p.name || '').toLowerCase() === s.company?.toLowerCase()
                  );

                  const isPersonProfile = profile && (
                    profile.company === 'Unknown' ||
                    profile.name.toLowerCase() === s.company?.toLowerCase()
                  );

                  const cacheKey = `${s.company}-${targetDept}-${targetSeniority}`;
                  const alternateContact = isPersonProfile ? null : (dynamicContacts[cacheKey] || snapData?.alternateContacts?.[0]);
                  const contactName = isPersonProfile ? profile.name : (alternateContact?.name || s.profile || profile?.name || 'Key Contact');
                  const contactTitle = isPersonProfile 
                    ? (profile.title !== 'Unknown' && profile.title !== 'Unknown Title' && profile.title ? profile.title : 'Founder') 
                    : (alternateContact?.title || profile?.title || 'Key Stakeholder');
                  const isFallbackContact = isPersonProfile ? false : (alternateContact?.isFallback || false);

                  // Relative time calculator
                  const ms = Date.now() - new Date(s.detectedAt).getTime();
                  const h = Math.floor(ms / 3600000);
                  const timeString = h < 1 ? `${Math.floor(ms / 60000)}m ago` : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;

                  const emailTemplate = synthesis?.templates?.email;
                  const linkedinTemplate = synthesis?.templates?.linkedin;
                  const frameworks = synthesis?.frameworks || [];
                  const activeFrameworkId = selectedFrameworks[s.id] || 1;
                  const activeFramework = frameworks.find(f => f.id === activeFrameworkId) || frameworks[0];
                  const firstName = contactName ? contactName.split(' ')[0] : 'there';

                  return (
                    <div
                      key={s.id}
                      style={{
                        background: isDone ? '#F8F9FA' : '#FFFFFF',
                        border: isDone ? '1px solid #E2E8F0' : `1px solid var(--border)`,
                        borderLeft: isDone ? '3px solid #10B981' : `3px solid ${pCfg.color === '#ef4444' ? '#FF2A00' : pCfg.color}`,
                        borderRadius: 0,
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      {/* Main Row Header */}
                      <div
                        onClick={() => toggleRow(s.id)}
                        style={{
                          padding: '14px 20px 14px 24px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          cursor: 'pointer',
                          flexWrap: 'wrap'
                        }}
                      >
                        {/* Expand/Collapse Arrow */}
                        <span style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                          width: 12,
                          display: 'inline-block'
                        }}>
                          ▶
                        </span>

                        {/* Logo */}
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 0,
                          background: '#fff',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: 2,
                          flexShrink: 0
                        }}>
                          <img
                            src={logo}
                            alt=""
                            onError={e => { e.target.src = `https://logo.clearbit.com/linkedin.com`; }}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>

                        {/* Company and Info */}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#132D7D' }}>{s.company}</span>
                            {synthesis?.surgeScore !== undefined && (
                              <span style={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                color: synthesis.surgeScore >= 75 ? '#FF2A00' : '#132D7D',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                [ {synthesis.surgeScore}/100 ]
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>•</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {contactName} ({contactTitle})
                              {isFallbackContact && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  background: '#FF2A0010',
                                  color: '#FF2A00',
                                  border: '1px solid #FF2A0030',
                                  padding: '1px 5px',
                                  borderRadius: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  lineHeight: 1
                                }}>
                                  ⚠️ CEO Fallback
                                </span>
                              )}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 14 }}>{s.emoji || '📡'}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 450 }}>
                              {s.label}
                            </span>
                          </div>
                        </div>

                        {/* Meta info & badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
                          <span style={{
                            fontSize: 9.5,
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 0,
                            background: '#F8F9FA',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)'
                          }}>
                            {s.source}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeString}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            background: isDone ? 'rgba(16, 185, 129, 0.08)' : (pCfg.color === '#ef4444' ? 'rgba(255, 42, 0, 0.08)' : pCfg.bg),
                            color: isDone ? '#10B981' : (pCfg.color === '#ef4444' ? '#FF2A00' : pCfg.color),
                            border: `1px solid ${isDone ? 'rgba(16,185,129,0.2)' : (pCfg.color === '#ef4444' ? 'rgba(255,42,0,0.2)' : pCfg.border)}`,
                            borderRadius: 0
                          }}>
                            {isDone ? 'Reached Out' : pCfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div style={{
                          padding: '0 24px 20px 48px',
                          borderTop: '1px solid var(--border)',
                          background: '#F8F9FA',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 16,
                          animation: 'fadeIn 0.2s ease'
                        }}>
                          {/* Reason Description */}
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Why it matters</div>
                            <div
                              style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}
                              dangerouslySetInnerHTML={{ __html: s.why || 'Buyer intent signals detected.' }}
                            />
                            {s.evidence && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>📊 Evidence:</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{s.evidence}</span>
                              </div>
                            )}

                            {/* Consolidated Signals Map */}
                            {snapData && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, padding: '10px 12px', background: '#FFFFFF', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#132D7D', width: '100%', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                  ⚡ Consolidated Signals Map (What we found)
                                </div>
                                {snapData.jobOpenings && snapData.jobOpenings.length > 0 && (
                                  <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '3px 8px', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    💼 {snapData.jobOpenings.length} Active Openings (Hiring Surge)
                                  </span>
                                )}
                                {snapData.sitemapLinks && snapData.sitemapLinks.length > 0 && (
                                  <span style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '3px 8px', color: '#132D7D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    🌐 {snapData.sitemapLinks.length} Sitemaps/URLs (Product Expansion)
                                  </span>
                                )}
                                {snapData.prMentions && snapData.prMentions.length > 0 && (
                                  <span style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '3px 8px', color: '#FF2A00', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    📰 {snapData.prMentions.length} PR/News Coverage Spikes
                                  </span>
                                )}
                                {snapData.redditMentions && snapData.redditMentions.length > 0 && (
                                  <span style={{ fontSize: 11, background: 'rgba(107, 114, 128, 0.08)', border: '1px solid rgba(107, 114, 128, 0.2)', padding: '3px 8px', color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    💬 {snapData.redditMentions.length} Reddit / Community Mentions
                                  </span>
                                )}
                                {snapData.youtubeVideos && snapData.youtubeVideos.length > 0 && (
                                  <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '3px 8px', color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    🎥 {snapData.youtubeVideos.length} YouTube Channel Uploads
                                  </span>
                                )}
                                {s.source === 'Autobound' && (
                                  <span style={{ fontSize: 11, background: 'rgba(255, 42, 0, 0.08)', border: '1px solid rgba(255, 42, 0, 0.2)', padding: '3px 8px', color: '#FF2A00', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    🔥 Autobound Outbound Account Surge
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Outreach Assistant Generators */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                            {/* Email Assistant */}
                            {frameworks && frameworks.length > 0 && (
                              <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#132D7D' }}>📧 Personalized Cold Email</span>
                                  <button
                                    onClick={(e) => handleCopyEmail(e, s.id, s.company, contactName)}
                                    style={{
                                      fontSize: 10.5,
                                      padding: '3px 8px',
                                      borderRadius: 0,
                                      background: '#FF2A00',
                                      border: 'none',
                                      color: '#FFFFFF',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    {copiedStates[`email-${s.id}`] ? '✓ Copied' : 'Copy Subject + Body'}
                                  </button>
                                </div>
                                <div style={{ display: 'flex', gap: 4, padding: '6px 12px', background: '#F8F9FA', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                                  {frameworks.map(f => (
                                    <button
                                      key={f.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFrameworks(prev => ({ ...prev, [s.id]: f.id }));
                                      }}
                                      style={{
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        borderRadius: 0,
                                        background: activeFrameworkId === f.id ? '#FF2A00' : 'transparent',
                                        border: `1px solid ${activeFrameworkId === f.id ? '#FF2A00' : 'transparent'}`,
                                        color: activeFrameworkId === f.id ? '#FFFFFF' : '#666666',
                                        cursor: 'pointer',
                                        fontWeight: activeFrameworkId === f.id ? 700 : 500
                                      }}
                                      title={f.name}
                                    >
                                      F{f.id}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>
                                  <strong>Subject:</strong> {activeFramework.subject}
                                  <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
                                  {activeFramework.body
                                    .replace(/\{\{first_name\}\}/g, firstName)
                                    .replace(/%signature%/g, 'Best,\nShubham')
                                  }
                                </div>
                              </div>
                            )}

                            {/* LinkedIn Assistant */}
                            {linkedinTemplate && (
                              <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#132D7D' }}>💬 LinkedIn Connection Note</span>
                                  <button
                                    onClick={(e) => handleCopyLinkedin(e, s.id, s.company)}
                                    style={{
                                      fontSize: 10.5,
                                      padding: '3px 8px',
                                      borderRadius: 0,
                                      background: '#FF2A00',
                                      border: 'none',
                                      color: '#FFFFFF',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    {copiedStates[`li-${s.id}`] ? '✓ Copied' : 'Copy Connection Note'}
                                  </button>
                                </div>
                                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>
                                  {linkedinTemplate.replace('{{Contact}}', contactName)}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Row Footer CTA Buttons */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                            <button
                              onClick={() => handleOpenDrawer(s.company)}
                              style={{
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 0,
                                background: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                color: '#132D7D',
                                cursor: 'pointer'
                              }}
                            >
                              💼 Open Account Dossier →
                            </button>
                            
                            {profile?.linkedinUrl && (
                              <a
                                  href={profile.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderRadius: 0,
                                  background: 'transparent',
                                  border: '1px solid #E2E8F0',
                                  color: '#132D7D',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                👤 Target LinkedIn
                              </a>
                            )}

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                              <button
                                onClick={(e) => handleToggleDone(s.id, e)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  borderRadius: 0,
                                  background: isDone ? 'transparent' : 'rgba(16, 185, 129, 0.08)',
                                  border: `1px solid ${isDone ? '#E2E8F0' : 'rgba(16, 185, 129, 0.3)'}`,
                                  color: isDone ? 'var(--text-secondary)' : '#10B981',
                                  cursor: 'pointer'
                                }}
                              >
                                {isDone ? '↩️ Mark Unreached' : '✓ Reached Out'}
                              </button>
                              
                              <button
                                onClick={() => onDismiss(s.id)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  borderRadius: 0,
                                  background: 'rgba(255, 42, 0, 0.05)',
                                  border: '1px solid rgba(255, 42, 0, 0.15)',
                                  color: '#FF2A00',
                                  cursor: 'pointer'
                                }}
                              >
                                🗑️ Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* Website Visitors (IP Intelligence) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🌐 IP Intelligence Engine
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="live-dot" style={{ width: 8, height: 8, borderRadius: 0, background: 'var(--signal-green)', boxShadow: '0 0 8px var(--signal-green)', display: 'inline-block' }}></span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Listening</span>
                  </span>
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Identify anonymous B2B accounts browsing your corporate web properties in real-time.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={onRefresh} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: 12 }}>
                🔄 Refresh Logs
              </button>
            </div>

            {/* Metric Row */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Total B2B Hits</div>
                <div className="stat-value">{totalHits}</div>
                <div className="stat-sub">Across all trackable pages</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Resolved Accounts</div>
                <div className="stat-value">{uniqueCompanies}</div>
                <div className="stat-sub">Unique corporate profiles</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Top Landing Path</div>
                <div className="stat-value" style={{ fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '12px' }}>
                  {topPage}
                </div>
                <div className="stat-sub">Highest traffic directory</div>
              </div>
            </div>

            {/* Tracking Snippet Block */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border)',
              borderRadius: 0,
              padding: '24px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    📥 Embedded Javascript Tracker
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Embed this async tracking script inside your site's <code>&lt;head&gt;</code> to deanonymize corporate visitors.
                  </p>
                </div>
                <button 
                  className={`btn ${copied ? 'btn-secondary' : 'btn-primary'}`} 
                  onClick={handleCopy}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copied ? '✓ Copied' : '📋 Copy Snippet'}
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: '14px 18px',
                background: 'var(--bg-elevated)',
                borderRadius: 0,
                border: '1px solid var(--border)',
                fontSize: '12.5px',
                color: '#60a5fa',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: '1.5'
              }}>
                {trackingCode}
              </pre>
            </div>

            {/* Live Visitor Feed */}
            <div className="signals-header">
              <div className="signals-title">
                📋 Deanonymized Visitor Traffic
                <span className="section-badge watch" style={{ marginLeft: '10px' }}>
                  {visitorLogs.length} events
                </span>
              </div>
            </div>

            {visitorLogs.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 0 }}>
                <div className="empty-icon">🌐</div>
                <div className="empty-title">Awaiting first traffic event...</div>
                <div className="empty-desc">
                  No visitors have been recorded yet. Verify the tracker snippet is embedded on your landing page.
                </div>
              </div>
            ) : (
              <div className="profiles-card">
                <table className="profiles-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px' }}>Company</th>
                      <th>Domain</th>
                      <th>Visited Path</th>
                      <th>Referrer Source</th>
                      <th>Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitorLogs.map((log) => {
                      const logoUrl = `https://logos.context.dev/?publicClientId=brandLL_46718e0a71177164dc42031e8c8e55e16d4561aeedbe4bd7&domain=${log.company_domain}`;
                      const fallbackLogoUrl = `https://logo.clearbit.com/${log.company_domain}`;
                      
                      const isExpanded = expandedCompany === log.company_domain;
                      const companyVisits = visitorLogs.filter(v => v.company_domain === log.company_domain);
                      
                      return (
                        <Fragment key={log.id}>
                          <tr 
                            style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                            onClick={() => setExpandedCompany(isExpanded ? null : log.company_domain)}
                          >
                            <td style={{ paddingLeft: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img 
                                  src={logoUrl}
                                  onError={(e) => { 
                                    if (e.target.src !== fallbackLogoUrl) {
                                      e.target.src = fallbackLogoUrl;
                                    } else {
                                      e.target.style.display = 'none';
                                    }
                                  }} 
                                  style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: 0, 
                                    background: '#fff', 
                                    padding: '2px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                  alt=""
                                />
                                <div>
                                  <span className="profile-name" style={{ fontWeight: 600 }}>{log.company_name}</span>
                                  {companyVisits.length > 1 && (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      fontSize: '11px', 
                                      background: 'rgba(59, 130, 246, 0.2)', 
                                      color: '#60a5fa', 
                                      padding: '2px 6px', 
                                      borderRadius: 0,
                                      fontWeight: 500
                                    }}>
                                      {companyVisits.length} visits
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <a 
                                href={`https://${log.company_domain}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: '#132D7D', textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {log.company_domain} ↗
                              </a>
                            </td>
                            <td>
                              <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 0, fontSize: '12px' }}>
                                {log.page_path}
                              </code>
                            </td>
                            <td>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {log.referrer ? (
                                  <a 
                                    href={log.referrer} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {log.referrer.length > 35 ? log.referrer.slice(0, 35) + '...' : log.referrer}
                                  </a>
                                ) : (
                                  'Direct / Search'
                                )}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', paddingRight: '12px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                  {formatTimestamp(log.created_at)}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ background: 'rgba(15, 23, 42, 0.3)' }}>
                              <td colSpan="5" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ paddingLeft: '32px' }}>
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📄 Timeline for {log.company_name}
                                  </h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '16px', marginLeft: '6px' }}>
                                    {companyVisits.map((visit, index) => {
                                      let refText = 'Direct / Search';
                                      try {
                                        if (visit.referrer) refText = `via ${new URL(visit.referrer).hostname}`;
                                      } catch (_) {
                                        refText = `via ${visit.referrer}`;
                                      }
                                      return (
                                        <div key={visit.id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px' }}>
                                          <div style={{ position: 'absolute', left: '-21px', top: '6px', width: '8px', height: '8px', borderRadius: 0, background: index === 0 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.3)' }} />
                                          <div>
                                            <code style={{ background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 0, fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                              {visit.page_path || '/'}
                                            </code>
                                            <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                              {refText}
                                            </span>
                                          </div>
                                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {new Date(visit.created_at).toLocaleString()}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Account Dossier Slide-out Drawer */}
      {selectedGroup && (
        <div className="modal-overlay" onClick={() => setSelectedGroup(null)} style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '95vw', height: '90vh', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s ease' }}>
            <CompanyDetailDrawer group={selectedGroup} profiles={profiles} onClose={() => setSelectedGroup(null)} onDismiss={onDismiss} targetDept={targetDept} targetSeniority={targetSeniority} correlateCache={correlateCache} setCorrelateCache={setCorrelateCache} userId={userId} />
          </div>
        </div>
      )}
    </>
  );
}
