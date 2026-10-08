#!/usr/bin/env node
// Compare two versions of a web project visually and functionally: git ref vs git ref, ref vs working tree, or two URLs.
// Prints a tiny summary; details go to .compare-out/run/report.html
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { execFileSync, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
const options = Object.fromEntries(args.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')));
const refs = args.filter((a) => !a.startsWith('--'));

const repo = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
})();
const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex');
const slugify = (text) => text.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-$/, '') || 'home';
const seconds = (since) => ((Date.now() - since) / 1000).toFixed(1);
const isUrl = (text) => /^https?:\/\//.test(text ?? '');

const repoName = path.basename(repo);
const outRoot = path.join(repo, '.compare-out');
const runDir = path.join(outRoot, 'run');
const configPath = path.join(repo, '.branch-compare.json');

if (flags.has('--clean')) {
  const worktrees = git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
    .filter((dir) => dir.includes('__cmp-'));
  for (const dir of worktrees) git('worktree', 'remove', '--force', dir);
  git('worktree', 'prune');
  fs.rmSync(outRoot, { recursive: true, force: true });
  console.log('cleaned worktrees and .compare-out');
  process.exit(0);
}

if (!fs.existsSync(configPath)) {
  console.error(`missing ${configPath} (see references/config.md for the format)`);
  process.exit(1);
}
const config = {
  viewports: [375, 768, 1440],
  pages: ['/'],
  hide: [],
  build: [],
  motion: [],
  watch: ['build', 'dist'],
  base: 'main',
  concurrency: 3,
  minDiffPx: 50,
  ...JSON.parse(fs.readFileSync(configPath, 'utf8')),
};
const pages = config.pages.map((entry) => (typeof entry === 'string' ? { path: entry } : entry));
const captureHash = sha1(JSON.stringify(config.hide));

const mode = isUrl(refs[0]) ? 'urls' : config.mode ?? (config.serve ? 'serve' : config.baseUrl ? 'wordpress-theme' : null);
if (!mode) {
  console.error('config needs "serve" (any project), or "mode": "wordpress-theme" with "baseUrl", or pass two URLs');
  process.exit(1);
}
if (mode === 'urls' && !isUrl(refs[1])) {
  console.error('urls mode needs two URLs: compare.mjs <urlA> <urlB>');
  process.exit(1);
}

// ---------- servers started for serve mode ----------

const servers = [];
const stopServers = () => {
  for (const child of servers.splice(0)) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
};
process.on('exit', stopServers);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(1));

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

async function waitUntilUp(url, child) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early (code ${child.exitCode}): ${config.serve.command}`);
    try {
      await fetch(url);
      return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server not reachable at ${url} after 60s`);
}

async function startServer(dir) {
  const port = await freePort();
  const command = config.serve.command.replaceAll('{port}', String(port));
  const child = spawn(command, {
    cwd: path.join(dir, config.serve.cwd ?? '.'),
    shell: true,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PORT: String(port), ...config.serve.env },
  });
  servers.push(child);
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilUp(baseUrl + (config.serve.ready ?? '/'), child);
  return baseUrl;
}

// ---------- sides (what is being compared) ----------

const MU_PLUGIN = `<?php
// branch-compare: serve a theme worktree for requests carrying the cmp_theme cookie. Local dev only.
$cmp_theme = $_COOKIE['cmp_theme'] ?? '';
$cmp_host = $_SERVER['HTTP_HOST'] ?? '';
if ($cmp_theme && preg_match('/^[A-Za-z0-9_-]+__cmp-[a-f0-9]{7,40}$/', $cmp_theme)
    && preg_match('/\\.(test|localhost)(:\\d+)?$/', $cmp_host)
    && is_dir(WP_CONTENT_DIR . '/themes/' . $cmp_theme)) {
    $cmp_original = explode('__cmp-', $cmp_theme)[0];
    add_filter('pre_option_stylesheet', fn() => $cmp_theme);
    add_filter('pre_option_template', fn() => $cmp_theme);
    add_filter("pre_option_theme_mods_$cmp_theme", fn() => get_option("theme_mods_$cmp_original"));
}
`;

function ensureMuPlugin() {
  const muDir = path.join(path.dirname(repo), '..', 'mu-plugins');
  const file = path.join(muDir, 'branch-compare.php');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === MU_PLUGIN) return;
  fs.mkdirSync(muDir, { recursive: true });
  fs.writeFileSync(file, MU_PLUGIN);
  console.log(`installed ${path.relative(process.cwd(), file)}`);
}

function ensureExcluded() {
  const excludeFile = path.resolve(repo, git('rev-parse', '--git-path', 'info/exclude'));
  const current = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, 'utf8') : '';
  const missing = ['.compare-out/', '.branch-compare.json'].filter((line) => !current.includes(line));
  if (missing.length) fs.appendFileSync(excludeFile, `\n${missing.join('\n')}\n`);
}

function dirStamp(dir) {
  if (!fs.existsSync(dir)) return '';
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const file = path.join(entry.parentPath ?? entry.path, entry.name);
      return `${file}:${fs.statSync(file).mtimeMs}`;
    })
    .join('\n');
}

function liveSide() {
  const head = git('rev-parse', 'HEAD');
  const dirtyDiff = git('diff', 'HEAD');
  const untracked = git('ls-files', '-o', '--exclude-standard');
  const buildStamp = config.watch.map((dir) => dirStamp(path.join(repo, dir))).join('\n');
  const isDirty = Boolean(dirtyDiff || untracked);
  return {
    label: `live@${head.slice(0, 7)}${isDirty ? '+dirty' : ''}`,
    key: sha1(head + dirtyDiff + untracked + buildStamp),
  };
}

function ensureWorktree(ref) {
  const sha = git('rev-parse', '--verify', `${ref}^{commit}`);
  const slug = `${repoName}__cmp-${sha.slice(0, 7)}`;
  const parent = mode === 'wordpress-theme' ? path.dirname(repo) : path.join(os.tmpdir(), 'branch-compare');
  const dir = path.join(parent, slug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(parent, { recursive: true });
    git('worktree', 'add', '--detach', dir, sha);
  }
  const builtMarker = path.join(dir, '.cmp-built');
  if (!fs.existsSync(builtMarker)) {
    for (const command of config.build) execSync(command, { cwd: dir, stdio: 'pipe', maxBuffer: 1 << 26 });
    fs.writeFileSync(builtMarker, '');
  }
  return { sha, slug, dir };
}

async function resolveSide(ref) {
  if (mode === 'urls') return { label: new URL(ref).host, baseUrl: ref.replace(/\/$/, ''), key: crypto.randomUUID() };

  if (mode === 'wordpress-theme') {
    if (ref === 'live') return { ...liveSide(), slug: repoName, cookie: false, baseUrl: config.baseUrl };
    const { sha, slug } = ensureWorktree(ref);
    return { label: `${ref}@${sha.slice(0, 7)}`, slug, cookie: true, key: sha, baseUrl: config.baseUrl };
  }

  if (ref === 'live') return { ...liveSide(), baseUrl: await startServer(repo) };
  const { sha, dir } = ensureWorktree(ref);
  return { label: `${ref}@${sha.slice(0, 7)}`, key: sha, baseUrl: await startServer(dir) };
}

async function assertReachable(side) {
  const response = await fetch(side.baseUrl, { headers: side.cookie ? { cookie: `cmp_theme=${side.slug}` } : {} }).catch((error) => {
    throw new Error(`cannot reach ${side.baseUrl}: ${error.cause?.code ?? error.message}`);
  });
  if (response.status >= 500) throw new Error(`${side.baseUrl} answered ${response.status}`);
  if (side.cookie && !(await response.text()).includes(`/themes/${side.slug}/`)) {
    throw new Error(`theme switch failed for ${side.slug}: mu-plugin not active or page cache in the way`);
  }
}

// ---------- browser ----------

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch {
    const roots = [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright')];
    for (const root of roots.filter(fs.existsSync)) {
      const shells = fs.readdirSync(root).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse();
      for (const shell of shells) {
        const inner = fs.readdirSync(path.join(root, shell)).find((n) => n.startsWith('chrome-headless-shell'));
        const executablePath = inner && path.join(root, shell, inner, 'chrome-headless-shell');
        if (executablePath && fs.existsSync(executablePath)) return chromium.launch({ executablePath });
      }
    }
    return chromium.launch({ channel: 'chrome' });
  }
}

const FREEZE_CSS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';

async function openPage(browser, side, width, height = 900) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  if (side.cookie) await context.addCookies([{ name: 'cmp_theme', value: side.slug, url: side.baseUrl }]);
  const siteOrigin = new URL(side.baseUrl).origin;
  await context.route('**/*', (route) => (route.request().url().startsWith(siteOrigin) ? route.continue() : route.abort('blockedbyclient')));
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const problems = new Set();
  page.on('console', (m) => m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(m.text()) && problems.add(`console: ${m.text().slice(0, 140)}`));
  page.on('pageerror', (e) => problems.add(`js: ${e.message.slice(0, 140)}`));
  page.on('requestfailed', (r) => !/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT/.test(r.failure()?.errorText ?? '') && problems.add(`failed: ${r.url().split('?')[0]}`));
  page.on('response', (r) => r.status() >= 400 && problems.add(`${r.status()}: ${r.url().split('?')[0]}`));
  return { context, page, problems };
}

async function prepare(page, { freeze }) {
  const hideCss = config.hide.length ? `${config.hide.join(',')}{visibility:hidden!important}` : '';
  const css = (freeze ? FREEZE_CSS : '') + hideCss;
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    document.querySelectorAll('video').forEach((v) => { v.pause(); v.currentTime = 0; });
    // lazy images load at unpredictable moments, which makes the screenshots flaky: load them all up front
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    document.querySelectorAll('img[data-lazy-src]').forEach((i) => { i.src = i.dataset.lazySrc; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await wait(60); }
    scrollTo(0, 0);
    const imagesLoaded = Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))));
    await Promise.race([imagesLoaded, wait(6000)]);
    await document.fonts.ready;
    let lastHeight = -1;
    for (let tries = 0; tries < 20; tries++) {
      await wait(200);
      const height = document.documentElement.scrollHeight;
      if (height === lastHeight) break;
      lastHeight = height;
    }
  });
}

// ---------- static comparison ----------

async function captureStatic(browser, side, pageEntry, width, forceFresh = false) {
  const id = `${slugify(pageEntry.name ?? pageEntry.path)}_${width}`;
  const cacheDir = path.join(outRoot, 'cache', sha1(side.key + captureHash).slice(0, 12));
  const file = path.join(cacheDir, `${id}.png`);
  const metaFile = path.join(cacheDir, `${id}.json`);
  if (!forceFresh && !flags.has('--fresh') && fs.existsSync(file) && fs.existsSync(metaFile)) {
    return { file, ...JSON.parse(fs.readFileSync(metaFile, 'utf8')) };
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const { context, page, problems } = await openPage(browser, side, width);
  try {
    const response = await page.goto(side.baseUrl + pageEntry.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (response && response.status() >= 400) problems.add(`http ${response.status()} on main document`);
    await prepare(page, { freeze: true });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const text = sha1(await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')));
    if (pageEntry.selector) await page.locator(pageEntry.selector).first().screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage: true });
    const meta = { problems: [...problems], text, confirmed: forceFresh };
    fs.writeFileSync(metaFile, JSON.stringify(meta));
    return { file, ...meta };
  } finally {
    await context.close();
  }
}

function padTo(png, width, height) {
  if (png.width === width && png.height === height) return png;
  const padded = new PNG({ width, height });
  padded.data.fill(255);
  PNG.bitblt(png, padded, 0, 0, png.width, png.height, 0, 0);
  return padded;
}

function diffImages(a, b) {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const [padA, padB] = [padTo(a, width, height), padTo(b, width, height)];
  const diff = new PNG({ width, height });
  const changed = pixelmatch(padA.data, padB.data, diff.data, width, height, { threshold: 0.1 });
  return { diff, changed, pct: (changed / (width * height)) * 100, width, height, padA, padB };
}

function changedRowRange(diff) {
  let first = -1;
  let last = -1;
  for (let y = 0; y < diff.height; y++) {
    for (let x = 0; x < diff.width; x++) {
      const i = (y * diff.width + x) * 4;
      if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  return [first, last];
}

async function measureStatic(browser, sides, pageEntry, width, forceFresh) {
  const [a, b] = await Promise.all(sides.map((side) => captureStatic(browser, side, pageEntry, width, forceFresh)));
  const imageA = PNG.sync.read(fs.readFileSync(a.file));
  const imageB = PNG.sync.read(fs.readFileSync(b.file));
  return { a, b, imageA, imageB, ...diffImages(imageA, imageB) };
}

async function compareStatic(browser, sides, pageEntry, width) {
  let measured = await measureStatic(browser, sides, pageEntry, width, false);
  // pages can render slightly differently per load: only trust a diff that survives a second capture
  const isConfirmed = measured.a.confirmed && measured.b.confirmed;
  if (measured.changed >= config.minDiffPx && !isConfirmed) measured = await measureStatic(browser, sides, pageEntry, width, true);
  const { a, b, imageA, imageB, diff, changed, pct } = measured;
  const result = {
    kind: 'static',
    id: `${slugify(pageEntry.name ?? pageEntry.path)}_${width}`,
    title: `${pageEntry.path}${pageEntry.selector ? ` [${pageEntry.selector}]` : ''} @${width}`,
    changed,
    pct,
    sizes: [`${imageA.width}x${imageA.height}`, `${imageB.width}x${imageB.height}`],
    newProblems: b.problems.filter((p) => !a.problems.includes(p)),
    fixedProblems: a.problems.filter((p) => !b.problems.includes(p)),
    textChanged: a.text !== b.text,
    isDifferent: changed >= config.minDiffPx,
  };
  if (result.isDifferent) {
    const shots = path.join(runDir, 'shots');
    fs.mkdirSync(shots, { recursive: true });
    fs.copyFileSync(a.file, path.join(shots, `${result.id}-a.png`));
    fs.copyFileSync(b.file, path.join(shots, `${result.id}-b.png`));
    fs.writeFileSync(path.join(shots, `${result.id}-diff.png`), PNG.sync.write(diff));
    result.rows = changedRowRange(diff);
  }
  return result;
}

// ---------- motion comparison (hover, modal open, ...) ----------

async function runStep(page, step) {
  if (step.hover) return page.locator(step.hover).first().hover();
  if (step.click) return page.locator(step.click).first().click();
  if (step.focus) return page.locator(step.focus).first().focus();
  if (step.press) return page.keyboard.press(step.press);
  if (step.fill) return page.locator(step.fill[0]).first().fill(step.fill[1]);
  if (step.scroll != null) return page.evaluate((y) => scrollTo(0, y), step.scroll);
  if (step.wait) return page.waitForTimeout(step.wait);
  throw new Error(`unknown step ${JSON.stringify(step)}`);
}

async function findClip(page, scenario, width, height) {
  const target = scenario.region ?? scenario.action.hover ?? scenario.action.click ?? scenario.action.focus ?? 'viewport';
  if (target === 'viewport') return { x: 0, y: 0, width, height };
  const locator = page.locator(target).first();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const pad = scenario.pad ?? 24;
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  return {
    x,
    y,
    width: Math.min(width - x, Math.ceil(box.width + pad * 2)),
    height: Math.min(height - y, Math.ceil(box.height + pad * 2)),
  };
}

async function captureMotion(browser, side, scenario, knownClip) {
  const width = scenario.viewport ?? 1440;
  const height = scenario.height ?? 900;
  const frameCount = scenario.frames ?? 12;
  const duration = scenario.duration ?? 500;
  const { context, page } = await openPage(browser, side, width, height);
  try {
    await page.goto(side.baseUrl + scenario.page, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await prepare(page, { freeze: false });
    for (const step of scenario.setup ?? []) await runStep(page, step);
    await page.waitForTimeout(scenario.settle ?? 300);
    const clip = knownClip ?? (await findClip(page, scenario, width, height));
    await page.mouse.move(0, 0);
    const shoot = () => page.screenshot({ clip });
    const frames = [];
    // loops that never end would differ per timing; park them at the start so frames stay comparable
    await page.evaluate(() => {
      window.__cmpBefore = new Set(document.getAnimations());
      document.getAnimations().forEach((a) => {
        if (a.effect?.getComputedTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; }
      });
    });
    let warning = null;
    if (scenario.realtime) {
      frames.push(await shoot());
      const acting = runStep(page, scenario.action);
      for (let i = 1; i < frameCount; i++) {
        await page.waitForTimeout(duration / (frameCount - 1));
        frames.push(await shoot());
      }
      await acting;
    } else {
      await runStep(page, scenario.action);
      const started = await page.evaluate(() => {
        window.__cmpNew = document.getAnimations().filter((a) => !window.__cmpBefore.has(a));
        window.__cmpNew.forEach((a) => a.pause());
        return window.__cmpNew.length;
      });
      if (started === 0) {
        warning = 'no CSS animation started (JS-driven?) - try "realtime": true';
        frames.push(await shoot());
      } else {
        for (let i = 0; i < frameCount; i++) {
          const time = (duration * i) / (frameCount - 1);
          await page.evaluate((t) => window.__cmpNew.forEach((a) => { a.currentTime = t; }), time);
          frames.push(await shoot());
        }
      }
    }
    return { frames, clip, warning };
  } finally {
    await context.close();
  }
}

function sideBySide(imageA, imageB, diff) {
  const gap = 6;
  const { width, height } = imageA;
  const canvas = new PNG({ width: width * 3 + gap * 2, height });
  canvas.data.fill(110);
  [imageA, imageB, diff].forEach((image, index) => PNG.bitblt(image, canvas, 0, 0, width, height, index * (width + gap), 0));
  return canvas;
}

async function compareMotion(browser, sides, scenario) {
  const result = { kind: 'motion', id: scenario.name, title: `motion ${scenario.name}` };
  const first = await captureMotion(browser, sides[0], scenario);
  const second = await captureMotion(browser, sides[1], scenario, first.clip);
  result.warning = first.warning ?? second.warning;
  const composites = [];
  let maxChanged = 0;
  const count = Math.min(first.frames.length, second.frames.length);
  for (let i = 0; i < count; i++) {
    const imageA = PNG.sync.read(first.frames[i]);
    const imageB = PNG.sync.read(second.frames[i]);
    const { diff, changed } = diffImages(imageA, imageB);
    maxChanged = Math.max(maxChanged, changed);
    composites.push(sideBySide(imageA, imageB, diff));
  }
  result.changed = maxChanged;
  result.pct = (maxChanged / (first.clip.width * first.clip.height)) * 100;
  result.isDifferent = maxChanged >= config.minDiffPx;
  if (result.isDifferent) {
    try {
      result.gif = writeGif(scenario, composites);
    } catch {
      result.warning = [result.warning, 'GIF not written (is ffmpeg installed?)'].filter(Boolean).join('; ');
    }
  }
  return result;
}

function writeGif(scenario, composites) {
  const framesDir = path.join(runDir, 'motion', `${scenario.name}-frames`);
  fs.mkdirSync(framesDir, { recursive: true });
  const sequence = [composites[0], composites[0], ...composites, ...Array(composites.length > 1 ? 6 : 0).fill(composites.at(-1))];
  sequence.forEach((canvas, i) => fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(3, '0')}.png`), PNG.sync.write(canvas)));
  const gifFile = path.join(runDir, 'motion', `${scenario.name}.gif`);
  try {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', String(scenario.fps ?? 8),
      '-i', path.join(framesDir, 'f%03d.png'),
      '-vf', "scale='min(1000,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer",
      gifFile,
    ]);
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
  return path.relative(runDir, gifFile);
}

// ---------- report ----------

function renderReport(labels, results) {
  const esc = (text) => String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const items = results.filter((r) => r.isDifferent).map((r) => {
    if (r.kind === 'motion') {
      return `<section><h2>${esc(r.title)} <small>${r.pct.toFixed(2)}% max frame diff</small></h2>
        <p class="note">A | B | diff</p>${r.gif ? `<img src="${r.gif}">` : ''}${r.warning ? `<p class="warn">${esc(r.warning)}</p>` : ''}</section>`;
    }
    const problems = [...r.newProblems.map((p) => `+ ${p}`), ...r.fixedProblems.map((p) => `- ${p}`)];
    return `<section><h2>${esc(r.title)} <small>${r.pct.toFixed(2)}% (${r.changed}px) rows ${r.rows?.join('-')} | A ${r.sizes[0]} B ${r.sizes[1]}</small></h2>
      <div class="swipe" style="--p:50%"><img src="shots/${r.id}-a.png"><img class="top" src="shots/${r.id}-b.png">
        <input type="range" min="0" max="100" value="50" oninput="this.parentNode.style.setProperty('--p',this.value+'%')"></div>
      <details><summary>A | B | diff</summary><div class="trio"><img src="shots/${r.id}-a.png"><img src="shots/${r.id}-b.png"><img src="shots/${r.id}-diff.png"></div></details>
      ${problems.length ? `<pre>${esc(problems.join('\n'))}</pre>` : ''}</section>`;
  });
  return `<!doctype html><meta charset=utf-8><title>branch-compare</title><style>
    :root{color-scheme:light dark;font:14px system-ui}body{margin:0;padding:1rem 1.25rem;background:Canvas;color:CanvasText}
    h1{font-size:1.1rem}h2{font-size:1rem;margin:2rem 0 .5rem}small{font-weight:400;opacity:.7}
    img{max-width:100%;display:block}.swipe{position:relative;max-width:1200px}
    .swipe .top{position:absolute;inset:0;clip-path:inset(0 0 0 var(--p))}
    .swipe input{position:sticky;bottom:0;width:100%}.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .note,.warn,pre{opacity:.8}.warn{color:#b45309}pre{white-space:pre-wrap}
  </style><h1>A = ${esc(labels[0])} &nbsp; B = ${esc(labels[1])} &nbsp; (swipe: left = A, right = B)</h1>${items.join('') || '<p>No differences.</p>'}`;
}

function openReport(file) {
  const [command, ...prefix] = { darwin: ['open'], win32: ['cmd', '/c', 'start', ''] }[process.platform] ?? ['xdg-open'];
  try {
    execFileSync(command, [...prefix, file], { stdio: 'ignore' });
  } catch {}
}

// ---------- main ----------

async function runPool(tasks, size) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]().catch((error) => ({ failed: true, title: tasks[index].title, error: String(error.message).split('\n')[0] }));
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

const startedAt = Date.now();
if (mode !== 'urls') ensureExcluded();
if (mode === 'wordpress-theme') ensureMuPlugin();
const refA = refs[0] ?? config.base;
const refB = refs[1] ?? 'live';
const sides = await Promise.all([resolveSide(refA), resolveSide(refB)]);
await Promise.all(sides.map(assertReachable));

const onlyFilter = options.only;
const staticTasks = flags.has('--no-static') ? [] : pages
  .filter((p) => !onlyFilter || p.path.includes(onlyFilter))
  .flatMap((p) => config.viewports.map((width) => Object.assign(() => compareStatic(browser, sides, p, width), { title: `${p.path} @${width}` })));
const motionTasks = flags.has('--no-motion') ? [] : config.motion
  .filter((m) => !onlyFilter || m.name.includes(onlyFilter))
  .map((m) => Object.assign(() => compareMotion(browser, sides, m), { title: `motion ${m.name}` }));

fs.rmSync(runDir, { recursive: true, force: true });
fs.mkdirSync(runDir, { recursive: true });
const browser = await launchBrowser();
const results = await runPool([...staticTasks, ...motionTasks], config.concurrency);
await browser.close();
stopServers();

const labels = sides.map((s) => s.label);
fs.writeFileSync(path.join(runDir, 'report.html'), renderReport(labels, results));

const failed = results.filter((r) => r.failed);
const compared = results.filter((r) => !r.failed);
const different = compared.filter((r) => r.isDifferent).sort((x, y) => y.pct - x.pct);
const lines = [`A=${labels[0]}  B=${labels[1]}  ${staticTasks.length} shots, ${motionTasks.length} motion, ${seconds(startedAt)}s`];
for (const r of different.slice(0, 12)) {
  const where = r.kind === 'motion' ? `${r.gif ?? 'no gif'}${r.warning ? ` (${r.warning})` : ''}` : `rows ${r.rows.join('-')}${r.sizes[0] !== r.sizes[1] ? ` size ${r.sizes[0]}->${r.sizes[1]}` : ''}`;
  lines.push(`DIFF ${r.title} ${r.pct.toFixed(2)}% ${where}`);
}
if (different.length > 12) lines.push(`... +${different.length - 12} more diffs in report`);
lines.push(`SAME ${compared.filter((r) => !r.isDifferent).length}`);
for (const r of compared.filter((r) => r.newProblems?.length).slice(0, 5)) lines.push(`ERR+ ${r.title}: ${r.newProblems[0]}${r.newProblems.length > 1 ? ` (+${r.newProblems.length - 1})` : ''}`);
const textChanged = compared.filter((r) => r.textChanged).map((r) => r.title);
if (textChanged.length) lines.push(`TEXT changed: ${textChanged.slice(0, 6).join(', ')}${textChanged.length > 6 ? ', ...' : ''}`);
for (const r of failed) lines.push(`FAIL ${r.title}: ${r.error}`);
lines.push(`report: ${path.join(runDir, 'report.html')}`);
console.log(lines.join('\n'));

if (different.length && !flags.has('--no-open')) openReport(path.join(runDir, 'report.html'));
