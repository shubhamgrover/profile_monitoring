const fs = require('fs');
const path = require('path');

function redesignFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace border-radius with 0
  content = content.replace(/borderRadius:\s*['"]?[^'"}0,]+['"]?/g, 'borderRadius: 0');
  content = content.replace(/borderRadius:\s*\d+/g, 'borderRadius: 0');

  // Replace background colors/active accents to Ad Momenta colors
  // --accent-blue, --accent-blue-glow, #3B82F6 -> #132D7D (deep navy blue) or #FF2A00 (orange-red)
  // Let's replace next button gradients or background blue highlights
  content = content.replace(/background:\s*'linear-gradient\(135deg,\s*#3B82F6,\s*#6366F1\)'/g, "background: '#132D7D'");
  content = content.replace(/background:\s*'linear-gradient\(135deg,\s*#a855f7,\s*#6366f1\)'/g, "background: '#FF2A00'");
  content = content.replace(/background:\s*'var\(--accent-blue-glow\)'/g, "background: 'rgba(19, 45, 125, 0.08)'");
  content = content.replace(/border:\s*'1px solid var\(--accent-blue\)'/g, "border: '1px solid #132D7D'");
  content = content.replace(/color:\s*'var\(--accent-blue\)'/g, "color: '#132D7D'");
  content = content.replace(/background:\s*'rgba\(59,\s*130,\s*246,\s*0\.12\)'/g, "background: 'rgba(19, 45, 125, 0.12)'");
  content = content.replace(/color:\s*'#3B82F6'/g, "color: '#132D7D'");
  content = content.replace(/background:\s*'#3B82F6'/g, "background: '#132D7D'");
  content = content.replace(/border:\s*`1px solid \${activeFrameworkId === f\.id \? '#3B82F6' : '#E2E8F0'}`/g, "border: `1px solid ${activeFrameworkId === f.id ? '#FF2A00' : '#E2E8F0'}`");
  content = content.replace(/color:\s*'#6366F1'/g, "color: '#132D7D'");
  content = content.replace(/background:\s*'rgba\(10,\s*102,\s*194,\s*0\.08\)'/g, "background: 'rgba(19, 45, 125, 0.08)'");
  content = content.replace(/border:\s*'1px solid rgba\(10,\s*102,\s*194,\s*0\.2\)'/g, "border: '1px solid rgba(19, 45, 125, 0.2)'");
  content = content.replace(/color:\s*'#0A66C2'/g, "color: '#132D7D'");

  // Outreach Target Persona banner styling:
  content = content.replace(/background:\s*'rgba\(255,\s*255,\s*255,\s*0\.03\)'/g, "background: '#F8F9FA'");
  content = content.replace(/border:\s*'1px solid rgba\(255,\s*255,\s*255,\s*0\.06\)'/g, "border: '1px solid var(--border)'");

  // Fix any remaining specific radii
  content = content.replace(/border-radius:\s*[^;}\s]+/gi, 'border-radius: 0px');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

redesignFile('components/SignalFeedPage.jsx');
redesignFile('components/Dashboard.jsx');
