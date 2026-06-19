'use client';

import { useState, useEffect, useRef } from 'react';
import { detectSignals, detectExternalSignals, rankSignals } from '../lib/signalEngine';
import { MOCK_PROFILES, MOCK_POLL_LOG, MOCK_SIGNALS } from '../lib/mockData';
import { identifyLinkedInUrlType } from '../lib/poller';
import { supabase } from '../lib/supabaseClient';

export default function PollPage({ profiles: propProfiles, apiKey: propApiKey, onApiKeyChange, onProfilesUpdated, onSignalsDetected, onNavigate }) {
  const [apiKey, setApiKey] = useState(propApiKey || '');
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const [signalsFound, setSignalsFound] = useState(0);
  const [showApiModal, setShowApiModal] = useState(!propApiKey);

  useEffect(() => {
    setApiKey(propApiKey || '');
  }, [propApiKey]);
  const logRef = useRef(null);
  const profiles = propProfiles || MOCK_PROFILES;

  // Added logic for filtering pending profiles
  const pendingProfiles = profiles.filter(p => p.status === 'pending');
  const [pollMode, setPollMode] = useState(pendingProfiles.length > 0 ? 'pending' : 'all');
  const activeQueue = pollMode === 'pending' ? pendingProfiles : profiles;

  // Person polls can make 2 calls (profile + company), company-only makes 1 call
  const personPollCount = activeQueue.filter(p => identifyLinkedInUrlType(p.linkedinUrl) === 'person').length;
  const companyPollCount = activeQueue.filter(p => identifyLinkedInUrlType(p.linkedinUrl) === 'company').length;
  const companyOverlapCount = activeQueue.filter(p => identifyLinkedInUrlType(p.linkedinUrl) === 'person' && p.companyLinkedinUrl).length;
  const totalApiCalls = personPollCount + companyOverlapCount + companyPollCount;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const appendLog = (item) => {
    setLog(prev => [...prev, item]);
  };

  const runMockPoll = async () => {
    setPolling(true);
    setDone(false);
    setLog([]);
    setSignalsFound(0);

    appendLog({ type: 'info', text: `Starting demo poll for ${activeQueue.length} profiles...` });

    const allSignals = [];

    for (let i = 0; i < activeQueue.length; i++) {
      const profile = activeQueue[i];
      await sleep(300);
      appendLog({ type: 'info', text: `Polling LinkedIn baseline for ${profile.name}...` });
      
      const isComp = identifyLinkedInUrlType(profile.linkedinUrl) === 'company';
      await sleep(150);
      appendLog({ type: 'success', text: `✓ ${profile.name} — baseline LinkedIn snapshot stored` });
      
      // Seed a baseline snapshot structure if none exists
      const prev = (profile.snapshots && profile.snapshots[profile.snapshots.length - 1]) || {};
      const snapshot = {
        ...prev,
        currentCompany: profile.company || profile.name,
        currentTitle: profile.title || (isComp ? 'Company Page' : 'Executive'),
        polledAt: new Date().toISOString(),
      };

      if (isComp) {
        // Generate mock company posts if empty
        if (!snapshot.posts || snapshot.posts.length === 0) {
          snapshot.posts = generateMockCompanyPosts(profile.name);
        }
      } else {
        // Generate mock person posts & activity if empty
        if (!snapshot.recentPosts || snapshot.recentPosts.length === 0) {
          snapshot.recentPosts = generateMockPersonPosts(profile.name, profile.company);
        }
        if (!snapshot.activity || snapshot.activity.length === 0) {
          snapshot.activity = generateMockPersonActivity(profile.name, profile.company);
        }
        if (!snapshot.posts || snapshot.posts.length === 0) {
          snapshot.posts = generateMockCompanyPosts(profile.company || 'Their Company');
        }
      }

      if (isComp && profile.name.toLowerCase().includes('atlys')) {
        appendLog({ type: 'signal', text: `💰 SIGNAL: Atlys raised $36M Series C · 352 employees` });
        allSignals.push({
          id: `funding-Atlys-${Date.now()}`,
          type: 'company_funding',
          priority: 'urgent',
          label: 'Series C Just Raised',
          emoji: '💰',
          why: `<strong>Atlys</strong> closed a <strong>$36M Series C</strong> in March 2026. Fresh capital = active vendor evaluation window open.`,
          action: 'Pitch now — 90-day window',
          profile: profile.name,
          company: 'Atlys',
          linkedinUrl: profile.linkedinUrl,
          detectedAt: new Date().toISOString(),
          source: 'Company Page + Web Research',
          evidence: '$36M Series C · March 2026',
          dismissed: false,
        });
        setSignalsFound(prevVal => prevVal + 1);
      }

      // Fetch external feeds in parallel (works in demo mode too!)
      try {
        appendLog({ type: 'info', text: `🔍 Querying Google News, Reddit, Twitter, and YouTube for "${profile.company || profile.name}"...` });
        const extRes = await fetch('/api/collectors/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: profile.company || profile.name,
            companyDomain: profile.companyLinkedinUrl ? '' : ''
          }),
        });

        if (extRes.ok) {
          const extData = await extRes.json();
          
          if (extData) {
            snapshot.sitemapLinks = extData.sitemapLinks || [];
            snapshot.youtubeVideos = extData.youtubeVideos || [];
            snapshot.jobOpenings = extData.jobOpenings || [];
            snapshot.prMentions = extData.prMentions || [];
            snapshot.redditMentions = extData.redditMentions || [];
            snapshot.twitterMentions = extData.twitterMentions || [];
            snapshot.resolvedDomain = extData.resolvedDomain || '';

            if (extData.sitemapLinks && extData.sitemapLinks.length > 0) {
              appendLog({ type: 'success', text: `🌐 Firecrawl: sitemap mapped ${extData.sitemapLinks.length} URLs` });
            }

            if (extData.youtubeVideos && extData.youtubeVideos.length > 0) {
              appendLog({ type: 'success', text: `🎥 YouTube Feed: resolved channel and fetched latest videos` });
            }

            if (extData.jobOpenings && extData.jobOpenings.length > 0) {
              appendLog({ type: 'success', text: `💼 Jobs: found ${extData.jobOpenings.length} active job vacancies` });
            }
          }

          const extSignals = detectExternalSignals(profile, extData, prev);
          if (extSignals.length > 0) {
            extSignals.forEach(s => {
              appendLog({ type: 'signal', text: `${s.emoji} SIGNAL: ${s.label} — ${s.source}` });
            });
            allSignals.push(...extSignals);
            setSignalsFound(prevVal => prevVal + extSignals.length);
          }
        }
      } catch (err) {
        console.error('Error fetching external collectors:', err);
      }

      // Update the profile record in Supabase with the new snapshot
      try {
        const currentSnapshots = profile.snapshots || [];
        const { error } = await supabase
          .from('profiles')
          .update({
            status: 'active',
            last_polled: new Date().toISOString(),
            snapshots: [...currentSnapshots, snapshot]
          })
          .eq('id', profile.id);
        if (error) throw error;
      } catch (err) {
        console.error("Error updating profile status in Supabase:", err);
      }

      const pct = Math.round(((i + 1) / activeQueue.length) * 100);
      setProgress(pct);
    }

    if (onSignalsDetected) {
      onSignalsDetected(rankSignals(allSignals));
    }

    setDone(true);
    setPolling(false);
  };

  const runRealPoll = async () => {
    setPolling(true);
    setDone(false);
    setLog([]);
    setSignalsFound(0);

    appendLog({ type: 'info', text: `Starting poll for ${activeQueue.length} profiles...` });

    // Dynamically import poller (client-side only)
    const { pollProfilesBatch } = await import('../lib/poller');

    const allSignals = [];

    const generator = pollProfilesBatch(activeQueue, apiKey, { delayMs: 600 });

    for await (const update of generator) {
      if (update.type === 'progress') {
        setProgress(update.pct);
        appendLog({ type: 'info', text: `Polling LinkedIn profile ${update.profileName}... (${update.current}/${update.total})` });
      } else if (update.type === 'success') {
        try {
          const prev = (update.profile?.snapshots && update.profile?.snapshots[update.profile.snapshots.length - 1]) || {};
          const snapshot = {
            ...prev,
            ...update.snapshot
          };

          // Run baseline LinkedIn signal detection
          const linkedinSignals = detectSignals(update.profile, prev, snapshot);
          if (linkedinSignals.length > 0) {
            linkedinSignals.forEach(s => {
              appendLog({ type: 'signal', text: `${s.emoji} SIGNAL: ${s.label} — ${s.profile}` });
            });
            allSignals.push(...linkedinSignals);
            setSignalsFound(prevVal => prevVal + linkedinSignals.length);
          } else {
            appendLog({ type: 'success', text: `✓ ${update.profile?.name} — LinkedIn baseline checked` });
          }

          // Fetch external brand mentions & sitemaps (Google News, Reddit, Twitter, YouTube, Firecrawl)
          try {
            appendLog({ type: 'info', text: `🔍 Querying Google News, Reddit, Twitter, and YouTube for "${update.profile?.company || update.profile?.name}"...` });
            const extRes = await fetch('/api/collectors/all', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyName: update.profile?.company || update.profile?.name,
                companyDomain: update.profile?.companyLinkedinUrl ? '' : ''
              }),
            });

            if (extRes.ok) {
              const extData = await extRes.json();
              
              if (extData) {
                snapshot.sitemapLinks = extData.sitemapLinks || [];
                snapshot.youtubeVideos = extData.youtubeVideos || [];
                snapshot.jobOpenings = extData.jobOpenings || [];
                snapshot.prMentions = extData.prMentions || [];
                snapshot.redditMentions = extData.redditMentions || [];
                snapshot.twitterMentions = extData.twitterMentions || [];
                snapshot.resolvedDomain = extData.resolvedDomain || '';

                if (extData.sitemapLinks && extData.sitemapLinks.length > 0) {
                  appendLog({ type: 'success', text: `🌐 Firecrawl: sitemap mapped ${extData.sitemapLinks.length} URLs` });
                }

                if (extData.youtubeVideos && extData.youtubeVideos.length > 0) {
                  appendLog({ type: 'success', text: `🎥 YouTube Feed: resolved channel and fetched latest videos` });
                }

                if (extData.jobOpenings && extData.jobOpenings.length > 0) {
                  appendLog({ type: 'success', text: `💼 Jobs: found ${extData.jobOpenings.length} active job vacancies` });
                }
              }

              const extSignals = detectExternalSignals(update.profile, extData, prev);
              if (extSignals.length > 0) {
                extSignals.forEach(s => {
                  appendLog({ type: 'signal', text: `${s.emoji} SIGNAL: ${s.label} — ${s.source}` });
                });
                allSignals.push(...extSignals);
                setSignalsFound(prevVal => prevVal + extSignals.length);
              }
            }
          } catch (err) {
            console.error('Error fetching external collectors:', err);
          }

          // Update the profile in Supabase
          try {
            const currentSnapshots = update.profile?.snapshots || [];
            const { error } = await supabase
              .from('profiles')
              .update({
                status: 'active',
                last_polled: new Date().toISOString(),
                snapshots: [...currentSnapshots, snapshot]
              })
              .eq('id', update.profile?.id);
            if (error) throw error;
          } catch (err) {
            console.error("Error updating profile status in Supabase:", err);
          }
        } catch (err) {
          appendLog({ type: 'info', text: `⚠ Error processing profile ${update.profileName}: ${err.message}` });
          console.error("Error processing successful profile scrape:", err);
        }

      } else if (update.type === 'error') {
        appendLog({ type: 'info', text: `⚠ ${update.profileName} — ${update.error}` });
      } else if (update.type === 'done') {
        appendLog({ type: 'signal', text: `✅ Poll complete — ${allSignals.length} total signals detected` });
        if (onSignalsDetected) onSignalsDetected(rankSignals(allSignals));
      }
    }

    setDone(true);
    setPolling(false);
  };

  const handleStartPoll = () => {
    if (!apiKey) {
      runMockPoll();
    } else {
      runRealPoll();
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Run Signal Poll</div>
        <div className="topbar-right">
          <button
            className="btn btn-secondary"
            onClick={() => setShowApiModal(true)}
            id="set-api-key-btn"
          >
            🔑 {apiKey ? 'Change API Key' : 'Set API Key'}
          </button>
        </div>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: 700 }}>

          {/* Poll config card */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Poll Configuration
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {activeQueue.length} profiles queued · {apiKey ? '🟢 Real API' : '🟡 Demo mode (no API key)'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-blue)' }}>
                  {totalApiCalls}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>API calls</div>
              </div>
            </div>

            {/* Queue Target Selector */}
            {pendingProfiles.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Queue Target:
                </span>
                <div className="tabs" style={{ margin: 0, padding: 2, background: 'var(--bg-surface)' }}>
                  <button
                    className={`tab ${pollMode === 'pending' ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setPollMode('pending')}
                  >
                    ⏱️ Pending ({pendingProfiles.length})
                  </button>
                  <button
                    className={`tab ${pollMode === 'all' ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setPollMode('all')}
                  >
                    🔄 All ({profiles.length})
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Profiles', value: activeQueue.length },
                { label: 'Person Polls', value: personPollCount },
                { label: 'Company Polls', value: companyPollCount + companyOverlapCount },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>

            {!apiKey && (
              <div style={{
                background: 'var(--signal-yellow-bg)',
                border: '1px solid var(--signal-yellow-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--signal-yellow)',
              }}>
                ⚠️ No API key set — running in <strong>demo mode</strong> with simulated signals.{' '}
                <button
                  onClick={() => setShowApiModal(true)}
                  style={{ color: 'inherit', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                >
                  Add your ScrapeCreators API key
                </button>{' '}to poll real LinkedIn profiles.
              </div>
            )}

            <button
              id="start-poll-btn"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}
              onClick={handleStartPoll}
              disabled={polling}
            >
              {polling ? '⏳ Polling in progress...' : `⚡ ${apiKey ? 'Start Real Poll' : 'Run Demo Poll'}`}
            </button>
          </div>

          {/* Progress */}
          {(polling || done) && (
            <div className="poll-progress">
              <div className="poll-progress-header">
                <span className="poll-progress-title">
                  {done ? `✅ Complete — ${signalsFound} signals found` : '⚡ Polling profiles...'}
                </span>
                <span className="poll-progress-pct">{progress}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="poll-log" ref={logRef}>
                {log.map((item, i) => (
                  <div key={i} className={`poll-log-item ${item.type}`}>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {done && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('dashboard')}
                id="view-signals-btn"
              >
                View Signals →
              </button>
              <button className="btn btn-secondary" onClick={handleStartPoll}>
                Run Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* API Key Modal */}
      {showApiModal && (
        <ApiKeyModal
          initialKey={apiKey}
          onSave={(key) => {
            setApiKey(key);
            if (onApiKeyChange) onApiKeyChange(key);
            setShowApiModal(false);
          }}
          onClose={() => setShowApiModal(false)}
        />
      )}
    </>
  );
}

function ApiKeyModal({ initialKey, onSave, onClose }) {
  const [key, setKey] = useState(initialKey || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">🔑 ScrapeCreators API Key</div>
        <div className="modal-desc">
          Enter your API key to poll real LinkedIn profiles. Get one at{' '}
          <a href="https://scrapecreators.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>
            scrapecreators.com
          </a>.
          Without a key, demo mode simulates signals.
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="api-key-input">API Key</label>
          <input
            id="api-key-input"
            className="form-input"
            type="password"
            placeholder="sc_live_xxxxxxxxxxxxx"
            value={key}
            onChange={e => setKey(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="save-api-key-btn"
            className="btn btn-primary"
            onClick={() => onSave(key)}
          >
            {key ? 'Save Key' : 'Continue in Demo Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateMockCompanyPosts(companyName) {
  const cleanName = companyName || 'Company';
  const lowerHandle = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Custom posts for known demo companies
  if (lowerHandle.includes('dentsux')) {
    return [
      {
        text: "Dentsu X India is thrilled to secure the integrated media mandate for a leading EV automotive brand! Looking forward to driving scale and performance marketing across APAC.",
        link: "https://www.linkedin.com/company/dentsu-x",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        likesCount: 320,
        commentsCount: 24
      },
      {
        text: "Context-based targeting is crucial for B2B. Here's how we helped our retail partners optimize cross-channel campaigns this quarter.",
        link: "https://www.linkedin.com/company/dentsu-x",
        date: new Date(Date.now() - 86400000 * 4).toISOString(),
        likesCount: 145,
        commentsCount: 9
      }
    ];
  } else if (lowerHandle.includes('dentsu')) {
    return [
      {
        text: "Dentsu launches Zoyumi, our proprietary AI-driven content production and media planning platform across APAC! Reach out to learn more about how we scale creative campaigns.",
        link: "https://www.linkedin.com/company/dentsu",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        likesCount: 540,
        commentsCount: 38
      }
    ];
  } else if (lowerHandle.includes('carat')) {
    return [
      {
        text: "Carat Media secures the digital media planning mandate for APAC! We are excited to partner with leading brands to drive digital transformation.",
        link: "https://www.linkedin.com/company/carat",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        likesCount: 145,
        commentsCount: 12
      }
    ];
  } else if (lowerHandle.includes('atlys')) {
    return [
      {
        text: "Outbound travel shouldn't start with visa paperwork anxiety. Here's how Atlys is automating visa processing for 80+ destinations globally with smart document checks.",
        link: "https://www.linkedin.com/company/getatlys",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        likesCount: 320,
        commentsCount: 15
      }
    ];
  }

  // Dynamic fallback for any other company name (e.g. DWA Media)
  return [
    {
      text: `${cleanName} is thrilled to announce our expansion into new digital planning and performance marketing services! We are scaling our operations to better serve our enterprise partners.`,
      link: `https://www.linkedin.com/company/${lowerHandle}`,
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      likesCount: Math.floor(Math.random() * 100) + 15,
      commentsCount: Math.floor(Math.random() * 15) + 1
    },
    {
      text: `How is agentic workflow and context-based data changing B2B operations? Read the latest research post from the ${cleanName} digital strategy team.`,
      link: `https://www.linkedin.com/company/${lowerHandle}`,
      date: new Date(Date.now() - 86400000 * 5).toISOString(),
      likesCount: Math.floor(Math.random() * 80) + 10,
      commentsCount: Math.floor(Math.random() * 10) + 1
    }
  ];
}

function generateMockPersonPosts(personName, companyName) {
  const cleanName = personName || 'Executive';
  const cleanCompany = companyName || 'Company';
  const lowerHandle = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    {
      title: `Excited to sync with the digital strategy team at ${cleanCompany} today. We are actively reviewing our Q3 growth goals and looking to scale our digital media and planning operations!`,
      link: `https://www.linkedin.com/in/${lowerHandle}`,
      datePublished: new Date(Date.now() - 86400000 * 3).toISOString(),
      likesCount: Math.floor(Math.random() * 80) + 15,
      commentsCount: Math.floor(Math.random() * 10) + 1
    },
    {
      title: `Strategic advice: Focus on workflow context and data schemas first before purchasing expensive marketing automation tools. Tools are secondary to clean intent mapping.`,
      link: `https://www.linkedin.com/in/${lowerHandle}`,
      datePublished: new Date(Date.now() - 86400000 * 6).toISOString(),
      likesCount: Math.floor(Math.random() * 60) + 10,
      commentsCount: Math.floor(Math.random() * 8) + 1
    }
  ];
}

function generateMockPersonActivity(personName, companyName) {
  const cleanName = personName || 'Executive';
  const cleanCompany = companyName || 'Company';
  const lowerHandle = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    {
      title: `Outbound marketing is changing rapidly in APAC. Glad to see ${cleanCompany} is expanding digital media planning and campaign analytics programs this month!`,
      link: `https://www.linkedin.com/in/${lowerHandle}`,
      activityType: "liked",
      datePublished: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      title: `I'm thrilled to share that I've joined the team at ${cleanCompany}! Looking forward to building the future of automated campaigns.`,
      link: `https://www.linkedin.com/in/${lowerHandle}`,
      activityType: "liked",
      datePublished: new Date(Date.now() - 86400000 * 4).toISOString()
    }
  ];
}
