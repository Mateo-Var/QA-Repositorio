'use strict'

/**
 * publish-report.js
 * Genera el reporte Allure, inyecta dark mode, lo sube a gh-pages
 * en una subcarpeta con timestamp y actualiza el index.html.
 * Si hubo tests fallidos, envía notificación a Slack via webhook.
 *
 * Uso: node scripts/publish-report.js [ruta-allure-results]
 * Requiere: SLACK_WEBHOOK_URL en .env o variable de entorno (opcional)
 */

const { execSync } = require('child_process')
const https = require('https')
const fs    = require('fs')
const path  = require('path')

// Cargar .env si existe
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  })
}

const APP_ID     = (process.env.APP_ID || 'tvnPass').trim()
const GH_REPO    = process.env.GITHUB_REPOSITORY || ''
const [ghOwner, ghRepo] = GH_REPO.split('/')

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(srcPath, destPath)
    else fs.copyFileSync(srcPath, destPath)
  }
}

const ROOT         = path.join(__dirname, '..')
const RESULTS_DIR  = process.argv[2]
  ? path.resolve(ROOT, process.argv[2])
  : path.join(ROOT, 'reports', APP_ID, 'allure-results')
const REPORT_SRC   = path.join(ROOT, 'reports', APP_ID, 'allure-report')
const WORKTREE_DIR = path.join(ROOT, '.gh-pages-worktree')
const REMOTE       = 'origin'
const BRANCH       = 'gh-pages'
const BASE_URL     = process.env.GITHUB_PAGES_URL
  || (ghOwner && ghRepo ? `https://${ghOwner}.github.io/${ghRepo}` : '')

// ── CSS dark mode ─────────────────────────────────────────────────────────────
const DARK_MODE_CSS = `
<style id="qa-dark-override">
  :root { color-scheme: dark; }
  body, .app { background: #0d1117 !important; color: #e6edf3 !important; }
  .link { color: #58a6ff !important; }
  .table__row { color: #e6edf3 !important; }
  .tree__info { color: #e6edf3 !important; }
  .node { color: #e6edf3 !important; }
  .sorter_enabled { color: #e6edf3 !important; }
  .pane__subtitle { color: #8b949e !important; }
  .splash__subtitle { color: #8b949e !important; }
  .popover { background: #161b22 !important; color: #e6edf3 !important; border-color: #30363d !important; }
  .hljs { background: #1c2128 !important; color: #e6edf3 !important; }
  .side-nav, .side-nav__list { background: #161b22 !important; border-color: #30363d !important; }
  .side-nav__item a, .side-nav__item span { color: #8b949e !important; }
  .side-nav__item.active a { color: #58a6ff !important; background: #1c2128 !important; }
  .widget, .card, .summary, .chart-widget { background: #161b22 !important; border-color: #30363d !important; }
  .widget__title, .card__title { color: #8b949e !important; }
  svg text { fill: #8b949e !important; }
  .y-axis text, .x-axis text { fill: #8b949e !important; }
  .chart__legend-text, .summary-widget__stats span,
  .widget__column span, .widget__flex-line span { color: #e6edf3 !important; }
  .header { background: #161b22 !important; border-bottom: 1px solid #30363d !important; }
  .header__name { color: #e6edf3 !important; }
  .tab, .tabs__tab { color: #8b949e !important; background: #161b22 !important; }
  .tab.active, .tabs__tab_active { color: #58a6ff !important; border-color: #58a6ff !important; }
  .table__row, tr { border-color: #21262d !important; }
  .table__row:hover, tr:hover { background: #1c2128 !important; }
  .status-line { background: #161b22 !important; }
  .tag, .badge { background: #1c2128 !important; color: #8b949e !important; }
  a { color: #58a6ff !important; }
  .passed .status, .status_passed { color: #3fb950 !important; }
  .failed .status, .status_failed { color: #f85149 !important; }
  .broken .status, .status_broken { color: #8b949e !important; }
  .skipped .status, .status_skipped { color: #8b949e !important; }
  .chart__fill_status_broken { fill: #f85149 !important; }
  .bar__fill_status_broken, .label_status_broken,
  .chart__legend-icon_status_broken, .y-label_status_broken { background: #f85149 !important; }
  .text_status_broken, .n-label_status_broken { color: #f85149 !important; }
  .status-details_status_broken  { background: #1f1500 !important; border-color: #f85149 !important; }
  .status-details_status_failed  { background: #1f0000 !important; border-color: #f85149 !important; }
  .alert_status_broken  { background: #2a1c00 !important; color: #ffd050 !important; }
  .alert_status_failed  { background: #2d0a0a !important; color: #f85149 !important; }
  .table__row_active { background: #1c2128 !important; }
  .node__title_active, .node__title_active:before { background: #1c2128 !important; }
  .node__title:hover, .node__title:hover:before { background: #21262d !important; }
  .step__title:hover, .step__title:hover:before { background: #21262d !important; }
  .button_active { background: #30363d !important; }
  .tab_active > a, .tab_active > a:hover { border-bottom-color: #58a6ff !important; }
  .island { background: #161b22 !important; border-color: #30363d !important; }
  .side-nav__item:has(a[href="#suites"]),
  .side-nav__item:has(a[href="#categories"]),
  .side-nav__item:has(a[href="#graph"]),
  .side-nav__item:has(a[href="#timeline"]),
  .side-nav__item:has(a[href="#behaviors"]),
  .side-nav__item:has(a[href="#packages"]) { display: none !important; }
</style>
`

const WIDGET_LAYOUT = `
<style id="qa-widget-layout">
  .widgets-grid { display: flex !important; flex-direction: column !important; width: 100% !important; margin: 0 !important; }
  .widgets-grid__col { width: 100% !important; flex: none !important; max-width: 100% !important; padding: 0 !important; }
  .widget.island { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; margin-bottom: 20px !important; }
  .widget[data-id] { display: none !important; }
  .widget[data-id="summary"], .widget[data-id="suites"] { display: block !important; }
  .summary-widget__chart text { fill: #ffffff !important; font-weight: bold; font-family: monospace; }
  .bar { height: 24px !important; border-radius: 4px !important; }
  .bar__fill { height: 24px !important; }
  .widget__body { width: 100% !important; box-sizing: border-box !important; }
</style>

<script id="qa-widget-hider">
(function () {
  function removeUnwanted() {
    document.querySelectorAll('.widget').forEach(function (w) {
      if (w.getAttribute('data-id') !== 'summary' && w.getAttribute('data-id') !== 'suites') w.remove();
    });
  }
  [100, 300, 800, 1500].forEach(function (t) { setTimeout(removeUnwanted, t); });
})();
</script>

<script id="qa-custom-summary-v11-stable">
(function () {
  const VERSION = 'V11-STABLE';
  function addVersionBadge() {
    var bId = 'qa-version-badge-v11';
    if (document.getElementById(bId)) return;
    var b = document.createElement('div');
    b.id = bId;
    b.style.cssText = 'position:fixed;bottom:10px;right:12px;background:rgba(0,100,0,0.9);color:#fff;padding:6px 14px;border-radius:6px;font-family:monospace;font-size:11px;z-index:999999;border:2px solid #58a6ff;font-weight:bold;';
    b.innerHTML = 'QA TOOLS ' + VERSION + ' - ACTIVE';
    document.body.appendChild(b);
  }
  window.__qaTargets = null;
  window.__qaFilterBusy = false;
  window.applyAllureFilter = function(targets) {
    window.__qaTargets = targets;
    if (location.hash.indexOf('#suites') !== -1) { applyFilterWhenReady(); }
    else { location.hash = '#suites'; }
  };
  function forceClick(el) {
    if (!el) return;
    try { el.click(); el.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true })); } catch(e) {}
  }
  function applyFilterWhenReady() {
    if (window.__qaFilterBusy || !window.__qaTargets) return;
    if (location.hash.indexOf('#suites') === -1) return;
    var container = document.querySelector('.status-toggle');
    if (!container) { setTimeout(applyFilterWhenReady, 150); return; }
    window.__qaFilterBusy = true;
    var targets = window.__qaTargets;
    window.__qaTargets = null;
    var statuses = ['passed', 'failed', 'broken', 'skipped', 'unknown'];
    var delay = 0;
    statuses.forEach(function(st) {
      setTimeout(function() {
        var btn = document.querySelector('.status-toggle__item_status_' + st);
        if (!btn) return;
        var isActive = btn.classList.contains('status-toggle__item_active');
        var shouldBeActive = targets.indexOf(st) !== -1 || targets.indexOf('all') !== -1;
        if (isActive !== shouldBeActive) forceClick(btn);
      }, delay);
      delay += 120;
    });
    setTimeout(function() { window.__qaFilterBusy = false; }, delay + 200);
  }
  function modifySummary() {
    addVersionBadge();
    applyFilterWhenReady();
    var summary = document.querySelector('.widget[data-id="summary"]');
    if (!summary || summary.hasAttribute('data-customized-v11')) return;
    summary.setAttribute('data-customized-v11', 'true');
    var styleId = 'qa-layout-fix-v11';
    if (!document.getElementById(styleId)) {
      var st = document.createElement('style');
      st.id = styleId;
      st.innerHTML = '.widget[data-id="summary"] .summary-widget{display:flex!important;flex-direction:row!important;width:100%!important;gap:40px!important;align-items:flex-start!important;padding:10px 0!important}.widget[data-id="summary"] .summary-widget__stats{display:flex!important;flex-direction:column!important;width:50%!important;flex:1!important;min-width:0!important;margin:0!important;justify-content:center!important;align-items:center!important;min-height:300px!important;text-align:center!important}.widget[data-id="summary"] .summary-widget__chart{display:block!important;width:50%!important;flex:1!important;min-height:300px!important}.widget[data-id="environment"],.widget[data-id="categories"],.widget[data-id="executors"],.widget[data-id="history"]{display:none!important}';
      document.head.appendChild(st);
    }
    var statsNode = summary.querySelector('.summary-widget__stats');
    if (statsNode) {
      Array.from(statsNode.children).forEach(function(child) {
        if (!child.classList.contains('widget__title')) child.remove();
      });
      var title = summary.querySelector('.widget__title');
      if (title) {
        title.style.cssText = 'margin:0!important;text-align:center!important;width:100%!important;display:block!important;font-weight:bold!important;color:#8b949e!important;font-size:20px!important;';
      }
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:100%;display:flex;justify-content:center;margin:0;padding:0;';
      var customBox = document.createElement('div');
      customBox.style.cssText = 'display:flex!important;flex-direction:column!important;gap:12px!important;width:100%!important;max-width:280px!important;margin:0 auto!important;';
      wrapper.appendChild(customBox);
      statsNode.appendChild(wrapper);
      fetch('widgets/summary.json').then(res => res.json()).then(data => {
        var s = data.statistic, t = data.time;
        var stDate = new Date(t.start);
        var dateStr = stDate.getDate() + '/' + (stDate.getMonth()+1) + '/' + stDate.getFullYear();
        var startStr = stDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        var endStr = new Date(t.stop).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        var durStr = Math.floor(t.duration/60000)+'m '+Math.floor((t.duration%60000)/1000)+'s';
        if (title) {
          title.innerHTML = 'QA REPORT ' + dateStr;
          var sub = document.createElement('div');
          sub.style.cssText = 'color:#8b949e;font-size:13px;margin:5px 0 20px 0!important;font-weight:normal;text-align:center!important;width:100%!important;display:block!important;';
          sub.innerHTML = startStr + ' - ' + endStr + ' (' + durStr + ')';
          title.after(sub);
        }
        function createCard(label, count, color, bg, targetList) {
          var card = document.createElement('div');
          card.style.cssText = 'background:'+bg+';border:1px solid #30363d;border-left:8px solid '+color+';border-radius:8px;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 6px rgba(0,0,0,0.3);cursor:pointer;transition:transform 0.1s;';
          card.onmouseover = function(){ this.style.filter='brightness(1.2)';this.style.transform='scale(1.02)'; };
          card.onmouseout  = function(){ this.style.filter='brightness(1)';this.style.transform='scale(1)'; };
          card.onclick = function(){ window.applyAllureFilter(targetList); };
          card.innerHTML = '<div style="font-size:13px;color:#c9d1d9;font-weight:600;text-transform:uppercase;pointer-events:none;">'+label+'</div><div style="font-size:28px;font-weight:bold;color:'+color+';pointer-events:none;">'+(count||0)+'</div>';
          return card;
        }
        var fallCount = (s.failed||0)+(s.broken||0);
        customBox.appendChild(createCard('Total Casos', s.total,   '#58a6ff', '#1f2428', ['all']));
        customBox.appendChild(createCard('Aprobados',   s.passed,  '#3fb950', '#1c2e22', ['passed']));
        customBox.appendChild(createCard('Fallidos',    fallCount, '#f85149', '#301c1c', ['failed','broken']));
        [100,500,1500].forEach(function(ti){ setTimeout(function(){ window.dispatchEvent(new Event('resize')); },ti); });
      }).catch(e => console.log('Error QA Summary:', e));
    }
  }
  var obs = new MutationObserver(function(){ modifySummary(); applyFilterWhenReady(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  [100,500,1500,3000].forEach(function(t){ setTimeout(modifySummary,t); });
})();
</script>
`

function buildLogoScript() {
  const logoPath = path.join(ROOT, 'assets', 'logo.png')
  if (!fs.existsSync(logoPath)) return ''
  const b64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
  return `
<script id="qa-logo-inject">
(function(){
  var SRC='${b64}';
  function replaceLogo(){
    var favicon=document.querySelector('link[rel="icon"]');
    if(favicon) favicon.href=SRC;
    var brand=document.querySelector('.side-nav__brand');
    if(document.querySelector('.qa-injected-logo')) return;
    if(brand){
      var img=document.createElement('img');
      img.src=SRC; img.className='qa-injected-logo';
      img.style.cssText='height:40px;width:auto;display:block;margin:0 auto;';
      brand.innerHTML=''; brand.appendChild(img);
    }
  }
  var obs=new MutationObserver(replaceLogo);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  [50,200,600,1500].forEach(function(t){setTimeout(replaceLogo,t);});
})();
</script>`
}

function injectDarkMode(reportDir) {
  const indexPath = path.join(reportDir, 'index.html')
  if (!fs.existsSync(indexPath)) return
  let html = fs.readFileSync(indexPath, 'utf8')
  // Remover inyecciones anteriores
  html = html.replace(/<style id="qa-dark-override">[\s\S]*?<\/style>\s*/g, '')
  html = html.replace(/<style id="qa-widget-layout">[\s\S]*?<\/style>\s*/g, '')
  html = html.replace(/<script id="qa-widget-hider">[\s\S]*?<\/script>\s*/g, '')
  html = html.replace(/<script id="qa-custom-summary[^"]*">[\s\S]*?<\/script>\s*/g, '')
  html = html.replace(/<script id="qa-logo-inject">[\s\S]*?<\/script>\s*/g, '')
  const logoPath = path.join(ROOT, 'assets', 'logo.png')
  if (fs.existsSync(logoPath)) {
    const b64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
    html = html.replace(/<link rel="icon" href="[^"]*">/, `<link rel="icon" href="${b64}">`)
  }
  html = html.replace('</head>', DARK_MODE_CSS + WIDGET_LAYOUT + buildLogoScript() + '</head>')
  fs.writeFileSync(indexPath, html)
}

function generateIndex(runsDir) {
  const runs = fs.existsSync(runsDir)
    ? fs.readdirSync(runsDir).filter(f => fs.statSync(path.join(runsDir, f)).isDirectory()).sort().reverse()
    : []

  const rows = runs.map((run, i) => {
    let passed = 0, failed = 0, total = 0
    try {
      const s = JSON.parse(fs.readFileSync(path.join(runsDir, run, 'widgets', 'summary.json'), 'utf8')).statistic
      passed = s.passed; failed = s.failed; total = s.total
    } catch (_) {}
    const isLatest    = i === 0
    const allPass     = +failed === 0
    const statusBadge = allPass
      ? `<span class="pass">✓ ${passed}/${total} pasaron</span>`
      : `<span class="fail">✖ ${failed} fallaron · ${passed}/${total} pasaron</span>`
    return `
      <tr${isLatest ? ' class="latest-row"' : ''}>
        <td>${isLatest ? '<span class="latest">LATEST</span> ' : ''}<a href="${BASE_URL}/runs/${run}/">${run.replace('_', ' ')}</a></td>
        <td>${statusBadge}</td>
        <td><a href="${BASE_URL}/runs/${run}/" class="btn">Ver reporte →</a></td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Kit-Ott-Suite — QA Reports</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh}
    header{background:#161b22;border-bottom:1px solid #30363d;padding:20px 40px;display:flex;align-items:center;gap:14px}
    .logo{font-size:22px}
    header h1{font-size:18px;font-weight:600}
    header p{color:#8b949e;font-size:13px;margin-top:2px}
    main{max-width:860px;margin:36px auto;padding:0 24px}
    h2{font-size:12px;color:#8b949e;margin-bottom:12px;text-transform:uppercase;letter-spacing:.08em}
    table{width:100%;border-collapse:collapse;background:#161b22;border-radius:10px;overflow:hidden;border:1px solid #30363d}
    th{background:#1c2128;color:#8b949e;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:10px 16px;text-align:left}
    td{padding:13px 16px;border-top:1px solid #21262d;font-size:14px;vertical-align:middle}
    tr:hover td{background:#1c2128}
    .latest-row td:first-child{border-left:2px solid #238636}
    td a{color:#58a6ff;text-decoration:none}
    td a:hover{text-decoration:underline}
    .latest{background:#238636;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:.04em}
    .pass{color:#3fb950;font-size:13px;font-weight:500}
    .fail{color:#f85149;font-size:13px;font-weight:500}
    .btn{background:#21262d;color:#e6edf3!important;padding:5px 12px;border-radius:6px;font-size:13px;border:1px solid #30363d;text-decoration:none!important;white-space:nowrap}
    .btn:hover{background:#30363d}
  </style>
</head>
<body>
  <header>
    <div class="logo">🧪</div>
    <div>
      <h1>Kit-Ott-Suite — QA Reports</h1>
      <p>${APP_ID} · Android · E2E</p>
    </div>
  </header>
  <main>
    <h2>Corridas (${runs.length})</h2>
    <table>
      <thead><tr><th>Fecha / Hora</th><th>Resultado</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#8b949e;padding:32px">Sin corridas aún</td></tr>'}</tbody>
    </table>
  </main>
</body>
</html>`
}

async function sendSlackNotification(stats, reportUrl, timestamp) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.log('\n⚠️  SLACK_WEBHOOK_URL no definida — omitiendo notificación Slack.')
    return
  }
  const { passed, failed, broken, total } = stats
  const realFailed = (failed || 0) + (broken || 0)
  if (realFailed === 0) {
    console.log('\n✅ Todos los tests pasaron — no se envía notificación a Slack.\n')
    return
  }
  const passRate  = total > 0 ? Math.round((passed / total) * 100) : 0
  const dateLabel = timestamp.replace('_', ' ')
  const appPkg    = process.env.ANDROID_APP_PACKAGE || APP_ID
  const failText  = broken > 0 ? `:x: ${failed} fallidos + :warning: ${broken} rotos` : `:x: ${realFailed}`
  const payload = {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `🚨 QA REPORT — ${realFailed} test${realFailed > 1 ? 's' : ''} fallaron`, emoji: true } },
      { type: 'divider' },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*❌ Fallidos*\n${failText}` },
        { type: 'mrkdwn', text: `*✅ Pasaron*\n${passed} / ${total}` },
        { type: 'mrkdwn', text: `*📊 Pass Rate*\n${passRate}%` },
        { type: 'mrkdwn', text: `*📱 App*\n${appPkg}` },
        { type: 'mrkdwn', text: `*🕐 Corrida*\n${dateLabel}` },
      ]},
      { type: 'divider' },
      { type: 'actions', elements: [
        { type: 'button', style: 'danger', text: { type: 'plain_text', text: '🔍  Ver reporte completo →', emoji: true }, url: reportUrl }
      ]}
    ]
  }
  const body = JSON.stringify(payload)
  const url  = new URL(webhookUrl)
  return new Promise(resolve => {
    const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { res.resume(); res.on('end', () => { console.log(`\n📣 Notificación Slack enviada (status ${res.statusCode}).\n`); resolve() }) })
    req.on('error', err => { console.error(`\n⚠️  Error Slack: ${err.message}\n`); resolve() })
    req.write(body); req.end()
  })
}

async function main() {
  console.log(`\n📊 Generando reporte Allure desde: ${RESULTS_DIR}`)
  if (!fs.existsSync(RESULTS_DIR) || !fs.readdirSync(RESULTS_DIR).length) {
    console.warn('⚠️  Sin allure-results — abortando publicación.')
    return
  }

  run(`npx allure generate "${RESULTS_DIR}" --clean -o "${REPORT_SRC}"`)
  console.log('🌙 Aplicando dark mode...')
  injectDarkMode(REPORT_SRC)

  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
  console.log(`\n📁 Timestamp: ${ts}`)

  // ── Preparar worktree de gh-pages ──────────────────────────────────────────
  console.log('\n🔀 Preparando rama gh-pages...')
  if (fs.existsSync(WORKTREE_DIR)) {
    try { run(`git worktree remove --force "${WORKTREE_DIR}"`, { cwd: ROOT }) } catch (_) {}
  }

  // Si gh-pages no existe aún, crearla como rama huérfana
  const ghPagesExists = (() => {
    try { execSync(`git ls-remote --exit-code --heads ${REMOTE} ${BRANCH}`, { cwd: ROOT, stdio: 'ignore' }); return true } catch (_) { return false }
  })()

  if (ghPagesExists) {
    run(`git fetch ${REMOTE} ${BRANCH}`, { cwd: ROOT })
    run(`git worktree add "${WORKTREE_DIR}" ${BRANCH}`, { cwd: ROOT })
  } else {
    console.log('  Primera vez: inicializando rama gh-pages...')
    run(`git worktree add --orphan -b ${BRANCH} "${WORKTREE_DIR}"`, { cwd: ROOT })
    fs.mkdirSync(path.join(WORKTREE_DIR, 'runs'), { recursive: true })
    fs.writeFileSync(path.join(WORKTREE_DIR, 'index.html'), generateIndex(path.join(WORKTREE_DIR, 'runs')))
    run('git add -A', { cwd: WORKTREE_DIR })
    run('git commit -m "init: crear rama gh-pages"', { cwd: WORKTREE_DIR })
    run(`git push ${REMOTE} ${BRANCH}`, { cwd: WORKTREE_DIR })
  }

  // ── Copiar reporte y actualizar index ──────────────────────────────────────
  const runsDir = path.join(WORKTREE_DIR, 'runs')
  const destRun = path.join(runsDir, ts)
  console.log(`\n📤 Copiando reporte a runs/${ts}/...`)
  copyDir(REPORT_SRC, destRun)
  console.log('\n📝 Actualizando index.html...')
  fs.writeFileSync(path.join(WORKTREE_DIR, 'index.html'), generateIndex(runsDir))

  // ── Commit y push ──────────────────────────────────────────────────────────
  console.log('\n🚀 Subiendo a GitHub Pages...')
  run('git add -A', { cwd: WORKTREE_DIR })
  run(`git commit -m "report: corrida ${ts}"`, { cwd: WORKTREE_DIR })
  run(`git push ${REMOTE} ${BRANCH}`, { cwd: WORKTREE_DIR })
  run(`git worktree remove --force "${WORKTREE_DIR}"`, { cwd: ROOT })

  const reportUrl = BASE_URL ? `${BASE_URL}/runs/${ts}/` : `(configurar GITHUB_PAGES_URL)`
  console.log(`\n✅ Reporte publicado: ${reportUrl}`)
  console.log(`   Índice: ${BASE_URL || '(configurar GITHUB_PAGES_URL)'}/\n`)

  let stats = { passed: 0, failed: 0, broken: 0, total: 0 }
  try {
    stats = JSON.parse(fs.readFileSync(path.join(REPORT_SRC, 'widgets', 'summary.json'), 'utf8')).statistic
  } catch (_) { console.warn('⚠️  No se pudo leer summary.json') }

  await sendSlackNotification(stats, reportUrl, ts)
}

main().catch(e => { console.error(e); process.exit(1) })
