'use client';

import { useState, useEffect, useRef } from 'react';
import { detectSignals, detectExternalSignals, rankSignals } from '../lib/signalEngine';
import { MOCK_PROFILES, MOCK_POLL_LOG, MOCK_SIGNALS } from '../lib/mockData';
import { identifyLinkedInUrlType } from '../lib/poller';
import { supabase } from '../lib/supabaseClient';

export default function PollPage({ profiles: propProfiles, apiKey: propApiKey, onApiKeyChange, onProfilesUpdated, onSignalsDetected, onNavigate, targetDept = 'Marketing', targetSeniority = 'VP' }) {
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

  const enrichCompanies = async (scrapedItems) => {
    if (scrapedItems.length === 0) return [];
    
    appendLog({ type: 'info', text: '🔍 Starting deep B2B company research & enrichment...' });
    
    // Group scraped profiles by company name
    const companyGroups = {};
    scrapedItems.forEach(item => {
      let company = item.snapshot.currentCompany;
      if (!company || company === 'Unknown Company') {
        company = item.profile.company;
      }
      if (!company || company === 'Unknown Company') return;
      if (!companyGroups[company]) companyGroups[company] = [];
      companyGroups[company].push(item);
    });

    const uniqueCompanies = Object.keys(companyGroups);
    appendLog({ type: 'info', text: `Found ${uniqueCompanies.length} unique companies across ${scrapedItems.length} profiles.` });

    const allExtSignals = [];

    // Process companies in parallel with standard promises to ensure no skips and speed up execution
    await Promise.all(uniqueCompanies.map(async (company, cIdx) => {
      const profilesInCompany = companyGroups[company];
      // Look for a profile with a valid company LinkedIn URL
      const profileWithDomain = profilesInCompany.find(p => p.profile.companyLinkedinUrl) || profilesInCompany[0];

      // Check if this company was already researched today
      const isCompanyPolledToday = profilesInCompany.some(p => {
        const lastPolledDate = p.profile.lastPolled || p.profile.last_polled;
        if (!lastPolledDate) return false;
        return new Date(lastPolledDate).toDateString() === new Date().toDateString();
      });

      try {
        let extData = null;

        if (isCompanyPolledToday) {
          appendLog({ type: 'info', text: `ℹ️ Skip: Company "${company}" was already polled today. Using cache.` });
          const prev = profileWithDomain.prev || {};
          extData = {
            sitemapLinks: prev.sitemapLinks || [],
            youtubeVideos: prev.youtubeVideos || [],
            jobOpenings: prev.jobOpenings || [],
            prMentions: prev.prMentions || [],
            redditMentions: prev.redditMentions || [],
            twitterMentions: prev.twitterMentions || [],
            companyLinkedinUrl: profileWithDomain.profile.companyLinkedinUrl || prev.companyLinkedinUrl || '',
            resolvedCompany: company,
            resolvedDomain: profileWithDomain.profile.domain || prev.resolvedDomain || '',
            companyPosts: prev.posts || [],
            autoboundSignals: prev.autoboundSignals || [],
          };
        } else {
          appendLog({ type: 'info', text: `🌐 Researching "${company}" (${cIdx + 1}/${uniqueCompanies.length})...` });
          const extRes = await fetch('/api/collectors/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: company,
              companyDomain: profileWithDomain.profile.companyLinkedinUrl ? '' : '',
              profileUrl: profileWithDomain.profile.linkedinUrl,
              profileName: profileWithDomain.profile.name
            }),
          });

          if (!extRes.ok) {
            throw new Error(`status ${extRes.status}`);
          }

          extData = await extRes.json();
        }
        
        if (extData) {
          if (!isCompanyPolledToday) {
            appendLog({ type: 'success', text: `✓ Completed research for "${extData.resolvedCompany || company}"` });
          }

          // Fetch alternative buying committee contacts using Exa
          let alternateContacts = [];
          if (!isCompanyPolledToday) {
            try {
              const bcRes = await fetch('/api/collectors/buying-committee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: extData.resolvedCompany || company, department: targetDept, seniority: targetSeniority })
              });
              if (bcRes.ok) {
                const bcData = await bcRes.json();
                alternateContacts = bcData.contacts || [];
                if (alternateContacts.length > 0) {
                  appendLog({ type: 'success', text: `  └ 👥 Discovered contacts: ${alternateContacts.length} people` });
                }
              }
            } catch (bcErr) {
              console.error(`Failed to fetch buying committee for ${company}:`, bcErr);
            }
          } else {
            alternateContacts = profileWithDomain.prev?.alternateContacts || [];
          }
          
          // Update sitemap links, YouTube, job openings, etc. in snapshots
          if (!isCompanyPolledToday) {
            if (extData.sitemapLinks && extData.sitemapLinks.length > 0) {
              appendLog({ type: 'success', text: `  └ 🌐 Mapped sitemaps: ${extData.sitemapLinks.length} URLs` });
            }
            if (extData.jobOpenings && extData.jobOpenings.length > 0) {
              appendLog({ type: 'success', text: `  └ 💼 Mapped job openings: ${extData.jobOpenings.length} vacancies` });
            }
          }

          // Build a temporary snapshot representation to send to the correlation engine
          const tempSnapData = {
            sitemapLinks: extData.sitemapLinks || [],
            youtubeVideos: extData.youtubeVideos || [],
            jobOpenings: extData.jobOpenings || [],
            prMentions: extData.prMentions || [],
            redditMentions: extData.redditMentions || [],
            twitterMentions: extData.twitterMentions || [],
            resolvedDomain: extData.resolvedDomain || '',
            alternateContacts: alternateContacts,
            ceoLinkedinUrl: extData.ceoLinkedinUrl || '',
            twitterHandle: extData.twitterHandle || '',
            g2Url: extData.g2Url || '',
            capterraUrl: extData.capterraUrl || '',
            g2Reviews: extData.g2Reviews || [],
            capterraReviews: extData.capterraReviews || [],
            posts: extData.companyPosts || [],
            autoboundSignals: extData.autoboundSignals || [],
            currentCompany: extData.resolvedCompany || company,
          };

          // Pre-fetch the strategic GTM investigator synthesis
          let preFetchedSynthesis = null;
          try {
            appendLog({ type: 'info', text: `  └ 🧠 Pre-fetching strategic correlations & templates...` });
            let gtmSettings = {};
            if (typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem('gtm_product_settings');
                if (stored) gtmSettings = JSON.parse(stored);
              } catch (e) {
                console.error('Failed to load GTM settings in PollPage:', e);
              }
            }
            const corrRes = await fetch('/api/correlate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyName: extData.resolvedCompany || company,
                domain: extData.resolvedDomain || '',
                snapData: tempSnapData,
                targetDept,
                targetSeniority,
                gtmSettings
              })
            });
            if (corrRes.ok) {
              preFetchedSynthesis = await corrRes.json();
              appendLog({ type: 'success', text: `  └ 🧠 Synthesis pre-fetched successfully!` });
            }
          } catch (corrErr) {
            console.error(`Failed to pre-fetch correlations for ${company}:`, corrErr);
          }

          // Save enrichment to Supabase for each profile in the group
          for (const item of profilesInCompany) {
            const { profile, snapshot, prev } = item;
            
            snapshot.sitemapLinks = extData.sitemapLinks || [];
            snapshot.youtubeVideos = extData.youtubeVideos || [];
            snapshot.jobOpenings = extData.jobOpenings || [];
            snapshot.prMentions = extData.prMentions || [];
            snapshot.redditMentions = extData.redditMentions || [];
            snapshot.twitterMentions = extData.twitterMentions || [];
            snapshot.resolvedDomain = extData.resolvedDomain || '';
            snapshot.alternateContacts = alternateContacts;
            snapshot.ceoLinkedinUrl = extData.ceoLinkedinUrl || '';
            snapshot.twitterHandle = extData.twitterHandle || '';
            snapshot.g2Url = extData.g2Url || '';
            snapshot.capterraUrl = extData.capterraUrl || '';
            snapshot.g2Reviews = extData.g2Reviews || [];
            snapshot.capterraReviews = extData.capterraReviews || [];
            snapshot.posts = extData.companyPosts || [];
            snapshot.autoboundSignals = extData.autoboundSignals || [];
            if (extData.resolvedCompany && extData.resolvedCompany !== 'Unknown') {
              snapshot.currentCompany = extData.resolvedCompany;
            }
            if (preFetchedSynthesis) {
              snapshot.synthesis = preFetchedSynthesis;
            }

            // Detect external signals
            const extSignals = detectExternalSignals(profile, extData, prev);
            if (extSignals.length > 0) {
              extSignals.forEach(s => {
                appendLog({ type: 'signal', text: `${s.emoji} SIGNAL: ${s.label} — ${s.source}` });
              });
              allExtSignals.push(...extSignals);
              setSignalsFound(prevVal => prevVal + extSignals.length);
            }

            // Write enriched snapshot back to Supabase
            const { data: currentData } = await supabase
              .from('profiles')
              .select('snapshots')
              .eq('id', profile.id)
              .single();

            const currentSnapshots = (currentData && currentData.snapshots) || [];
            const updatedSnapshots = [...currentSnapshots.slice(0, -1), snapshot];

            const updatePayload = {
              snapshots: updatedSnapshots,
              status: 'active',
              last_polled: new Date().toISOString()
            };
            if (!profile.companyLinkedinUrl && extData.companyLinkedinUrl) {
              updatePayload.company_linkedin_url = extData.companyLinkedinUrl;
              profile.companyLinkedinUrl = extData.companyLinkedinUrl;
            }
            if ((!profile.company || profile.company === 'Unknown') && extData.resolvedCompany && extData.resolvedCompany !== 'Unknown') {
              updatePayload.company = extData.resolvedCompany;
              profile.company = extData.resolvedCompany;
            }
            await supabase
              .from('profiles')
              .update(updatePayload)
              .eq('id', profile.id);
          }
        }
      } catch (err) {
        appendLog({ type: 'info', text: `⚠️ Company research failed for "${company}": ${err.message}` });
        console.error(`Company research failed for ${company}:`, err);
      }
    }));

    return allExtSignals;
  };

  const runMockPoll = async () => {
    setPolling(true);
    setDone(false);
    setLog([]);
    setSignalsFound(0);

    appendLog({ type: 'info', text: `Starting demo poll for ${activeQueue.length} profiles...` });

    const allSignals = [];
    const scrapedItems = [];

    for (let i = 0; i < activeQueue.length; i++) {
      const profile = activeQueue[i];
      await sleep(150);
      appendLog({ type: 'info', text: `Polling LinkedIn baseline for ${profile.name}...` });
      
      const isComp = identifyLinkedInUrlType(profile.linkedinUrl) === 'company';
      await sleep(100);
      appendLog({ type: 'success', text: `✓ ${profile.name} — baseline LinkedIn snapshot stored` });
      
      const prev = (profile.snapshots && profile.snapshots[profile.snapshots.length - 1]) || {};
      let resolvedCompany = profile.company || '';
      if (!resolvedCompany || resolvedCompany === 'Unknown' || resolvedCompany === '') {
        const nameLower = (profile.name || '').toLowerCase();
        const urlLower = (profile.linkedinUrl || '').toLowerCase();
        if (nameLower.includes('abha') || urlLower.includes('abha')) resolvedCompany = 'Atlys';
        else if (nameLower.includes('suraj') || urlLower.includes('suraj') || nameLower.includes('raviteja') || urlLower.includes('rteja')) resolvedCompany = 'MoEngage';
        else if (nameLower.includes('disha') || urlLower.includes('disha') || nameLower.includes('shraddha') || urlLower.includes('shraddha')) resolvedCompany = 'DigiDNA';
        else if (nameLower.includes('vivek') || urlLower.includes('vivek') || urlLower.includes('khandelwal')) resolvedCompany = 'CogniSwitch';
        else if (nameLower.includes('khadim') || urlLower.includes('khadimbatti')) resolvedCompany = 'Whatfix';
        else if (nameLower.includes('ankit') || urlLower.includes('ankitratan')) resolvedCompany = 'Signzy';
        else if (nameLower.includes('prabhu') || urlLower.includes('prabhurama') || nameLower.includes('nivedha') || urlLower.includes('nivedha')) resolvedCompany = 'Facilio';
        else if (nameLower.includes('aseem') || urlLower.includes('aseemsinha')) resolvedCompany = 'Locus';
        else if (nameLower.includes('aditya') || urlLower.includes('adityavempaty')) resolvedCompany = 'Coram AI';
        else resolvedCompany = 'Acme Corp';
      }

      const snapshot = {
        ...prev,
        currentCompany: resolvedCompany,
        currentTitle: profile.title || (isComp ? 'Company Page' : 'Executive'),
        polledAt: new Date().toISOString(),
      };

      if (isComp) {
        if (!snapshot.posts || snapshot.posts.length === 0) {
          snapshot.posts = generateMockCompanyPosts(profile.name);
        }
      } else {
        if (!snapshot.recentPosts || snapshot.recentPosts.length === 0) {
          snapshot.recentPosts = generateMockPersonPosts(profile.name, resolvedCompany);
        }
        if (!snapshot.activity || snapshot.activity.length === 0) {
          snapshot.activity = generateMockPersonActivity(profile.name, resolvedCompany);
        }
        if (!snapshot.posts || snapshot.posts.length === 0) {
          snapshot.posts = generateMockCompanyPosts(resolvedCompany || 'Their Company');
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

      // Run baseline LinkedIn signal detection
      const linkedinSignals = detectSignals(profile, prev, snapshot);
      if (linkedinSignals.length > 0) {
        linkedinSignals.forEach(s => {
          appendLog({ type: 'signal', text: `${s.emoji} SIGNAL: ${s.label} — ${s.profile}` });
        });
        allSignals.push(...linkedinSignals);
        setSignalsFound(prevVal => prevVal + linkedinSignals.length);
      }

      // Update the profile record in Supabase with the basic snapshot (Active)
      try {
        const currentSnapshots = profile.snapshots || [];
        const updatePayload = {
          status: 'active',
          last_polled: new Date().toISOString(),
          snapshots: [...currentSnapshots, snapshot]
        };
        if (!profile.company || profile.company === 'Unknown' || profile.company === '') {
          updatePayload.company = resolvedCompany;
          profile.company = resolvedCompany;
        }
        const { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', profile.id);
        if (error) throw error;

        scrapedItems.push({ profile, snapshot, prev });
      } catch (err) {
        console.error("Error updating profile status in Supabase:", err);
      }

      const pct = Math.round(((i + 1) / activeQueue.length) * 100);
      setProgress(pct);
    }

    // Run deferred external enrichment for unique companies
    const extSignals = await enrichCompanies(scrapedItems);
    allSignals.push(...extSignals);

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

    const toPollQueue = [];
    const scrapedItems = [];
    const allSignals = [];

    activeQueue.forEach(item => {
      const lastPolledDate = item.last_polled || item.lastPolled;
      const isPolledToday = lastPolledDate && new Date(lastPolledDate).toDateString() === new Date().toDateString();
      if (isPolledToday) {
        const prev = (item.snapshots && item.snapshots.length > 0) ? item.snapshots[item.snapshots.length - 1] : {};
        scrapedItems.push({ profile: item, snapshot: prev, prev });
        const prevSignals = detectSignals(item, (item.snapshots && item.snapshots.length > 1) ? item.snapshots[item.snapshots.length - 2] : {}, prev);
        allSignals.push(...prevSignals);
        setSignalsFound(prevVal => prevVal + prevSignals.length);
        appendLog({ type: 'info', text: `ℹ️ Profile "${item.name}" was already polled today. Skipping scraping.` });
      } else {
        toPollQueue.push(item);
      }
    });

    appendLog({ type: 'info', text: `Starting poll for ${toPollQueue.length} profiles...` });

    if (toPollQueue.length > 0) {
      // Dynamically import poller (client-side only)
      const { pollProfilesBatch } = await import('../lib/poller');

      const generator = pollProfilesBatch(toPollQueue, apiKey, { delayMs: 600 });

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
              if (snapshot.isPrivateProfile) {
                appendLog({ type: 'info', text: `🔒 ${update.profile?.name} — Profile is private (monitoring company instead)` });
              } else {
                appendLog({ type: 'success', text: `✓ ${update.profile?.name} — LinkedIn baseline checked` });
              }
            }

            // Update the profile in Supabase to active immediately
            try {
              const currentSnapshots = update.profile?.snapshots || [];
              const updatePayload = {
                status: 'active',
                last_polled: new Date().toISOString(),
                snapshots: [...currentSnapshots, snapshot]
              };
              if (!update.profile?.company || update.profile.company === 'Unknown' || update.profile.company === '') {
                if (snapshot.currentCompany) {
                  updatePayload.company = snapshot.currentCompany;
                  update.profile.company = snapshot.currentCompany;
                }
              }
              const { error } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', update.profile?.id);
              if (error) throw error;

              scrapedItems.push({ profile: update.profile, snapshot, prev });
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
          appendLog({ type: 'info', text: `LinkedIn baseline check complete. Starting company enrichment...` });
        }
      }
    } else {
      setProgress(100);
      appendLog({ type: 'info', text: `LinkedIn baseline check complete. Starting company enrichment...` });
    }
    // Run deferred external enrichment for unique companies
    const extSignals = await enrichCompanies(scrapedItems);
    allSignals.push(...extSignals);

    appendLog({ type: 'signal', text: `✅ Poll complete — ${allSignals.length} total signals detected` });
    if (onSignalsDetected) onSignalsDetected(rankSignals(allSignals));

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
                ⚠️ No API key set — running in <strong>demo mode</strong> with simulated signals. Add your ScrapeCreators API key in the environment to poll real LinkedIn profiles.
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
            <div style={{
              marginTop: 20,
              padding: 24,
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Success! Profiles are live.</h3>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                Signal detection is complete. The target profiles have been successfully mapped and enriched. You can now monitor them in your dashboard.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onNavigate('brief')}
                  id="view-signals-btn"
                >
                  View Opportunity Dashboard →
                </button>
                <button className="btn btn-secondary" onClick={handleStartPoll}>
                  Run Another Poll
                </button>
              </div>
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
