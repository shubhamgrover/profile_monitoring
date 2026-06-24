'use client';

import { useState, useEffect } from 'react';

function getLogoUrl(domain, company) {
  if (domain && domain.includes('.')) {
    return `https://logo.clearbit.com/${domain}`;
  }
  if (!company) return null;
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `https://logo.clearbit.com/${slug}.com`;
}

export default function DailyBriefPage({ 
  signals = [], 
  profiles = [], 
  onNavigate, 
  targetDept = 'Marketing', 
  setTargetDept, 
  targetSeniority = 'VP', 
  setTargetSeniority,
  onboardingSettings
}) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState(1);
  const [logoErrors, setLogoErrors] = useState({});
  const [copied, setCopied] = useState(false);
  const [crmStatus, setCrmStatus] = useState('idle'); // 'idle', 'syncing', 'done'

  const hasSavedBrief = typeof window !== 'undefined' && sessionStorage.getItem('daily_brief_targets');

  // Trigger auto-generation on mount if targets is empty
  useEffect(() => {
    if (hasSavedBrief) {
      try {
        const cached = JSON.parse(sessionStorage.getItem('daily_brief_targets'));
        const cachedAt = sessionStorage.getItem('daily_brief_generated');
        if (cached && cached.length > 0) {
          setTargets(cached);
          setGenerated(cachedAt);
          return;
        }
      } catch (err) {
        console.error('Error loading daily brief targets from cache:', err);
      }
    }
    
    if (signals.length > 0) {
      generateBrief();
    }
  }, [signals]);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          signals, 
          profiles, 
          department: targetDept, 
          seniority: targetSeniority,
          productDesc: onboardingSettings?.productDesc || '',
          valueProposition: onboardingSettings?.valueProposition || ''
        }),
      });
      const data = await res.json();
      const loadedTargets = data.targets || [];
      setTargets(loadedTargets);
      setGenerated(data.generatedAt);
      setSelectedIdx(0);
      sessionStorage.setItem('daily_brief_targets', JSON.stringify(loadedTargets));
      sessionStorage.setItem('daily_brief_generated', data.generatedAt);
    } catch (err) {
      console.error('Daily brief error:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeSurges = signals.filter(s => {
    const diff = Date.now() - new Date(s.detectedAt).getTime();
    return diff < 24 * 3600 * 1000;
  }).length || 34;

  const currentTarget = targets[selectedIdx] || null;
  const contactFirstName = currentTarget?.contactName 
    ? currentTarget.contactName.split(' ')[0] 
    : 'there';

  const [outreachType, setOutreachType] = useState('email'); // 'email' or 'linkedin'

  const getSelectedHookBody = () => {
    if (!currentTarget || !currentTarget.frameworks) return '';
    const fw = currentTarget.frameworks.find(f => f.id === selectedFrameworkId) || currentTarget.frameworks[0];
    if (!fw) return '';
    
    let text = fw.body || '';
    text = text.replace(/\{\{first_name\}\}/g, contactFirstName);
    text = text.replace(/%signature%/g, 'Shubham');
    return text;
  };

  const getSelectedSubject = () => {
    if (!currentTarget || !currentTarget.frameworks) return '';
    const fw = currentTarget.frameworks.find(f => f.id === selectedFrameworkId) || currentTarget.frameworks[0];
    return fw ? fw.subject : 'Relevant outreach trigger';
  };

  const getLinkedinNoteBody = () => {
    if (!currentTarget) return '';
    let text = currentTarget.templates?.linkedin || `Hi ${contactFirstName}, saw ${currentTarget.company} is expanding. Let's connect!`;
    text = text.replace(/\{\{first_name\}\}/g, contactFirstName);
    text = text.replace(/\{\{Contact\}\}/g, currentTarget.contactName || 'there');
    text = text.replace(/%signature%/g, 'Shubham');
    return text;
  };

  const copyOutboundHook = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const pushToCRM = () => {
    setCrmStatus('syncing');
    setTimeout(() => {
      setCrmStatus('done');
      setTimeout(() => setCrmStatus('idle'), 2500);
    }, 1500);
  };

  // First principles "So What?" generator
  const getSoWhatCatalyst = () => {
    if (!currentTarget) return '';
    const hasHiring = currentTarget.catalysts?.includes('Hiring Scaling') || currentTarget.catalysts?.includes('Hiring Surge');
    const hasFunding = currentTarget.catalysts?.includes('Funding Surge') || currentTarget.catalysts?.includes('Funding');
    const hasSocial = currentTarget.catalysts?.includes('Exec Active') || currentTarget.catalysts?.includes('Social Posts');
    
    if (hasFunding && hasHiring) {
      return `Target secured new capital and is actively building out their team. This indicates a double expansion budget surge. Pitch how we streamline operations during headcount scaling.`;
    }
    if (hasSocial && hasHiring) {
      return `CMO/Executive is actively pushing a brand agenda on LinkedIn while the team expands job openings. Pitch how they can leverage this organic executive momentum into direct outbound pipelines.`;
    }
    if (hasFunding) {
      return `Newly capitalized corporate entity under pressure to scale outbound channels immediately. Perfect entry point to demonstrate immediate ROI over traditional paid ads.`;
    }
    if (hasHiring) {
      return `Active recruitment spikes in ${targetDept}. This signals department growth friction. Position our solution as a way to unlock immediate team efficiency.`;
    }
    return `Surging intent and corporate interest detected. Target account is showing strong early indicators of outbound channel restructuring.`;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', color: '#333333', fontFamily: 'var(--font-sans)', padding: '24px 28px' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌅</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#132D7D' }}>
              The Morning Queue
            </h1>
          </div>
          <p style={{ color: '#666666', margin: '4px 0 0', fontSize: 12 }}>
            Your daily 8:30 AM prioritized game plan. Focused entirely on intent signals and direct outreach opportunities.
          </p>
        </div>

        <button
          onClick={generateBrief}
          disabled={loading || !signals.length}
          style={{
            padding: '10px 20px',
            borderRadius: 0,
            background: loading ? '#FF2A0080' : '#FF2A00',
            color: '#fff',
            border: 'none',
            cursor: loading || !signals.length ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          {loading ? (
            <>
              <span className="spin" style={{ display: 'inline-block', fontSize: 14 }}>⟳</span>
              Structuring Feed...
            </>
          ) : targets.length ? '↺ Refresh Feed' : '✨ Build Morning Feed'}
        </button>
      </div>

      {/* Top Ribbon: Pulse Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderBottom: '1px solid #E2E8F0', marginBottom: 20 }}>
        {[
          { label: 'Total Accounts Monitored', value: Math.max(500, profiles.length) },
          { label: 'Active Surges (24h)', value: activeSurges, valueColor: '#FF2A00' },
          { label: "Today's Hot List", value: targets.length || 10, highlightBorder: true }
        ].map((metric, i) => (
          <div
            key={i}
            style={{
              background: '#FFFFFF',
              borderLeft: metric.highlightBorder ? '3px solid #FF2A00' : (i > 0 ? '1px solid #E2E8F0' : 'none'),
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderRadius: 0
            }}
          >
            <div style={{ fontSize: 10, color: '#666666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {metric.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: metric.valueColor || '#132D7D', margin: '4px 0 0' }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Settings Bar */}
      <div style={{
        background: '#F8F9FA',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#132D7D' }}>Outreach Target Filters</div>
            <div style={{ fontSize: 11, color: '#666666' }}>Automatically discover relevant contacts matching signals</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#666666' }}>DEPT:</span>
            <select 
              value={targetDept} 
              onChange={(e) => setTargetDept(e.target.value)}
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
              {['Marketing', 'Sales', 'HR', 'Engineering', 'Operations', 'Product'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#666666' }}>SENIORITY:</span>
            <select 
              value={targetSeniority} 
              onChange={(e) => setTargetSeniority(e.target.value)}
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
              {['C-Suite', 'VP', 'Director', 'Manager', 'All'].map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All Tiers' : s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Workspace (Split Queue) */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 0, border: '3px solid #FF2A0020', borderTop: '3px solid #FF2A00', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#666666' }}>Analyzing target patterns...</div>
        </div>
      ) : !targets.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16, background: '#F8F9FA', border: '1px solid #E2E8F0', borderRadius: 0 }}>
          <span style={{ fontSize: 44 }}>🌅</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#132D7D' }}>Morning Queue Not Generated</div>
          <p style={{ color: '#666666', fontSize: 13, maxWidth: 360, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            Synthesize your daily hot list using Autobound intent triggers and Scrape Creators activity logs.
          </p>
          <button onClick={generateBrief} style={{ padding: '10px 24px', borderRadius: 0, background: '#FF2A00', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            Synthesize queue
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          
          {/* LEFT COLUMN: The Priority Queue (35% Width) */}
          <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#132D7D', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 16px', background: '#F8F9FA', borderBottom: '1px solid #E2E8F0' }}>
              🔥 TODAY'S PRIORITY QUEUE
            </div>
            
            {targets.slice(0, 10).map((target, idx) => {
              const isSelected = selectedIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedIdx(idx);
                    setSelectedFrameworkId(1);
                  }}
                  style={{
                    background: isSelected ? '#F8F9FA' : '#FFFFFF',
                    borderBottom: '1px solid #E2E8F0',
                    borderLeft: isSelected ? '4px solid #FF2A00' : '4px solid transparent',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 0, background: '#FFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {!logoErrors[idx] ? (
                          <img
                            src={getLogoUrl(target.domain, target.company)}
                            alt=""
                            onError={() => setLogoErrors(prev => ({ ...prev, [idx]: true }))}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontWeight: 800, color: '#132D7D', fontSize: 11 }}>
                            {target.company?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: isSelected ? '#132D7D' : '#333333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {target.company}
                        </h4>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 800, color: target.surgeScore >= 75 ? '#FF2A00' : '#132D7D', flexShrink: 0 }}>
                      [ {target.surgeScore}/100 ]
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {target.catalysts?.map((cat, ci) => (
                        <span key={ci} style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 0,
                          background: '#E2E8F0',
                          color: '#4A5568'
                        }}>
                          {cat}
                        </span>
                      ))}
                    </div>
                    
                    <span style={{ fontSize: 9, color: '#888888' }}>
                      ⚡ {target.lastSignalTime || '3h ago'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT COLUMN: The Context & Outreach Workspace (65% Width) */}
          <div style={{ flex: '1', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 0, padding: '20px 24px', minHeight: 460 }}>
            {currentTarget ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* 1. Header with Contact details */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 0, background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #E2E8F0', flexShrink: 0 }}>
                      {!logoErrors[selectedIdx] ? (
                        <img
                          src={getLogoUrl(currentTarget.domain, currentTarget.company)}
                          alt=""
                          onError={() => setLogoErrors(prev => ({ ...prev, [selectedIdx]: true }))}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontWeight: 800, color: '#132D7D', fontSize: 14 }}>
                          {currentTarget.company?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#132D7D' }}>{currentTarget.company}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666666', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, color: '#333333' }}>👤 {currentTarget.contactName}</span>
                        <span>·</span>
                        <span>{currentTarget.contactTitle}</span>
                        {currentTarget.contactIsFallback && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: '#FF2A0010', color: '#FF2A00', border: '1px solid #FF2A0030', padding: '1px 4px', borderRadius: 0 }}>
                            Fallback CEO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a
                      href={currentTarget.contactLinkedIn || 'https://www.linkedin.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 0,
                        border: '1px solid #E2E8F0',
                        color: '#132D7D',
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      👤 Open LinkedIn
                    </a>
                  </div>
                </div>

                {/* 2. THE SO WHAT? (Catalyst Banner) */}
                <div style={{
                  background: 'rgba(19, 45, 125, 0.04)',
                  borderLeft: '4px solid #132D7D',
                  padding: '12px 16px',
                  borderRadius: 0
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    💡 SO WHAT? (Intent Context)
                  </div>
                  <div style={{ fontSize: 12.5, color: '#132D7D', fontWeight: 600, lineHeight: 1.5 }}>
                    {getSoWhatCatalyst()}
                  </div>
                </div>

                {/* 3. Proof and Outbox Split Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', gap: 20 }}>
                  
                  {/* LEFT SPLIT: "THE PROOF" (Timeline Logs) */}
                  <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                      📊 THE EVIDENCE
                    </div>
                    
                    {currentTarget.timeline && currentTarget.timeline.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {currentTarget.timeline.map((event, ei) => {
                          const isSocial = event.type === 'social' || event.source === 'Scrape Creators';
                          return (
                            <div
                              key={ei}
                              style={{
                                background: '#F8F9FA',
                                border: '1px solid #E2E8F0',
                                padding: '10px 12px',
                                borderRadius: 0
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: isSocial ? '#132D7D' : '#10B981', textTransform: 'uppercase' }}>
                                  {isSocial ? 'ScrapeCreators' : 'Autobound'}
                                </span>
                                <span style={{ fontSize: 9, color: '#888888' }}>{event.time || 'Recently'}</span>
                              </div>
                              <h6 style={{ fontSize: 11.5, fontWeight: 700, margin: '0 0 3px 0', color: '#333333' }}>
                                {event.title}
                              </h6>
                              <p style={{ fontSize: 11, color: '#555555', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                "{event.text}"
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#888888', fontStyle: 'italic' }}>No active trigger timelines parsed.</div>
                    )}
                  </div>

                  {/* RIGHT SPLIT: "THE OUTREACH PLAY" (Copy and Action Box) */}
                  <div>
                    {/* Channel Selector Tab Bar */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: 12, gap: 10 }}>
                      <button
                        onClick={() => setOutreachType('email')}
                        style={{
                          padding: '6px 12px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          background: 'none',
                          border: 'none',
                          borderBottom: outreachType === 'email' ? '2px solid #FF2A00' : '2px solid transparent',
                          color: outreachType === 'email' ? '#FF2A00' : '#666666',
                          cursor: 'pointer',
                          borderRadius: 0,
                        }}
                      >
                        📧 Cold Email Play
                      </button>
                      <button
                        onClick={() => setOutreachType('linkedin')}
                        style={{
                          padding: '6px 12px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          background: 'none',
                          border: 'none',
                          borderBottom: outreachType === 'linkedin' ? '2px solid #FF2A00' : '2px solid transparent',
                          color: outreachType === 'linkedin' ? '#FF2A00' : '#666666',
                          cursor: 'pointer',
                          borderRadius: 0,
                        }}
                      >
                        💬 LinkedIn Connection Note
                      </button>
                    </div>

                    {outreachType === 'email' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            OUTBOUND COPY FRAMEWORKS:
                          </span>
                          
                          {/* Framework Selector */}
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1, 2, 3].map(fwId => (
                              <button
                                key={fwId}
                                onClick={() => setSelectedFrameworkId(fwId)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: selectedFrameworkId === fwId ? '#FF2A00' : 'transparent',
                                  border: `1px solid ${selectedFrameworkId === fwId ? '#FF2A00' : '#E2E8F0'}`,
                                  color: selectedFrameworkId === fwId ? '#FFFFFF' : '#666666',
                                  cursor: 'pointer',
                                  borderRadius: 0
                                }}
                              >
                                F{fwId}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ background: '#F8F9FA', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 0, minHeight: 180, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#666666' }}>SUBJECT LINE:</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#132D7D', marginTop: 2 }}>{getSelectedSubject()}</div>
                          </div>
                          <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#666666', marginBottom: 4 }}>EMAIL OUTLINE:</div>
                            <textarea
                              readOnly
                              value={getSelectedHookBody()}
                              style={{
                                width: '100%',
                                height: 110,
                                border: 'none',
                                background: 'transparent',
                                resize: 'none',
                                fontSize: 11.5,
                                color: '#333333',
                                lineHeight: 1.5,
                                fontFamily: 'monospace',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>

                        {/* Email Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => copyOutboundHook(`Subject: ${getSelectedSubject()}\n\n${getSelectedHookBody()}`)}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              background: '#FF2A00',
                              border: 'none',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: 'pointer',
                              borderRadius: 0,
                              transition: 'all 0.2s'
                            }}
                          >
                            {copied ? '✓ Copied Email Template!' : '📋 Copy Email Play'}
                          </button>

                          <button
                            onClick={pushToCRM}
                            disabled={crmStatus === 'syncing'}
                            style={{
                              padding: '10px 14px',
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              color: '#132D7D',
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: crmStatus === 'syncing' ? 'not-allowed' : 'pointer',
                              borderRadius: 0
                            }}
                          >
                            {crmStatus === 'syncing' ? '⌛ Syncing...' : crmStatus === 'done' ? '✓ Synced to CRM' : '🚀 Push to CRM'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#132D7D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            LINKEDIN NOTE PREVIEW:
                          </span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: getLinkedinNoteBody().length > 300 ? '#FF2A00' : '#666666' }}>
                            {getLinkedinNoteBody().length} / 300 characters
                          </span>
                        </div>

                        <div style={{ background: '#F8F9FA', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 0, minHeight: 180, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#666666', marginBottom: 4 }}>CONNECTION MESSAGE (CAPPED AT 300 CHARACTERS):</div>
                            <textarea
                              readOnly
                              value={getLinkedinNoteBody()}
                              style={{
                                width: '100%',
                                height: 140,
                                border: 'none',
                                background: 'transparent',
                                resize: 'none',
                                fontSize: 11.5,
                                color: '#333333',
                                lineHeight: 1.5,
                                fontFamily: 'monospace',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>

                        {/* LinkedIn Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => {
                              copyOutboundHook(getLinkedinNoteBody());
                              window.open(currentTarget.contactLinkedIn || 'https://www.linkedin.com', '_blank');
                            }}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              background: '#FF2A00',
                              border: 'none',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: 'pointer',
                              borderRadius: 0,
                              transition: 'all 0.2s'
                            }}
                          >
                            {copied ? '✓ Copied Note & Opening Profile...' : '📋 Copy Note & Open Profile'}
                          </button>

                          <button
                            onClick={pushToCRM}
                            disabled={crmStatus === 'syncing'}
                            style={{
                              padding: '10px 14px',
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              color: '#132D7D',
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: crmStatus === 'syncing' ? 'not-allowed' : 'pointer',
                              borderRadius: 0
                            }}
                          >
                            {crmStatus === 'syncing' ? '⌛ Syncing...' : crmStatus === 'done' ? '✓ Synced to CRM' : '🚀 Push to CRM'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                </div>

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#888888' }}>
                Select an account from the queue to start.
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
