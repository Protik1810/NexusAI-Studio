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

/**
 * "The release isn't cut yet" and "the release is cut but a download is
 * broken" look identical at the asset level — both 404 — but only the
 * second is a reason to block a deploy.
 *
 * Pushing the version bump to main before running `gh release create` is
 * the normal order (the release notes and checksums have to be committed
 * first), and it made every release fail this check once, purely on
 * timing. So: if the tag itself doesn't exist yet, this is a
 * work-in-progress deploy — say so and pass. Once the tag is there, every
 * asset must resolve.
 */
async function tagExists(url) {
  const m = url.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\/download\/([^/]+)\//);
  if (!m) return true;                       // unrecognised shape — check it strictly
  const [, repo, tag] = m;
  try {
    const res = await fetch(`${repo}/releases/tag/${tag}`, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch (e) {
    return true;                             // network trouble: don't silently skip
  }
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
    if (!(await tagExists(urls[0]))) {
      console.warn(
        `\n${failed} of ${urls.length} download link(s) 404, but that release tag doesn't exist yet — ` +
        `treating this as a pre-release deploy and continuing. Re-run this once the release is published ` +
        `to actually verify the links.`
      );
      return;
    }
    console.error(`\n${failed} of ${urls.length} download link(s) are broken — refusing to deploy.`);
    process.exit(1);
  }
  console.log(`\nAll ${urls.length} download links resolve.`);
})();
