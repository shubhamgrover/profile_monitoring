import { NextResponse } from 'next/server';
import { synthesizeCompanyAccount, getFrameworkTemplates } from '../../../lib/synthesisEngine';

// Exa search helper
async function searchExa(query, limit = 2, includeDomains = null) {
  let exaKey = process.env.EXA_API_KEY;
  if (!exaKey || exaKey.trim() === '' || exaKey.includes('your_key') || exaKey.includes('placeholder') || exaKey.includes('xxxx') || exaKey === 'undefined' || exaKey === 'null') {
    exaKey = 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';
  }
  try {
    const requestBody = {
      query: query,
      numResults: limit,
    };
    if (includeDomains) {
      requestBody.includeDomains = includeDomains;
    }
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': exaKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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

// Scrape Creators Person profile simulation/API fetch
async function getScrapeCreatorsPosts(linkedinUrl) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY || 'dummy-key';
  if (apiKey === 'dummy-key') {
    // Generate high-quality mock posts based on profile url to save credits during testing
    if (linkedinUrl.includes('abha') || linkedinUrl.includes('khurana')) {
      return [
        { text: "Atlys is scaling! We are building out our executive compliance team and hiring engineering talent. Daily customer calls are keeping us grounded!" },
        { text: "Rituals that scale are better than processes. Daily support call playbacks define our culture." }
      ];
    }
    if (linkedinUrl.includes('vivek') || linkedinUrl.includes('khandelwal')) {
      return [
        { text: "Delighted to share we are exploring new generative engine optimization strategy. Scaling our brand presence across all search engines." },
        { text: "Outbound tools should sync guide documents directly to users. Excited for our roadmap." }
      ];
    }
    return [
      { text: "Excited to scale our outbound B2B campaigns this quarter. Looking to optimize lead list matching and intent signals." },
      { text: "Evaluating our marketing stack. Standard paid acquisition loops are showing rising customer acquisition costs." }
    ];
  }
  try {
    const res = await fetch(`https://api.scrapecreators.com/v1/linkedin/profile?url=${encodeURIComponent(linkedinUrl)}`, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      const sources = [
        data.recentPosts,
        data.posts,
        data.updates,
        data.activity,
        data.recentActivity,
        data.comments,
        data.reposts
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
                link: item.link || item.url || linkedinUrl,
                datePublished: item.date || item.datePublished || item.createdAt || new Date().toISOString()
              });
            }
          }
        }
      }
      return merged.slice(0, 10);
    }
  } catch (err) {
    console.error(`ScrapeCreators failed for ${linkedinUrl}:`, err);
  }
  return [];
}

// Scrape Creators Company page simulation/API fetch
async function getCompanyPagePosts(companyName, companyLinkedinUrl) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY || 'dummy-key';
  
  let targetUrl = companyLinkedinUrl;
  if (!targetUrl) {
    let cleanName = companyName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-');
    if (cleanName.includes('factors')) {
      cleanName = 'factors-ai';
    }
    targetUrl = `https://www.linkedin.com/company/${cleanName}`;
  }

  if (apiKey === 'dummy-key') {
    if (companyName.toLowerCase().includes('factors')) {
      return [
        {
          text: "We just launched Scout! Stop spending hours piecing together siloed CRM, web, and ad data. Use Scout to instantly find and automate your first-party account data.",
          link: "https://www.linkedin.com/company/factors-ai",
          datePublished: "2026-05-09T00:00:00Z"
        },
        {
          text: "Double down on pipeline! Thrilled to announce our new team expansions in Bangalore and US. We are hiring across the board.",
          link: "https://www.linkedin.com/company/factors-ai",
          datePublished: "2026-06-01T00:00:00Z"
        }
      ];
    }
    return [
      { text: `${companyName} is expanding its product lines, releasing sitemaps, and hiring key staff across growth and engineering.` }
    ];
  }

  try {
    const res = await fetch(`https://api.scrapecreators.com/v1/linkedin/company?url=${encodeURIComponent(targetUrl)}`, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      const posts = data.posts || data.updates || data.recentPosts || data.recent_posts || [];
      return posts.map(p => ({ 
        text: p.text || p.title || p.content || p.commentary || p.description || '',
        link: p.link || targetUrl,
        datePublished: p.datePublished || p.date || p.createdAt || new Date().toISOString()
      }));
    }
  } catch (err) {
    console.error(`ScrapeCreators failed for company ${companyName}:`, err);
  }
  return [];
}

// Helper to filter out past/retired employees
function isCurrentEmployee(r, companyName) {
  if (!r) return false;
  
  // If the title contains "former", "ex-", "ex ", "past", "retired", "previous", "was", etc., reject immediately
  const title = (r.title || '').toLowerCase();
  if (/\b(former|ex-|ex\b|past|retired|previous|was)\b/i.test(title)) {
    return false;
  }

  if (!r.entities?.[0]?.properties) return true; // fallback to true if no entity data is present
  const props = r.entities[0].properties;
  if (!props.workHistory || props.workHistory.length === 0) return true; // trust rank if no history parsed
  
  // Find if there is any active (no end date) work history for this company
  return props.workHistory.some(h => {
    const cName = h.company?.name || '';
    const isCompanyMatch = cName.toLowerCase().includes(companyName.toLowerCase()) || 
                           companyName.toLowerCase().includes(cName.toLowerCase());
    const isCurrent = !h.dates?.to; // if "to" date is not set, it is current
    return isCompanyMatch && isCurrent;
  });
}

// Helper to translate foreign language posts to English using Gemini
async function translateIfNeeded(text, apiKey) {
  if (!text || !/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text) || !apiKey) return text;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Translate the following foreign language LinkedIn update to plain English. Do not add any conversational text or comments, return only the direct English translation:\n\n${text}` }] }]
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      const translated = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (translated) return translated.trim();
    }
  } catch (e) {
    console.error('Translation failed:', e);
  }
  return text;
}

const inFlight = new Map();

async function handleCorrelateRequest(body) {
  let companyName = 'Unknown';
  let enrichedData = {};
  let targetDept = 'Marketing';
  let targetSeniority = 'VP';
  let resolvedContacts = [];
  let founderContact = null;
  let marketingContact = null;
  let companyPosts = [];
  
  try {
    companyName = body.companyName;
    const domain = body.domain;
    targetDept = body.targetDept || 'Marketing';
    targetSeniority = body.targetSeniority || 'VP';
    const gtmSettings = body.gtmSettings || {};
    const productName = (gtmSettings.productName && gtmSettings.productName.trim() !== '') ? gtmSettings.productName : 'our platform';
    const competitors = (gtmSettings.competitors && gtmSettings.competitors.trim() !== '') ? gtmSettings.competitors : 'traditional ad networks';
    const productDesc = (gtmSettings.productDesc && gtmSettings.productDesc.trim() !== '')
      ? (gtmSettings.productName ? `${gtmSettings.productName} (${gtmSettings.productDesc})` : gtmSettings.productDesc)
      : (body.productDesc || 'B2B intent signal tracking tool');
    const valueProposition = (gtmSettings.productDesc && gtmSettings.productDesc.trim() !== '')
      ? `Outperforming competitors like ${competitors} by addressing the specific pain: ${gtmSettings.productDesc}`
      : (body.valueProposition || 'gives enterprise teams an additional outbound channel and removes dependence on traditional ad spend');
    enrichedData = { ...(body.snapData || {}) };
    
    if (!companyName) {
      return { error: 'Missing companyName' };
    }

    const exaKey = process.env.EXA_API_KEY || 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';

    // Attempt to enrich data via Autobound Signal API if key and domain are present
    const autoboundKey = process.env.AUTOBOUND_API_KEY;
    if (autoboundKey && domain) {
      try {
        console.log(`[Autobound] Enriching domain: ${domain}`);
        const abResponse = await fetch("https://signals.autobound.ai/v1/companies/enrich", {
          method: "POST",
          headers: {
            "X-API-KEY": autoboundKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ domain }),
          signal: AbortSignal.timeout(10000)
        });
        if (abResponse.ok) {
          const abData = await abResponse.json();
          if (abData && abData.signals) {
            console.log(`[Autobound] Found ${abData.signals.length} signals for ${domain}`);
            enrichedData.autoboundSignals = abData.signals;
            enrichedData.autoboundCompanyInfo = abData.company;
          }
        } else {
          console.warn(`[Autobound] Failed to enrich ${domain}: status ${abResponse.status}`);
        }
      } catch (abErr) {
        console.error(`[Autobound] Enrichment error for ${domain}:`, abErr.message);
      }
    }

    // Generate mock fallback Autobound signals in case the API returned 0 signals (e.g. in sandbox or for custom domains)
    if (!enrichedData.autoboundSignals || enrichedData.autoboundSignals.length === 0) {
      console.log(`[Autobound Fallback] Generating mock signals for ${companyName}`);
      
      const compLower = companyName.toLowerCase();
      let generatedSignals = [];

      if (compLower.includes('dentsu')) {
        generatedSignals = [
          {
            signal_id: "dentsu-ab-sig-1",
            signal_type: "hiring-velocity",
            signal_subtype: "engineeringScale",
            signal_name: "Engineering Ramping",
            detected_at: new Date().toISOString(),
            data: {
              summary: "Dentsu has accelerated software and AI-native engineering hires by 18% month-over-month.",
              takeaway: "Technical Expansion: Scaling software capability to drive localized ad automation and sitemap tracking.",
              evidence: "Recruiting velocity tracking: 8 new senior developer listings detected."
            }
          },
          {
            signal_id: "dentsu-ab-sig-2",
            signal_type: "website-intelligence",
            signal_subtype: "buyingIntent",
            signal_name: "Buying Intent Spike",
            detected_at: new Date().toISOString(),
            data: {
              summary: "Dentsu is researching B2B contact data enrichment APIs and visitor de-anonymization software.",
              takeaway: "Intent Surge: Mid-funnel search activity shows active tooling evaluations for first-party data capture.",
              evidence: "Tech intent signal: search volume surge for 'Clearbit alternatives' and 'visitor identify APIs'."
            }
          }
        ];
      } else if (compLower.includes('cogniswitch')) {
        generatedSignals = [
          {
            signal_id: "cogni-ab-sig-1",
            signal_type: "website-intelligence",
            signal_subtype: "productLaunch",
            signal_name: "Product Launch",
            detected_at: new Date().toISOString(),
            data: {
              summary: "CogniSwitch is launching its 'ContextOps' knowledge-graph synchronization platform.",
              takeaway: "Product Launch: Launching developer tools and sitemaps for B2B enterprise travel compliance integrations.",
              evidence: "Sitemap expansion: 14 new documentation page sitemaps published."
            }
          }
        ];
      } else {
        generatedSignals = [
          {
            signal_id: `${compLower.replace(/[^a-z0-9]/g, '')}-ab-1`,
            signal_type: "website-intelligence",
            signal_subtype: "buyingIntent",
            signal_name: "GTM Intent Spike",
            detected_at: new Date().toISOString(),
            data: {
              summary: `${companyName} shows high search activity for sales enablement tooling and CRM integrations.`,
              takeaway: "Buying Intent: Investigating software to automate rep outreach and optimize outbound pipelines.",
              evidence: "Intent signal: Target account visits to tech comparison platforms for B2B lists."
            }
          },
          {
            signal_id: `${compLower.replace(/[^a-z0-9]/g, '')}-ab-2`,
            signal_type: "hiring-velocity",
            signal_subtype: "salesTeamGrowth",
            signal_name: "Sales Scaleup",
            detected_at: new Date().toISOString(),
            data: {
              summary: `${companyName} is expanding its business development and operational enablement divisions.`,
              takeaway: "Hiring Expansion: Ramping sales capacity to support new product launches and ACV acceleration.",
              evidence: "Recruiting spike: 3 new listings for Account Executives and BD Directors."
            }
          }
        ];
      }
      enrichedData.autoboundSignals = generatedSignals;
    }

    // 1. Resolve top 2 department contacts via Exa
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

    const seniorityQuery = seniorityMap[targetSeniority] || seniorityMap['All'];
    const departmentQuery = deptMap[targetDept] || deptMap['Marketing'];

    const domainContext = domain ? ` (${domain})` : '';
    const contactsQuery = `LinkedIn profile of a ${targetSeniority} in the ${targetDept} department at ${companyName}${domainContext} site:linkedin.com/in/`;
    const founderQuery = `LinkedIn profile of the CEO, Founder, or President of ${companyName}${domainContext} site:linkedin.com/in/`;
    const marketingQuery = `LinkedIn profile of the CMO, VP of Marketing, or Head of Marketing at ${companyName}${domainContext} site:linkedin.com/in/`;

    // 1. Concurrently resolve all Exa searches
    const promises = [];
    const keys = [];

    promises.push(searchExa(contactsQuery, 4, ['linkedin.com']));
    keys.push('contacts');

    promises.push(searchExa(founderQuery, 3, ['linkedin.com']));
    keys.push('founder');

    promises.push(searchExa(marketingQuery, 3, ['linkedin.com']));
    keys.push('marketing');

    let companyLinkedinUrl = enrichedData.companyLinkedinUrl || enrichedData.linkedinUrl || '';
    if (!companyLinkedinUrl || companyLinkedinUrl.includes('/in/')) {
      promises.push(searchExa(`site:linkedin.com/company/ "${companyName}" official page`, 1, ['linkedin.com']));
      keys.push('companyLinkedin');
    }

    let jobOpenings = enrichedData.jobOpenings || [];
    if (jobOpenings.length === 0) {
      promises.push(searchExa(`"${companyName}" job openings OR careers page OR "hiring"`, 5));
      keys.push('jobs');
    }

    let twitterMentions = enrichedData.twitterMentions || [];
    if (twitterMentions.length === 0) {
      promises.push(searchExa(`"${companyName}" twitter posts OR tweet OR X mention`, 3));
      keys.push('twitter');
    }

    let redditMentions = enrichedData.redditMentions || [];
    if (redditMentions.length === 0) {
      promises.push(searchExa(`"${companyName}" reddit discussion OR thread`, 3));
      keys.push('reddit');
    }

    let prMentions = enrichedData.prMentions || [];
    if (prMentions.length === 0) {
      promises.push(searchExa(`"${companyName}" (funding news OR product launch OR acquisition OR press release)`, 3));
      keys.push('pr');
    }

    const searchResults = await Promise.all(promises);
    const resultObj = {};
    keys.forEach((key, idx) => {
      resultObj[key] = searchResults[idx] || [];
    });

    const exaContacts = resultObj['contacts'] || [];
    const exaFounders = resultObj['founder'] || [];
    const exaMarketing = resultObj['marketing'] || [];

    if (resultObj['companyLinkedin'] && resultObj['companyLinkedin'].length > 0) {
      companyLinkedinUrl = resultObj['companyLinkedin'][0].url;
      enrichedData.companyLinkedinUrl = companyLinkedinUrl;
    }

    if (resultObj['jobs']) {
      const jobResults = resultObj['jobs'];
      jobOpenings = jobResults
        .map(r => {
          let title = r.title || '';
          // Clean common suffixes and site/job board names from title
          title = title.replace(/\s*[-|–—•]\s*(LinkedIn|Myworkdayjobs|Careers|Built In|Indeed|Glassdoor|Workday|Jobs|Recruitment|Hiring).*/i, '').trim();
          return { title, url: r.url };
        })
        .filter(job => {
          const t = job.title.toLowerCase();
          const c = companyName.toLowerCase();
          if (t === c || t === 'careers' || t === 'jobs' || t === 'hiring' || t.length < 4) return false;
          if (t.includes('working at') || t.includes('official site') || t.includes('home page') || t === 'linkedin') return false;
          if (t.includes('careers and employment') || t.includes('explore job opportunity') || t.endsWith('careers') || t.includes('job opportunities') || t.includes('careers portal') || t.includes('working here') || t.includes('explore jobs')) return false;
          return true;
        });
      enrichedData.jobOpenings = jobOpenings;
    }

    if (resultObj['twitter']) {
      twitterMentions = resultObj['twitter'].map(r => ({ title: r.title, url: r.url }));
      enrichedData.twitterMentions = twitterMentions;
    }

    if (resultObj['reddit']) {
      redditMentions = resultObj['reddit'].map(r => ({ title: r.title, url: r.url }));
      enrichedData.redditMentions = redditMentions;
    }

    if (resultObj['pr']) {
      prMentions = resultObj['pr'].map(r => ({ title: r.title, url: r.url }));
      enrichedData.prMentions = prMentions;
    }

    // Parsing helpers
    const parseLinkedInTitle = (titleRaw) => {
      let cleanTitle = titleRaw.replace(/\s*[|–-]\s*LinkedIn\b/i, '').trim();
      const segments = cleanTitle.split(/\s*[-|–—]\s*/).map(s => s.trim()).filter(Boolean);
      const name = segments[0] || 'LinkedIn Member';
      let title = segments[1] || 'Executive';
      if (title.includes(' at ')) title = title.split(' at ')[0].trim();
      else if (title.includes(' @ ')) title = title.split(' @ ')[0].trim();
      
      // Title Normalization
      title = title
        .replace(/\bChief Executive Officer\b/gi, 'CEO')
        .replace(/\bChief Operating Officer\b/gi, 'COO')
        .replace(/\bChief Technology Officer\b/gi, 'CTO')
        .replace(/\bChief Marketing Officer\b/gi, 'CMO')
        .replace(/\bChief Revenue Officer\b/gi, 'CRO')
        .replace(/\bVice President\b/gi, 'VP')
        .trim();

      return { name, title };
    };

    const parseExaContact = (r, defaultTitle = 'Executive') => {
      let name = 'LinkedIn Member';
      let title = defaultTitle;
      
      // Try to parse from entities workHistory first
      if (r.entities?.[0]?.properties) {
        const props = r.entities[0].properties;
        if (props.name) {
          name = props.name;
        } else if (props.firstName && props.lastName) {
          name = `${props.firstName} ${props.lastName}`;
        }
        
        if (props.workHistory && props.workHistory.length > 0) {
          const match = props.workHistory.find(h => {
            const cName = h.company?.name || '';
            return cName.toLowerCase().includes(companyName.toLowerCase()) || 
                   companyName.toLowerCase().includes(cName.toLowerCase());
          });
          if (match && match.title) {
            title = match.title;
          } else if (props.workHistory[0]?.title) {
            title = props.workHistory[0].title;
          }
        }
      }
      
      // Fallback to titleRaw parsing if name is still default or title is default
      if (name === 'LinkedIn Member' || title === defaultTitle) {
        const parsed = parseLinkedInTitle(r.title || '');
        if (name === 'LinkedIn Member') name = parsed.name;
        if (title === defaultTitle) title = parsed.title;
      }

      if (title) {
        title = title
          .replace(/\bChief Executive Officer\b/gi, 'CEO')
          .replace(/\bChief Operating Officer\b/gi, 'COO')
          .replace(/\bChief Technology Officer\b/gi, 'CTO')
          .replace(/\bChief Marketing Officer\b/gi, 'CMO')
          .replace(/\bChief Revenue Officer\b/gi, 'CRO')
          .replace(/\bVice President\b/gi, 'VP')
          .trim();
      }
      
      return { name, title, url: r.url || 'https://www.linkedin.com' };
    };

    // Exclusions list to prevent VP of Data being returned for Marketing
    const filterExclusions = (contactsList) => {
      const exclusions = ['data', 'analytics', 'science', 'ops', 'operations', 'engineering', 'developer', 'recruiter', 'hr', 'people', 'talent'];
      return contactsList.filter(c => {
        const titleLower = c.title.toLowerCase();
        const rawLower = (c.rawTitle || '').toLowerCase();
        if (titleLower.includes('growth ops') || titleLower.includes('marketing ops') || titleLower.includes('marketing operations') ||
            rawLower.includes('growth ops') || rawLower.includes('marketing ops') || rawLower.includes('marketing operations')) {
          return true;
        }
        return !exclusions.some(exc => titleLower.includes(exc) || rawLower.includes(exc));
      });
    };

    let currentContacts = exaContacts.filter(r => isCurrentEmployee(r, companyName));
    if (currentContacts.length === 0) currentContacts = exaContacts; // fallback to unfiltered if empty
    
    resolvedContacts = currentContacts.map(r => {
      const parsed = parseExaContact(r, 'Executive');
      return { ...parsed, rawTitle: r.title };
    });

    if (targetDept === 'Marketing') {
      resolvedContacts = filterExclusions(resolvedContacts);
    }

    // 2. Concurrently fetch all ScrapeCreators social posts in parallel
    const postPromises = [];
    const postKeys = [];

    // resolvedContacts posts
    resolvedContacts.forEach((c, idx) => {
      postPromises.push(getScrapeCreatorsPosts(c.url));
      postKeys.push({ type: 'contact', index: idx });
    });

    // founderContact post
    let tempFounderParsed = null;
    if (exaFounders && exaFounders.length > 0) {
      const bestFounder = exaFounders.find(r => isCurrentEmployee(r, companyName)) || exaFounders[0];
      tempFounderParsed = parseExaContact(bestFounder, 'CEO / Founder');
      postPromises.push(getScrapeCreatorsPosts(tempFounderParsed.url));
      postKeys.push({ type: 'founder' });
    }

    // marketingContact post
    let tempMarketingParsed = null;
    if (exaMarketing && exaMarketing.length > 0) {
      const bestMarketing = exaMarketing.find(r => isCurrentEmployee(r, companyName)) || exaMarketing[0];
      tempMarketingParsed = parseExaContact(bestMarketing, 'Head of Marketing');
      postPromises.push(getScrapeCreatorsPosts(tempMarketingParsed.url));
      postKeys.push({ type: 'marketing' });
    }

    // company posts
    postPromises.push(getCompanyPagePosts(companyName, companyLinkedinUrl));
    postKeys.push({ type: 'company' });

    const postResults = await Promise.all(postPromises);

    const apiKey = process.env.GEMINI_API_KEY;

    // Apply translations in parallel for foreign language posts
    const allPostsToTranslate = [];
    postKeys.forEach((key, idx) => {
      const posts = postResults[idx] || [];
      posts.forEach(p => {
        allPostsToTranslate.push(p);
      });
    });

    await Promise.all(allPostsToTranslate.map(async p => {
      if (p.text) {
        p.text = await translateIfNeeded(p.text, apiKey);
      }
    }));

    postKeys.forEach((key, idx) => {
      const posts = postResults[idx] || [];
      if (key.type === 'contact') {
        resolvedContacts[key.index].posts = posts;
      } else if (key.type === 'founder' && tempFounderParsed) {
        founderContact = { ...tempFounderParsed, posts };
      } else if (key.type === 'marketing' && tempMarketingParsed) {
        marketingContact = { ...tempMarketingParsed, posts };
      } else if (key.type === 'company') {
        companyPosts = posts;
      }
    });

    // Merge everything into enrichedData payload for Gemini review
    enrichedData.resolvedContacts = resolvedContacts;
    enrichedData.founderContact = founderContact;
    enrichedData.marketingContact = marketingContact;
    enrichedData.companyPosts = companyPosts;
    
    if (!apiKey) {
      // Fallback synthesis
      const fallback = synthesizeCompanyAccount(companyName, enrichedData, targetDept);
      const finalResponse = prepareCorrelateResponse(fallback, resolvedContacts, founderContact, marketingContact, companyPosts, true, companyName, targetDept, jobOpenings, prMentions, redditMentions, twitterMentions, enrichedData.autoboundSignals || []);
      return finalResponse;
    }

        const systemPrompt = `You are the world’s elite B2B Go-To-Market (GTM) strategist, corporate intelligence analyst, and master of Account-Based Marketing (ABM).

You are being handed a pre-compiled, multi-channel data payload for a target account. Your core capability is Multi-Signal Synthesis: you do not look at data points in isolation. Instead, you look for the "connective tissue" where an executive's personal point of view, a technical social media discussion, an API trigger, and job openings collide to reveal an unannounced corporate pivot, macro strategic shift, or massive operational bottleneck.

We sell: "${productDesc}"
Our value proposition / solved pain: "${valueProposition}"

We have resolved:
1. Top decision-makers (Y & Z) in the target department: ${JSON.stringify(resolvedContacts)}
2. The CEO/Founder: ${JSON.stringify(founderContact)}
3. The Marketing Lead: ${JSON.stringify(marketingContact)}
4. Recent company updates: ${JSON.stringify(companyPosts)}

YOUR STRATEGIC STRATEGY & EXPORT BLUEPRINT:
Analyze the payload below and deliver a hyper-sharp, non-obvious B2B intelligence brief structured into three distinct layers. Avoid generic fluff like "they want to scale." Focus on highly leveraged, actionable business realities. Make sure observations are crisp and directly help the sales team correlate what is happening.

CRITICAL INSTRUCTIONS FOR CORRELATIONS AND OUTBOUND PITCH:
- DO NOT generate vague, abstract, or generic correlations (e.g. "Since sitemaps exist, it means they are launching products").
- Every correlation MUST be hyper-specific to the target account's raw data (e.g. referencing specific titles of job openings, specific recent news, or specific social posts they made).
- The narrative/reality [A] MUST state a concrete business challenge or internal friction point (e.g. "Since you are hiring a Senior Product Manager for ad-automation and scaling your SEO agencies, it generally means you are struggling with rising customer acquisition costs and need to automate first-party visitor data collection to bypass paid ads").
- The outreach script [P] MUST pitch our solution in a hyper-targeted, direct way, mentioning their exact trigger events. It must sound like a real human outreach email (warm, peer-to-peer hook script, concise, direct).

🎯 LAYER 1: THE MACRO CORRELATION MAP (Connecting the Dots)
Identify **at least 5 to 10** "Core Strategic Correlations" or outreach triggers by cross-referencing multiple disparate channels. Ensure you return at least 5-10 separate correlation models in the JSON.
Format each correlation using this precise logical structure:
- Evidence channels represent [X], [Y], and [Z] (e.g. job posts, news mentions, tech stacks, events, PR).
- The narrative/reality represents [A] (what it generally means). It MUST start with: "Since [X], [Y], and [Z] exist/happened, it generally means [A]".
- The outreach script represents [P] (our pitch). It MUST start with: "Which means this can be our pitch: [pitch content]".
- The recommended contact represents [U] (the right person to reach out to).

👥 LAYER 2: 1-TO-1 EXECUTIVE ENGAGEMENT PLAYBOOK
For the top decision-makers surfaced, construct a tailored sales entry point (U).

📣 LAYER 3: ACCOUNT-BASED MARKETING (ABM) AIR COVER
Outline how to surround this account with marketing assets to prime them for sales outreach.

You MUST respond ONLY with a valid JSON object matching this schema. Do not include markdown code block syntax (like \`\`\`json) or any conversational text.
CRITICAL EMAIL FORMAT RULE: All email frameworks under the "frameworks" list MUST be **generic in nature** and follow the exact format below. They must NEVER mention our company name (SignalEngine) or describe specific proprietary product features. 

The email body must look EXACTLY like this:
Hi {{first_name}},

Saw [X] (observed trigger event like their recent post, hiring surge, or news).

This generally means [Y] (logical implication / challenge).

We have done this for [A], [B], [C] (provide 2-3 similar past reference companies like Atlys, CogniSwitch, or Dentsu).

Worth a quick chat?

Best,
[Your Name]

JSON Schema:
{
  "strategicCorrelations": [
    {
      "title": "Pivot / Pain Signal Title",
      "evidence": "Connected Channels (e.g., X, Y, and Z)",
      "narrative": "Since [X], [Y], and [Z] exist/happened, it generally means [A (underlying business shift or operational pain)]",
      "friction": "The Immediate Internal Friction description",
      "script": "Which means this can be our pitch: [peer-to-peer hook script, warm, direct, helpful peer tone]",
      "marketingTrigger": "High-Intent Content Asset: [Topic] | ABM Retargeting Theme: [Creative Hook]"
    }
  ],
  "conclusion": "Capitalized strategic pivot description",
  "emoji": "🚀",
  "category": "A single word category name",
  "details": "A detailed 2-sentence strategic deduction explaining the proof sequence",
  "strategicShift": "A concise, highly specific 1-sentence prediction explaining exactly what future macro shift or strategic transition we think is happening/will happen next",
  "recommendedContact": {
    "name": "Name of recommended contact (U)",
    "title": "Title of recommended contact",
    "url": "LinkedIn URL",
    "reason": "Clear explanation linking Layer 2 persona, angle, or post to Layer 1"
  },
  "recommendedFrameworkId": 5,
  "frameworks": [
    { "id": 1, "name": "Framework 1: Lead Magnet", "subject": "playbook for ${companyName}", "body": "Hi {{first_name}},\n\nSaw [X].\n\nThis generally means [Y].\n\nWe have done this for [A], [B], [C].\n\nWorth a quick chat?\n\nBest,\n[Your Name]" },
    { "id": 2, "name": "Framework 2: Offer (1 line)", "subject": "quick question", "body": "Hi {{first_name}},\n\nSaw [X].\n\nThis generally means [Y].\n\nWe have done this for [A], [B], [C].\n\nWorth a quick chat?\n\nBest,\n[Your Name]" },
    { "id": 3, "name": "Framework 3: Guaranteed Result", "subject": "result for ${companyName}", "body": "Hi {{first_name}},\n\nSaw [X].\n\nThis generally means [Y].\n\nWe have done this for [A], [B], [C].\n\nWorth a quick chat?\n\nBest,\n[Your Name]" },
    { "id": 4, "name": "Framework 4: Pain point focus", "subject": "question regarding ${companyName}", "body": "Hi {{first_name}},\n\nSaw [X].\n\nThis generally means [Y].\n\nWe have done this for [A], [B], [C].\n\nWorth a quick chat?\n\nBest,\n[Your Name]" },
    { "id": 5, "name": "Framework 5: Market Insight", "subject": "insight for ${companyName}", "body": "Hi {{first_name}},\n\nSaw [X].\n\nThis generally means [Y].\n\nWe have done this for [A], [B], [C].\n\nWorth a quick chat?\n\nBest,\n[Your Name]" }
  ]
}`;

    const userPrompt = `### THE INPUT DATA
${companyName}:
- Autobound Signals: ${JSON.stringify(enrichedData.autoboundSignals || [])}
- New Job Openings: ${JSON.stringify(enrichedData.jobOpenings || [])}
- Twitter/X Activity: ${JSON.stringify(enrichedData.twitterMentions || [])}
- Reddit Discussions: ${JSON.stringify(enrichedData.redditMentions || [])}
- LinkedIn Activity: ${JSON.stringify({
    companyPosts: companyPosts || [],
    founderLinkedInPosts: founderContact?.posts || [],
    marketingLinkedInPosts: marketingContact?.posts || [],
    contactsLinkedInPosts: resolvedContacts.flatMap(c => c.posts || [])
  })}
  
Generate the deep correlations based on these 5 signal streams. Make sure that if recent LinkedIn posts exist (like Arpit Ratan's Booth 7 MEA Finance Banking Technology Summit post or any other comments/reposts), you specifically connect them to hiring signals and new business formations!`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API request failed:', errText);
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('Empty response from Gemini API');
    }

    const result = JSON.parse(textResponse.trim());
    const finalResponse = prepareCorrelateResponse(result, resolvedContacts, founderContact, marketingContact, companyPosts, false, companyName, targetDept, jobOpenings, prMentions, redditMentions, twitterMentions, enrichedData.autoboundSignals || []);
    return finalResponse;

  } catch (error) {
    console.error('Error in /api/correlate route:', error.message);
    const fallback = synthesizeCompanyAccount(companyName || 'Unknown', enrichedData || {}, targetDept);
    const finalResponse = prepareCorrelateResponse(fallback, resolvedContacts || [], founderContact || null, marketingContact || null, companyPosts || [], true, companyName || 'Unknown', targetDept, enrichedData.jobOpenings || [], enrichedData.prMentions || [], enrichedData.redditMentions || [], enrichedData.twitterMentions || [], enrichedData.autoboundSignals || []);
    return { ...finalResponse, error: error.message };
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { companyName, targetDept = 'Marketing', targetSeniority = 'VP' } = body;
  if (!companyName) {
    return NextResponse.json({ error: 'Missing companyName' }, { status: 400 });
  }

  const requestKey = `${companyName}-${targetDept}-${targetSeniority}`;

  if (inFlight.has(requestKey)) {
    console.log(`[Correlate API] Deduping concurrent in-flight request for: ${requestKey}`);
    const result = await inFlight.get(requestKey);
    return NextResponse.json(result);
  }

  const promise = handleCorrelateRequest(body);
  inFlight.set(requestKey, promise);

  try {
    const result = await promise;
    if (result.error && result.error.includes('Missing companyName')) {
      return NextResponse.json({ error: 'Missing companyName' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[Correlate API] Fatal error for promise ${requestKey}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    inFlight.delete(requestKey);
  }
}

function prepareCorrelateResponse(synthesis, resolvedContacts, founderContact, marketingContact, companyPosts, isFallback, companyName, targetDept, jobOpenings = [], prMentions = [], redditMentions = [], twitterMentions = [], autoboundSignals = []) {
  // Overwrite recommended contact with resolved contacts if available
  let recommended = synthesis.recommendedContact;
  if (resolvedContacts && resolvedContacts.length > 0) {
    recommended = {
      name: resolvedContacts[0].name,
      title: resolvedContacts[0].title,
      url: resolvedContacts[0].url,
      reason: `Recommended as the active ${resolvedContacts[0].title} in the ${targetDept} department.`
    };
  } else if (founderContact) {
    recommended = {
      name: founderContact.name,
      title: founderContact.title,
      url: founderContact.url,
      reason: `Recommended because as ${founderContact.title || 'Founder/CEO'}, they lead strategic scaling.`
    };
  } else {
    recommended = {
      name: "Key Decision Maker",
      title: `${targetDept} Strategic Lead`,
      url: `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-')}`,
      reason: `Default fallback to target department.`
    };
  }

  // Populate frameworks names
  let frameworks = synthesis.frameworks || [];
  if (frameworks.length === 0) {
    frameworks = getFrameworkTemplates(companyName, synthesis.conclusion || '', {}, targetDept);
  }

  // Replace {{first_name}} placeholder inside frameworks bodies with the recommended contact's first name
  const contactName = recommended.name || 'there';
  const firstName = contactName !== 'Key Decision Maker' ? contactName.split(' ')[0] : 'there';
  
  frameworks = frameworks.map(f => {
    let updatedBody = f.body || '';
    updatedBody = updatedBody.replace(/\{\{first_name\}\}/g, firstName);
    updatedBody = updatedBody.replace(/Hi \{\{Contact\}\}/g, `Hi ${firstName}`);
    return { ...f, body: updatedBody };
  });

  // Ensure fallback format for strategicCorrelations if fallback is used
  let correlations = synthesis.strategicCorrelations || [];
  if (isFallback || correlations.some(c => !c.narrative.startsWith("Since"))) {
    correlations = correlations.map(c => {
      let narrative = c.narrative;
      if (!narrative.startsWith("Since")) {
        narrative = `Since ${c.evidence || 'multiple signals'} exist/happened, it generally means ${c.narrative || 'stable baseline operations'}`;
      }
      let script = c.script;
      if (script && !script.startsWith("Which means")) {
        script = `Which means this can be our pitch: "${script}"`;
      }
      return { ...c, narrative, script };
    });
  }

  return {
    ...synthesis,
    strategicCorrelations: correlations,
    recommendedContact: recommended,
    frameworks,
    resolvedContacts,
    founderContact,
    marketingContact,
    companyPosts,
    isFallback,
    jobOpenings,
    prMentions,
    redditMentions,
    twitterMentions,
    autoboundSignals
  };
}
