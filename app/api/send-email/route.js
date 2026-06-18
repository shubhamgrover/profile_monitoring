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

    const textContent = formatEmailText(validatedSignals);
    const htmlContent = formatEmailHtml(validatedSignals);

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
  let text = "Here are the signals from the top companies uploaded:\n\n";

  signals.forEach(s => {
    const isPost = s.type === 'content_signal' || s.type === 'thought_leadership' || s.type === 'interest_signal';
    const isCompany = s.type === 'company_funding' || s.type === 'company_signal' || s.type === 'engagement_signal';

    if (isPost) {
      const topic = extractTopic(s.why, s.label);
      const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
      const authorPhrase = isCompanyProfile ? s.company : `${s.profile} from ${s.company}`;
      text += `📝 ${authorPhrase} posted about ${topic}\n`;
    } else if (isCompany) {
      const cleanWhy = stripHtml(s.why);
      text += `${formatCompanyActionText(s.company, s.label, cleanWhy)}\n`;
    } else {
      const cleanWhy = stripHtml(s.why);
      const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
      const contactPhrase = isCompanyProfile ? s.company : `${s.profile} (${s.company})`;
      text += `⚡ ${contactPhrase}: ${s.label} - ${cleanWhy}\n`;
    }
  });

  return text;
}

function formatEmailHtml(signals) {
  let html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; margin-bottom: 24px; font-size: 18px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; font-family: system-ui, sans-serif;">Here are the signals from the top companies uploaded:</h2>
      <ul style="list-style-type: none; padding-left: 0; margin: 0;">
  `;

  signals.forEach(s => {
    const isPost = s.type === 'content_signal' || s.type === 'thought_leadership' || s.type === 'interest_signal';
    const isCompany = s.type === 'company_funding' || s.type === 'company_signal' || s.type === 'engagement_signal';

    if (isPost) {
      const topic = extractTopic(s.why, s.label);
      const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
      const authorPhrase = isCompanyProfile ? `<strong>${s.company}</strong>` : `<strong>${s.profile}</strong> from <strong>${s.company}</strong>`;

      html += `
        <li style="padding: 14px; margin-bottom: 12px; background-color: #ffffff; border-radius: 6px; border-left: 4px solid #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05); list-style: none;">
          <div style="font-size: 13px; color: #334155; line-height: 1.5;">
            📝 ${authorPhrase} posted about <em>${topic}</em>
          </div>
          ${s.postUrl ? `<div style="margin-top: 6px;"><a href="${s.postUrl}" target="_blank" style="font-size: 11px; color: #3b82f6; text-decoration: none; font-weight: 600;">🔗 Verify Proof</a></div>` : ''}
        </li>
      `;
    } else if (isCompany) {
      const cleanWhy = stripHtml(s.why);
      html += `
        <li style="padding: 14px; margin-bottom: 12px; background-color: #ffffff; border-radius: 6px; border-left: 4px solid #ef4444; box-shadow: 0 1px 2px rgba(0,0,0,0.05); list-style: none;">
          <div style="font-size: 13px; color: #334155; line-height: 1.5;">
            ${formatCompanyActionHtml(s.company, s.label, cleanWhy)}
          </div>
          ${s.postUrl ? `<div style="margin-top: 6px;"><a href="${s.postUrl}" target="_blank" style="font-size: 11px; color: #3b82f6; text-decoration: none; font-weight: 600;">🔗 Verify Proof</a></div>` : ''}
        </li>
      `;
    } else {
      const cleanWhy = stripHtml(s.why);
      const isCompanyProfile = s.profile.toLowerCase() === s.company.toLowerCase();
      const contactPhrase = isCompanyProfile ? `<strong>${s.company}</strong>` : `<strong>${s.profile}</strong> (${s.company})`;

      html += `
        <li style="padding: 14px; margin-bottom: 12px; background-color: #ffffff; border-radius: 6px; border-left: 4px solid #10b981; box-shadow: 0 1px 2px rgba(0,0,0,0.05); list-style: none;">
          <div style="font-size: 13px; color: #334155; line-height: 1.5;">
            ⚡ ${contactPhrase}: <strong>${s.label}</strong> - ${cleanWhy}
          </div>
          ${s.linkedinUrl ? `<div style="margin-top: 6px;"><a href="${s.linkedinUrl}" target="_blank" style="font-size: 11px; color: #3b82f6; text-decoration: none; font-weight: 600;">🔗 View Contact</a></div>` : ''}
        </li>
      `;
    }
  });

  html += `
      </ul>
      <div style="margin-top: 24px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        Sent automatically by SignalEngine · ${new Date().toLocaleString()}
      </div>
    </div>
  `;
  return html;
}
