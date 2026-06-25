'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth({ onBackToHome }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const signUpOptions = {
          email,
          password,
        };
        if (redirectUrl) {
          signUpOptions.options = {
            emailRedirectTo: redirectUrl
          };
        }
        const { data, error } = await supabase.auth.signUp(signUpOptions);
        if (error) throw error;
        setSuccessMsg('Sign-up successful! Please check your email for the confirmation link.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-main)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '36px',
            marginBottom: '10px',
            display: 'inline-block',
            filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))'
          }}>
            ⚡
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            SignalEngine
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            {isSignUp ? 'Create your account to start monitoring profiles' : 'Sign in to access your monitored signals'}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{ width: '100%' }}
            />
          </div>

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              background: 'var(--signal-red-bg)',
              border: '1px solid var(--signal-red-border)',
              color: 'var(--signal-red)',
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              background: 'var(--signal-green-bg)',
              border: '1px solid var(--signal-green-border)',
              color: 'var(--signal-green)',
            }}>
              ✓ {successMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px', fontWeight: 600 }}
          >
            {loading ? '⏳ Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '13px',
          borderTop: '1px solid var(--border)',
          paddingTop: '20px'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isSignUp ? 'Already have an account? ' : 'First time here? '}
          </span>
          <button
            className="link-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-blue)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        {onBackToHome && (
          <div style={{
            marginTop: '16px',
            textAlign: 'center',
            borderTop: '1px dashed var(--border)',
            paddingTop: '12px'
          }}>
            <button
              type="button"
              className="link-btn"
              onClick={onBackToHome}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
