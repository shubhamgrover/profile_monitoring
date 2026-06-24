'use client';

import { useState, useEffect, Fragment } from 'react';

export default function IpIntelligencePage({ trackerId, visitorLogs = [], onRefresh }) {
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

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          🌐 IP Intelligence Engine
          <span style={{ marginLeft: 10 }}>
            <span className="live-dot" style={{ marginRight: 6 }}></span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Listening</span>
          </span>
        </div>
        <div className="topbar-right">
          <button className="btn btn-secondary" onClick={onRefresh} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            🔄 Refresh Logs
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Metric Row */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Identified B2B Hits</div>
            <div className="stat-value">{totalHits}</div>
            <div className="stat-sub">Across all connected domains</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">De-anonymized Companies</div>
            <div className="stat-value">{uniqueCompanies}</div>
            <div className="stat-sub">Unique corporate entities resolved</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Most Visited Path</div>
            <div className="stat-value" style={{ fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '12px' }}>
              {topPage}
            </div>
            <div className="stat-sub">Top landing directory</div>
          </div>
        </div>

        {/* Tracking Snippet Block */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                📥 Embedded Tracking Code
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Copy and paste this script tag inside the <code>&lt;head&gt;</code> of your website to start identifying enterprise visitors.
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
                fontSize: '13px',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? '✓ Copied' : '📋 Copy Snippet'}
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '14px 18px',
            background: 'var(--bg-main)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '13px',
            color: 'var(--accent-blue)',
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
            📋 Live De-anonymized Traffic Feed
            <span className="section-badge watch" style={{ marginLeft: '10px' }}>
              {visitorLogs.length} hits
            </span>
          </div>
        </div>

        {visitorLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-icon">🌐</div>
            <div className="empty-title">Waiting for traffic data...</div>
            <div className="empty-desc">
              Your tracking snippet is ready. Embed the code on your website to start resolving anonymous visitor IPs.
            </div>
          </div>
        ) : (
          <div className="profiles-card">
            <table className="profiles-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Company</th>
                  <th>Domain</th>
                  <th>Page Visited</th>
                  <th>Referrer</th>
                  <th>Detected At</th>
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
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '6px', 
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
                                  borderRadius: '12px',
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
                            style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {log.company_domain} ↗
                          </a>
                        </td>
                        <td>
                          <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
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
                                📄 Customer Journey Timeline for {log.company_name}
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
                                      <div style={{ position: 'absolute', left: '-21px', top: '6px', width: '8px', height: '8px', borderRadius: '50%', background: index === 0 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.3)' }} />
                                      <div>
                                        <code style={{ background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
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
      </div>
    </>
  );
}

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffH < 1) {
    const mins = Math.floor(diffMs / 60000);
    return mins <= 1 ? 'Just now' : `${mins}m ago`;
  }
  if (diffH < 24) return `${diffH}h ago`;
  return `${diffD}d ago`;
}
