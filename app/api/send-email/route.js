import { NextResponse } from 'next/server';

async function validateLink(url) {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();

  // Special check for YouTube links: validate existence via oEmbed API
  if (lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/')) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  // Bypass server-side check for major platforms that block server requests (e.g. 403, 999)
  const bypassDomains = ['linkedin.com', 'twitter.com', 'x.com', 'reddit.com', 'techcrunch.com'];
  if (bypassDomains.some(domain => lowerUrl.includes(domain))) {
    return true;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.status >= 200 && response.status < 400;
  } catch (err) {
    clearTimeout(timeoutId);
    return false;
  }
}

export async function POST(request) {
  try {
    const { to, signals } = await request.json();

    if (!to) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ error: 'No signals provided' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY environment variable is missing' }, { status: 500 });
    }

    // Run parallel validation on all signal URLs in the payload
    const validatedSignals = await Promise.all(
      signals.map(async (s) => {
        const initialProofUrl = s.postUrl || s.linkedinUrl || (s.data && s.data.url);
        if (!initialProofUrl) return s;

        const isValid = await validateLink(initialProofUrl);
        if (isValid) {
          return s; // valid link, return original signal
        }

        const fallback = s.profileLinkedinUrl || s.linkedinUrl || 'https://www.linkedin.com';
        const safeFallback = fallback === initialProofUrl ? 'https://www.linkedin.com' : fallback;

        return {
          ...s,
          postUrl: s.postUrl === initialProofUrl ? safeFallback : s.postUrl,
          linkedinUrl: s.linkedinUrl === initialProofUrl ? safeFallback : s.linkedinUrl,
        };
      })
    );

    const finalSignals = filterAndSelectSignals(validatedSignals);

    const textContent = formatEmailText(finalSignals);
    const htmlContent = formatEmailHtml(finalSignals);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SignalEngine <onboarding@resend.dev>',
        to: to,
        subject: `⚡ SignalEngine Summary: ${new Date().toLocaleDateString()}`,
        text: textContent,
        html: htmlContent,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return NextResponse.json({ error: `Resend API Error: ${errorText}` }, { status: resendResponse.status });
    }

    const data = await resendResponse.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function filterAndSelectSignals(signals) {
  const priorityOrder = { urgent: 0, week: 1, watch: 2 };
  
  // 1. Group by company
  const grouped = {};
  for (const s of signals) {
    const comp = s.company || 'Unknown';
    if (!grouped[comp]) grouped[comp] = [];
    grouped[comp].push(s);
  }

  // 2. Sort signals inside each company by priority
  for (const comp in grouped) {
    grouped[comp].sort((a, b) => {
      const pa = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 99;
      const pb = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 99;
      return pa - pb;
    });
  }

  // 3. Sort companies by highest priority signal
  const companies = Object.keys(grouped).map(name => {
    const sigs = grouped[name];
    const highestPriority = sigs[0] ? (priorityOrder[sigs[0].priority] !== undefined ? priorityOrder[sigs[0].priority] : 99) : 99;
    return { name, sigs, highestPriority };
  });
  companies.sort((a, b) => a.highestPriority - b.highestPriority);

  // 4. Select signals: limit to 2 per company initially. Top up to 10 total if needed and available.
  const companySelections = companies.map(c => ({
    name: c.name,
    all: c.sigs,
    selected: []
  }));

  // Pass 1: Select up to 2 signals per company
  for (const cs of companySelections) {
    const toTake = cs.all.slice(0, 2);
    cs.selected.push(...toTake);
  }

  // Calculate current total
  let currentTotal = companySelections.reduce((sum, cs) => sum + cs.selected.length, 0);

  // Pass 2: If total < 10, top up round-robin starting from the 3rd signal
  if (currentTotal < 10) {
    let index = 2;
    let addedAny = true;
    while (currentTotal < 10 && addedAny) {
      addedAny = false;
      for (const cs of companySelections) {
        if (currentTotal >= 10) break;
        if (cs.all.length > index) {
          cs.selected.push(cs.all[index]);
          currentTotal++;
          addedAny = true;
        }
      }
      index++;
    }
  }

  // Combine back to flat array of selected signals, keeping company grouping order
  const finalSignals = [];
  for (const cs of companySelections) {
    finalSignals.push(...cs.selected);
  }

  return finalSignals;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>?/gm, '');
}

function extractTopic(why, label) {
  const cleanWhy = stripHtml(why);
  // Matches "posted about [topic]" stopping at a dot followed by space, dash, or end of string.
  // This avoids truncating decimal values like $3.6B.
  const postMatch = cleanWhy.match(/posted about (.*?)(?:\.\s|$|—)/i) || 
                    cleanWhy.match(/published a post about (.*?)(?:\.\s|$|—)/i);
  return postMatch ? postMatch[1].trim() : label;
}

function formatCompanyActionText(company, label, explanation) {
  const cleanLabel = label.toLowerCase();
  let action = '';

  if (cleanLabel.includes('series c')) {
    action = 'raised a Series C';
  } else if (cleanLabel.includes('major account win') || cleanLabel.includes('mandate win')) {
    action = 'secured a major account win';
  } else if (cleanLabel.includes('expanding') || cleanLabel.includes('expansion')) {
    action = 'is expanding';
  } else if (cleanLabel.includes('people-leader events') || cleanLabel.includes('hosting marketing summit') || cleanLabel.includes('d2c digital growth summit')) {
    action = 'is hosting a marketing/culture event';
  } else {
    action = `announced: "${label}"`;
  }

  return `Company ${company} ${action}, which means: ${explanation}`;
}

function formatCompanyActionHtml(company, label, explanation) {
  const cleanLabel = label.toLowerCase();
  let action = '';

  if (cleanLabel.includes('series c')) {
    action = 'raised a Series C';
  } else if (cleanLabel.includes('major account win') || cleanLabel.includes('mandate win')) {
    action = 'secured a major account win';
  } else if (cleanLabel.includes('expanding') || cleanLabel.includes('expansion')) {
    action = 'is expanding';
  } else if (cleanLabel.includes('people-leader events') || cleanLabel.includes('hosting marketing summit') || cleanLabel.includes('d2c digital growth summit')) {
    action = 'is hosting a marketing/culture event';
  } else {
    action = `announced: "${label}"`;
  }

  return `🏢 Company <strong>${company}</strong> ${action}, which means: ${explanation}`;
}

function formatEmailText(signals) {
  const grouped = {};
  const companyOrder = [];
  
  for (const s of signals) {
    const comp = s.company || 'Unknown';
    if (!grouped[comp]) {
      grouped[comp] = [];
      companyOrder.push(comp);
    }
    grouped[comp].push(s);
  }

  let text = "⚡ SignalEngine Intelligence Summary\n====================================\n\n";

  for (const comp of companyOrder) {
    text += `🏢 ${comp.toUpperCase()}\n------------------------------------\n`;
    grouped[comp].forEach(s => {
      const isPost = s.type === 'content_signal' || s.type === 'thought_leadership' || s.type === 'interest_signal';
      const isCompany = s.type === 'company_funding' || s.type === 'company_signal' || s.type === 'engagement_signal';

      if (isPost) {
        const topic = extractTopic(s.why, s.label);
        const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
        const authorPhrase = isCompanyProfile ? s.company : s.profile;
        text += `📝 ${authorPhrase} posted about ${topic}\n`;
        if (s.postUrl) text += `   Link: ${s.postUrl}\n`;
      } else if (isCompany) {
        const cleanWhy = stripHtml(s.why);
        text += `• ${formatCompanyActionText(s.company, s.label, cleanWhy)}\n`;
        if (s.postUrl) text += `   Link: ${s.postUrl}\n`;
      } else {
        const cleanWhy = stripHtml(s.why);
        const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
        const contactPhrase = isCompanyProfile ? s.company : s.profile;
        text += `⚡ ${contactPhrase}: ${s.label} - ${cleanWhy}\n`;
        if (s.linkedinUrl) text += `   Link: ${s.linkedinUrl}\n`;
      }
    });
    text += "\n";
  }

  return text;
}

function formatEmailHtml(signals) {
  const grouped = {};
  const companyOrder = [];
  
  for (const s of signals) {
    const comp = s.company || 'Unknown';
    if (!grouped[comp]) {
      grouped[comp] = [];
      companyOrder.push(comp);
    }
    grouped[comp].push(s);
  }

  let html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; margin-bottom: 24px; font-size: 18px; font-weight: 700; border-bottom: 2px solid #132D7D; padding-bottom: 8px; font-family: system-ui, sans-serif;">⚡ SignalEngine Intelligence Summary</h2>
  `;

  for (const comp of companyOrder) {
    const compSignals = grouped[comp];
    const priorityOrder = { urgent: 0, week: 1, watch: 2 };
    let highestPriority = 'watch';
    for (const s of compSignals) {
      if (s.priority === 'urgent') highestPriority = 'urgent';
      else if (s.priority === 'week' && highestPriority !== 'urgent') highestPriority = 'week';
    }

    const badgeColor = highestPriority === 'urgent' ? '#FF2A00' : highestPriority === 'week' ? '#132D7D' : '#64748b';

    html += `
      <div style="margin-bottom: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background-color: #132D7D; color: #ffffff; padding: 12px 16px; font-weight: 700; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #ffffff;">🏢 ${comp}</span>
          <span style="background-color: ${badgeColor}; color: #ffffff; font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: 600; text-transform: uppercase;">${highestPriority}</span>
        </div>
        <div style="padding: 16px;">
          <ul style="list-style-type: none; padding-left: 0; margin: 0;">
    `;

    compSignals.forEach(s => {
      const isPost = s.type === 'content_signal' || s.type === 'thought_leadership' || s.type === 'interest_signal';
      const isCompany = s.type === 'company_funding' || s.type === 'company_signal' || s.type === 'engagement_signal';

      html += `
        <li style="padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; list-style: none; line-height: 1.5;">
      `;

      if (isPost) {
        const topic = extractTopic(s.why, s.label);
        const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
        const authorPhrase = isCompanyProfile ? `<strong>${s.company}</strong>` : `<strong>${s.profile}</strong>`;

        html += `
          <div style="font-size: 13px; color: #334155;">
            📝 ${authorPhrase} posted about <em>${topic}</em>
          </div>
          ${s.postUrl ? `<div style="margin-top: 6px;"><a href="${s.postUrl}" target="_blank" style="font-size: 11px; color: #FF2A00; text-decoration: none; font-weight: 600;">🔗 Verify Proof</a></div>` : ''}
        `;
      } else if (isCompany) {
        const cleanWhy = stripHtml(s.why);
        html += `
          <div style="font-size: 13px; color: #334155;">
            ${formatCompanyActionHtml(s.company, s.label, cleanWhy)}
          </div>
          ${s.postUrl ? `<div style="margin-top: 6px;"><a href="${s.postUrl}" target="_blank" style="font-size: 11px; color: #FF2A00; text-decoration: none; font-weight: 600;">🔗 Verify Proof</a></div>` : ''}
        `;
      } else {
        const cleanWhy = stripHtml(s.why);
        const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
        const contactPhrase = isCompanyProfile ? `<strong>${s.company}</strong>` : `<strong>${s.profile}</strong>`;

        html += `
          <div style="font-size: 13px; color: #334155;">
            ⚡ ${contactPhrase}: <strong>${s.label}</strong> - ${cleanWhy}
          </div>
          ${s.linkedinUrl ? `<div style="margin-top: 6px;"><a href="${s.linkedinUrl}" target="_blank" style="font-size: 11px; color: #FF2A00; text-decoration: none; font-weight: 600;">🔗 View Contact</a></div>` : ''}
        `;
      }

      html += `</li>`;
    });

    html += `
          </ul>
        </div>
      </div>
    `;
  }

  html += `
      <div style="margin-top: 24px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        Sent automatically by SignalEngine · ${new Date().toLocaleString()}
      </div>
    </div>
  `;
  return html;
}
