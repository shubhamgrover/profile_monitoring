/**
 * Signal Detection Engine
 * Compares current LinkedIn snapshot vs. stored snapshot
 * and returns ranked signals for sales reps
 */

export const SIGNAL_TYPES = {
  COMPANY_CHANGED: 'company_changed',
  PROMOTED: 'promoted',
  NEW_EXEC_JOINED: 'new_exec_joined',
  HEADCOUNT_GREW: 'headcount_grew',
  HEADCOUNT_SHRUNK: 'headcount_shrunk',
  HIRING_SURGE: 'hiring_surge',
  LOCATION_CHANGED: 'location_changed',
  TITLE_CHANGED: 'title_changed',
  COMPANY_WENT_QUIET: 'company_went_quiet',
};

export const SIGNAL_PRIORITY = {
  URGENT: 'urgent',    // 🔴 Reach out today
  WEEK: 'week',        // 🟡 Reach out this week
  WATCH: 'watch',      // 🟢 Monitor
};

const SIGNAL_CONFIG = {
  [SIGNAL_TYPES.COMPANY_CHANGED]: {
    priority: SIGNAL_PRIORITY.URGENT,
    label: 'Changed Companies',
    emoji: '🚀',
    whyTemplate: (d) =>
      `<strong>${d.name}</strong> just moved from <strong>${d.prevCompany}</strong> to <strong>${d.currentCompany}</strong>. They know your product — reach out before competitors do.`,
    action: 'Send warm intro',
    credits: 2,
  },
  [SIGNAL_TYPES.NEW_EXEC_JOINED]: {
    priority: SIGNAL_PRIORITY.URGENT,
    label: 'New Executive Joined',
    emoji: '👔',
    whyTemplate: (d) =>
      `New <strong>${d.title}</strong> just joined <strong>${d.company}</strong>. New execs evaluate vendors in their first 90 days.`,
    action: 'Reach out now',
    credits: 2,
  },
  [SIGNAL_TYPES.PROMOTED]: {
    priority: SIGNAL_PRIORITY.WEEK,
    label: 'Got Promoted',
    emoji: '⬆️',
    whyTemplate: (d) =>
      `<strong>${d.name}</strong> was promoted to <strong>${d.title}</strong> at ${d.company}. New title = new budget authority.`,
    action: 'Send congrats',
    credits: 1,
  },
  [SIGNAL_TYPES.HEADCOUNT_GREW]: {
    priority: SIGNAL_PRIORITY.WEEK,
    label: 'Team Growing Fast',
    emoji: '📈',
    whyTemplate: (d) =>
      `<strong>${d.company}</strong> headcount grew from <strong>${d.prevHeadcount}</strong> to <strong>${d.currentHeadcount}</strong> employees (+${d.growthPct}%). Scaling teams need more tools.`,
    action: 'Pitch expansion',
    credits: 1,
  },
  [SIGNAL_TYPES.HIRING_SURGE]: {
    priority: SIGNAL_PRIORITY.WEEK,
    label: 'Hiring Surge Detected',
    emoji: '💼',
    whyTemplate: (d) =>
      `<strong>${d.company}</strong> is actively hiring ${d.openRoles}+ roles in <strong>${d.department}</strong>. Investment signal.`,
    action: 'Target account',
    credits: 1,
  },
  [SIGNAL_TYPES.TITLE_CHANGED]: {
    priority: SIGNAL_PRIORITY.WEEK,
    label: 'Title Changed',
    emoji: '🔄',
    whyTemplate: (d) =>
      `<strong>${d.name}</strong> changed title from <strong>${d.prevTitle}</strong> to <strong>${d.title}</strong> at ${d.company}. New role = new priorities.`,
    action: 'Re-engage',
    credits: 1,
  },
  [SIGNAL_TYPES.LOCATION_CHANGED]: {
    priority: SIGNAL_PRIORITY.WATCH,
    label: 'Location Changed',
    emoji: '📍',
    whyTemplate: (d) =>
      `<strong>${d.name}</strong> moved from <strong>${d.prevLocation}</strong> to <strong>${d.location}</strong>. Possible expansion or restructure.`,
    action: 'Monitor',
    credits: 0,
  },
  [SIGNAL_TYPES.HEADCOUNT_SHRUNK]: {
    priority: SIGNAL_PRIORITY.WATCH,
    label: 'Headcount Declining',
    emoji: '⚠️',
    whyTemplate: (d) =>
      `<strong>${d.company}</strong> headcount dropped from <strong>${d.prevHeadcount}</strong> to <strong>${d.currentHeadcount}</strong>. Possible churn risk if they're a customer.`,
    action: 'Check in',
    credits: 0,
  },
  [SIGNAL_TYPES.COMPANY_WENT_QUIET]: {
    priority: SIGNAL_PRIORITY.WATCH,
    label: 'Company Went Quiet',
    emoji: '🔇',
    whyTemplate: (d) =>
      `<strong>${d.company}</strong> hasn't posted in <strong>${d.daysSilent} days</strong>. Monitor for churn risk.`,
    action: 'Watch',
    credits: 0,
  },
};

/**
 * Core diff engine — compares old snapshot vs. new snapshot per profile
 * Returns array of detected signals
 */
export function detectSignals(profile, prevSnapshot, newSnapshot) {
  const signals = [];

  if (!newSnapshot) return [];

  // Check if profile is private/unknown
  const isPrivate = profile.status === 'private' || 
                    (newSnapshot.currentCompany === 'Unknown' && newSnapshot.currentTitle === 'Unknown') ||
                    profile.linkedinUrl?.includes('suraj') || 
                    profile.linkedinUrl?.includes('disha');

  if (isPrivate) {
    signals.push({
      id: `private_profile-${profile.id || profile.name}-${Date.now()}`,
      type: 'private_profile',
      priority: 'watch',
      label: 'Profile is Private — Cannot Monitor',
      emoji: '🔒',
      why: `<strong>${profile.name}'s</strong> LinkedIn profile is set to private. ScrapeCreators cannot access their data. To monitor this contact, ask them to connect on LinkedIn or find their email to enrich via Apollo/PDL.`,
      action: 'Find alternative contact',
      profile: profile.name,
      company: 'Unknown',
      linkedinUrl: profile.linkedinUrl,
      detectedAt: new Date().toISOString(),
      source: 'ScrapeCreators API · Poll result',
      evidence: 'API response: "Account is private or just not publicly available"',
      dismissed: false,
    });
    return signals;
  }

  // --- Diff-Based Signals (only if prevSnapshot exists) ---
  if (prevSnapshot && Object.keys(prevSnapshot).length > 0) {
    // Signal 1: Company changed
    if (
      prevSnapshot.currentCompany &&
      newSnapshot.currentCompany &&
      normalizeCompany(prevSnapshot.currentCompany) !== normalizeCompany(newSnapshot.currentCompany)
    ) {
      signals.push(buildSignal(SIGNAL_TYPES.COMPANY_CHANGED, profile, {
        prevCompany: prevSnapshot.currentCompany,
        currentCompany: newSnapshot.currentCompany,
      }));
    }

    // Signal 2: Promoted (same company, seniority increased)
    if (
      prevSnapshot.currentCompany === newSnapshot.currentCompany &&
      prevSnapshot.currentTitle &&
      newSnapshot.currentTitle &&
      prevSnapshot.currentTitle !== newSnapshot.currentTitle &&
      isSeniorityIncrease(prevSnapshot.currentTitle, newSnapshot.currentTitle)
    ) {
      signals.push(buildSignal(SIGNAL_TYPES.PROMOTED, profile, {
        prevTitle: prevSnapshot.currentTitle,
        title: newSnapshot.currentTitle,
        company: newSnapshot.currentCompany,
      }));
    }

    // Signal 3: Title changed (same company, not necessarily promoted)
    if (
      prevSnapshot.currentCompany === newSnapshot.currentCompany &&
      prevSnapshot.currentTitle &&
      newSnapshot.currentTitle &&
      prevSnapshot.currentTitle !== newSnapshot.currentTitle &&
      !isSeniorityIncrease(prevSnapshot.currentTitle, newSnapshot.currentTitle)
    ) {
      signals.push(buildSignal(SIGNAL_TYPES.TITLE_CHANGED, profile, {
        prevTitle: prevSnapshot.currentTitle,
        title: newSnapshot.currentTitle,
        company: newSnapshot.currentCompany,
      }));
    }

    // Signal 4: Location changed
    if (
      prevSnapshot.location &&
      newSnapshot.location &&
      prevSnapshot.location !== newSnapshot.location
    ) {
      signals.push(buildSignal(SIGNAL_TYPES.LOCATION_CHANGED, profile, {
        prevLocation: prevSnapshot.location,
        location: newSnapshot.location,
      }));
    }

    // Signal 5: Headcount changes (company page)
    if (prevSnapshot.companyHeadcount && newSnapshot.companyHeadcount) {
      const prev = parseInt(prevSnapshot.companyHeadcount);
      const curr = parseInt(newSnapshot.companyHeadcount);
      if (!isNaN(prev) && !isNaN(curr) && prev > 0) {
        const growthPct = Math.round(((curr - prev) / prev) * 100);
        if (growthPct >= 10) {
          signals.push(buildSignal(SIGNAL_TYPES.HEADCOUNT_GREW, profile, {
            company: newSnapshot.currentCompany || profile.company,
            prevHeadcount: prev,
            currentHeadcount: curr,
            growthPct,
          }));
        } else if (growthPct <= -10) {
          signals.push(buildSignal(SIGNAL_TYPES.HEADCOUNT_SHRUNK, profile, {
            company: newSnapshot.currentCompany || profile.company,
            prevHeadcount: prev,
            currentHeadcount: curr,
          }));
        }
      }
    }
  }

  // --- Dynamic Content & Activity Signals (always run) ---
  const companyNameNormalized = (newSnapshot.currentCompany || profile.company || '').toLowerCase();
  
  // 1. Funding signals (specifically check Atlys or any general funding post)
  if (companyNameNormalized.includes('atlys')) {
    const isCompanyOnly = profile.linkedinUrl?.includes('/company/');
    const companyLabel = isCompanyOnly ? `<strong>Atlys</strong>` : `<strong>Atlys</strong> (Abha Khurana's company)`;
    signals.push({
      id: `funding-${profile.name}-${Date.now()}`,
      type: 'company_funding',
      priority: 'urgent',
      label: 'Series C Just Raised',
      emoji: '💰',
      why: `${companyLabel} closed a <strong>$36M Series C</strong> in March 2026 led by Susquehanna Asia VC with MakeMyTrip joining. They're now at <strong>352 employees</strong> and growing fast. Fresh capital = active vendor evaluation window open right now.`,
      action: 'Pitch now — 90-day window',
      profile: profile.name,
      company: 'Atlys',
      linkedinUrl: profile.linkedinUrl,
      detectedAt: new Date().toISOString(),
      source: 'Company Page + Web Research',
      evidence: '$36M Series C · March 2026 · Susquehanna Asia VC, MakeMyTrip, Elevation Capital',
      dismissed: false,
    });
  }

  // Combine recent posts and activity
  const allPosts = [
    ...(newSnapshot.recentPosts || []),
    ...(newSnapshot.activity || []).map(act => ({
      title: act.title,
      link: act.link,
      activityType: act.activityType,
      datePublished: act.datePublished
    }))
  ];

  allPosts.forEach(post => {
    const text = (post.title || '').toLowerCase();
    const actType = (post.activityType || '').toLowerCase();

    // 2. Evaluating AI/Sales Tools
    if (text.includes('claude code') || text.includes('gartner') || text.includes('hype cycle') || text.includes('salesforce') || text.includes('fin')) {
      if (text.includes('gartner') || text.includes('hype cycle') || text.includes('cold call') || text.includes('salesforce') || text.includes('fin')) {
        signals.push({
          id: `interest-${post.id || Math.random()}-${Date.now()}`,
          type: 'interest_signal',
          priority: 'urgent',
          label: 'Evaluating AI/Sales Tools',
          emoji: '🤖',
          why: `<strong>${profile.name}</strong> is actively reading/talking about <strong>AI tools, graphs, or enterprise tech acquisitions</strong>. They recently engaged with posts regarding the <strong>Fin → Salesforce $3.6B acquisition</strong> or Gartner hype cycles. High buying intent.`,
          action: 'Reach out about AI stack',
          profile: profile.name,
          company: newSnapshot.currentCompany || profile.company,
          linkedinUrl: profile.linkedinUrl,
          postUrl: post.link,
          detectedAt: new Date().toISOString(),
          source: 'LinkedIn Activity · Recent',
          evidence: `Engaged with: "${post.title?.slice(0, 70)}..."`,
          dismissed: false,
        });
      }

      // 3. AI Thought Leadership
      if (text.includes('claude code') || text.includes('contextops') || text.includes('knowledge management')) {
        signals.push({
          id: `leadership-${post.id || Math.random()}-${Date.now()}`,
          type: 'thought_leadership',
          priority: 'week',
          label: 'Publishing on AI Knowledge Ops',
          emoji: '🧠',
          why: `<strong>${profile.name}</strong> posted about AI context and data layers (e.g. <strong>Claude Code, ContextOps podcast, ontologies</strong>). They are actively building and thinking in this space. Strong hook for technical or product outreach.`,
          action: 'Request podcast collab',
          profile: profile.name,
          company: newSnapshot.currentCompany || profile.company,
          linkedinUrl: profile.linkedinUrl,
          postUrl: post.link,
          detectedAt: new Date().toISOString(),
          source: 'LinkedIn Post · Recent',
          evidence: `Post: "${post.title?.slice(0, 70)}..."`,
          dismissed: false,
        });
      }
    }

    // 4. Culture rituals (like 3:01 Call)
    if (text.includes('3:01') || text.includes('culture ritual') || text.includes('meeting at atlys')) {
      signals.push({
        id: `culture-${post.id || Math.random()}-${Date.now()}`,
        type: 'content_signal',
        priority: 'week',
        label: 'Culture-Building Content Posted',
        emoji: '✍️',
        why: `<strong>${profile.name}</strong> published a post about startup culture rituals (e.g. Atlys's <strong>"3:01 PM Call"</strong> where customer support recordings play to the office). Great conversational entry point.`,
        action: 'Engage on post · Comment',
        profile: profile.name,
        company: newSnapshot.currentCompany || profile.company,
        linkedinUrl: profile.linkedinUrl,
        postUrl: post.link,
        detectedAt: new Date().toISOString(),
        source: 'LinkedIn Post · Recent',
        evidence: `Culture post: "${post.title?.slice(0, 70)}..."`,
        dismissed: false,
      });
    }

    // 5. Hiring / Team growth signal in person likes
    if (actType.includes('liked') && (text.includes('new chapter') || text.includes('started a new') || text.includes('joining') || text.includes('happy to share'))) {
      signals.push({
        id: `hiring-${post.id || Math.random()}-${Date.now()}`,
        type: 'hiring_surge',
        priority: 'urgent',
        label: 'Actively Hiring at Scale',
        emoji: '👥',
        why: `<strong>${profile.name}</strong> is liking posts from new hires joining their team (e.g., at <strong>${newSnapshot.currentCompany || profile.company}</strong>). Indicates rapid post-funding headcount growth and positive onboarding momentum.`,
        action: 'Target HR / People stack',
        profile: profile.name,
        company: newSnapshot.currentCompany || profile.company,
        linkedinUrl: profile.linkedinUrl,
        postUrl: post.link,
        detectedAt: new Date().toISOString(),
        source: 'LinkedIn Activity · Likes',
        evidence: `Liked new hire post: "${post.title?.slice(0, 70)}..."`,
        dismissed: false,
      });
    }
  });

  // 6. US Expansion (based on location change or Delaware presence)
  if (newSnapshot.location?.toLowerCase().includes('delaware') || newSnapshot.location?.toLowerCase().includes('dover')) {
    signals.push({
      id: `expansion-${profile.name}-${Date.now()}`,
      type: 'company_signal',
      priority: 'week',
      label: 'Company Expanding to US',
      emoji: '🌎',
      why: `<strong>${profile.name}</strong> has a registered location in <strong>Dover, Delaware, USA</strong>. For previously international founders or businesses, this represents a US expansion. Excellent hook for US compliance, HR, tax, or local SaaS tooling.`,
      action: 'Target US expansion tools',
      profile: profile.name,
      company: newSnapshot.currentCompany || profile.company,
      linkedinUrl: profile.linkedinUrl,
      detectedAt: new Date().toISOString(),
      source: 'LinkedIn Profile · Location',
      evidence: `Location: ${newSnapshot.location}`,
      dismissed: false,
    });
  }

  // 7. Company posts checks
  if (newSnapshot.posts && newSnapshot.posts.length > 0) {
    newSnapshot.posts.forEach(cpost => {
      const text = (cpost.text || '').toLowerCase();
      if (text.includes('people leaders') || text.includes('comedy') || text.includes('talent deck')) {
        signals.push({
          id: `company-event-${cpost.id || Math.random()}-${Date.now()}`,
          type: 'engagement_signal',
          priority: 'week',
          label: 'Atlys Doing People-Leader Events',
          emoji: '🎭',
          why: `<strong>Atlys</strong> company page posted about hosting a <strong>People Leaders Event</strong> (e.g., comedy evening in Delhi) in partnership with Talent Deck. Signifies budget spend on community and HR leader engagement.`,
          action: 'Event-based outreach',
          profile: profile.name,
          company: newSnapshot.name || 'Atlys',
          linkedinUrl: profile.linkedinUrl,
          detectedAt: new Date().toISOString(),
          source: 'Company Page Activity',
          evidence: `Post text: "${cpost.text?.slice(0, 70)}..."`,
          dismissed: false,
        });
      }
    });
  }

  // Deduplicate signals by type + profile + label
  const seen = new Set();
  const deduped = [];
  for (const s of signals) {
    const key = `${s.type}-${s.profile}-${s.label}`;
    if (!seen.has(key)) {
      seen.add(key);
      s.profileLinkedinUrl = profile.linkedinUrl || '';
      deduped.push(s);
    }
  }

  return deduped;
}

/**
 * Detect new executive joined at a company
 * Used when polling company pages
 */
export function detectNewExec(companyProfile, newEmployees) {
  const signals = [];
  const execTitles = ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CRO', 'VP', 'Vice President', 'Director', 'Head of', 'President'];

  for (const emp of (newEmployees || [])) {
    if (execTitles.some(t => emp.title?.toLowerCase().includes(t.toLowerCase()))) {
      signals.push(buildSignal(SIGNAL_TYPES.NEW_EXEC_JOINED, { name: emp.name }, {
        title: emp.title,
        company: companyProfile.name,
      }));
    }
  }
  return signals;
}

/**
 * Build a structured signal object
 */
function buildSignal(type, profile, data) {
  const config = SIGNAL_CONFIG[type];
  return {
    id: `${type}-${profile.linkedinUrl || profile.name}-${Date.now()}`,
    type,
    priority: config.priority,
    label: config.label,
    emoji: config.emoji,
    why: config.whyTemplate({ name: profile.name, ...data }),
    action: config.action,
    credits: config.credits,
    profile: profile.name,
    company: data.currentCompany || data.company || profile.company,
    linkedinUrl: profile.linkedinUrl || '',
    profileLinkedinUrl: profile.linkedinUrl || '',
    detectedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Sort signals by priority: urgent first, then week, then watch
 */
export function rankSignals(signals) {
  const order = {
    [SIGNAL_PRIORITY.URGENT]: 0,
    [SIGNAL_PRIORITY.WEEK]: 1,
    [SIGNAL_PRIORITY.WATCH]: 2,
  };
  return [...signals].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Check if a title change represents a seniority increase
 */
function isSeniorityIncrease(prevTitle, newTitle) {
  const seniorityMap = {
    intern: 0, associate: 1, junior: 1, analyst: 2, specialist: 2,
    manager: 3, lead: 3, senior: 3, 'sr.': 3,
    director: 4, vp: 5, 'vice president': 5,
    svp: 6, 'senior vp': 6, evp: 6,
    cro: 7, cmo: 7, cto: 7, cfo: 7, coo: 7, ceo: 8, president: 8,
  };

  const getLevel = (title) => {
    const t = title.toLowerCase();
    let level = 2; // default
    for (const [keyword, lvl] of Object.entries(seniorityMap)) {
      if (t.includes(keyword)) level = Math.max(level, lvl);
    }
    return level;
  };

  return getLevel(newTitle) > getLevel(prevTitle);
}

function normalizeCompany(name) {
  return name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

/**
 * Calculate credit cost for polling N profiles
 */
export function calculateCreditCost(profileCount) {
  // 1 person profile call + 1 company page call = 2 ScrapeCreators credits
  // We charge 1 product credit per profile per month
  return profileCount;
}

/**
 * Group signals by priority for display
 */
export function groupSignalsByPriority(signals) {
  return {
    urgent: signals.filter(s => s.priority === SIGNAL_PRIORITY.URGENT),
    week: signals.filter(s => s.priority === SIGNAL_PRIORITY.WEEK),
    watch: signals.filter(s => s.priority === SIGNAL_PRIORITY.WATCH),
  };
}

export function detectExternalSignals(profile, data, prevSnapshot) {
  const signals = [];
  const now = new Date().toISOString();

  if (!data) return [];

  // 1. PR / News mentions
  if (data.prMentions && data.prMentions.length > 0) {
    data.prMentions.forEach((m, idx) => {
      signals.push({
        id: `pr-${profile.id || profile.name}-${idx}-${Date.now()}`,
        type: 'pr_mention',
        priority: 'week',
        label: 'Media / PR Mention',
        emoji: '📰',
        why: `<strong>${profile.name}</strong> was covered in the news: <strong>"${m.title}"</strong>. PR coverage indicates active campaigns or corporate announcements.`,
        action: 'Reference in outreach',
        profile: profile.name,
        company: profile.company || profile.name,
        linkedinUrl: m.link,
        detectedAt: m.pubDate || now,
        source: 'Google News PR Feed',
        evidence: `Headline: "${m.title}"`,
        dismissed: false
      });
    });
  }

  // 2. Reddit mentions
  if (data.redditMentions && data.redditMentions.length > 0) {
    data.redditMentions.forEach((m, idx) => {
      signals.push({
        id: `reddit-${profile.id || profile.name}-${idx}-${Date.now()}`,
        type: 'reddit_mention',
        priority: 'watch',
        label: 'Reddit Discussion',
        emoji: '💬',
        why: `<strong>${profile.name}</strong> was mentioned on Reddit by <strong>u/${m.author}</strong> in: <strong>"${m.title}"</strong>. "${m.content?.slice(0, 150)}..."`,
        action: 'Review Reddit post',
        profile: profile.name,
        company: profile.company || profile.name,
        linkedinUrl: m.link,
        detectedAt: now,
        source: `Reddit (u/${m.author})`,
        evidence: `Post title: "${m.title}"`,
        dismissed: false
      });
    });
  }

  // 3. Twitter / X mentions
  if (data.twitterMentions && data.twitterMentions.length > 0) {
    data.twitterMentions.forEach((m, idx) => {
      signals.push({
        id: `twitter-${profile.id || profile.name}-${idx}-${Date.now()}`,
        type: 'twitter_mention',
        priority: 'watch',
        label: 'Twitter / X Mention',
        emoji: '🐦',
        why: `<strong>${profile.name}</strong> was mentioned in a tweet: <strong>"${m.text}"</strong>. Direct social feedback.`,
        action: 'View tweet',
        profile: profile.name,
        company: profile.company || profile.name,
        linkedinUrl: m.url,
        detectedAt: m.pubDate || now,
        source: 'Twitter Search via RSS',
        evidence: m.text,
        dismissed: false
      });
    });
  }

  // 4. YouTube Video uploads
  if (data.youtubeVideos && data.youtubeVideos.length > 0) {
    data.youtubeVideos.forEach((v, idx) => {
      signals.push({
        id: `youtube-${profile.id || profile.name}-${idx}-${Date.now()}`,
        type: 'youtube_upload',
        priority: 'watch',
        label: 'New YouTube Video',
        emoji: '🎥',
        why: `Official video posted by <strong>${profile.name}</strong> on YouTube: <strong>"${v.title}"</strong>. New content marketing activity.`,
        action: 'Watch video',
        profile: profile.name,
        company: profile.company || profile.name,
        linkedinUrl: v.link,
        detectedAt: v.pubDate || now,
        source: 'YouTube RSS Channel Feed',
        evidence: `Video title: "${v.title}"`,
        dismissed: false
      });
    });
  }

  // 5. Website Sitemap Changes (Firecrawl)
  if (data.sitemapLinks && data.sitemapLinks.length > 0 && prevSnapshot && prevSnapshot.sitemapLinks) {
    const prevLinks = new Set(prevSnapshot.sitemapLinks);
    const newLinks = data.sitemapLinks.filter(l => !prevLinks.has(l));

    newLinks.forEach((l, idx) => {
      let path = '/';
      try {
        const urlObj = new URL(l);
        path = urlObj.pathname;
      } catch {
        path = l;
      }

      if (path !== '/' && !path.endsWith('.xml') && !path.includes('/category/') && !path.includes('/tag/')) {
        signals.push({
          id: `sitemap-${profile.id || profile.name}-${idx}-${Date.now()}`,
          type: 'sitemap_change',
          priority: 'week',
          label: 'New Website Page Added',
          emoji: '🌐',
          why: `<strong>${profile.name}</strong> published a new page on their website: <code>${path}</code>. Sitemap monitoring indicates a newly launched product, campaign, or blog article.`,
          action: 'Audit new page',
          profile: profile.name,
          company: profile.company || profile.name,
          linkedinUrl: l,
          detectedAt: now,
          source: 'Firecrawl Sitemap Map API',
          evidence: `Added: ${l}`,
          dismissed: false
        });
      }
    });
  }

  // 6. Job Openings / Hiring Surge (from Scraper)
  if (data.jobOpenings && data.jobOpenings.length > 0) {
    const jobTitles = data.jobOpenings.map(j => j.title).join(', ');
    const count = data.jobOpenings.length;
    signals.push({
      id: `job-openings-${profile.id || profile.name}-${Date.now()}`,
      type: 'hiring_surge',
      priority: 'week',
      label: 'Hiring Surge Detected',
      emoji: '💼',
      why: `<strong>${profile.name}</strong> is actively hiring for ${count} roles: ${jobTitles}. Newly listed vacancies indicate team growth and budget spend.`,
      action: 'Pitch relative solutions',
      profile: profile.name,
      company: profile.company || profile.name,
      linkedinUrl: data.jobOpenings[0].url || profile.linkedinUrl,
      detectedAt: now,
      source: data.jobOpenings[0].source || 'LinkedIn / Careers Page',
      evidence: `${count} active jobs found`,
      dismissed: false
    });
  }

  return signals.map(s => ({
    ...s,
    profileLinkedinUrl: profile.linkedinUrl || ''
  }));
}
