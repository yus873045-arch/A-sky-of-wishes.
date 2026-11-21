import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const html = await readFile(new URL('../festival.html', import.meta.url), 'utf8');
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>', styleStart);
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>', scriptStart);
assert.ok(styleStart >= 0 && styleEnd > styleStart, 'page styles exist');
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'page script exists');
const styles = html.slice(styleStart + 7, styleEnd);
const script = html.slice(scriptStart + 8, scriptEnd);
const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

test('the user-provided still image is the full-site background beneath the original sky layers', async () => {
  const tag = html.match(/<img id="site-background-image"[^>]*>/)?.[0];
  assert.ok(tag, 'global background image exists');
  assert.match(tag, /src="\/assets\/galaxy-background\.webp"/);
  assert.match(tag, /alt=""/);
  assert.match(tag, /aria-hidden="true"/);

  const sceneStart = html.indexOf('<div class="scene" aria-hidden="true">');
  const imageIndex = html.indexOf('<img id="site-background-image"', sceneStart);
  const starsIndex = html.indexOf('<canvas id="stars">', sceneStart);
  const ribbonIndex = html.indexOf('<canvas id="ribbon-flow"', imageIndex);
  const spiralIndex = html.indexOf('galaxy-spiral.webp', ribbonIndex);
  const ritualStart = html.indexOf('<section class="ritual"', starsIndex);
  assert.ok(sceneStart >= 0 && sceneStart < imageIndex && imageIndex < ribbonIndex);
  assert.ok(ribbonIndex < spiralIndex && spiralIndex < starsIndex && starsIndex < ritualStart);
  assert.doesNotMatch(html, /<video\b/i, 'no video element remains in the website');
  assert.doesNotMatch(html, /site-background-video|ritual-video|setLaunchBackground|lantern-flight-background\.mp4/);

  for (const f of ['galaxy-background','galaxy-ribbon','galaxy-spiral']) {
    const asset = await stat(new URL(`../public/assets/${f}.webp`, import.meta.url));
    assert.ok(asset.size > 50_000, `${f} is bundled`);
  }
  assert.match(server, /\['\.webp', 'image\/webp'\]/, 'server serves WebP');
  assert.doesNotMatch(server, /\['\.mp4', 'video\/mp4'\]/, 'video-only MIME mapping has been removed');
});

test('the still background covers the viewport and remains available with reduced motion', () => {
  assert.match(styles, /\.scene\{position:fixed;inset:0;overflow:hidden;background:/, 'original scene background remains as a fallback');
  assert.match(styles, /\.site-background-image\{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;object-position:center/);
  assert.match(styles, /\.disc-ring\{[^}]*animation:discSpin/, 'spiral galaxy rotates');
  assert.match(script, /galaxy-ribbon\.webp/, 'ribbon flows via canvas');
  assert.match(script, /glints=/, 'sparkling stars exist');
  assert.match(styles, /\.site-background-image\{[^}]*pointer-events:none/);
  assert.doesNotMatch(styles, /\.site-background-video|\.ritual-video|\.ritual\.flight-background/);
  assert.doesNotMatch(script, /siteBackgroundVideo|syncSiteBackgroundVideo/);
  assert.doesNotMatch(styles, /@media\(prefers-reduced-motion:reduce\)\{[^}]*site-background-image/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.disc-ring,\.core-glow\{animation:none\}\}/);
});

test('static background does not alter ritual geometry or server-confirmed launch timing', () => {
  assert.match(styles, /\.ritual-stage\{position:absolute;inset:75px 5% 25px;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;animation:ritualIn \.9s both\}/);
  assert.doesNotMatch(styles, /#ritual-content\{[^}]*position:relative/, 'absolute ritual stages remain viewport-aligned');

  const start = script.indexOf('async function finishOnlineRitual');
  const end = script.indexOf('async function showMine', start);
  assert.ok(start >= 0 && end > start, 'online ritual lifecycle exists');
  const finish = script.slice(start, end);
  const response = finish.indexOf('connection(true)');
  const launch = finish.indexOf("assembly.classList.add('launching')");
  const flightWait = finish.indexOf('await waitR(2800)');
  assert.ok(response >= 0 && launch > response, 'lantern launch remains after the successful save response');
  assert.ok(launch < flightWait, 'original launch animation duration remains unchanged');
});
