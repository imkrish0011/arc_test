// ArchAutomation Telemetry Dashboard Client
let currentPayload = null;
let currentScenario = 'rds_bottleneck';
let activeLogLevel = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initScenarioButtons();
  initActionButtons();
  initLogFilterPills();
  initLiveModal();
  checkAwsStatus();
  loadScenario(currentScenario);
});

// Check AWS Credential Status
async function checkAwsStatus() {
  try {
    const res = await fetch('/api/aws/status');
    const data = await res.json();
    const status = data.status;
    const badge = document.getElementById('aws-status-badge');
    const text = document.getElementById('aws-status-text');

    if (status.hasCredentials && !status.isSimulated) {
      badge.className = 'status-pill status-live';
      text.innerText = `AWS Mode: Live (${status.source})`;
    } else {
      badge.className = 'status-pill status-simulated';
      text.innerText = 'AWS Mode: Simulated';
    }
  } catch (err) {
    console.warn('Failed to fetch AWS status:', err);
  }
}

// Initialize Tabs
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

// Initialize Scenario Buttons
function initScenarioButtons() {
  const scBtns = document.querySelectorAll('.btn-scenario[data-scenario]');
  scBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sc = btn.getAttribute('data-scenario');
      currentScenario = sc;
      loadScenario(sc);
    });
  });
}

// Load Scenario Telemetry
async function loadScenario(scenarioId) {
  try {
    const res = await fetch(`/api/scenarios/trigger/${scenarioId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success && data.payload) {
      currentPayload = data.payload;
      renderPayload(currentPayload);
    }
  } catch (err) {
    console.error('Failed to load scenario:', err);
  }
}

// Render Payload
function renderPayload(payload) {
  if (!payload) return;

  // Metadata
  document.getElementById('incident-id').innerText = payload.incidentId;
  document.getElementById('incident-time').innerText = new Date(payload.triggeredAt).toLocaleString();
  document.getElementById('alarms-count-badge').innerText = `${payload.activeAlarms.length} Active`;
  document.getElementById('tab-logs-count').innerText = payload.cloudWatchLogs30m.length;
  document.getElementById('tab-trail-count').innerText = payload.cloudTrailEvents60m.length;
  document.getElementById('tab-nodes-count').innerText = `${payload.canvasGraph.nodes.length} Nodes`;

  // Alarms
  renderAlarms(payload.activeAlarms);

  // Filtered Logs
  renderLogs(payload.cloudWatchLogs30m);

  // CloudTrail Events
  renderCloudTrail(payload.cloudTrailEvents60m);

  // Canvas Graph
  renderCanvasGraph(payload.canvasGraph);

  // JSON viewer
  document.getElementById('raw-json-output').innerText = JSON.stringify(payload, null, 2);
}

// Render Alarms Grid
function renderAlarms(alarms) {
  const container = document.getElementById('alarms-list');
  container.innerHTML = '';

  alarms.forEach(a => {
    const card = document.createElement('div');
    card.className = 'alarm-card';
    card.innerHTML = `
      <div class="alarm-header">
        <span class="alarm-name">${escapeHtml(a.alarmName)}</span>
        <span class="alarm-node-tag">${escapeHtml(a.nodeId)}</span>
      </div>
      <div class="alarm-resource" title="${escapeHtml(a.awsResourceId)}">
        ${escapeHtml(a.awsResourceId)}
      </div>
      <div class="alarm-metric-row">
        <span>Metric: <strong>${escapeHtml(a.metricName)}</strong></span>
        <span class="metric-crossed">${a.metricValue} (Threshold: &gt;${a.threshold})</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Log Filters
function initLogFilterPills() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeLogLevel = pill.getAttribute('data-level');
      if (currentPayload) {
        renderLogs(currentPayload.cloudWatchLogs30m);
      }
    });
  });
}

// Render Filtered Logs
function renderLogs(logs) {
  const tbody = document.getElementById('logs-table-body');
  tbody.innerHTML = '';

  const filtered = activeLogLevel === 'ALL'
    ? logs
    : logs.filter(l => l.level === activeLogLevel);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-dim);">No log entries matching level '${activeLogLevel}'</td></tr>`;
    return;
  }

  filtered.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
      <td><span class="log-level-badge lvl-${log.level}">${log.level}</span></td>
      <td><span class="alarm-node-tag">${escapeHtml(log.nodeId)}</span></td>
      <td style="font-size:0.75rem; color:var(--text-muted);" title="${escapeHtml(log.awsResourceId)}">
        ${escapeHtml(log.awsResourceId.split(':').pop() || log.awsResourceId)}
      </td>
      <td class="log-msg">${escapeHtml(log.message)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render CloudTrail
function renderCloudTrail(events) {
  const container = document.getElementById('trail-list-container');
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:2rem;">No recent CloudTrail mutation events found in 60m window.</div>';
    return;
  }

  events.forEach(evt => {
    const item = document.createElement('div');
    item.className = 'trail-item';
    item.innerHTML = `
      <div class="trail-header">
        <span class="trail-name">${escapeHtml(evt.eventName)}</span>
        <span class="trail-user">User: <strong>${escapeHtml(evt.userIdentity)}</strong></span>
      </div>
      <div style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">
        Event ID: ${escapeHtml(evt.eventId)} | Time: ${new Date(evt.eventTime).toLocaleString()} | Resource: ${escapeHtml(evt.awsResourceId)}
      </div>
      <div class="trail-params-box">
        <pre>${JSON.stringify(evt.requestParameters, null, 2)}</pre>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Canvas Graph
function renderCanvasGraph(graph) {
  const container = document.getElementById('canvas-nodes-container');
  const edgesContainer = document.getElementById('canvas-edges-container');
  container.innerHTML = '';
  edgesContainer.innerHTML = '';

  graph.nodes.forEach((node, index) => {
    const nodeCard = document.createElement('div');
    const isCritical = node.data?.healthStatus === 'critical';
    nodeCard.className = `canvas-node-card ${isCritical ? 'node-critical' : ''}`;
    nodeCard.innerHTML = `
      <div class="node-type-badge">${escapeHtml(node.type)} &bull; ${escapeHtml(node.id)}</div>
      <div class="node-label">${escapeHtml(String(node.data?.label || node.id))}</div>
      <div class="node-res-id" title="${escapeHtml(node.awsResourceId)}">${escapeHtml(node.awsResourceId)}</div>
    `;
    container.appendChild(nodeCard);

    if (index < graph.nodes.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'graph-arrow';
      arrow.innerHTML = '&rarr;';
      container.appendChild(arrow);
    }
  });

  graph.edges.forEach(edge => {
    const edgePill = document.createElement('div');
    edgePill.className = 'edge-pill';
    edgePill.innerText = `${edge.source} ➔ ${edge.target} (${edge.id})`;
    edgesContainer.appendChild(edgePill);
  });
}

// Action Buttons: Copy, Download, Handoff
function initActionButtons() {
  // Copy JSON
  document.getElementById('btn-copy-json').addEventListener('click', () => {
    if (!currentPayload) return;
    navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    showToast('Copied alertPayload.json to clipboard!');
  });

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    if (!currentPayload) return;
    navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    showToast('Copied JSON!');
  });

  // Download JSON
  document.getElementById('btn-download-json').addEventListener('click', () => {
    if (!currentPayload) return;
    const blob = new Blob([JSON.stringify(currentPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alertPayload-${currentPayload.incidentId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded alertPayload.json');
  });

  // Send Payload to Gargi's Engine
  document.getElementById('btn-send-gargi').addEventListener('click', async () => {
    if (!currentPayload) return;
    await triggerHandoffModal();
  });

  // Modal Close
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('handoff-modal').classList.add('hidden');
  });
  document.getElementById('modal-ok-btn').addEventListener('click', () => {
    document.getElementById('handoff-modal').classList.add('hidden');
  });
}

// Trigger Handoff Modal
async function triggerHandoffModal() {
  const modal = document.getElementById('handoff-modal');
  const bodyContent = document.getElementById('modal-body-content');
  const subtitle = document.getElementById('handoff-modal-subtitle');

  modal.classList.remove('hidden');
  subtitle.innerText = 'Calling handoffToGargiEngine(alertPayload)...';
  bodyContent.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; padding:1.5rem; justify-content:center;">
      <div class="pulse-glow" style="width:14px; height:14px; border-radius:50%; background:#38bdf8;"></div>
      <span>Verifying schema contract and transmitting payload...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/handoff/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: currentPayload }),
    });

    const data = await res.json();
    const handoff = data.handoffResult;

    if (data.success && handoff) {
      subtitle.innerText = 'Delivered to Gargi Diagnostic Engine';
      bodyContent.innerHTML = `
        <div class="handoff-step">
          <div class="step-icon">&check;</div>
          <div>
            <div class="step-title">Handoff Contract 1 Verified</div>
            <div class="step-desc">All 4 telemetry sources (activeAlarms, cloudWatchLogs30m, cloudTrailEvents60m, canvasGraph) match schema specification.</div>
          </div>
        </div>
        <div class="handoff-step">
          <div class="step-icon">&check;</div>
          <div>
            <div class="step-title">Transmission Channel: ${escapeHtml(data.dispatchType)}</div>
            <div class="step-desc">Target: <code>${escapeHtml(handoff.target)}</code></div>
          </div>
        </div>
        <div class="handoff-step">
          <div class="step-icon">&check;</div>
          <div>
            <div class="step-title">Diagnostic Engine Status: ${escapeHtml(handoff.diagnosticStatus || 'pending_rca')}</div>
            <div class="step-desc">Incident ID: <code>${escapeHtml(handoff.incidentId)}</code> &bull; Delivered At: ${new Date(handoff.deliveredAt).toLocaleTimeString()}</div>
          </div>
        </div>
        <div class="trail-params-box">
          <pre>${JSON.stringify(handoff.response, null, 2)}</pre>
        </div>
      `;
      document.getElementById('handoff-status-badge').innerText = 'Delivered to Gargi';
      document.getElementById('handoff-status-badge').className = 'status-pill status-live';
    } else {
      subtitle.innerText = 'Handoff Error';
      bodyContent.innerHTML = `
        <div style="color:var(--color-error); padding:1rem; background:rgba(239,68,68,0.1); border-radius:8px;">
          Failed to transmit: ${escapeHtml(data.error || 'Unknown error')}
        </div>
      `;
    }
  } catch (err) {
    subtitle.innerText = 'Handoff Connection Failed';
    bodyContent.innerHTML = `
      <div style="color:var(--color-error); padding:1rem; background:rgba(239,68,68,0.1); border-radius:8px;">
        ${escapeHtml(err.message)}
      </div>
    `;
  }
}

// Live Modal
function initLiveModal() {
  const modal = document.getElementById('live-modal');
  document.getElementById('btn-open-live-modal').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('live-modal-close').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  document.getElementById('btn-cancel-live').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('btn-submit-live').addEventListener('click', async () => {
    const resId = document.getElementById('live-input-resource').value.trim();
    const alarmName = document.getElementById('live-input-alarm').value.trim();
    const metricName = document.getElementById('live-input-metric').value.trim();
    const metricVal = parseFloat(document.getElementById('live-input-val').value) || 100;
    const thresh = parseFloat(document.getElementById('live-input-thresh').value) || 80;

    modal.classList.add('hidden');

    try {
      const res = await fetch('/api/aws/live-collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awsResourceId: resId || undefined,
          alarmName,
          metricName,
          metricValue: metricVal,
          threshold: thresh,
        }),
      });
      const data = await res.json();
      if (data.success && data.payload) {
        currentPayload = data.payload;
        renderPayload(currentPayload);
        showToast('Live telemetry collected and mapped to canvas topology!');
      }
    } catch (err) {
      showToast('Live collection failed: ' + err.message);
    }
  });
}

function showToast(msg) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '2rem';
  toast.style.right = '2rem';
  toast.style.backgroundColor = '#0284c7';
  toast.style.color = '#fff';
  toast.style.padding = '0.75rem 1.25rem';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
  toast.style.fontWeight = '600';
  toast.style.fontSize = '0.85rem';
  toast.style.zIndex = '999';
  toast.innerText = msg;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
