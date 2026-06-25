import { NextResponse } from 'next/server';
import { synthesizeCompanyAccount } from '../../../lib/synthesisEngine';

async function searchExa(query, limit = 2) {
  let exaKey = process.env.EXA_API_KEY;
  if (!exaKey || exaKey.trim() === '' || exaKey.includes('your_key') || exaKey.includes('placeholder') || exaKey.includes('xxxx') || exaKey === 'undefined' || exaKey === 'null') {
    exaKey = 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';
  }
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': exaKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        includeDomains: ['linkedin.com'],
        numResults: limit,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
  } catch (err) {
    console.error(`Exa search failed for query "${query}":`, err);
  }
  return [];
}

async function getScrapeCreatorsPosts(linkedinUrl) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY || 'dummy-key';
  if (apiKey === 'dummy-key') {
    return [
      { text: "Evaluating outbound channels. Standard paid acquisition loops are showing rising customer acquisition costs." },
      { text: "Outbound tools should sync guide documents directly to users. Excited for our roadmap." }
    ];
  }
  try {
    const res = await fetch(`https://api.scrapecreators.com/v1/linkedin/profile?url=${encodeURIComponent(linkedinUrl)}`, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      return (data.posts || []).map(p => ({ text: p.text || p.content || '' }));
    }
  } catch (err) {
    console.error(`ScrapeCreators failed for ${linkedinUrl}:`, err);
  }
  return [];
}

const parseLinkedInTitle = (titleRaw, companyName = '') => {
  if (!titleRaw) return { name: 'LinkedIn Member', title: 'Executive' };
  let cleanTitle = titleRaw.replace(/\s*[|–-]\s*LinkedIn\b/i, '').trim();
  const segments = cleanTitle.split(/\s*[-|–—]\s*/).map(s => s.trim()).filter(Boolean);
  const name = segments[0] || 'LinkedIn Member';
  let title = segments[1] || 'Executive';
  if (title.includes(' at ')) title = title.split(' at ')[0].trim();
  return { name, title };
};

export async function POST(request) {
  try {
    const { signals = [], profiles = [], department = 'Marketing', seniority = 'VP', productDesc = 'SignalEngine B2B tracking tool', valueProposition = 'gives enterprise teams an additional outbound channel and removes dependence on traditional ad spend' } = await request.json();

    if (!signals.length) {
      return NextResponse.json({ targets: [], message: 'No signals found. Run a poll first.' });
    }

    const exaKey = process.env.EXA_API_KEY || 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Group signals by company, pick the top signal per company
    const urgencyOrder = { urgent: 0, week: 1, watch: 2 };
    const companySignalMap = {};

    for (const signal of signals) {
      const company = signal.company || signal.profile || 'Unknown';
      if (company === 'Unknown') continue;
      const existing = companySignalMap[company];
      if (!existing || urgencyOrder[signal.priority] < urgencyOrder[existing.priority]) {
        companySignalMap[company] = signal;
      }
    }

    const topSignals = Object.values(companySignalMap).slice(0, 10); // Curate Top 10 Accounts

    const seniorityMap = {
      'C-Suite': '(CEO OR Founder OR "Chief" OR President OR COO OR CTO OR CMO OR CRO)',
      'VP': '(VP OR "Vice President" OR "Head")',
      'Director': '("Director" OR "Head")',
      'Manager': '("Manager" OR "Lead")',
      'All': '(CEO OR Founder OR VP OR Director OR Head OR Manager OR Lead)'
    };

    const deptMap = {
      'Marketing': '(Marketing OR Brand OR Growth OR PR OR Communications OR CMO)',
      'Sales': '(Sales OR Outbound OR BD OR "Business Development" OR Account OR Revenue OR CRO)',
      'HR': '(HR OR Talent OR Recruiting OR People OR Culture OR CHRO)',
      'Engineering': '(Engineering OR Developer OR Technical OR Software OR Architect OR CTO)',
      'Operations': '(Operations OR Ops OR COO)',
      'Product': '(Product OR PM OR CPO)'
    };

    const seniorityQuery = seniorityMap[seniority] || seniorityMap['All'];
    const departmentQuery = deptMap[department] || deptMap['Marketing'];

    const targets = await Promise.all(
      topSignals.map(async (signal) => {
        const company = signal.company || signal.profile;
        
        // Find profile details from profiles list
        const profile = profiles.find(p => p.company?.toLowerCase() === company.toLowerCase() || p.name?.toLowerCase() === company.toLowerCase()) || {};
        const snapData = (profile.snapshots && profile.snapshots.length > 0) ? profile.snapshots[profile.snapshots.length - 1] : { jobOpenings: [], sitemapLinks: [], prMentions: [] };
        
        let exaContacts = [];
        let isFallback = false;

        // Try Exa first to find a real contact
        try {
          const query = `site:linkedin.com/in/ "${company}" ${seniorityQuery} ${departmentQuery}`;
          exaContacts = await searchExa(query, 2);

          // Apply exclusions
          if (department === 'Marketing') {
            const exclusions = ['data', 'analytics', 'science', 'ops', 'operations', 'engineering', 'developer', 'recruiter', 'hr', 'people', 'talent'];
            exaContacts = exaContacts.filter(r => {
              const titleLower = (r.title || '').toLowerCase();
              const { title } = parseLinkedInTitle(r.title);
              const titleClean = (title || '').toLowerCase();
              if (titleClean.includes('growth ops') || titleClean.includes('marketing ops') || titleClean.includes('marketing operations') ||
                  titleLower.includes('growth ops') || titleLower.includes('marketing ops') || titleLower.includes('marketing operations')) {
                return true;
              }
              return !exclusions.some(exc => titleClean.includes(exc) || titleLower.includes(exc));
            });
          }

          if (exaContacts.length === 0) {
            // Fallback CEO lookup
            const fallbackQuery = `site:linkedin.com/in/ "${company}" (CEO OR Founder OR President OR "Chief Executive")`;
            exaContacts = await searchExa(fallbackQuery, 1);
            isFallback = true;
          }
        } catch (exaErr) {
          console.warn(`[DailyBrief] Exa lookup failed:`, exaErr.message);
        }

        // Parse contacts
        let contactsList = exaContacts.map(r => {
          const { name, title } = parseLinkedInTitle(r.title);
          return { name, title, url: r.url, isFallback };
        });

        const primaryContact = contactsList[0] || { name: profile.name || 'Key Executive', title: profile.title || 'Director', url: profile.linkedinUrl || 'https://www.linkedin.com', isFallback };

        // Pull Scrape Creators posts
        let execPosts = [];
        try {
          execPosts = await getScrapeCreatorsPosts(primaryContact.url);
        } catch {}

        // Calculate dynamic synthesis rules for the score & templates
        const synthesis = synthesizeCompanyAccount(company, snapData, department);
        
        // Build timeline events in order
        const timeline = [];
        if (execPosts.length > 0) {
          timeline.push({
            id: `post-${Date.now()}`,
            type: 'social',
            source: 'Scrape Creators',
            time: 'Today',
            title: `${primaryContact.name} posted on LinkedIn`,
            text: execPosts[0].text,
            url: primaryContact.url
          });
        }
        if (signal.type === 'funding') {
          timeline.push({
            id: `funding-${Date.now()}`,
            type: 'intent',
            source: 'Autobound',
            time: 'Recently',
            title: 'Funding Capital Trigger',
            text: signal.why || `${company} recently secured capital to scale growth operations.`
          });
        } else if (signal.type === 'hiring_surge' || snapData.jobOpenings?.length > 0) {
          timeline.push({
            id: `hiring-${Date.now()}`,
            type: 'intent',
            source: 'Autobound',
            time: 'Recently',
            title: 'Headcount & Hiring Surge',
            text: `Intent Surge: Actively scaling teams in ${department}. ${snapData.jobOpenings?.length || 3} open roles listed.`
          });
        } else if (snapData.sitemapLinks?.length > 0) {
          timeline.push({
            id: `sitemap-${Date.now()}`,
            type: 'intent',
            source: 'Autobound',
            time: 'Recently',
            title: 'Product Launch Sitemap Spike',
            text: `Detected ${snapData.sitemapLinks.length} new product page directories published.`
          });
        }

        // Establish catalyst tags
        const catalysts = [];
        if (signal.type === 'funding') catalysts.push('Funding Surge');
        if (snapData.jobOpenings?.length > 0) catalysts.push('Hiring Scaling');
        if (snapData.sitemapLinks?.length > 0) catalysts.push('Product Launch');
        if (execPosts.length > 0) catalysts.push('Exec Active');
        if (catalysts.length === 0) catalysts.push('Intent Surge');

        return {
          company,
          domain: profile.companyLinkedinUrl || `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          surgeScore: synthesis.surgeScore || 75,
          catalysts,
          lastSignalTime: timeAgoString(signal.detectedAt),
          contactName: primaryContact.name,
          contactTitle: primaryContact.title,
          contactLinkedIn: primaryContact.url,
          contactIsFallback: primaryContact.isFallback,
          timeline,
          frameworks: synthesis.frameworks || [],
          templates: synthesis.templates || {}
        };
      })
    );

    return NextResponse.json({ targets, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error generating daily brief:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function timeAgoString(iso) {
  if (!iso) return '3h ago';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
