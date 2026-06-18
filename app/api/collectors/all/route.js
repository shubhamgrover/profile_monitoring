import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { companyName, companyDomain } = await request.json();

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const exaKey = process.env.EXA_API_KEY || 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';
    const firecrawlKey = process.env.FIRECRAWL_API_KEY || '';

    // 1. Resolve company domain (if not provided)
    let domain = companyDomain;
    if (!domain) {
      domain = await resolveCompanyDomain(companyName, exaKey);
    }

    // 2. Fetch external signals in parallel
    const [newsData, redditData, twitterData, youtubeChannelId, linkedInJobs] = await Promise.all([
      fetchPRMentions(companyName, domain),
      fetchRedditMentions(companyName),
      fetchTwitterMentions(companyName),
      resolveYoutubeChannelId(companyName, exaKey),
      fetchLinkedInJobs(companyName),
    ]);

    // 3. Fetch channel videos & sitemap links (nested parallel)
    const [youtubeVideos, sitemapLinks, fallbackJobs] = await Promise.all([
      fetchYoutubeVideos(youtubeChannelId),
      fetchSitemapLinks(domain, firecrawlKey),
      linkedInJobs.length === 0 ? fetchCareersPageJobs(domain) : Promise.resolve([]),
    ]);

    const jobs = linkedInJobs.length > 0 ? linkedInJobs : fallbackJobs;

    return NextResponse.json({
      prMentions: newsData,
      redditMentions: redditData,
      twitterMentions: twitterData,
      youtubeVideos: youtubeVideos,
      sitemapLinks: sitemapLinks,
      resolvedDomain: domain,
      jobOpenings: jobs,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 1. Google News PR RSS Fetcher
async function fetchPRMentions(companyName, domain) {
  try {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    const query = `"${companyName}" -site:${cleanDomain} -inurl:${cleanDomain} -site:ashbyhq.com -site:greenhouse.io -site:lever.co -site:indeed.com -site:glassdoor.com -site:linkedin.com`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        let title = decodeXmlEntities(titleMatch[1]);
        const link = linkMatch[1];
        const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString();

        // Strip source suffix (e.g. "- TechCrunch")
        title = title.replace(/\s+-\s+[^-]+$/, '').trim();

        const titleLower = title.toLowerCase();
        const isJobNoise = /hiring|vacancies|recruit|recruiting|developer|engineer|jobs|careers/i.test(titleLower);
        const isStockNoise = /stock price|nyse:|nasdaq:|zacks|marketwatch|investor relations|shares/i.test(titleLower);

        if (!isJobNoise && !isStockNoise) {
          items.push({ title, link, pubDate });
        }
      }
      if (items.length >= 3) break;
    }

    return items;
  } catch (err) {
    console.error('Error fetching PR mentions:', err);
    return [];
  }
}

// 2. Reddit Mentions Fetcher
async function fetchRedditMentions(companyName) {
  try {
    const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(companyName)}&sort=new`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"/);
      const authorMatch = entryXml.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/);
      const contentMatch = entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/);

      if (titleMatch && linkMatch) {
        const title = decodeXmlEntities(titleMatch[1]);
        const link = linkMatch[1];
        const author = authorMatch ? authorMatch[1].replace('/user/', '') : 'unknown';
        let content = contentMatch ? contentMatch[1] : '';

        content = content.replace(/<\/?[^>]+(>|$)/g, "");
        content = decodeXmlEntities(content).slice(0, 250).trim();

        items.push({ title, link, author, content });
      }
      if (items.length >= 3) break;
    }

    return items;
  } catch (err) {
    console.error('Error fetching Reddit mentions:', err);
    return [];
  }
}

// 3. Twitter / X Mentions Fetcher
async function fetchTwitterMentions(companyName) {
  try {
    const query = `"${companyName}" (site:twitter.com OR site:x.com)`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        let title = decodeXmlEntities(titleMatch[1]);
        const link = linkMatch[1];
        const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString();

        title = title.replace(/\s+-\s+[^-]+$/, '').trim();

        items.push({ text: title, url: link, pubDate });
      }
      if (items.length >= 3) break;
    }

    return items;
  } catch (err) {
    console.error('Error fetching Twitter mentions:', err);
    return [];
  }
}

// 4. Exa Domain Resolver
async function resolveCompanyDomain(companyName, apiKey) {
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${companyName} official website`,
        numResults: 3,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];
    const match = results.find(r => {
      const u = r.url?.toLowerCase() || '';
      return !u.includes('linkedin.com') && !u.includes('twitter.com') && !u.includes('x.com') &&
             !u.includes('facebook.com') && !u.includes('youtube.com') && !u.includes('instagram.com') &&
             !u.includes('crunchbase.com');
    });
    if (match) {
      const urlObj = new URL(match.url);
      return urlObj.hostname.replace('www.', '');
    }
  } catch (err) {
    console.error('Error resolving domain:', err);
  }
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}

// 5. Exa YouTube Channel ID Resolver
async function resolveYoutubeChannelId(companyName, apiKey) {
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `site:youtube.com/ "${companyName}" channel or brand`,
        includeDomains: ['youtube.com'],
        numResults: 3,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];
    const match = results.find(r => {
      const u = r.url?.toLowerCase() || '';
      return u.includes('/channel/') || u.includes('/c/') || u.includes('/@');
    });

    if (match) {
      const url = match.url;
      if (url.includes('/channel/')) {
        const parts = url.split('/channel/');
        return parts[parts.length - 1]?.split('/')[0]?.split('?')[0];
      }
      
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
        if (idMatch) return idMatch[1];
        const itempropMatch = html.match(/itemprop="channelId"\s+content="(UC[a-zA-Z0-9_-]{22})"/);
        if (itempropMatch) return itempropMatch[1];
      }
    }
  } catch (err) {
    console.error('Error resolving YouTube channel:', err);
  }
  return null;
}

// 6. YouTube RSS Feed Fetcher
async function fetchYoutubeVideos(channelId) {
  if (!channelId) return [];
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"/);
      const dateMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);
      
      if (titleMatch && linkMatch) {
        const title = decodeXmlEntities(titleMatch[1]);
        const link = linkMatch[1];
        const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString();

        items.push({ title, link, pubDate });
      }
      if (items.length >= 3) break;
    }
    return items;
  } catch (err) {
    console.error('Error fetching YouTube RSS:', err);
    return [];
  }
}

// 7. Firecrawl Map Link Fetcher
async function fetchSitemapLinks(domain, firecrawlKey) {
  if (!firecrawlKey) return [];
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://${domain}`,
        limit: 20,
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl Map API returned error: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data.links || [];
  } catch (err) {
    console.error('Error fetching sitemap links:', err);
    return [];
  }
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

// 8. LinkedIn Guest API Scraper
async function fetchLinkedInJobs(companyName) {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(companyName)}&location=worldwide`;
  let attempts = 0;
  const maxAttempts = 3;
  let html = '';
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (res.ok) {
        html = await res.text();
        break;
      } else {
        console.warn(`LinkedIn guest job search attempt ${attempts} failed with status: ${res.status}`);
      }
    } catch (err) {
      console.warn(`LinkedIn guest job search attempt ${attempts} threw error:`, err);
    }
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!html) return [];

  const jobCards = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = liRegex.exec(html)) !== null) {
    const cardHtml = match[1];

    // Extract title: class="base-search-card__title"
    const titleMatch = cardHtml.match(/class="[^"]*base-search-card__title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\//i);
    
    // Extract company: class="base-search-card__subtitle"
    const companyMatch = cardHtml.match(/class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\//i);

    // Extract location: class="job-search-card__location"
    const locationMatch = cardHtml.match(/class="[^"]*job-search-card__location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\//i);

    // Extract URL: look for the first link starting with /jobs/view/ or containing jobs/view
    const urlMatch = cardHtml.match(/href="([^"]*?linkedin\.com\/jobs\/view\/[^"]*?)"/i) || 
                     cardHtml.match(/href="([^"]*?\/jobs\/view\/[^"]*?)"/i) ||
                     cardHtml.match(/class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"/i);

    if (titleMatch && companyMatch) {
      let title = decodeXmlEntities(titleMatch[1].replace(/<\/?[^>]+(>|$)/g, "")).trim();
      let company = decodeXmlEntities(companyMatch[1].replace(/<\/?[^>]+(>|$)/g, "")).trim();
      let location = locationMatch ? decodeXmlEntities(locationMatch[1].replace(/<\/?[^>]+(>|$)/g, "")).trim() : 'Worldwide';
      let jobUrl = urlMatch ? urlMatch[1] : '';

      if (jobUrl && !jobUrl.startsWith('http')) {
        if (jobUrl.startsWith('//')) {
          jobUrl = 'https:' + jobUrl;
        } else {
          jobUrl = 'https://www.linkedin.com' + (jobUrl.startsWith('/') ? '' : '/') + jobUrl;
        }
      }

      // Strict Brand Filtering
      const companyClean = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const keywordClean = companyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      // Support sub-brands/variations (e.g. Instamart -> Swiggy)
      const isMatch = companyClean.includes(keywordClean) || keywordClean.includes(companyClean) ||
                      (companyClean.includes('instamart') && keywordClean.includes('swiggy')) ||
                      (keywordClean.includes('instamart') && companyClean.includes('swiggy'));

      if (isMatch && title && company) {
        jobCards.push({
          title,
          company,
          location,
          url: jobUrl,
          source: 'LinkedIn'
        });
      }
    }
  }

  return jobCards;
}

// 9. Careers Page Scraper Fallback
async function fetchCareersPageJobs(domain) {
  if (!domain) return [];
  
  const baseDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  const baseUrl = `https://${baseDomain}`;
  
  const testPaths = ['/careers', '/jobs', '/careers/open-positions', '/join-us'];
  let html = '';
  let successPath = '';

  for (const path of testPaths) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        html = await res.text();
        successPath = path;
        break;
      }
    } catch (err) {
      console.warn(`Careers page check failed for ${url}:`, err.message);
    }
  }

  if (!html) return [];

  const jobs = [];
  const seenTitles = new Set();
  const seenUrls = new Set();

  const aRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  const ctaNoise = /^(apply|apply now|view job|view openings|learn more|see details|read more|submit|apply today|join|join us|careers?|details|open roles?|search|explore|view details|link|click here|interested)$/i;

  while ((match = aRegex.exec(html)) !== null) {
    let href = match[1].trim();
    let text = match[2].replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, ' ').trim();

    const isJobLink = /\/(jobs|careers|vacancy|vacancies|openings|positions)\//i.test(href) ||
                      href.includes('job-board') || href.includes('greenhouse.io') || href.includes('lever.co') || href.includes('ashbyhq.com');

    if (isJobLink && text) {
      let fullUrl = href;
      if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        if (href.startsWith('//')) {
          fullUrl = 'https:' + href;
        } else {
          fullUrl = `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
        }
      }

      const textClean = decodeXmlEntities(text).trim();
      
      if (textClean.length < 3 || textClean.length > 100 || ctaNoise.test(textClean)) {
        continue;
      }

      if (!seenTitles.has(textClean.toLowerCase()) && !seenUrls.has(fullUrl)) {
        seenTitles.add(textClean.toLowerCase());
        seenUrls.add(fullUrl);
        jobs.push({
          title: textClean,
          company: domain,
          location: 'Remote / Headquarters',
          url: fullUrl,
          source: `Careers Page (${successPath})`
        });
      }
    }
    
    if (jobs.length >= 10) break;
  }

  return jobs;
}
