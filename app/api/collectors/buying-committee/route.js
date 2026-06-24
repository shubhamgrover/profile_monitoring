import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { companyName, department = 'Marketing', seniority = 'VP', profileUrl, userId } = body;

    const apiKey = process.env.SCRAPECREATORS_API_KEY || 'cwG38owB6JPGD6YMF5VhTfrAeBn2';

    // If profileUrl is provided, scrape and update the profile via ScrapeCreators
    if (profileUrl) {
      console.log(`[Buying Committee] Scraping profile: ${profileUrl} via ScrapeCreators`);
      
      const res = await fetch(`https://api.scrapecreators.com/v1/linkedin/profile?url=${encodeURIComponent(profileUrl)}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
      });
      
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
        return merged.slice(0, 5);
      }

      let posts = [];
      let name = 'LinkedIn Member';
      let title = 'Executive';
      let companyNameFromProfile = companyName || '';
      let rawData = null;

      if (res.ok) {
        rawData = await res.json();
        
        // Normalize profile data
        const experience = rawData.experience || rawData.positions || [];
        const currentJob = experience.find(e => !e.endDate && !e.end_date) || experience[0] || {};
        
        name = rawData.name || (rawData.firstName ? `${rawData.firstName || ''} ${rawData.lastName || ''}`.trim() : '') || 'LinkedIn Member';
        title = currentJob.title || currentJob.position || rawData.headline || 'Executive';
        companyNameFromProfile = currentJob.name || currentJob.company || currentJob.companyName || rawData.company || companyName || '';
        posts = extractLast5Posts(rawData);
      } else {
        console.error(`ScrapeCreators failed to fetch profile: ${res.statusText}`);
      }

      // Save/Upsert to Supabase profiles table to monitor this profile
      if (userId && (res.ok || profileUrl)) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Prepare snapshot
          const snapshot = {
            currentCompany: companyNameFromProfile,
            currentTitle: title,
            location: rawData?.location || rawData?.geoLocation || '',
            summary: rawData?.summary || rawData?.about || '',
            connections: rawData?.connections || rawData?.connectionsCount || 0,
            posts: posts,
            polledAt: new Date().toISOString()
          };

          // Find if profile already exists to get its snapshots array
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('linkedin_url', profileUrl)
            .maybeSingle();

          let snapshots = existingProfile?.snapshots || [];
          // Upsert snapshot: prepend if new, limit to 10
          snapshots = [snapshot, ...snapshots.slice(0, 9)];

          const record = {
            id: existingProfile?.id || crypto.randomUUID(),
            name: name,
            linkedin_url: profileUrl,
            company: companyNameFromProfile,
            title: title,
            status: 'active',
            last_polled: new Date().toISOString(),
            snapshots: snapshots,
            user_id: userId
          };

          const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert(record, { onConflict: 'linkedin_url' });

          if (upsertErr) {
            console.error('[Buying Committee] Error upserting scraped profile to Supabase:', upsertErr.message);
          } else {
            console.log('[Buying Committee] Successfully upserted scraped profile to monitored profiles:', name);
          }
        } catch (supabaseErr) {
          console.error('[Buying Committee] Supabase init or operation failed:', supabaseErr.message);
        }
      }

      return NextResponse.json({
        name,
        title,
        url: profileUrl,
        posts
      });
    }

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const exaKey = process.env.EXA_API_KEY || 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';

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

    // Query Exa to find LinkedIn profiles of key decision-makers at the company
    let query = `site:linkedin.com/in/ "${companyName}" ${seniorityQuery} ${departmentQuery}`;
    
    console.log(`[Buying Committee] Querying Exa for: "${companyName}" with query: ${query}`);

    let response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': exaKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        includeDomains: ['linkedin.com'],
        numResults: 4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Exa API error: ${errorText}`);
    }

    let data = await response.json();
    let results = data.results || [];
    let isFallback = false;

    // Helper to map and filter contacts
    const mapAndFilter = (rawResults) => {
      let mapped = rawResults.map(r => {
        const { name, title } = parseLinkedInTitle(r.title, companyName);
        return {
          name: name || 'LinkedIn Member',
          title: title || 'Executive',
          url: r.url || 'https://www.linkedin.com',
          isFallback: isFallback,
          rawTitle: r.title || ''
        };
      });

      if (department === 'Marketing') {
        const exclusions = ['data', 'analytics', 'science', 'ops', 'operations', 'engineering', 'developer', 'recruiter', 'hr', 'people', 'talent'];
        mapped = mapped.filter(c => {
          const titleLower = c.title.toLowerCase();
          const rawLower = c.rawTitle.toLowerCase();
          if (titleLower.includes('growth ops') || titleLower.includes('marketing ops') || titleLower.includes('marketing operations') ||
              rawLower.includes('growth ops') || rawLower.includes('marketing ops') || rawLower.includes('marketing operations')) {
            return true;
          }
          return !exclusions.some(exc => titleLower.includes(exc) || rawLower.includes(exc));
        });
      } else if (department === 'Sales') {
        const exclusions = ['marketing', 'engineering', 'developer', 'recruiter', 'hr', 'people', 'talent', 'data', 'analytics'];
        mapped = mapped.filter(c => {
          const titleLower = c.title.toLowerCase();
          const rawLower = c.rawTitle.toLowerCase();
          return !exclusions.some(exc => titleLower.includes(exc) || rawLower.includes(exc));
        });
      }
      return mapped;
    };

    let contacts = mapAndFilter(results);

    if (contacts.length === 0) {
      // Fallback search to CEO / Founder
      const fallbackQuery = `site:linkedin.com/in/ "${companyName}" (CEO OR Founder OR President OR "Chief Executive")`;
      console.log(`[Buying Committee] No relevant results for ${department} at ${companyName}. Running fallback query: ${fallbackQuery}`);
      
      const fbResponse = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'x-api-key': exaKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: fallbackQuery,
          includeDomains: ['linkedin.com'],
          numResults: 4,
        }),
      });

      if (fbResponse.ok) {
        const fbData = await fbResponse.json();
        const fbResults = fbData.results || [];
        isFallback = true;
        contacts = fbResults.map(r => {
          const { name, title } = parseLinkedInTitle(r.title, companyName);
          return {
            name: name || 'LinkedIn Member',
            title: title || 'Executive',
            url: r.url || 'https://www.linkedin.com',
            isFallback: true
          };
        });
      }
    }

    return NextResponse.json({ contacts, isFallback });
  } catch (error) {
    console.error('Error fetching buying committee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export function parseLinkedInTitle(titleRaw, companyName = '') {
  if (!titleRaw) return { name: 'LinkedIn Member', title: 'Executive' };

  // Remove common suffixes like "| LinkedIn", "- LinkedIn", etc.
  let cleanTitle = titleRaw.replace(/\s*[|–-]\s*LinkedIn\b/i, '').trim();

  // Split by common delimiters: " - ", " | ", " – " (en dash), " — " (em dash)
  const segments = cleanTitle.split(/\s*[-|–—]\s*/).map(s => s.trim()).filter(Boolean);

  if (segments.length === 0) {
    return { name: 'LinkedIn Member', title: 'Executive' };
  }

  const name = segments[0];

  // If there's only 1 segment (no delimiters), try to see if it contains " at " or " @ "
  if (segments.length === 1) {
    const atParts = name.split(/\s+at\s+|\s+@\s+/i);
    if (atParts.length > 1) {
      return {
        name: atParts[0].trim(),
        title: atParts[1].trim() || 'Executive'
      };
    }
    return { name: name, title: 'Executive' };
  }

  // If we have multiple segments, let's identify which one is the title.
  // Standard priority list of job title keywords:
  const jobKeywords = [
    'ceo', 'cfo', 'cmo', 'cto', 'coo', 'cro', 'cpo', 'chro', 'founder', 'president',
    'vp', 'vice president', 'director', 'head', 'lead', 'manager', 'executive',
    'engineer', 'developer', 'marketer', 'marketing', 'sales', 'ops', 'operations',
    'product', 'partner', 'associate', 'specialist', 'recruiter', 'talent'
  ];

  let detectedTitle = '';
  // Check segments after the name
  for (let i = 1; i < segments.length; i++) {
    const segLower = segments[i].toLowerCase();
    
    // Skip if it matches companyName exactly (case-insensitive) or is too short
    if (companyName && (segLower === companyName.toLowerCase() || segLower.includes(companyName.toLowerCase()))) {
      continue;
    }

    // Check if it contains any of the job keywords
    const hasJobKeyword = jobKeywords.some(kw => segLower.includes(kw));
    if (hasJobKeyword) {
      detectedTitle = segments[i];
      break;
    }
  }

  // Fallback if no segment specifically matched job keywords:
  // Use the second segment, provided it doesn't match the company name
  if (!detectedTitle && segments[1]) {
    const segLower = segments[1].toLowerCase();
    if (!companyName || (segLower !== companyName.toLowerCase() && !segLower.includes(companyName.toLowerCase()))) {
      detectedTitle = segments[1];
    }
  }

  // If still nothing, default to first non-name segment or 'Executive'
  if (!detectedTitle) {
    detectedTitle = segments[1] || 'Executive';
  }

  // Clean up title if it contains "at Company" or "@ Company"
  if (detectedTitle.includes(' at ')) {
    detectedTitle = detectedTitle.split(' at ')[0].trim();
  } else if (detectedTitle.includes(' @ ')) {
    detectedTitle = detectedTitle.split(' @ ')[0].trim();
  }

  return {
    name: name,
    title: detectedTitle || 'Executive'
  };
}
