'use client';

import { useState } from 'react';

export default function LandingPage({ onGetStarted }) {
  const [accounts, setAccounts] = useState(150);
  const [trackExtraExecs, setTrackExtraExecs] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  // Calculate slots & pricing tier
  const slotsNeeded = accounts * (trackExtraExecs ? 3 : 2);
  let recommendedPlan = 'Starter Plan';
  let planPrice = '₹9,900';

  if (slotsNeeded > 100 && slotsNeeded <= 450) {
    recommendedPlan = 'Pro Plan';
    planPrice = '₹24,900';
  } else if (slotsNeeded > 450) {
    recommendedPlan = 'Scale Plan';
    planPrice = '₹49,900';
  }

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div style={{ backgroundColor: '#131318', color: '#e4e1e9', fontFamily: 'Inter, sans-serif', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Google Fonts and Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Geist:wght@400;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* Tailwind Class overrides and custom scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card {
          background: rgba(26, 26, 33, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .glow-border-blue:hover {
          border-color: rgba(183, 196, 255, 0.5);
          box-shadow: 0 0 20px rgba(19, 45, 125, 0.3);
        }
        .cta-glow:hover {
          box-shadow: 0 0 25px rgba(255, 42, 0, 0.6);
        }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}} />

      {/* Section 1: Navigation & Hero */}
      <header className="fixed top-0 w-full z-50 bg-[#131318]/80 backdrop-blur-md border-b border-white/10">
        <nav className="max-w-[1280px] mx-auto px-10 flex justify-between items-center h-20">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#e4e1e9', letterSpacing: '-0.04em', fontFamily: 'Geist, sans-serif' }}>
              signal<span style={{ color: '#FF2A00' }}>IQ</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a className="text-[#c5c5d3] hover:text-white transition-colors font-mono text-[12px] tracking-wider" href="#features">Features</a>
            <a className="text-[#c5c5d3] hover:text-white transition-colors font-mono text-[12px] tracking-wider" href="#pricing">Pricing</a>
            <a className="text-[#c5c5d3] hover:text-white transition-colors font-mono text-[12px] tracking-wider" href="#faq">FAQ</a>
            <button 
              onClick={onGetStarted}
              className="bg-[#FF2A00] text-white px-6 py-2.5 rounded-lg font-medium text-[14px] cta-glow transition-all active:scale-95 shadow-lg shadow-[#FF2A00]/20"
            >
              Sign In
            </button>
          </div>
          <button onClick={onGetStarted} className="md:hidden text-[#e4e1e9]">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </nav>
      </header>

      <main className="pt-32">
        {/* Hero Content */}
        <section className="max-w-[1280px] mx-auto px-10 text-center relative mb-24">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#132D7D]/10 blur-[120px] rounded-full -z-10"></div>
          <p className="font-mono text-[12px] tracking-widest text-[#FF2A00] uppercase mb-6">Stop wasting ad spend on cold databases.</p>
          <h1 className="font-bold text-[48px] md:text-[64px] max-w-4xl mx-auto mb-8 text-[#e4e1e9] leading-tight font-sans tracking-tight">
            Turn Buying Intent and Executive Activity into <span style={{ color: '#FF2A00' }}>Warm Conversations.</span>
          </h1>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16">
            <button 
              onClick={onGetStarted}
              className="bg-[#FF2A00] text-white px-10 py-4 rounded-xl font-semibold text-[16px] cta-glow transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#FF2A00]/20"
            >
              [ Start Free Trial ]
            </button>
            <a 
              href="#pricing"
              className="border border-[#132d7d] text-[#b7c4ff] px-10 py-4 rounded-xl font-semibold text-[16px] hover:bg-[#132d7d]/10 transition-all text-center"
            >
              Calculate Plan
            </a>
          </div>
          <div className="relative max-w-5xl mx-auto glass-card rounded-2xl overflow-hidden shadow-2xl p-2 border border-white/10">
            <img 
              className="w-full h-auto rounded-xl" 
              alt="Dashboard Preview" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkF4Y0k7PA1pllX4sVkzDr8Cm4qXCZI9Rq4vDa4lBB0hTmXLmQrTpNNR71bNG80Fg7cgdVU8rcPcdYLzCH6sIe7cq8Zz2jj0uzyd0U3szER-dzqt54x16Cx2LdwgkYTjWMGMriZ-Y2eMV-ESlFxq8PMTsqlXiAOmYVxH1zThasUjqjihN0tDZ-WoWA2r-FpgAZgqOoTAr09qwnSUvu4JfcVS_mPH1D6OV7LkwB9mAfC8dWnmxEmxJu" 
            />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#131318] via-transparent to-transparent opacity-40"></div>
          </div>
        </section>

        {/* Section 2: How It Works */}
        <section className="py-24 bg-[#0e0e13] relative overflow-hidden">
          <div className="max-w-[1280px] mx-auto px-10">
            <div className="text-center mb-16">
              <h2 className="text-[32px] font-semibold mb-4 font-sans text-white">Master Your Sales Signals</h2>
              <p className="text-[#c5c5d3] max-w-2xl mx-auto">Our automated intelligence engine does the heavy lifting, so your team can focus on closing deals.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass-card p-8 rounded-2xl flex flex-col items-center text-center group hover:-translate-y-2 transition-transform">
                <div className="w-16 h-16 bg-[#132d7d]/20 rounded-full flex items-center justify-center mb-6 border border-[#b7c4ff]/20 group-hover:bg-[#FF2A00]/20 group-hover:border-[#FF2A00]/40 transition-colors">
                  <span className="material-symbols-outlined text-[#b7c4ff] group-hover:text-[#FF2A00] transition-colors" style={{ fontSize: '32px' }}>upload_file</span>
                </div>
                <h3 className="text-[20px] font-semibold mb-4 text-white">1. Upload or Search</h3>
                <p className="text-[#c5c5d3] text-[14px] leading-relaxed">Enter domains, LinkedIn URLs, or upload a CSV of target accounts. We map the entire buying center instantly.</p>
              </div>
              <div className="glass-card p-8 rounded-2xl flex flex-col items-center text-center group hover:-translate-y-2 transition-transform border-t-2 border-t-[#FF2A00]">
                <div className="w-16 h-16 bg-[#132d7d]/20 rounded-full flex items-center justify-center mb-6 border border-[#b7c4ff]/20 group-hover:bg-[#FF2A00]/20 group-hover:border-[#FF2A00]/40 transition-colors">
                  <span className="material-symbols-outlined text-[#b7c4ff] group-hover:text-[#FF2A00] transition-colors" style={{ fontSize: '32px' }}>psychology</span>
                </div>
                <h3 className="text-[20px] font-semibold mb-4 text-white">2. AI Enrichment</h3>
                <p className="text-[#c5c5d3] text-[14px] leading-relaxed">Our engine checks real-time triggers like new funding rounds, department-specific hiring surges, and recent exits.</p>
              </div>
              <div className="glass-card p-8 rounded-2xl flex flex-col items-center text-center group hover:-translate-y-2 transition-transform">
                <div className="w-16 h-16 bg-[#132d7d]/20 rounded-full flex items-center justify-center mb-6 border border-[#b7c4ff]/20 group-hover:bg-[#FF2A00]/20 group-hover:border-[#FF2A00]/40 transition-colors">
                  <span className="material-symbols-outlined text-[#b7c4ff] group-hover:text-[#FF2A00] transition-colors" style={{ fontSize: '32px' }}>notifications_active</span>
                </div>
                <h3 className="text-[20px] font-semibold mb-4 text-white">3. Twice-Weekly Alerts</h3>
                <p className="text-[#c5c5d3] text-[14px] leading-relaxed">Get a grouped summary email every Tuesday and Thursday with pre-written, tailored copy for each executive.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Feature Deep-Dive */}
        <section className="py-24" id="features">
          <div className="max-w-[1280px] mx-auto px-10">
            {/* Feature 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
              <div>
                <div className="inline-block px-3 py-1 rounded bg-[#FF2A00]/10 text-[#FF2A00] border border-[#FF2A00]/20 font-mono text-[12px] mb-6">INTENT MONITORING</div>
                <h2 className="text-[36px] font-bold mb-6 leading-tight text-white">Sitemap &amp; Job Surge Triggers</h2>
                <p className="text-[#c5c5d3] text-[16px] leading-relaxed mb-8">
                  We don't just tell you they are hiring; we tell you why. Our system analyzes sitemap changes and job description keywords to identify specific technical pain points before they post the role on LinkedIn.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#4CAF82]">check_circle</span>
                    <span>Real-time technical stack detection</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#4CAF82]">check_circle</span>
                    <span>Department expansion alerts</span>
                  </li>
                </ul>
              </div>
              <div className="glass-card rounded-2xl aspect-video relative overflow-hidden group">
                <img 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  alt="Feature Visual" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYwuPkfnHHPJ2nCZoWfSgIMasJbOA_SvXX5ui3ZsulzcuD5ugY5rAZODIoweNq_xjnmCaXF77R3OfNxiEXZhl5C6Xz1CUc00zXVCpfYBSWJyBxqD4uNaHb95y5X_mHwNmA3AhjTJPiAy32mynOmquq5aVuHv89ZkV8Iv2P8MdF4zxDHhQjMC9SN-ud-D6aQtQ1agRa804SY1esqAhW-WpOsZUuYKxyhbNQJTYLKRSlmUaNXPNMK--U" 
                />
                <div className="absolute inset-0 bg-[#132D7D]/10 mix-blend-overlay"></div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
              <div className="md:order-2">
                <div className="inline-block px-3 py-1 rounded bg-[#b7c4ff]/10 text-[#b7c4ff] border border-[#b7c4ff]/20 font-mono text-[12px] mb-6">SOCIAL INTELLIGENCE</div>
                <h2 className="text-[36px] font-bold mb-6 leading-tight text-white">LinkedIn Activity Tracking</h2>
                <p className="text-[#c5c5d3] text-[16px] leading-relaxed mb-8">
                  Track what your prospects are actually talking about. signalIQ captures comments, posts, and engagement from your target account C-Suite to give you the perfect personalized hook.
                </p>
                <a href="#pricing" className="text-[#b7c4ff] font-medium border-b border-[#b7c4ff] hover:text-[#FF2A00] hover:border-[#FF2A00] transition-all pb-1">
                  See plans &amp; pricing
                </a>
              </div>
              <div className="md:order-1 glass-card rounded-2xl aspect-video relative overflow-hidden group">
                <img 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  alt="Feature Visual" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyYBcsYbX3rNXn4JjAVkp5o64ffjokqwqx-3zpq3rhsUpMDB6YGZtNpkmRmT4JpHLyzLzUzGcum5HdvhHVbcxAqKT5V3i2NB3BeuhJJq70l5j8isZfXyxr1oJNVydd0reAKjzQoj66itOoxnJaN4CJgNyndA76bhKmeGDT2mLHBCus7H1dHNQxyn4WMrUj4UltjMAXAJpdxTLPrqsiEAepXAL4SvshK8MrsIcfz1OpS-2KetHa40J3" 
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
              <div>
                <div className="inline-block px-3 py-1 rounded bg-white/10 text-white border border-white/20 font-mono text-[12px] mb-6">CREDIT EFFICIENCY</div>
                <h2 className="text-[36px] font-bold mb-6 leading-tight text-white">Custom Contact Override</h2>
                <p className="text-[#c5c5d3] text-[16px] leading-relaxed mb-8">
                  Control your budget with precision. If our AI suggests a contact you already know or don't want to target, reject the proposal in one click. You only pay for the signals you actually action.
                </p>
                <div className="flex gap-4 p-4 rounded-xl border border-white/10 bg-[#1b1b20]">
                  <span className="material-symbols-outlined text-[#FF2A00]">security</span>
                  <p className="text-sm">Never double-pay for contacts already in your CRM.</p>
                </div>
              </div>
              <div className="glass-card rounded-2xl aspect-video relative overflow-hidden group">
                <img 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  alt="Feature Visual" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmXK2inPCT6EQewze9GkJjF5hs6r3m-kpY5uGEigruUH6Ig9wc9x95lq-32mb0BtgmMEBOFqgfXlu5af3eSpm1d0D7FIitIbPf9Toe9z_doRluyv5dDyKRoLq9yeAYMA07-yEIwljSxjC0JbmtTUcmCJl18G0KBc14QXxsP4ZW85TVfpFLpaZMb8lWmfn-Gp4C7wALDH0SAd12C4u4c50m39ETW-UcEMBc_bSjLV3dgIXeExSsto0b" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Live Interactive Sandbox */}
        <section className="py-24 relative" id="pricing">
          <div className="absolute inset-0 bg-[#132D7D]/5 -skew-y-3 -z-10"></div>
          <div className="max-w-[1280px] mx-auto px-10">
            <div className="glass-card p-12 rounded-3xl border-[#b7c4ff]/20 max-w-3xl mx-auto shadow-2xl">
              <h2 className="text-[32px] font-bold text-center mb-10 text-white">Calculate Your Scale</h2>
              <div className="space-y-12">
                <div>
                  <div className="flex justify-between mb-4">
                    <label className="text-[18px] font-medium text-white font-sans">Target accounts to monitor</label>
                    <span className="text-[#FF2A00] font-bold text-xl">{accounts} Companies</span>
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={accounts}
                    onChange={(e) => setAccounts(Number(e.target.value))}
                    className="w-full h-2 bg-[#2a292f] rounded-lg appearance-none cursor-pointer accent-[#FF2A00]" 
                  />
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="checkbox"
                    id="exec-toggle"
                    checked={trackExtraExecs}
                    onChange={(e) => setTrackExtraExecs(e.target.checked)}
                    className="w-6 h-6 rounded border-white/10 bg-[#1f1f24] text-[#FF2A00] focus:ring-[#FF2A00]" 
                  />
                  <label className="text-[16px] text-[#e4e1e9]" htmlFor="exec-toggle">Track up to 2 key executives per account</label>
                </div>
                <div className="pt-8 border-t border-white/10 text-center">
                  <p className="text-[#c5c5d3] font-mono text-[12px] uppercase mb-2">Estimated Investment</p>
                  <div className="text-4xl font-bold text-white mb-4">Requires {slotsNeeded} Slots</div>
                  <div className="inline-block px-6 py-3 bg-[#132D7D]/20 text-[#b7c4ff] rounded-full font-bold">
                    Recommended: <span>{recommendedPlan}</span> ({planPrice}/mo)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Social Proof */}
        <section className="py-24 border-y border-white/10 bg-[#0e0e13]">
          <div className="max-w-[1280px] mx-auto px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="text-center md:text-left">
                <div className="text-7xl font-extrabold text-[#FF2A00] mb-4">22%</div>
                <p className="text-2xl text-[#e4e1e9] font-bold">Average Response Rate</p>
                <p className="text-[#c5c5d3] mt-4 leading-relaxed">Industry average is 2.1%. Our signals provide the context that forces prospects to reply.</p>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute -top-10 -left-10 text-8xl text-[#b7c4ff]/10" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
                <div className="glass-card p-8 rounded-2xl relative z-10">
                  <p className="text-xl italic mb-6 leading-relaxed">"Our booking rate doubled in 2 weeks. We stopped exporting huge sheets from Apollo and started focusing only on companies with active triggers. It's a game changer."</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#132D7D]/30 overflow-hidden">
                      <img 
                        className="w-full h-full object-cover" 
                        alt="Sarah Jenkins Profile" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDdPFy0uiDkm-agTzdM8CXkjmCf3N5aNa6Ad-IrJ2WeIcwJxkfapWSUmg5yPZGILGW3rY1i8PuKVkHblqgln9fxDRzYwVSG2bJbDaKh06oyoZIkrmvPCl3xgfmhFgtLM6eL4TQ8tCoF4fsLvXUkorDZwwu4X0L4HDC2zF6Ug2L7WBOKPF9K7S7BxZcNPtF3hmV1LDdHbe-NWwx99WFSeNjJwQ2WSxJUHr56Ps6K_pIyqjC8NcldkrM" 
                      />
                    </div>
                    <div>
                      <p className="font-bold text-white">Sarah Jenkins</p>
                      <p className="text-sm text-[#c5c5d3]">VP of Sales, TechScale</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Pricing Cards */}
        <section className="py-24">
          <div className="max-w-[1280px] mx-auto px-10">
            <div className="text-center mb-16">
              <h2 className="text-[32px] font-bold mb-4 text-white">Simple, Signal-Based Pricing</h2>
              <p className="text-[#c5c5d3]">1 Credit = 1 Monitored Target slot for the month.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Starter */}
              <div className="glass-card p-10 rounded-3xl flex flex-col border border-white/10 hover:border-[#b7c4ff]/50 transition-all">
                <h3 className="text-[20px] font-semibold mb-2 text-white">Starter</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">₹9,900</span>
                  <span className="text-[#c5c5d3]">/mo</span>
                </div>
                <p className="text-[#b7c4ff] font-bold mb-8">50 Companies (100 Slots)</p>
                <ul className="space-y-4 mb-10 flex-grow text-[#c5c5d3]">
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Weekly AI Reports</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> 1 Exec per account</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Email Support</li>
                </ul>
                <button 
                  onClick={onGetStarted}
                  className="w-full py-4 rounded-xl border border-[#b7c4ff] text-[#b7c4ff] hover:bg-[#b7c4ff]/10 transition-all font-bold"
                >
                  Choose Starter
                </button>
              </div>
              {/* Pro */}
              <div className="glass-card p-10 rounded-3xl flex flex-col relative border-2 border-[#FF2A00] shadow-2xl scale-105 z-10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#FF2A00] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">MOST POPULAR</div>
                <h3 className="text-[20px] font-semibold mb-2 text-white">Pro</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">₹24,900</span>
                  <span className="text-[#c5c5d3]">/mo</span>
                </div>
                <p className="text-[#FF2A00] font-bold mb-8">150 Companies (450 Slots)</p>
                <ul className="space-y-4 mb-10 flex-grow text-[#c5c5d3]">
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Real-time Signal Alerts</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> 2 Execs per account</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> LinkedIn Post Analysis</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Priority Support</li>
                </ul>
                <button 
                  onClick={onGetStarted}
                  className="w-full py-4 rounded-xl bg-[#FF2A00] text-white font-bold cta-glow transition-all"
                >
                  Get Started
                </button>
              </div>
              {/* Scale */}
              <div className="glass-card p-10 rounded-3xl flex flex-col border border-white/10 hover:border-[#b7c4ff]/50 transition-all">
                <h3 className="text-[20px] font-semibold mb-2 text-white">Scale</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">₹49,900</span>
                  <span className="text-[#c5c5d3]">/mo</span>
                </div>
                <p className="text-[#b7c4ff] font-bold mb-8">375 Companies (1,125 Slots)</p>
                <ul className="space-y-4 mb-10 flex-grow text-[#c5c5d3]">
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> CRM Integration</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Unlimited Execs</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Custom Trigger Logic</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-[#4CAF82]">check</span> Dedicated CS Manager</li>
                </ul>
                <button 
                  onClick={onGetStarted}
                  className="w-full py-4 rounded-xl border border-[#b7c4ff] text-[#b7c4ff] hover:bg-[#b7c4ff]/10 transition-all font-bold"
                >
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: FAQ Accordion */}
        <section className="py-24 bg-[#0e0e13]" id="faq">
          <div className="max-w-3xl mx-auto px-10">
            <h2 className="text-[32px] font-bold text-center mb-16 text-white">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "Does it consume credits for duplicates?",
                  a: "No, our proprietary cooldown engine ensures you pay ₹0 for re-uploads of existing accounts or duplicate contacts. We only deduct credits for new, active monitoring slots."
                },
                {
                  q: "Can I add my own contacts?",
                  a: "Yes, you can paste LinkedIn URLs directly into the interface or override the AI-suggested contacts with your own specific leads."
                },
                {
                  q: "What databases do you enrich from?",
                  a: "We use a multi-source orchestration layer including Exa, Firecrawl, ScrapeCreators, and Autobound to ensure the highest data freshness and contact accuracy."
                }
              ].map((faq, idx) => (
                <div key={idx} className="glass-card rounded-2xl overflow-hidden border border-white/10">
                  <button 
                    className="w-full p-6 text-left flex justify-between items-center group font-medium"
                    onClick={() => toggleFaq(idx)}
                  >
                    <span className="text-[18px] text-white">{faq.q}</span>
                    <span className="material-symbols-outlined group-hover:text-[#FF2A00] transition-colors">
                      {activeFaq === idx ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {activeFaq === idx && (
                    <div className="px-6 pb-6 text-[#c5c5d3] text-[15px] leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 8: Footer CTA */}
        <section className="py-24 px-10">
          <div className="max-w-[1280px] mx-auto">
            <div className="relative overflow-hidden glass-card rounded-[3rem] p-12 md:p-20 text-center border-2 border-[#FF2A00]/30">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF2A00]/10 via-transparent to-[#132D7D]/10 -z-10"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF2A00]/20 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
              <h2 className="text-[36px] md:text-[48px] font-bold mb-8 max-w-3xl mx-auto text-white leading-tight">Start tracking your dream pipeline today.</h2>
              <div className="flex flex-col md:flex-row justify-center gap-6">
                <button 
                  onClick={onGetStarted}
                  className="bg-[#FF2A00] text-white px-10 py-5 rounded-2xl font-bold text-[18px] cta-glow transition-all shadow-xl shadow-[#FF2A00]/30"
                >
                  Start 7-Day Free Trial
                </button>
                <button 
                  onClick={onGetStarted}
                  className="bg-white text-black px-10 py-5 rounded-2xl font-bold text-[18px] hover:bg-[#c5c5d3] transition-all"
                >
                  Book a Demo
                </button>
              </div>
              <p className="mt-8 text-[#c5c5d3] font-mono text-[12px] uppercase tracking-widest">No credit card required for trial.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0e0e13] border-t border-white/10 py-20">
        <div className="max-w-[1280px] mx-auto px-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#e4e1e9', letterSpacing: '-0.04em', fontFamily: 'Geist, sans-serif' }}>
              signal<span style={{ color: '#FF2A00' }}>IQ</span>
            </span>
            <p className="text-[#c5c5d3] text-sm">Automated Buying Intent &amp; Executive Activity Intelligence platform.</p>
          </div>
          <div className="flex md:justify-end gap-16 text-sm text-[#c5c5d3]">
            <div className="space-y-4">
              <p className="font-bold text-white uppercase text-xs">Product</p>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="font-bold text-white uppercase text-xs">Company</p>
              <ul className="space-y-2">
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a onClick={onGetStarted} className="hover:text-white transition-colors cursor-pointer">Login</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-10 mt-12 pt-8 border-t border-white/5 text-xs text-[#c5c5d3] flex justify-between">
          <span>&copy; {new Date().getFullYear()} signalIQ. All rights reserved.</span>
          <span>Ad Momenta Partner Project</span>
        </div>
      </footer>
    </div>
  );
}
