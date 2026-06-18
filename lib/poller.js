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

  const response = await fetch(
    `${SCRAPECREATORS_BASE}/v1/linkedin/profile?url=${encodeURIComponent(linkedinUrl)}`,
    {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

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

  const response = await fetch(
    `${SCRAPECREATORS_BASE}/v1/linkedin/company?url=${encodeURIComponent(companyLinkedinUrl)}`,
    {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

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
        const personSnapshot = await pollPersonProfile(profile.linkedinUrl, apiKey);

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
            companyHeadcount: companySnapshot.headcount,
            companyFollowers: companySnapshot.followers,
            companyLastPost: companySnapshot.lastPost,
            posts: companySnapshot.posts || [],
          } : {}),
          polledAt: new Date().toISOString(),
        };
      }

      results.push({ profile, snapshot, success: true });

      yield {
        type: 'success',
        profileName: profile.name,
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

/**
 * Normalize raw ScrapeCreators person profile response
 * into a consistent snapshot format
 */
function normalizePersonSnapshot(raw) {
  // ScrapeCreators returns varying field structures
  // We normalize to our standard format
  const experience = raw.experience || raw.positions || [];
  const currentJob = experience.find(e => !e.endDate && !e.end_date) || experience[0] || {};

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
    recentPosts: raw.recentPosts || [],
    activity: raw.activity || [],
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
    posts: raw.posts || [],
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
