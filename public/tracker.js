(function() {
    // Locate the executing script tag and grab the client's token
    const currentScript = document.currentScript || document.querySelector('script[data-app-id]');
    if (!currentScript) return;
    
    const token = currentScript.getAttribute('data-app-id');
    if (!token) return;

    // Resolve hosting origin dynamically from the script source URL (handles local dev and production vercel URLs automatically)
    const scriptSrc = currentScript.src;
    let apiHost = '';
    try {
        const url = new URL(scriptSrc);
        apiHost = url.origin;
    } catch (e) {
        apiHost = window.location.origin; // fallback
    }

    // Support a simulator/test flag in the hosting page query parameters (e.g. ?se_test=true)
    const isTest = window.location.search.includes('se_test=true');

    // Send tracking metadata asynchronously back to the ingestion server
    fetch(apiHost + '/api/v1/ingress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: token,
            path: window.location.pathname,
            referrer: document.referrer,
            test: isTest
        }),
        mode: 'cors'
    }).catch(err => console.warn("Tracking pipeline offline", err));
})();
