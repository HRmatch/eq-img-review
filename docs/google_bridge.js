// Work around Google Apps Script multi-login URL rewriting by pinning authuser=0
// on all backend requests from the public GitHub Pages app.
(() => {
  const cfg = window.HR_REVIEW_CONFIG || {};
  const endpoint = String(cfg.APPS_SCRIPT_URL || '').trim();
  if (!endpoint) return;

  function withAuthuser(url) {
    try {
      const u = new URL(url, window.location.href);
      if (u.href.startsWith(endpoint) && !u.searchParams.has('authuser')) {
        // Put authuser first to prevent /u/N/ rewriting in browsers with multiple Google accounts.
        const params = new URLSearchParams(u.search);
        params.delete('authuser');
        const rebuilt = new URLSearchParams();
        rebuilt.set('authuser', '0');
        for (const [k, v] of params.entries()) rebuilt.append(k, v);
        u.search = rebuilt.toString();
      }
      return u.href;
    } catch (_) {
      return url;
    }
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    if (typeof input === 'string') return nativeFetch(withAuthuser(input), init);
    if (input && input.url) {
      try { return nativeFetch(new Request(withAuthuser(input.url), input), init); }
      catch (_) { return nativeFetch(input, init); }
    }
    return nativeFetch(input, init);
  };

  const nativeAppendChild = HTMLHeadElement.prototype.appendChild;
  HTMLHeadElement.prototype.appendChild = function(node) {
    if (node && node.tagName === 'SCRIPT' && node.src && node.src.startsWith(endpoint)) {
      node.src = withAuthuser(node.src);
    }
    return nativeAppendChild.call(this, node);
  };
})();
