'use client';

import { useState, useEffect, useRef } from 'react';
import { groupSignalsByPriority } from '../lib/signalEngine';
import { MOCK_SIGNALS, MOCK_CREDITS, MOCK_PROFILES, MOCK_POLL_LOG } from '../lib/mockData';

function SignalCard({ signal, onDismiss, isRecent }) {
  const priorityClass = signal.priority;
  const initials = signal.profile?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??';
  const initialProofUrl = signal.postUrl || signal.linkedinUrl || (signal.data && signal.data.url);
  const [proofUrl, setProofUrl] = useState(initialProofUrl);

  useEffect(() => {
    if (!initialProofUrl) return;

    const isSocialOrLocal = initialProofUrl.includes('linkedin.com') ||
                            initialProofUrl.includes('twitter.com') ||
                            initialProofUrl.includes('x.com') ||
                            initialProofUrl.includes('reddit.com');

    if (isSocialOrLocal) {
      setProofUrl(initialProofUrl);
      return;
    }

    let isMounted = true;

    fetch('/api/validate-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: initialProofUrl })
    })
      .then(res => {
        if (!res.ok) throw new Error('Validation failed');
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          if (data.valid === false) {
            const fallback = signal.profileLinkedinUrl || signal.linkedinUrl || 'https://www.linkedin.com';
            const safeFallback = fallback === initialProofUrl ? 'https://www.linkedin.com' : fallback;
            setProofUrl(safeFallback);
            console.warn(`[Link Validator] Fallback for ${initialProofUrl} ➔ ${safeFallback}`);
          } else {
            setProofUrl(initialProofUrl);
          }
        }
      })
      .catch(err => {
        console.error('[Link Validator] Error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [initialProofUrl, signal.linkedinUrl, signal.profileLinkedinUrl]);

  return (
    <div className={`signal-card ${priorityClass}`}>
      <div className={`signal-avatar ${priorityClass}`}>{signal.emoji || initials}</div>
      <div className="signal-body">
        <div className="signal-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="signal-name">{signal.profile}</span>
            {isRecent && (
              <span style={{
                background: 'var(--accent-blue-glow)',
                color: 'var(--accent-blue)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '10px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                New Run
              </span>
            )}
          </div>
          <span className="signal-time">{formatTime(signal.detectedAt)}</span>
        </div>
        <div
          className="signal-why"
          dangerouslySetInnerHTML={{ __html: signal.why }}
        />
        <div className="signal-tags">
          <span className="signal-tag">{signal.company}</span>
          <span className="signal-tag">{signal.label}</span>
          {signal.evidence && (
            <span className="signal-tag text-muted" style={{ borderStyle: 'dashed' }}>
              📊 {signal.evidence}
            </span>
          )}
        </div>
      </div>
      <div className="signal-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {proofUrl && (
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action ghost"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none'
            }}
          >
            🔗 Verify Proof
          </a>
        )}
        <button
          className="btn-action primary"
          onClick={() => window.open(signal.profileLinkedinUrl || signal.linkedinUrl || 'https://linkedin.com', '_blank')}
        >
          {signal.action}
        </button>
        <button className="btn-action ghost" onClick={() => onDismiss(signal.id)}>✕</button>
      </div>
    </div>
  );
}

function SignalSection({ title, badge, signals, onDismiss, recentSignalIds }) {
  if (signals.length === 0) return null;
  return (
    <div>
      <div className="signals-header">
        <div className="signals-title">
          {title}
          <span className={`section-badge ${badge}`}>{signals.length}</span>
        </div>
      </div>
      <div className="signals-list">
        {signals.map(s => (
          <SignalCard
            key={s.id}
            signal={s}
            onDismiss={onDismiss}
            isRecent={recentSignalIds && recentSignalIds.has(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

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

export default function Dashboard({ signals: propSignals, profiles: propProfiles, credits, onNavigate, recentSignalIds, onDismiss }) {
  const [signals, setSignals] = useState(propSignals || MOCK_SIGNALS);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailAddress) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAddress,
          signals: filtered,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setEmailStatus({ type: 'success', message: 'Email sent successfully!' });
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailStatus(null);
      }, 2000);
    } catch (err) {
      setEmailStatus({ type: 'error', message: err.message });
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    if (propSignals) setSignals(propSignals);
  }, [propSignals]);

  const handleDismiss = (id) => {
    setSignals(prev => prev.filter(s => s.id !== id));
    if (onDismiss) {
      onDismiss(id);
    }
  };

  const filtered = signals.filter(s => {
    if (filter !== 'all' && s.priority !== filter) return false;
    if (showRecentOnly && recentSignalIds && !recentSignalIds.has(s.id)) return false;
    if (search && !s.profile?.toLowerCase().includes(search.toLowerCase()) &&
        !s.company?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = groupSignalsByPriority(filtered);
  const profiles = propProfiles || MOCK_PROFILES;
  const totalProfiles = profiles.length;
  const changedCount = profiles.filter(p => p.status === 'changed').length;
  const signalCount = signals.filter(s => !s.dismissed).length;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          Signal Dashboard
          <span style={{ marginLeft: 10 }}>
            <span className="live-dot" style={{ marginRight: 6 }}></span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Live</span>
          </span>
        </div>
        <div className="topbar-right">
          <button className="btn btn-secondary" onClick={() => setShowEmailModal(true)}>
            📧 Email Summary
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('upload')}>
            ＋ Upload Profiles
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('poll')}>
            ⚡ Run Poll
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-row">
          <StatCard
            label="Profiles Monitored"
            value={totalProfiles}
            sub="Updated weekly"
            badge={{ type: 'up', text: '↑ Active' }}
          />
          <StatCard
            label="Signals This Week"
            value={signalCount}
            sub={`${grouped.urgent.length} urgent`}
            badge={{ type: 'up', text: `${grouped.urgent.length} urgent` }}
          />
          <StatCard
            label="Companies Changed"
            value={changedCount}
            sub="Job changes detected"
          />
          <StatCard
            label="Credits Remaining"
            value={credits ? (credits.remaining !== undefined ? credits.remaining : (credits.total - credits.used)) : (MOCK_CREDITS.total - MOCK_CREDITS.used)}
            sub={credits ? (credits.plan === 'Pay-as-you-go' ? 'Pay-as-you-go plan' : `of ${credits.total} total`) : `of ${MOCK_CREDITS.total} total`}
          />
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <input
            id="signal-search"
            className="filter-input"
            placeholder="Search by name or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="tabs" style={{ margin: 0 }}>
            {[['all', 'All'], ['urgent', '🔴 Urgent'], ['week', '🟡 This Week'], ['watch', '🟢 Watch']].map(([val, label]) => (
              <button
                key={val}
                className={`tab ${filter === val ? 'active' : ''}`}
                onClick={() => setFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
          {recentSignalIds && recentSignalIds.size > 0 && (
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              whiteSpace: 'nowrap'
            }}>
              <input
                type="checkbox"
                checked={showRecentOnly}
                onChange={e => setShowRecentOnly(e.target.checked)}
                style={{ accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
              />
              🆕 Latest Run Only
            </label>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <div className="empty-title">No signals match your filter</div>
            <div className="empty-desc">Try adjusting the search or filter above</div>
          </div>
        ) : (
          <>
            <SignalSection
              title="🔴 Reach Out Today"
              badge="urgent"
              signals={grouped.urgent}
              onDismiss={handleDismiss}
              recentSignalIds={recentSignalIds}
            />
            <SignalSection
              title="🟡 Reach Out This Week"
              badge="week"
              signals={grouped.week}
              onDismiss={handleDismiss}
              recentSignalIds={recentSignalIds}
            />
            <SignalSection
              title="🟢 Watch"
              badge="watch"
              signals={grouped.watch}
              onDismiss={handleDismiss}
              recentSignalIds={recentSignalIds}
            />
          </>
        )}
      </div>
      {/* Email Summary Modal */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '480px' }}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '18px', fontWeight: 700 }}>
              <span>📧 Email Daily Summary</span>
            </div>
            <div className="modal-desc" style={{ marginTop: '6px' }}>
              Send a snapshot of the current <strong>{filtered.length} filtered signals</strong> to your inbox via Resend.
            </div>

            <form onSubmit={handleSendEmail}>
              <div className="form-group">
                <label className="form-label" htmlFor="summary-email">Recipient Email Address</label>
                <input
                  id="summary-email"
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={e => setEmailAddress(e.target.value)}
                  required
                  disabled={sendingEmail}
                  style={{ width: '100%' }}
                />
                <small style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  * Free Resend sandboxes can only send emails to the registered account owner's email address.
                </small>
              </div>

              {emailStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  marginBottom: '16px',
                  background: emailStatus.type === 'success' ? 'var(--signal-green-bg)' : 'var(--signal-red-bg)',
                  border: `1px solid ${emailStatus.type === 'success' ? 'var(--signal-green-border)' : 'var(--signal-red-border)'}`,
                  color: emailStatus.type === 'success' ? 'var(--signal-green)' : 'var(--signal-red)',
                }}>
                  {emailStatus.type === 'success' ? '✓' : '⚠️'} {emailStatus.message}
                </div>
              )}

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmailModal(false)} disabled={sendingEmail}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingEmail || !emailAddress}>
                  {sendingEmail ? '⏳ Sending...' : '📧 Send Summary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  return `${diffD}d ago`;
}
