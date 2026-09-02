// Verifies every GitHub Release download link on the generated landing page
// actually resolves before deploying it. The site's download buttons have
// gone stale twice already (f6c0e79 fixed the wrong names in
// RELEASE_NOTES.md/CHECKSUMS.txt but missed this file's real source,
// scripts/build-blob-landing.js; 7215228 then fixed the generator itself)
// — a resolved {{TOKEN}} pointing at a 404 is worse than an unresolved one,
// since it deploys silently instead of throwing like build-blob-landing.js
// already does for unresolved tokens. Run after generating docs/index.html,
// before deploying it.
const fs = require('fs');

const html = fs.readFileSync('docs/index.html', 'utf8');
const urls = [...new Set(
  [...html.matchAll(/https:\/\/github\.com\/[^"'\s]+\/releases\/download\/[^"'\s]+/g)].map(m => m[0])
)];

if (urls.length === 0) {
  console.error('No release download links found in docs/index.html — the extraction pattern may be stale, or the download section was removed.');
  process.exit(1);
}

(async () => {
  let failed = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      console.log(`${res.status}  ${url}`);
      if (!res.ok) failed++;
    } catch (e) {
      console.log(`ERROR  ${url}  (${e.message})`);
      failed++;
    }
  }
  if (failed) {
    console.error(`\n${failed} of ${urls.length} download link(s) are broken — refusing to deploy.`);
    process.exit(1);
  }
  console.log(`\nAll ${urls.length} download links resolve.`);
})();
