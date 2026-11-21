import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../festival.html', import.meta.url), 'utf8');
const scriptStart = html.indexOf('const backgroundMusic=');
const scriptEnd = html.indexOf("\n$('#motion').onclick=", scriptStart);
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'music controller exists in festival.html');
const controller = html.slice(scriptStart, scriptEnd);

class FakeButton {
  attributes = new Map([['aria-pressed', 'false'], ['aria-label', 'เปิดเพลงพื้นหลัง']]);
  listeners = new Map();
  disabled = false;
  textContent = 'เปิดเพลง';

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  async click() {
    if (this.disabled) return;
    return this.listeners.get('click')();
  }
}

class FakeAudio {
  listeners = new Map();
  paused = true;
  volume = 1;
  playCount = 0;
  pauseCount = 0;
  rejectPlay = false;

  addEventListener(name, listener) {
    const group = this.listeners.get(name) ?? [];
    group.push(listener);
    this.listeners.set(name, group);
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }

  async play() {
    this.playCount += 1;
    if (this.rejectPlay) throw new Error('Playback was blocked');
    this.paused = false;
    this.dispatch('play');
  }

  pause() {
    this.pauseCount += 1;
    this.paused = true;
    this.dispatch('pause');
  }
}

class FakeDocument {
  handlers = new Map();
  addEventListener(name, fn) { this.handlers.set(name, fn); }
  removeEventListener(name, fn) { if (this.handlers.get(name) === fn) this.handlers.delete(name); }
  async fire(name, target = {}) { return this.handlers.get(name)?.({ target }); }
}

function createFixture({ rejectPlay = false, withDocument = false } = {}) {
  const audio = new FakeAudio();
  const button = new FakeButton();
  const messages = [];
  audio.rejectPlay = rejectPlay;
  const document = withDocument ? new FakeDocument() : undefined;

  runInNewContext(controller, {
    ...(document ? { document } : {}),
    $: selector => selector === '#background-music' ? audio : button,
    toast: message => messages.push(message),
  });

  return { audio, button, messages, document };
}

const settleAutoplay = () => new Promise(resolve => setImmediate(resolve));

test('background track is bundled, hidden, looped, and attempted on page entry', async () => {
  assert.match(html, /<audio id="background-music" src="\/assets\/emotional-631198\.mp3" preload="auto" loop hidden>/);
  assert.match(controller, /const autoplayAttempt=backgroundMusic\.play\(\)/);
  assert.match(html, /<button id="music-toggle" type="button" aria-pressed="false"/);
  const asset = await readFile(new URL('../public/assets/emotional-631198.mp3', import.meta.url));
  assert.ok(asset.byteLength > 1_000_000, 'downloaded MP3 is present');
});

test('music attempts to start on entry, updates the toggle, and can be stopped', async () => {
  const { audio, button, messages } = createFixture();
  assert.equal(audio.playCount, 1, 'initialization attempts playback immediately');
  assert.equal(audio.paused, false);
  assert.equal(audio.volume, 0.18);
  assert.equal(button.attributes.get('aria-pressed'), 'true');
  assert.equal(button.attributes.get('aria-label'), 'ปิดเพลงพื้นหลัง');
  assert.equal(button.textContent, 'ปิดเพลง');
  assert.deepEqual(messages, []);

  await button.click();
  assert.equal(audio.pauseCount, 1);
  assert.equal(button.attributes.get('aria-pressed'), 'false');
  assert.equal(button.attributes.get('aria-label'), 'เปิดเพลงพื้นหลัง');
  assert.equal(button.textContent, 'เปิดเพลง');
});

test('when browser blocks autoplay, the open control remains available for a user gesture', async () => {
  const { audio, button, messages } = createFixture({ rejectPlay: true });
  await settleAutoplay();
  assert.equal(audio.playCount, 1, 'the page still attempts autoplay once');
  assert.equal(audio.paused, true);
  assert.equal(button.attributes.get('aria-pressed'), 'false');
  assert.equal(button.textContent, 'เปิดเพลง');
  assert.deepEqual(messages, [], 'a blocked automatic attempt is silent, not an error toast');

  audio.rejectPlay = false;
  await button.click();
  assert.equal(audio.playCount, 2);
  assert.equal(button.attributes.get('aria-pressed'), 'true');
  assert.equal(button.textContent, 'ปิดเพลง');
});

test('a failed manual retry keeps music off and reports the playback error', async () => {
  const { audio, button, messages } = createFixture({ rejectPlay: true });
  await settleAutoplay();
  await button.click();
  assert.equal(audio.playCount, 2);
  assert.equal(button.disabled, false);
  assert.equal(button.attributes.get('aria-pressed'), 'false');
  assert.equal(button.textContent, 'เปิดเพลง');
  assert.deepEqual(messages, ['ไม่สามารถเล่นเพลงได้ กรุณาลองอีกครั้ง']);
});

test('school logo is used for the browser tab and ASTRAEA brand mark', async () => {
  assert.match(html, /<link rel="icon" type="image\/png" sizes="192x192" href="\/assets\/school-favicon\.png">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/school-favicon\.png">/);
  assert.match(html, /<span class="brand-mark"><img src="\/assets\/school-logo\.png" width="42" height="42" alt="" aria-hidden="true"><\/span>/);
  const logo = await readFile(new URL('../public/assets/school-logo.png', import.meta.url));
  const favicon = await readFile(new URL('../public/assets/school-favicon.png', import.meta.url));
  assert.ok(logo.byteLength > 100_000, 'school logo file exists');
  assert.ok(favicon.byteLength > 10_000, 'school favicon file exists');
});

test('when autoplay is blocked, the first tap/click anywhere starts the music', async () => {
  const { audio, document } = createFixture({ rejectPlay: true, withDocument: true });
  await settleAutoplay();
  assert.equal(audio.paused, true);
  assert.ok(document.handlers.has('pointerup') && document.handlers.has('click'));
  await document.fire('click');
  assert.equal(audio.paused, true, 'still blocked: listener stays armed');
  audio.rejectPlay = false;
  await document.fire('click');
  assert.equal(audio.paused, false);
  assert.equal(document.handlers.size, 0, 'listeners removed after music starts');
});

test('a user who turned the music off is not restarted by later taps', async () => {
  const { audio, button, document } = createFixture({ withDocument: true });
  await settleAutoplay();
  await button.click();
  assert.equal(audio.paused, true);
  await document.fire('click');
  assert.equal(audio.paused, true);
});
