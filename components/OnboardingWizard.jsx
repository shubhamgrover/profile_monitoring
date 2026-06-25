'use client';

import { useState } from 'react';

export default function OnboardingWizard({ onSave, onClose }) {
  const [step, setStep] = useState(1);
  const [productDesc, setProductDesc] = useState('');
  const [valueProposition, setValueProposition] = useState('');
  const [targetDept, setTargetDept] = useState('Marketing');
  const [targetSeniority, setTargetSeniority] = useState('VP');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    
    const settings = {
      productDesc,
      valueProposition,
      targetDept,
      targetSeniority
    };
    
    localStorage.setItem('onboarding_settings', JSON.stringify(settings));
    
    // Sync with watchlist GTM settings
    const gtmSettings = {
      productName: '',
      productDesc: `${productDesc}\n\nValue Proposition: ${valueProposition}`,
      competitors: ''
    };
    localStorage.setItem('gtm_product_settings', JSON.stringify(gtmSettings));

    onSave(settings);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 5, 8, 0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        width: 480,
        maxWidth: '90vw',
        background: 'rgba(10, 15, 30, 0.85)',
        border: '1px solid rgba(19, 45, 125, 0.4)',
        borderRadius: 24,
        padding: '36px 40px',
        boxShadow: '0 20px 50px rgba(19, 45, 125, 0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Step indicator */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginBottom: 24,
          alignItems: 'center'
        }}>
          {[1, 2].map(s => (
            <div key={s} style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: s <= step ? 'linear-gradient(135deg, #132D7D, #FF2A00)' : 'rgba(255,255,255,0.08)',
              transition: 'all 0.3s ease'
            }} />
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>🚀 Initialize Workspace</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Configure what you sell and who you target so the AI can custom-tailor outreach signals to your value propositions.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>What product or service do you sell?</label>
              <textarea
                required
                placeholder="e.g. Generative Engine Optimization (GEO) audit platforms for enterprise SaaS brands..."
                value={productDesc}
                onChange={e => setProductDesc(e.target.value)}
                style={{
                  width: '100%',
                  height: 90,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: 12,
                  color: 'white',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255, 42, 0, 0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>What is your core value pitch / solved pain?</label>
              <textarea
                required
                placeholder="e.g. Automatically prepare SEO pipelines for AI search models and agents..."
                value={valueProposition}
                onChange={e => setValueProposition(e.target.value)}
                style={{
                  width: '100%',
                  height: 90,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: 12,
                  color: 'white',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255, 42, 0, 0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              />
            </div>

            <button type="submit" style={{
              background: 'linear-gradient(135deg, #FF2A00, #d62400)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(255, 42, 0, 0.3)',
              marginTop: 10
            }}>
              Next Step →
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>🎯 Define Outreach Persona</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Who is your default decision maker? AI will auto-enrich lists and target these roles first.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Target Department</label>
              <select
                value={targetDept}
                onChange={e => setTargetDept(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: 12,
                  color: 'white',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {['Marketing', 'Sales', 'HR', 'Engineering', 'Operations', 'Product'].map(d => (
                  <option key={d} value={d} style={{ background: '#0f101a' }}>{d}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Target Seniority</label>
              <select
                value={targetSeniority}
                onChange={e => setTargetSeniority(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: 12,
                  color: 'white',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {['C-Suite', 'VP', 'Director', 'Manager', 'All'].map(s => (
                  <option key={s} value={s} style={{ background: '#0f101a' }}>{s === 'All' ? 'All Tiers' : s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={() => setStep(1)} style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                Back
              </button>
              
              <button type="submit" style={{
                flex: 1,
                background: 'linear-gradient(135deg, #FF2A00, #d62400)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255, 42, 0, 0.3)'
              }}>
                Complete Setup
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
