'use client';

import { useState, useEffect } from 'react';
import { REAL_PROFILES } from '../lib/realData';

export default function ProfilesPage({ profiles: propProfiles, onNavigate }) {
  const [profiles, setProfiles] = useState(propProfiles || REAL_PROFILES);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [snapshotsMap, setSnapshotsMap] = useState({});

  useEffect(() => {
    if (propProfiles) setProfiles(propProfiles);
  }, [propProfiles]);

  useEffect(() => {
    const stored = localStorage.getItem('profile_snapshots');
    if (stored) {
      setSnapshotsMap(JSON.parse(stored));
    }
  }, [selectedProfile]);

  const filtered = profiles.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.company?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.status === 'active').length,
    changed: profiles.filter(p => p.status === 'changed').length,
    pending: profiles.filter(p => p.status === 'pending').length,
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Monitored Profiles</div>
        <div className="topbar-right">
          <button className="btn btn-secondary" onClick={() => onNavigate('upload')}>
            ＋ Add More Profiles
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('poll')}>
            ⚡ Run Poll Now
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Mini stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
            { label: 'Active', value: stats.active, color: 'var(--signal-green)' },
            { label: 'Changed', value: stats.changed, color: 'var(--signal-red)' },
            { label: 'Pending', value: stats.pending, color: 'var(--signal-yellow)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 20px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color }}>{value}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <input
            id="profile-search"
            className="filter-input"
            placeholder="Search by name or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            id="profile-status-filter"
            className="filter-select"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="changed">Changed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <div className="empty-title">No profiles yet</div>
            <div className="empty-desc">Upload a CSV to start monitoring your contacts</div>
            <button className="btn btn-primary" onClick={() => onNavigate('upload')}>
              Upload Profiles
            </button>
          </div>
        ) : (
          <div className="profiles-card">
            <table className="profiles-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Last Polled</th>
                  <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td><span className="profile-name">{p.name}</span></td>
                    <td>{p.company || '—'}</td>
                    <td>{p.title || '—'}</td>
                    <td>
                      <span className="status-dot">
                        <span className={`dot ${p.status}`}></span>
                        {p.status === 'active' ? 'Monitoring' :
                         p.status === 'changed' ? 'Changed ⚡' :
                         p.status === 'pending' ? 'Pending' : p.status}
                      </span>
                    </td>
                    <td>{p.lastPolled ? formatRelative(p.lastPolled) : 'Never'}</td>
                    <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                        <a
                          href={p.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11px', margin: 0 }}
                        >
                          LinkedIn
                        </a>
                        {p.status !== 'pending' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '11px', margin: 0 }}
                            onClick={() => setSelectedProfile(p)}
                          >
                            🔍 Inspect Dossier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedProfile && (
        <DossierModal
          profile={selectedProfile}
          profiles={profiles}
          snapshotsMap={snapshotsMap}
          snapshot={snapshotsMap[selectedProfile.linkedinUrl] || 
                    (selectedProfile.snapshots && selectedProfile.snapshots[selectedProfile.snapshots.length - 1]) || 
                    {}}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={() => {
            setSelectedProfile(null);
            setActiveTab('summary');
          }}
        />
      )}
    </>
  );
}

function DossierModal({ profile, profiles, snapshotsMap, snapshot, activeTab, setActiveTab, onClose }) {
  const [copied, setCopied] = useState(false);

  // Helper to determine URL type
  const getUrlType = (url) => {
    if (!url) return null;
    const clean = url.toLowerCase();
    if (clean.includes('/company/')) return 'company';
    if (clean.includes('/in/') || clean.includes('/profile/')) return 'person';
    return 'unknown';
  };

  const isPerson = getUrlType(profile.linkedinUrl) === 'person';
  
  // Find associated company profile if selectedProfile is a person
  const companyProfile = isPerson ? profiles.find(cp => {
    if (getUrlType(cp.linkedinUrl) !== 'company') return false;
    const pComp = (profile.company || '').toLowerCase();
    const cpName = (cp.name || cp.company || '').toLowerCase();
    return pComp && (pComp.includes(cpName) || cpName.includes(pComp));
  }) : null;

  // Retrieve company snapshot if we have a company profile
  const companySnapshot = companyProfile ? (snapshotsMap[companyProfile.linkedinUrl] || 
                            (companyProfile.snapshots && companyProfile.snapshots[companyProfile.snapshots.length - 1]) || 
                            {}) : {};

  // Merge job vacancies
  const mergedJobs = [
    ...(snapshot.jobOpenings || []),
    ...(companySnapshot.jobOpenings || [])
  ];
  // Deduplicate jobs by title + location
  const seenJobs = new Set();
  const dedupedJobs = mergedJobs.filter(j => {
    const key = `${j.title}-${j.location}`.toLowerCase();
    if (seenJobs.has(key)) return false;
    seenJobs.add(key);
    return true;
  });

  // Merge sitemaps
  const mergedSitemaps = [
    ...(snapshot.sitemapLinks || []),
    ...(companySnapshot.sitemapLinks || [])
  ];
  const dedupedSitemaps = Array.from(new Set(mergedSitemaps));

  // Merge company posts (if person snapshot doesn't have it, load from company snapshot)
  const mergedCompanyPosts = [
    ...(snapshot.posts || []),
    ...(companySnapshot.posts || [])
  ];
  // Deduplicate by text
  const seenCPosts = new Set();
  const dedupedCompanyPosts = mergedCompanyPosts.filter(cp => {
    const key = (cp.text || '').slice(0, 100).toLowerCase();
    if (!key) return false;
    if (seenCPosts.has(key)) return false;
    seenCPosts.add(key);
    return true;
  });

  // Consolidated record
  const record = {
    metadata: {
      id: profile.id,
      name: profile.name,
      company: profile.company,
      title: profile.title,
      location: profile.location,
      status: profile.status,
      lastPolled: profile.lastPolled,
      linkedinUrl: profile.linkedinUrl
    },
    linkedinSnapshot: {
      currentCompany: snapshot.currentCompany || profile.company || '—',
      currentTitle: snapshot.currentTitle || profile.title || '—',
      followers: profile.followers || snapshot.companyFollowers || '—',
      employees: profile.companyEmployees || snapshot.companyHeadcount || '—',
      industry: profile.companyIndustry || snapshot.companyIndustry || '—',
      location: snapshot.location || profile.location || '—',
      polledAt: snapshot.polledAt || profile.lastPolled || '—'
    },
    prMentions: snapshot.prMentions || [],
    redditMentions: snapshot.redditMentions || [],
    twitterMentions: snapshot.twitterMentions || [],
    youtubeVideos: snapshot.youtubeVideos || [],
    sitemapLinks: dedupedSitemaps,
    jobOpenings: dedupedJobs,
    recentPosts: snapshot.recentPosts || [],
    activity: snapshot.activity || [],
    companyPosts: dedupedCompanyPosts
  };

  const jsonString = JSON.stringify(record, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '720px', maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div className="modal-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <span>👤 Intelligence Dossier</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {profile.name} · {profile.company || 'Company Page'}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 12px' }}>✕ Close</button>
        </div>

        {/* Tab row */}
        <div className="tabs" style={{ marginBottom: 20, flexShrink: 0 }}>
          {[
            ['summary', '📊 Summary'],
            ['posts', '📝 Activity & Posts'],
            ['mentions', '💬 Mentions'],
            ['site', '💼 Site & Jobs'],
            ['json', '⚙️ Raw JSON']
          ].map(([id, label]) => (
            <button
              key={id}
              className={`tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
              style={{ border: 'none', background: 'none' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Modal content area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: '320px' }}>
          
          {activeTab === 'summary' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 20 }}>
                {[
                  { label: 'Official Title', value: record.linkedinSnapshot.currentTitle },
                  { label: 'Employer / Company', value: record.linkedinSnapshot.currentCompany },
                  { label: 'Followers (LinkedIn)', value: record.linkedinSnapshot.followers },
                  { label: 'Employee Headcount', value: record.linkedinSnapshot.employees },
                  { label: 'Industry Sector', value: record.linkedinSnapshot.industry },
                  { label: 'Verified Location', value: record.linkedinSnapshot.location },
                  { label: 'Last Scan', value: record.linkedinSnapshot.polledAt ? new Date(record.linkedinSnapshot.polledAt).toLocaleString() : 'Never' }
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <ActivityPostsTab
              profile={profile}
              snapshot={snapshot}
              dedupedCompanyPosts={dedupedCompanyPosts}
              isPerson={isPerson}
            />
          )}

          {activeTab === 'mentions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Google News PR */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📰 Google News PR Mentions ({record.prMentions.length})
                </h4>
                {record.prMentions.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No PR articles found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {record.prMentions.map((m, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--accent-blue)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                          {m.title}
                        </a>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Published: {new Date(m.pubDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reddit */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💬 Reddit Discussions ({record.redditMentions.length})
                </h4>
                {record.redditMentions.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Reddit discussions found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {record.redditMentions.map((m, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{m.title}</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>"{m.content}"</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                           <span>Author: u/{m.author}</span>
                           <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>View Thread →</a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Twitter */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🐦 Twitter / X Mentions ({record.twitterMentions.length})
                </h4>
                {record.twitterMentions.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Twitter mentions found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {record.twitterMentions.map((m, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>"{m.text}"</p>
                        <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>View Tweet →</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* YouTube */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎥 YouTube Uploads ({record.youtubeVideos.length})
                </h4>
                {record.youtubeVideos.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No YouTube videos found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {record.youtubeVideos.map((v, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <a href={v.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--accent-blue)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                          {v.title}
                        </a>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uploaded: {new Date(v.pubDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'site' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Job Vacancies */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💼 Job Vacancies ({record.jobOpenings.length})
                </h4>
                {record.jobOpenings.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active job openings found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {record.jobOpenings.map((j, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{j.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            📍 {j.location} · Source: {j.source}
                          </div>
                        </div>
                        <a href={j.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                          View URL →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sitemap Links */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🌐 Sitemap Links ({record.sitemapLinks.length})
                </h4>
                {record.sitemapLinks.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No sitemap links indexed.</p>
                ) : (
                  <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {record.sitemapLinks.map((l, idx) => (
                      <a key={idx} href={l} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🔗 {l}
                      </a>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'json' && (
            <div style={{ position: 'relative' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleCopy}
                style={{ position: 'absolute', top: 10, right: 10, padding: '6px 12px', fontSize: '12px' }}
              >
                {copied ? '✅ Copied!' : '📋 Copy JSON'}
              </button>
              <pre style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                color: '#86A5DF',
                fontFamily: 'Courier New, monospace',
                fontSize: '11px',
                overflowX: 'auto',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {jsonString}
              </pre>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function ActivityPostsTab({ profile, snapshot, dedupedCompanyPosts, isPerson }) {
  const [subTab, setSubTab] = useState(isPerson ? 'person-posts' : 'company-posts');

  const personPosts = snapshot.recentPosts || [];
  const personActivity = snapshot.activity || [];
  const companyPosts = dedupedCompanyPosts || [];

  // Determine available options
  const options = [];
  if (isPerson) {
    options.push({ id: 'person-posts', label: `Posts (${personPosts.length})` });
    options.push({ id: 'person-likes', label: `Likes & Activity (${personActivity.length})` });
    options.push({ id: 'company-posts', label: `${profile.company || 'Company'} Posts (${companyPosts.length})` });
  } else {
    options.push({ id: 'company-posts', label: `Company Posts (${companyPosts.length})` });
  }

  const activePosts = subTab === 'person-posts' ? personPosts : 
                      subTab === 'person-likes' ? personActivity : companyPosts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg-elevated)', padding: 4, borderRadius: 'var(--radius-sm)', alignSelf: 'flex-start' }}>
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSubTab(opt.id)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '4px',
              border: 'none',
              background: subTab === opt.id ? 'var(--bg-card)' : 'transparent',
              color: subTab === opt.id ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {activePosts.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
          No posts found.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activePosts.map((post, idx) => {
            const isLikedType = subTab === 'person-likes';
            const postText = post.title || post.text || '';
            const postDate = post.datePublished || post.date || snapshot.polledAt || profile.lastPolled;
            const authorName = isPerson && subTab !== 'company-posts' ? profile.name : (profile.company || profile.name);
            const authorTitle = isPerson && subTab !== 'company-posts' ? profile.title : 'Company Page';
            const authorImage = isPerson && subTab !== 'company-posts' ? profile.image : null;

            return (
              <div key={idx} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'all 0.15s ease'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'white',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {authorImage ? (
                      <img src={authorImage} alt={authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{authorName}</span>
                      {isLikedType && (
                        <span style={{
                          fontSize: '10px',
                          background: 'var(--signal-green-bg)',
                          color: 'var(--signal-green)',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontWeight: 500
                        }}>
                          Liked Activity
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {authorTitle} · {postDate ? new Date(postDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent'}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {postText}
                </div>

                {/* Footer / Engagement */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 16, fontSize: '12px', color: 'var(--text-muted)' }}>
                    {post.likesCount !== undefined && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        👍 {post.likesCount}
                      </span>
                    )}
                    {post.commentsCount !== undefined && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        💬 {post.commentsCount}
                      </span>
                    )}
                  </div>
                  {post.link && (
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px', margin: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      🔗 Verify Proof
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now - d) / 3600000);
  const diffD = Math.floor((now - d) / 86400000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  return `${diffD}d ago`;
}
