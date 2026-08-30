// Compatibility bridge: the full question bank + optimized media are packaged in one
// review_assets.zip file so GitHub Pages only needs one binary asset upload.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const phasePattern = /(?:^|\/)data\/(human_phase[123]|horse_phase[123])\.json(?:[?#].*)?$/;
  let unpackedPromise = null;

  async function unpackAssets() {
    if (!unpackedPromise) {
      unpackedPromise = (async () => {
        const response = await nativeFetch('review_assets.zip', { cache: 'force-cache' });
        if (!response.ok) throw new Error('Could not load review_assets.zip. Upload it inside the docs folder.');
        if (!window.fflate) throw new Error('Asset decompressor did not load.');
        return window.fflate.unzipSync(new Uint8Array(await response.arrayBuffer()));
      })();
    }
    return unpackedPromise;
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    // The current app asks for media_review.zip. Serve the combined asset archive instead;
    // it contains the same media/* paths plus the JSON bank.
    if (/(?:^|\/)media_review\.zip(?:[?#].*)?$/.test(url)) {
      return nativeFetch('review_assets.zip', init || { cache: 'force-cache' });
    }

    const match = url.match(phasePattern);
    if (match) {
      try {
        const files = await unpackAssets();
        const key = `data/${match[1]}.json`;
        const data = files[key];
        if (!data) return new Response('Missing question bank asset', { status: 404 });
        return new Response(data, {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      } catch (error) {
        return new Response(String(error && error.message ? error.message : error), { status: 500 });
      }
    }

    return nativeFetch(input, init);
  };
})();
