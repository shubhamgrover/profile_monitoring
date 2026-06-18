'use client';

import { useState, useRef } from 'react';
import { parseCSV, generateCSVTemplate } from '../lib/csvParser';

export default function UploadPage({ onUploaded, onNavigate, credits }) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [exaKey, setExaKey] = useState('a0c81fe8-4433-4a01-9dc5-ba02492cf921');
  const [resolving, setResolving] = useState(false);
  const [resolutionProgress, setResolutionProgress] = useState(0);
  const [resolutionLog, setResolutionLog] = useState([]);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setParsing(true);
    setError(null);
    setResult(null);
    setResolutionLog([]);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setResult(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleResolveUrls = async () => {
    if (!result || !result.profiles) return;
    const toResolve = result.profiles.filter(p => p.needsResolution);
    if (toResolve.length === 0) return;

    setResolving(true);
    setResolutionProgress(0);
    setResolutionLog(['⚡ Starting Exa URL resolution for ' + toResolve.length + ' profiles...']);

    let resolvedCount = 0;
    const updatedProfiles = [...result.profiles];

    for (let i = 0; i < toResolve.length; i++) {
      const p = toResolve[i];
      setResolutionLog(prev => [...prev, `🔍 Searching LinkedIn company page for "${p.company}"...`]);

      try {
        const response = await fetch('/api/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: p.company,
            apiKey: exaKey,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed request');
        }

        const data = await response.json();
        const results = data.results || [];
        // Find first link containing /company/
        const match = results.find(r => r.url?.toLowerCase().includes('linkedin.com/company/'));

        if (match) {
          const rawUrl = match.url;
          // Clean/Normalize the URL to canonical form
          let cleanUrl = rawUrl.trim().split('?')[0];
          if (cleanUrl.startsWith('http://')) {
            cleanUrl = cleanUrl.replace('http://', 'https://');
          } else if (!cleanUrl.startsWith('http')) {
            cleanUrl = 'https://' + cleanUrl;
          }
          if (!cleanUrl.includes('www.linkedin.com')) {
            cleanUrl = cleanUrl.replace('linkedin.com', 'www.linkedin.com');
          }
          cleanUrl = cleanUrl.replace(/\/+$/, '');
          if (cleanUrl.includes('/company/')) {
            cleanUrl = cleanUrl + '/';
          }
          
          const orig = updatedProfiles.find(x => x.id === p.id);
          if (orig) {
            orig.linkedinUrl = cleanUrl;
            orig.companyLinkedinUrl = cleanUrl;
            orig.needsResolution = false;
            orig.status = 'pending';
            
            const handle = cleanUrl.split('/company/')[1] || 'company';
            orig.id = `${handle}-${Math.random().toString(36).slice(2, 6)}`;
          }

          setResolutionLog(prev => [...prev, `✅ Resolved "${p.company}" ➔ ${cleanUrl}`]);
          resolvedCount++;
        } else {
          setResolutionLog(prev => [...prev, `⚠️ No LinkedIn Company URL found for "${p.company}".`]);
        }
      } catch (err) {
        setResolutionLog(prev => [...prev, `❌ Error resolving "${p.company}": ${err.message}`]);
      }

      setResolutionProgress(Math.round(((i + 1) / toResolve.length) * 100));
      // Throttle rate limit
      await new Promise(r => setTimeout(r, 400));
    }

    setResult(prev => ({
      ...prev,
      profiles: updatedProfiles,
    }));
    setResolving(false);
    setResolutionLog(prev => [...prev, `🏁 Resolution complete! Successfully linked ${resolvedCount} of ${toResolve.length} companies.`]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleConfirm = () => {
    if (result?.profiles?.length > 0) {
      onUploaded(result.profiles);
      onNavigate('profiles');
    }
  };

  const downloadTemplate = () => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signal_engine_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toResolveCount = result?.profiles?.filter(p => p.needsResolution).length || 0;
  const creditsNeeded = result?.profiles?.length || 0;
  const hasEnoughCredits = (credits?.remaining || 500) >= creditsNeeded;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Upload Profiles</div>
        <div className="topbar-right">
          <button className="btn btn-secondary" onClick={downloadTemplate}>
            ↓ Download Template
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="upload-container">
          <div className="upload-hero">
            <h1>Upload Your Target List</h1>
            <p>Upload up to 800 LinkedIn profiles or company names. We'll automatically resolve URLs and monitor them weekly.</p>
          </div>

          <div className="upload-card">
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                id="csv-upload-input"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              {parsing ? (
                <>
                  <div className="upload-icon">⏳</div>
                  <h3>Parsing your CSV...</h3>
                  <p>Validating profile URLs and column format</p>
                </>
              ) : result ? (
                <>
                  <div className="upload-icon">✅</div>
                  <h3>{result.total} profiles loaded</h3>
                  <p className="highlight">Click to upload a different file</p>
                </>
              ) : (
                <>
                  <div className="upload-icon">📁</div>
                  <h3>Drop your CSV here</h3>
                  <p>or <span className="highlight">click to browse</span> · .csv files only</p>
                </>
              )}
            </div>

            {error && (
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'var(--signal-red-bg)',
                border: '1px solid var(--signal-red-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--signal-red)',
              }}>
                ⚠️ {error}
              </div>
            )}

            {result && (
              <div style={{ marginTop: 20 }}>
                {/* Summary */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginBottom: 16,
                }}>
                  {[
                    { label: 'Total Profiles', value: result.total, color: 'var(--accent-blue)' },
                    { label: 'Credits Needed', value: creditsNeeded, color: hasEnoughCredits ? 'var(--signal-green)' : 'var(--signal-red)' },
                    { label: 'Unresolved URLs', value: toResolveCount, color: toResolveCount > 0 ? 'var(--signal-yellow)' : 'var(--signal-green)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Exa Resolver Section */}
                {toResolveCount > 0 && (
                  <div style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 20,
                    marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                          ⚡ Exa Company Resolver
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Automatically search and link LinkedIn company URLs for the {toResolveCount} unresolved rows.
                        </div>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label" htmlFor="exa-api-key">Exa API Key</label>
                      <input
                        id="exa-api-key"
                        className="form-input"
                        type="password"
                        placeholder="a0c81fe8-..."
                        value={exaKey}
                        onChange={e => setExaKey(e.target.value)}
                        disabled={resolving}
                      />
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                      onClick={handleResolveUrls}
                      disabled={resolving || !exaKey}
                    >
                      {resolving ? '⏳ Resolving via Exa API...' : `⚡ Resolve ${toResolveCount} URLs`}
                    </button>
                  </div>
                )}

                {/* Progress Logs */}
                {(resolving || resolutionLog.length > 0) && (
                  <div className="poll-progress" style={{ marginTop: 16, marginBottom: 20 }}>
                    <div className="poll-progress-header">
                      <span className="poll-progress-title">
                        {resolving ? '⚡ Resolving LinkedIn URLs...' : '✅ URL Resolution Complete'}
                      </span>
                      <span className="poll-progress-pct">{resolutionProgress}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${resolutionProgress}%` }} />
                    </div>
                    <div className="poll-log" style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {resolutionLog.map((logLine, i) => (
                        <div key={i} className={`poll-log-item ${logLine.includes('✅') ? 'success' : logLine.includes('❌') ? 'error' : 'info'}`}>
                          <span>{logLine}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.errors?.length > 0 && (
                  <div style={{
                    background: 'var(--signal-yellow-bg)',
                    border: '1px solid var(--signal-yellow-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--signal-yellow)', marginBottom: 6 }}>
                      ⚠️ {result.errors.length} rows had format issues (skipped)
                    </div>
                    {result.errors.slice(0, 3).map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>• {e}</div>
                    ))}
                    {result.errors.length > 3 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>...and {result.errors.length - 3} more</div>
                    )}
                  </div>
                )}

                {/* Preview table */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Preview (first 5 rows)
                  </div>
                  <div className="profiles-card">
                    <table className="profiles-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Company</th>
                          <th>Title</th>
                          <th>LinkedIn URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.profiles.slice(0, 5).map((p, i) => (
                          <tr key={i}>
                            <td><span className="profile-name">{p.name}</span></td>
                            <td>{p.company || '—'}</td>
                            <td>{p.title || '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {p.linkedinUrl ? p.linkedinUrl.replace('https://linkedin.com/company/', '…/company/').replace('https://linkedin.com/in/', '…/in/') : (
                                <span style={{ color: 'var(--signal-yellow)', fontWeight: 600 }}>⚠️ Missing URL</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => { setResult(null); setError(null); setResolutionLog([]); }}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={!hasEnoughCredits || result.total === 0 || toResolveCount > 0}
                    id="confirm-upload-btn"
                  >
                    {toResolveCount > 0 ? '⚠️ Resolve URLs to Proceed' : `✓ Add ${result.total} Profiles — Use ${creditsNeeded} Credits`}
                  </button>
                </div>
              </div>
            )}

            {/* Format guide */}
            {!result && (
              <div className="format-card">
                <div className="format-title">
                  📋 Required CSV Format
                </div>
                <table className="format-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Required</th>
                      <th>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['company', 'No*', 'HubSpot'],
                      ['linkedin_url', 'No*', 'https://linkedin.com/in/sarahw'],
                      ['company_linkedin_url', 'No*', 'https://linkedin.com/company/hubspot'],
                      ['name', 'No', 'Sarah Williams'],
                      ['title', 'No', 'VP Sales'],
                      ['email', 'No', 'sarah@hubspot.com'],
                    ].map(([col, req, ex]) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td style={{ color: req.startsWith('Required') || req.includes('*') ? 'var(--signal-yellow)' : 'var(--text-muted)' }}>{req}</td>
                        <td>{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                  * CSV must contain at least one identifier column: <code>company</code> (for URL resolution), <code>linkedin_url</code>, or <code>company_linkedin_url</code>.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
