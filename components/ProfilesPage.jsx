'use client';

import { useState, useEffect } from 'react';
import { REAL_PROFILES } from '../lib/realData';
import { synthesizeCompanyAccount } from '../lib/synthesisEngine';

export default function ProfilesPage({ profiles: propProfiles, onNavigate }) {
  const [profiles, setProfiles] = useState(propProfiles || REAL_PROFILES);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [hoveredDomain, setHoveredDomain] = useState(null);
  const [viewMode, setViewMode] = useState('accounts');

  // Mute / Pause domain tracking state
  const [mutedDomains, setMutedDomains] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('muted_domains');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    if (propProfiles) setProfiles(propProfiles);
  }, [propProfiles]);

  const toggleMuteDomain = (domain) => {
    const nextMuted = new Set(mutedDomains);
    if (nextMuted.has(domain)) {
      nextMuted.delete(domain);
    } else {
      nextMuted.add(domain);
    }
    setMutedDomains(nextMuted);
    localStorage.setItem('muted_domains', JSON.stringify(Array.from(nextMuted)));
  };

  // Group profiles to build target domain listings
  const companyGroups = {};
  profiles.forEach(p => {
    const comp = p.company || 'Unknown';
    if (!companyGroups[comp]) {
      let domain = p.companyLinkedinUrl || '';
      if (domain.includes('linkedin.com/company/')) {
        const h = domain.split('/company/')[1]?.split('?')[0]?.replace(/\/+$/, '') || '';
        domain = h ? `${h}.com` : '';
      }
      if (!domain && p.company) {
        domain = p.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
      }
      if (!domain) {
        domain = 'unknown.com';
      }

      // Calculate composite score using synthesisEngine
      const latestSnapshot = p.snapshots && p.snapshots.length > 0 ? p.snapshots[p.snapshots.length - 1] : {};
      const synthesis = synthesizeCompanyAccount(comp, latestSnapshot, 'Marketing');
      const score = synthesis.surgeScore || 35;

      let baselineStatus = 'cold';
      if (score >= 75) {
        baselineStatus = 'surging';
      } else if (score >= 40) {
        baselineStatus = 'warming';
      }

      companyGroups[comp] = {
        name: comp,
        domain,
        score,
        executives: [],
        baselineStatus,
        lastPolled: p.lastPolled
      };
    }

    companyGroups[comp].executives.push({
      name: p.name,
      title: p.title,
      linkedinUrl: p.linkedinUrl
    });
  });

  const watchlistRows = Object.values(companyGroups);

  const contactRows = profiles.map(p => {
    const comp = p.company || 'Unknown';
    let domain = p.companyLinkedinUrl || '';
    if (domain.includes('linkedin.com/company/')) {
      const h = domain.split('/company/')[1]?.split('?')[0]?.replace(/\/+$/, '') || '';
      domain = h ? `${h}.com` : '';
    }
    if (!domain && p.company) {
      domain = p.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    }
    if (!domain) {
      domain = 'unknown.com';
    }

    const latestSnapshot = p.snapshots && p.snapshots.length > 0 ? p.snapshots[p.snapshots.length - 1] : {};
    const synthesis = synthesizeCompanyAccount(comp, latestSnapshot, 'Marketing');
    const score = synthesis.surgeScore || 35;

    let baselineStatus = 'cold';
    if (score >= 75) {
      baselineStatus = 'surging';
    } else if (score >= 40) {
      baselineStatus = 'warming';
    }

    return {
      id: p.id,
      name: p.name,
      title: p.title,
      company: comp,
      domain,
      linkedinUrl: p.linkedinUrl,
      lastPolled: p.lastPolled || p.last_polled,
      status: p.status || 'pending',
      baselineStatus,
      score
    };
  });

  const filteredRows = watchlistRows.filter(row => {
    const isMuted = mutedDomains.has(row.domain);
    if (filter === 'surging' && row.baselineStatus !== 'surging') return false;
    if (filter === 'warming' && row.baselineStatus !== 'warming') return false;
    if (filter === 'cold' && row.baselineStatus !== 'cold') return false;
    if (filter === 'muted' && !isMuted) return false;
    if (filter === 'unmuted' && isMuted) return false;

    if (search) {
      const q = search.toLowerCase();
      if (!row.name.toLowerCase().includes(q) && !row.domain.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredContacts = contactRows.filter(row => {
    const isMuted = mutedDomains.has(row.domain);
    if (filter === 'surging' && row.baselineStatus !== 'surging') return false;
    if (filter === 'warming' && row.baselineStatus !== 'warming') return false;
    if (filter === 'cold' && row.baselineStatus !== 'cold') return false;
    if (filter === 'muted' && !isMuted) return false;
    if (filter === 'unmuted' && isMuted) return false;

    if (search) {
      const q = search.toLowerCase();
      if (
        !row.name.toLowerCase().includes(q) &&
        !row.company.toLowerCase().includes(q) &&
        !row.title.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalDomains = watchlistRows.length;
  const surgingDomains = watchlistRows.filter(r => r.baselineStatus === 'surging').length;
  const warmingDomains = watchlistRows.filter(r => r.baselineStatus === 'warming').length;
  const coldDomains = watchlistRows.filter(r => r.baselineStatus === 'cold').length;
  const mutedCount = mutedDomains.size;
  const totalContacts = contactRows.length;

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', color: '#333333', fontFamily: 'var(--font-sans)', padding: '24px 28px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🗄️</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#132D7D' }}>
              Administrative Watchlist
            </h1>
          </div>
          <p style={{ color: '#666666', margin: '4px 0 0', fontSize: 12 }}>
            Manage targeted accounts, track baseline signals, and optimize API credit usage.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 0, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#132D7D', fontWeight: 700 }}
            onClick={() => onNavigate('upload')}
          >
            ＋ Upload Profiles
          </button>
          <button 
            className="btn btn-primary" 
            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 0, background: '#FF2A00', border: 'none', color: '#FFFFFF', fontWeight: 700 }}
            onClick={() => onNavigate('poll')}
          >
            ⚡ Run Poll
          </button>
        </div>
      </div>

      {/* Watchlist Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Domains Tracked', value: totalDomains, color: '#132D7D', icon: '🌐' },
          { label: 'Actively Surging', value: surgingDomains, color: '#FF2A00', icon: '🔥' },
          { label: 'Warming Up', value: warmingDomains, color: '#F59E0B', icon: '⚡' },
          { label: 'Cold Baseline', value: coldDomains, color: '#8B9EC4', icon: '⚪' },
          { label: 'Muted Credit Pool', value: mutedCount, color: '#6B7280', icon: '🔇' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 9.5, color: '#666666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color, marginTop: 2 }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Control bar */}
      <div style={{
        background: '#F8F9FA',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
        padding: '10px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        {/* View Mode Toggle */}
        <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setViewMode('accounts')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: viewMode === 'accounts' ? '#132D7D' : '#FFFFFF',
              color: viewMode === 'accounts' ? '#FFFFFF' : '#132D7D',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            🏢 Accounts
          </button>
          <button
            onClick={() => setViewMode('contacts')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: viewMode === 'contacts' ? '#132D7D' : '#FFFFFF',
              color: viewMode === 'contacts' ? '#FFFFFF' : '#132D7D',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            👥 Contacts
          </button>
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#888888' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={viewMode === 'contacts' ? "Search name, title, or company..." : "Search domain or company..."}
            style={{
              width: '100%',
              padding: '6px 12px 6px 30px',
              fontSize: 12,
              borderRadius: 0,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#333333',
              outline: 'none'
            }}
          />
        </div>

        {/* Dropdown status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#666666' }}>BASELINE STATUS:</span>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 0,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#333333',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Profiles</option>
            <option value="surging">🔥 Actively Surging</option>
            <option value="warming">⚡ Warming Up</option>
            <option value="cold">⚪ Cold</option>
            <option value="muted">🔇 Muted/Paused</option>
            <option value="unmuted">🔊 Active tracking</option>
          </select>
        </div>
      </div>

      {/* The Data Table */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#FFFFFF' }}>
          {viewMode === 'accounts' ? (
            <>
              <thead>
                <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '30%' }}>Domain</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '30%' }}>Tracked Executives</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '20%' }}>Baseline Status</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '20%', textAlign: 'right' }}>Credit Control</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '32px 16px', textAlign: 'center', color: '#888888', fontSize: 12 }}>
                      No target domains found matching active criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isMuted = mutedDomains.has(row.domain);
                    
                    // Color dots mapping
                    let dotColor = '#8B9EC4'; // Cold status dot
                    let statusLabel = 'Cold Baseline';
                    
                    if (isMuted) {
                      statusLabel = 'Paused';
                    } else if (row.baselineStatus === 'surging') {
                      dotColor = '#FF2A00';
                      statusLabel = 'Actively Surging';
                    } else if (row.baselineStatus === 'warming') {
                      dotColor = '#F59E0B';
                      statusLabel = 'Warming Up';
                    }

                    return (
                      <tr 
                        key={row.domain} 
                        style={{ 
                          borderBottom: '1px solid #E2E8F0',
                          opacity: isMuted ? 0.5 : 1,
                          background: isMuted ? '#F8F9FA' : '#FFFFFF',
                          transition: 'opacity 0.2s, background 0.2s'
                        }}
                      >
                        {/* Column 1: Domain */}
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#333333' }}>
                          {row.domain}
                          <span style={{ display: 'block', fontSize: 10, color: '#888888', fontWeight: 400, marginTop: 1 }}>{row.name}</span>
                        </td>

                        {/* Column 2: Tracked Executives (Rendered inline for quick visibility) */}
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#4A5568' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {row.executives.map((exec, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <a 
                                  href={exec.linkedinUrl || 'https://www.linkedin.com'} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ color: '#132D7D', fontWeight: 700, textDecoration: 'none' }}
                                  onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.target.style.textDecoration = 'none'}
                                >
                                  👤 {exec.name} ↗
                                </a>
                                <span style={{ color: '#666666', fontSize: 11 }}>({exec.title || 'Executive'})</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Column 3: Baseline Status */}
                        <td style={{ padding: '12px 16px', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!isMuted && (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                            )}
                            <span style={{ fontWeight: 700, color: isMuted ? '#6B7280' : '#333333' }}>
                              {statusLabel}
                            </span>
                          </div>
                        </td>

                        {/* Column 4: Credit Optimization Controls */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => toggleMuteDomain(row.domain)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 10,
                              fontWeight: 700,
                              background: isMuted ? 'rgba(19, 45, 125, 0.08)' : 'rgba(255, 42, 0, 0.08)',
                              border: `1px solid ${isMuted ? '#132D7D' : '#FF2A00'}`,
                              color: isMuted ? '#132D7D' : '#FF2A00',
                              cursor: 'pointer',
                              borderRadius: 0,
                              textTransform: 'uppercase'
                            }}
                          >
                            {isMuted ? '🔊 Active Tracking' : '🔇 Pause Tracking'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '25%' }}>Name</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '35%' }}>Role & Company</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '20%' }}>Last Polled</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', width: '20%', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '32px 16px', textAlign: 'center', color: '#888888', fontSize: 12 }}>
                      No tracked contacts found matching active criteria.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((row) => {
                    const isMuted = mutedDomains.has(row.domain);
                    
                    let dotColor = '#8B9EC4'; 
                    let statusLabel = 'Cold';
                    
                    if (isMuted) {
                      statusLabel = 'Paused';
                    } else if (row.baselineStatus === 'surging') {
                      dotColor = '#FF2A00';
                      statusLabel = 'Surging';
                    } else if (row.baselineStatus === 'warming') {
                      dotColor = '#F59E0B';
                      statusLabel = 'Warming';
                    }

                    const formatLastPolled = (dateStr) => {
                      if (!dateStr) return 'Never';
                      try {
                        const d = new Date(dateStr);
                        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } catch (e) {
                        return dateStr;
                      }
                    };

                    return (
                      <tr 
                        key={row.id || row.linkedinUrl} 
                        style={{ 
                          borderBottom: '1px solid #E2E8F0',
                          opacity: isMuted ? 0.6 : 1,
                          background: isMuted ? '#F8F9FA' : '#FFFFFF',
                          transition: 'opacity 0.2s, background 0.2s'
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700 }}>
                          <a 
                            href={row.linkedinUrl || 'https://www.linkedin.com'} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ color: '#132D7D', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.target.style.textDecoration = 'none'}
                          >
                            👤 {row.name} ↗
                          </a>
                        </td>

                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#333333' }}>
                          <div style={{ fontWeight: 600 }}>{row.title || 'Executive'}</div>
                          <div style={{ fontSize: 11, color: '#666666' }}>{row.company} ({row.domain})</div>
                        </td>

                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#4A5568' }}>
                          {formatLastPolled(row.lastPolled)}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {!isMuted && (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                            )}
                            <span style={{ fontWeight: 700, color: isMuted ? '#6B7280' : '#333333' }}>
                              {statusLabel}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}
