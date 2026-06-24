/**
 * CSV Parser Utility
 * Parses uploaded CSV file with LinkedIn profile + company URLs
 */

const REQUIRED_COLUMNS = ['name', 'linkedin_url'];
const OPTIONAL_COLUMNS = ['company', 'company_linkedin_url', 'email', 'title', 'notes'];

/**
 * Parse CSV text into profile objects
 * Supports flexible column names (case-insensitive, common aliases)
 */
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const headers = lines[0]
    .split(',')
    .map(h => h.trim().toLowerCase().replace(/[^a-z_\s]/g, '').replace(/\s+/g, '_'));

  // Map headers to our standard column names
  const columnMap = buildColumnMap(headers);

  const hasProfileUrl = 'linkedin_url' in columnMap;
  const hasCompanyUrl = 'company_linkedin_url' in columnMap;
  const hasCompany = 'company' in columnMap;
  const hasName = 'name' in columnMap || 'first_name' in columnMap;

  if (!hasProfileUrl && !hasCompanyUrl && !hasCompany && !hasName) {
    throw new Error(`Invalid CSV: Must contain at least one column (e.g., 'company', 'name', 'linkedin_url'). Found: ${headers.join(', ')}`);
  }

  const profiles = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const profile = {};

      for (const [standardName, colIndex] of Object.entries(columnMap)) {
        profile[standardName] = values[colIndex]?.trim() || '';
      }

      // If we have first_name and last_name but no full name, combine them!
      if (!profile.name && (profile.first_name || profile.last_name)) {
        profile.name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      }

      // Validate and normalize
      const validated = validateProfile(profile, i + 1);
      if (validated.error) {
        errors.push(validated.error);
      } else {
        profiles.push(validated.profile);
      }
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  return { profiles, errors, total: profiles.length };
}

/**
 * Map flexible header names to standard column names
 */
function buildColumnMap(headers) {
  const aliases = {
    name: ['name', 'full_name', 'person', 'contact', 'person_name'],
    first_name: ['first_name', 'first', 'given_name', 'firstname'],
    last_name: ['last_name', 'last', 'family_name', 'surname', 'lastname'],
    linkedin_url: ['linkedin_url', 'linkedin', 'profile_url', 'linkedin_profile', 'profile', 'url'],
    company: ['company', 'company_name', 'employer', 'organization', 'org'],
    company_linkedin_url: ['company_linkedin_url', 'company_linkedin', 'company_url', 'company_page'],
    email: ['email', 'email_address', 'contact_email'],
    title: ['title', 'job_title', 'position', 'role', 'current_title'],
    notes: ['notes', 'note', 'comment', 'comments'],
  };

  const map = {};
  for (const [standardName, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) {
        map[standardName] = idx;
        break;
      }
    }
  }
  return map;
}

/**
 * Validate and normalize a single profile row
 */
function validateProfile(profile, rowNum) {
  const errors = [];

  // Determine which LinkedIn URL is provided (can be person linkedin_url or company_linkedin_url)
  let mainUrl = profile.linkedin_url || profile.company_linkedin_url;
  const name = profile.name || '';
  const company = profile.company || '';
  
  if (!mainUrl) {
    if (!company && !name) {
      errors.push(`Row ${rowNum}: Either a name, company, or LinkedIn URL is required`);
      return { error: errors.join('; ') };
    }
    return {
      profile: {
        id: 'resolve-' + Math.random().toString(36).slice(2, 8),
        name: name || company || 'Unnamed Profile',
        linkedinUrl: '',
        company: company || name || '',
        companyLinkedinUrl: '',
        email: profile.email || '',
        title: profile.title || (company ? 'Company Monitoring' : ''),
        notes: profile.notes || '',
        addedAt: new Date().toISOString(),
        lastPolled: null,
        status: 'needs_resolution',
        snapshots: [],
        needsResolution: true
      }
    };
  }

  mainUrl = normalizeLinkedInUrl(mainUrl);
  if (!mainUrl) {
    errors.push(`Row ${rowNum}: Invalid LinkedIn URL format`);
    return { error: errors.join('; ') };
  }

  const urlType = mainUrl.includes('/company/') ? 'company' : 'person';
  
  // Name handling
  let finalName = name;
  if (!finalName) {
    if (urlType === 'company') {
      // Extract company handle/name from URL
      const parts = mainUrl.split('/company/');
      const handle = parts[parts.length - 1]?.replace(/\/+$/, '') || 'Company Page';
      finalName = cleanHandleToName(handle) || 'Company Page';
    } else {
      // Extract person handle/name from URL
      const parts = mainUrl.split('/in/');
      const handle = parts[parts.length - 1]?.replace(/\/+$/, '') || 'LinkedIn Profile';
      finalName = cleanHandleToName(handle) || 'LinkedIn Profile';
    }
  }

  if (errors.length > 0) {
    return { error: errors.join('; ') };
  }

  return {
    profile: {
      id: generateId(mainUrl),
      name: finalName,
      linkedinUrl: mainUrl,
      company: urlType === 'company' ? finalName : (company || ''),
      companyLinkedinUrl: urlType === 'company' ? mainUrl : (profile.company_linkedin_url ? normalizeLinkedInUrl(profile.company_linkedin_url, 'company') : ''),
      email: profile.email || '',
      title: urlType === 'company' ? 'Company Monitoring' : (profile.title || ''),
      notes: profile.notes || '',
      addedAt: new Date().toISOString(),
      lastPolled: null,
      status: 'pending',
      snapshots: [],
    }
  };
}

/**
 * Normalize LinkedIn URLs to standard format
 */
function normalizeLinkedInUrl(url, type = 'person') {
  if (!url) return null;
  url = url.trim().toLowerCase();

  // Add https if missing
  if (!url.startsWith('http')) url = 'https://' + url;

  // Check it's a LinkedIn URL
  if (!url.includes('linkedin.com')) return null;

  // Normalize protocol
  url = url.replace('http://', 'https://');

  // Ensure www. is present
  if (!url.includes('www.linkedin.com')) {
    url = url.replace('linkedin.com', 'www.linkedin.com');
  }

  // Remove query parameters
  url = url.split('?')[0];

  // Strip trailing slashes first
  url = url.replace(/\/+$/, '');

  // Add clean trailing slash back based on type
  if (url.includes('/company/')) {
    url = url + '/';
  } else if (url.includes('/in/')) {
    url = url + '/';
  }

  return url;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

/**
 * Generate a stable ID from a LinkedIn URL
 */
function generateId(url) {
  return url
    .replace('https://linkedin.com/in/', '')
    .replace('https://linkedin.com/company/', '')
    .replace(/\//g, '')
    .slice(0, 30) + '-' + Math.random().toString(36).slice(2, 6);
}

/**
 * Generate a sample CSV template for download
 */
export function generateCSVTemplate() {
  const headers = ['name', 'linkedin_url', 'company', 'company_linkedin_url', 'title', 'email'];
  const samples = [
    ['John Smith', 'https://linkedin.com/in/johnsmith', 'Acme Corp', 'https://linkedin.com/company/acme-corp', 'VP Sales', 'john@acme.com'],
    ['Sarah Lee', 'https://linkedin.com/in/sarahlee', 'TechCo', 'https://linkedin.com/company/techco', 'Director Marketing', 'sarah@techco.com'],
  ];

  const rows = [headers, ...samples].map(r => r.join(','));
  return rows.join('\n');
}

/**
 * Clean up a raw LinkedIn URL handle into a displayable name
 */
export function cleanHandleToName(handle) {
  if (!handle) return '';
  
  let name = handle;
  try {
    name = decodeURIComponent(handle);
  } catch (e) {
    // ignore
  }

  // Strip trailing linkedin alphanumeric hashes (typically -[a-f0-9]{7,11} or similar)
  name = name.replace(/-[a-zA-Z0-9]{7,12}$/i, '');

  // If handle contains degree/certifications or other trailing info (e.g. -bsc-acipm)
  // we can also replace hyphens, underscores, or periods with spaces
  name = name.replace(/[-_.]/g, ' ');

  // Capitalize each word
  name = name
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  return name.trim();
}
