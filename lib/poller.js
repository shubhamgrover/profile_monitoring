/**
 * ScrapeCreators LinkedIn Polling Engine
 * Polls LinkedIn person profiles and company pages
 * Returns normalized snapshot data for signal comparison
 */

const SCRAPECREATORS_BASE = 'https://api.scrapecreators.com';

/**
 * Poll a single LinkedIn person profile
 * Returns normalized snapshot
 */
export async function pollPersonProfile(linkedinUrl, apiKey) {
  if (!apiKey) throw new Error('ScrapeCreators API key required');

  const endpoint = typeof window !== 'undefined'
    ? `/api/scrapecreators-proxy?type=profile&url=${encodeURIComponent(linkedinUrl)}`
    : `${SCRAPECREATORS_BASE}/v1/linkedin/profile?url=${encodeURIComponent(linkedinUrl)}`;

  const response = await fetch(endpoint, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return normalizePersonSnapshot(data);
}

/**
 * Poll a LinkedIn company page
 * Returns normalized company snapshot
 */
export async function pollCompanyPage(companyLinkedinUrl, apiKey) {
  if (!apiKey) throw new Error('ScrapeCreators API key required');

  const endpoint = typeof window !== 'undefined'
    ? `/api/scrapecreators-proxy?type=company&url=${encodeURIComponent(companyLinkedinUrl)}`
    : `${SCRAPECREATORS_BASE}/v1/linkedin/company?url=${encodeURIComponent(companyLinkedinUrl)}`;

  const response = await fetch(endpoint, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Company API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return normalizeCompanySnapshot(data);
}

export function identifyLinkedInUrlType(url) {
  if (!url) return null;
  const clean = url.toLowerCase();
  if (clean.includes('/company/')) return 'company';
  if (clean.includes('/in/') || clean.includes('/profile/')) return 'person';
  return 'unknown';
}

/**
 * Poll a batch of profiles with rate limiting
 * Yields progress updates for UI
 */
export async function* pollProfilesBatch(profiles, apiKey, options = {}) {
  const { delayMs = 500, onlyPerson = false } = options;
  const results = [];

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];

    yield {
      type: 'progress',
      current: i + 1,
      total: profiles.length,
      profileName: profile.name,
      pct: Math.round(((i + 1) / profiles.length) * 100),
    };

    try {
      const urlType = identifyLinkedInUrlType(profile.linkedinUrl);
      let snapshot = null;

      if (urlType === 'company') {
        // Poll company profile only
        const companySnapshot = await pollCompanyPage(profile.linkedinUrl, apiKey);
        snapshot = {
          currentCompany: companySnapshot.name,
          currentTitle: 'Company Page',
          companyHeadcount: companySnapshot.headcount,
          companyFollowers: companySnapshot.followers,
          companyLastPost: companySnapshot.lastPost,
          posts: companySnapshot.posts || [],
          polledAt: new Date().toISOString(),
        };
      } else {
        // Poll person profile
        let personSnapshot = null;
        let isPrivate = false;
        try {
          personSnapshot = await pollPersonProfile(profile.linkedinUrl, apiKey);
        } catch (personErr) {
          console.warn(`Profile ${profile.name} is private or restricted. Using fallback company monitoring: ${personErr.message}`);
          isPrivate = true;
          personSnapshot = {
            currentCompany: profile.company || 'Unknown Company',
            currentTitle: profile.title || 'Executive',
            isPrivateProfile: true
          };
        }

        let companySnapshot = null;
        if (!onlyPerson && profile.companyLinkedinUrl) {
          try {
            companySnapshot = await pollCompanyPage(profile.companyLinkedinUrl, apiKey);
          } catch {
            // Company page optional — continue
          }
          await delay(delayMs);
        }

        snapshot = {
          ...personSnapshot,
          ...(companySnapshot ? {
            currentCompany: (companySnapshot.name && companySnapshot.name !== 'Company Page') ? companySnapshot.name : (personSnapshot.currentCompany || 'Unknown Company'),
            companyHeadcount: companySnapshot.headcount,
            companyFollowers: companySnapshot.followers,
            companyLastPost: companySnapshot.lastPost,
            posts: companySnapshot.posts || [],
          } : {}),
          polledAt: new Date().toISOString(),
        };

        // Extract rich signals from LinkedIn posts (runs client-side safely — no external fetch)
        const posts = snapshot.posts || companySnapshot?.posts || [];
        if (posts.length > 0) {
          snapshot.postSignals = extractPostSignals(posts, snapshot.currentCompany || profile.company);
        }
      }

      results.push({ profile, snapshot, success: true });

      yield {
        type: 'success',
        profileName: profile.name,
        profile,
        snapshot,
      };

    } catch (err) {
      results.push({ profile, error: err.message, success: false });
      yield {
        type: 'error',
        profileName: profile.name,
        error: err.message,
      };
    }

    if (i < profiles.length - 1) await delay(delayMs);
  }

  yield { type: 'done', results };
}

function extractLast5Posts(rawData) {
  if (!rawData) return [];
  const sources = [
    rawData.recentPosts,
    rawData.posts,
    rawData.updates,
    rawData.activity,
    rawData.recentActivity,
    rawData.comments,
    rawData.reposts
  ];
  const merged = [];
  const seenTexts = new Set();
  for (const src of sources) {
    if (Array.isArray(src)) {
      for (const item of src) {
        if (!item) continue;
        const text = (item.text || item.title || item.content || item.commentText || item.description || '').trim();
        if (text && !seenTexts.has(text)) {
          seenTexts.add(text);
          merged.push({
            text: text,
            date: item.date || item.datePublished || item.createdAt || new Date().toISOString()
          });
        }
      }
    }
  }
  return merged.slice(0, 10);
}

/**
 * Normalize raw ScrapeCreators person profile response
 * into a consistent snapshot format
 */
function normalizePersonSnapshot(raw) {
  // ScrapeCreators returns varying field structures
  // We normalize to our standard format
  const experience = raw.experience || raw.positions || [];
  const currentJob = experience.find(e => !e.endDate && !e.end_date) || experience[0] || {};
  const posts = extractLast5Posts(raw);

  return {
    currentCompany: currentJob.name || currentJob.company || currentJob.companyName || raw.company || '',
    currentTitle: currentJob.title || currentJob.position || raw.headline || '',
    location: raw.location || raw.geoLocation || '',
    summary: raw.summary || raw.about || '',
    connections: raw.connections || raw.connectionsCount || 0,
    experience: experience.map(e => ({
      title: e.title || e.position || '',
      company: e.name || e.company || e.companyName || '',
      startDate: e.startDate || e.start_date || '',
      endDate: e.endDate || e.end_date || null,
      current: !e.endDate && !e.end_date,
    })),
    rawName: raw.name || raw.firstName ? `${raw.firstName || ''} ${raw.lastName || ''}`.trim() : '',
    recentPosts: posts,
    activity: posts,
  };
}

/**
 * Normalize raw ScrapeCreators company page response
 */
function normalizeCompanySnapshot(raw) {
  return {
    name: raw.name || raw.companyName || '',
    headcount: extractHeadcount(raw.employeeCount || raw.staffCount || raw.companySize || ''),
    followers: raw.followers || raw.followersCount || 0,
    industry: raw.industry || '',
    lastPost: raw.latestPost?.date || raw.lastActivity || null,
    specialties: raw.specialties || [],
    description: raw.description || raw.about || '',
    posts: raw.posts || raw.updates || raw.recentPosts || raw.recent_posts || [],
  };
}

/**
 * Extract numeric headcount from various formats
 * e.g. "1,001-5,000", "500+", "51-200" → midpoint
 */
function extractHeadcount(raw) {
  if (!raw) return null;
  const str = String(raw).replace(/,/g, '');

  // Already a number
  if (/^\d+$/.test(str)) return parseInt(str);

  // Range like "51-200"
  const rangeMatch = str.match(/(\d+)-(\d+)/);
  if (rangeMatch) {
    return Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
  }

  // "500+" format
  const plusMatch = str.match(/(\d+)\+/);
  if (plusMatch) return parseInt(plusMatch[1]);

  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simple CMS Footprint Scanner
 */
export async function scanCmsFootprints(domain) {
  if (!domain) return null;
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const results = {
    cms: 'unknown',
    wpUsers: [],
    shopifyProducts: []
  };

  try {
    // 1. Try WordPress Users Rest API
    const wpUsersRes = await fetch(`${url}/wp-json/wp/v2/users`, { signal: AbortSignal.timeout(2000) });
    if (wpUsersRes.ok) {
      const data = await wpUsersRes.json();
      if (Array.isArray(data) && data.length > 0) {
        results.cms = 'wordpress';
        results.wpUsers = data.slice(0, 10).map(u => ({
          name: u.name,
          slug: u.slug,
          description: u.description || 'Contributor'
        }));
      }
    }
  } catch (e) {}

  if (results.cms !== 'wordpress') {
    try {
      // 2. Try Shopify Products JSON
      const shopifyRes = await fetch(`${url}/products.json?limit=5`, { signal: AbortSignal.timeout(2000) });
      if (shopifyRes.ok) {
        const data = await shopifyRes.json();
        if (data && Array.isArray(data.products)) {
          results.cms = 'shopify';
          results.shopifyProducts = data.products.map(p => ({
            title: p.title,
            price: p.variants?.[0]?.price ? `$${p.variants[0].price}` : 'N/A'
          }));
        }
      }
    } catch (e) {}
  }

  return results.cms !== 'unknown' ? results : null;
}

/**
 * Extract rich signals from LinkedIn post text.
 * Runs entirely client-side — NO external fetch — so no CORS issues.
 * Detects: events, product launches, funding, partnerships, hiring, awards.
 */
export function extractPostSignals(posts, companyName) {
  if (!posts || posts.length === 0) return [];

  const signals = [];

  const patterns = [
    {
      type: 'EVENT_ATTENDANCE',
      emoji: '🎪',
      label: 'Attending Industry Event',
      priority: 'week',
      regex: /\b(attending|joining|meet us at|see us at|exhibiting at|booth at|speaking at|presenting at|will be at|come find us at|excited to attend|join us at|find us at|stopping by)\b[^.]{0,120}\b(summit|conference|expo|event|forum|meetup|symposium|webinar|workshop|hackathon|trade show|roadshow|demo day|pitch|launch event)\b/i,
      extract: (text) => {
        const eventMatch = text.match(/\b(attending|speaking at|exhibiting at|booth at|meet us at|see us at|presenting at|join us at|find us at)\b[^.!?]*?("[^"]+"|[A-Z][A-Za-z0-9 &'-]{3,50}(?:Summit|Conference|Expo|Forum|Meetup|Symposium|Hackathon|Show|Day|Fest|Week))/i);
        const dateMatch = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:[-–]\d{1,2})?(?:,?\s*\d{4})?/i);
        return {
          eventName: eventMatch?.[2]?.replace(/"/g, '') || 'industry event',
          date: dateMatch?.[0] || null,
        };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> is attending <strong>${data.eventName}</strong>${data.date ? ` on ${data.date}` : ''}. Perfect timing to request a meeting on-site.`,
    },
    {
      type: 'PRODUCT_LAUNCH',
      emoji: '🚀',
      label: 'Product / Feature Launch',
      priority: 'week',
      regex: /\b(launching|we('re| are) launching|excited to announce|introducing|released|just launched|now live|available now|announcing|proud to introduce|unveiling|today we launch|now available|rolling out|going live)\b/i,
      extract: (text) => {
        const nameMatch = text.match(/\b(?:launching|introducing|announcing|unveiling|released|rolling out)\s+(?:our\s+)?(["']?[A-Z][\w\s'-]{2,40}["']?)/i);
        return { productName: nameMatch?.[1]?.trim() || 'a new product' };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> just launched <strong>${data.productName}</strong>. First-mover outreach in the next 7 days has 3× higher reply rates.`,
    },
    {
      type: 'FUNDING_ANNOUNCED',
      emoji: '💰',
      label: 'Funding Round Announced',
      priority: 'urgent',
      regex: /\b(raised|secured|closed|announced).{0,60}\$(\d+(?:\.\d+)?\s*(?:million|billion|M|B|K))\b|\b(seed|series [a-e]|pre-seed|growth round|funding round)\b/i,
      extract: (text) => {
        const amountMatch = text.match(/\$(\d+(?:\.\d+)?\s*(?:million|billion|M|B|K))/i);
        const roundMatch = text.match(/\b(seed|series [a-e]|pre-seed|growth round)\b/i);
        return { amount: amountMatch?.[0] || null, round: roundMatch?.[0] || null };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> just announced ${data.amount ? data.amount + ' in' : 'a'} ${data.round || 'funding'} round. New capital means new vendor evaluations — reach out this week.`,
    },
    {
      type: 'PARTNERSHIP_ANNOUNCED',
      emoji: '🤝',
      label: 'Partnership Announced',
      priority: 'week',
      regex: /\b(partnered with|partnership with|teamed up with|collaborating with|strategic alliance|integration with|joined forces with|working with|announcing our partnership)\b/i,
      extract: (text) => {
        const partnerMatch = text.match(/\b(?:partnered with|partnership with|teamed up with|collaborating with|integration with|working with)\s+([A-Z][\w\s&.,'-]{2,40})/i);
        return { partner: partnerMatch?.[1]?.trim() || 'a strategic partner' };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> just partnered with <strong>${data.partner}</strong>. Partnerships unlock new vendor relationships — ideal time to introduce your solution.`,
    },
    {
      type: 'AWARD_RECOGNITION',
      emoji: '🏆',
      label: 'Award / Recognition',
      priority: 'watch',
      regex: /\b(awarded|won|recognized|named|honored|received|G2 leader|gartner|forrester|top company|best place to work|award|recognition|certified)\b/i,
      extract: (text) => {
        const awardMatch = text.match(/\b(?:won|awarded|named|recognized as|received)\s+(?:the\s+)?(["']?[\w\s&'-]{3,60}(?:award|recognition|leader|winner|certified)["']?)/i);
        return { award: awardMatch?.[1]?.trim() || 'an industry award' };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> was recognized for <strong>${data.award}</strong>. Congrats messages get 4× more replies — use this as your opener.`,
    },
    {
      type: 'HIRING_CALLOUT',
      emoji: '💼',
      label: 'Actively Hiring (LinkedIn Post)',
      priority: 'week',
      regex: /\b(we('re| are) hiring|now hiring|open roles|looking for|join our team|job opening|open position|we want you|come work with us|talent acquisition|grow our team|expanding our team|looking to hire)\b/i,
      extract: (text) => {
        const roleMatch = text.match(/\b(?:hiring|looking for|seeking)\s+(?:a\s+)?([A-Z][\w\s&'-]{2,40})/i);
        return { role: roleMatch?.[1]?.trim() || 'multiple roles' };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> is publicly calling out hiring for <strong>${data.role}</strong>. Scaling teams need tools — reach out to the hiring manager.`,
    },
    {
      type: 'MARKET_EXPANSION',
      emoji: '🌍',
      label: 'Market Expansion',
      priority: 'week',
      regex: /\b(expanding to|entering|new market|launch in|now available in|going global|international expansion|new office in|new region|new city|new country|growing in)\b/i,
      extract: (text) => {
        const marketMatch = text.match(/\b(?:expanding to|entering|launch in|new office in|now available in|growing in)\s+([A-Z][\w\s,&'-]{2,40})/i);
        return { market: marketMatch?.[1]?.trim() || 'a new market' };
      },
      getWhyText: (data, company) =>
        `<strong>${company}</strong> is expanding into <strong>${data.market}</strong>. New market entries require new vendor stacks — strong timing to reach out.`,
    },
  ];

  posts.forEach((post, idx) => {
    const text = (typeof post === 'string' ? post : (post.text || post.content || post.commentary || post.description || JSON.stringify(post)));
    if (!text || text.length < 20) return;

    for (const pattern of patterns) {
      if (pattern.regex.test(text)) {
        const extracted = pattern.extract(text);
        signals.push({
          type: pattern.type,
          emoji: pattern.emoji,
          label: pattern.label,
          priority: pattern.priority,
          why: pattern.getWhyText(extracted, companyName || 'This company'),
          postSnippet: text.slice(0, 280).trim(),
          postIndex: idx,
          detectedAt: new Date().toISOString(),
          ...extracted,
        });
        break; // One signal per post max
      }
    }
  });

  return signals;
}

function cleanXmlEntities(str) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
