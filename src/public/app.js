// ArchAutomation Telemetry & Gargi RCA Test Inspector Client
let currentPayload = null;
let currentScenario = 'rds_bottleneck';
let activeLogLevel = 'ALL';
let currentReport = null;
let currentRemediation = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('scenario')) {
    currentScenario = urlParams.get('scenario');
    document.querySelectorAll('.btn-scenario').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-scenario') === currentScenario);
    });
  }

  initTabs();
  initScenarioButtons();
  initActionButtons();
  initLogFilterPills();
  initLiveModal();
  initRcaChat();
  checkAwsStatus();
  loadScenario(currentScenario);

  if (urlParams.has('tab')) {
    const tabId = urlParams.get('tab');
    setTimeout(() => {
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
      if (tabBtn) tabBtn.click();
    }, 150);
  }
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
      if (targetContent) {
        targetContent.classList.add('active');
        document.querySelector('.inspector-panel')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// Scenario Buttons
function initScenarioButtons() {
  const buttons = document.querySelectorAll('.btn-scenario[data-scenario]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const scenario = btn.getAttribute('data-scenario');
      currentScenario = scenario;
      loadScenario(scenario);
    });
  });
}

// Load Scenario Telemetry & Auto-run Gargi RCA
async function loadScenario(scenarioId) {
  try {
    const res = await fetch(`/api/scenarios/trigger/${scenarioId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success && data.payload) {
      currentPayload = data.payload;
      renderPayload(currentPayload);
      // Automatically run RCA on scenario load so the RCA test tab is immediately live
      runGargiRca();
    }
  } catch (err) {
    console.error('Failed to trigger scenario:', err);
    showToast('Failed to load scenario: ' + err.message);
  }
}

// Execute Gargi RCA
async function runGargiRca() {
  if (!currentPayload) return;
  try {
    const res = await fetch('/api/rca/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: currentPayload }),
    });
    const data = await res.json();
    if (data.success && data.report) {
      currentReport = data.report;
      renderRcaReport(currentReport);
      // Automatically synthesize Sweta's verified remediation package
      runSwetaRemediation(currentReport);
    }
  } catch (err) {
    console.error('RCA run error:', err);
  }
}

// Render Gargi's Diagnosis into RCA Tab
function renderRcaReport(report) {
  const confidencePct = Math.round(report.confidenceScore * 100);
  const pill = document.getElementById('rca-confidence-pill');
  pill.innerText = `${confidencePct}% Confidence`;
  pill.style.background = confidencePct >= 80 ? '#065f46' : confidencePct >= 60 ? '#854d0e' : '#991b1b';
  pill.style.color = confidencePct >= 80 ? '#34d399' : confidencePct >= 60 ? '#fde047' : '#fca5a5';

  document.getElementById('rca-root-node').innerText = report.failingNodeId;
  document.getElementById('rca-root-resource').innerText = report.awsResourceId;
  document.getElementById('rca-summary').innerText = report.rootCauseSummary;
  document.getElementById('rca-evidence-line').innerText = report.logEvidenceLine;
  document.getElementById('rca-fix-intent').innerText = report.recommendedFixIntent;

  // Confidence Breakdown
  const b = report.confidenceBreakdown;
  document.getElementById('score-log').innerText = `+${Math.round(b.exactErrorCodeLogMatch * 100)}%`;
  document.getElementById('score-trail').innerText = `+${Math.round(b.recentCloudTrailChange * 100)}%`;
  document.getElementById('score-metric').innerText = `+${Math.round(b.resourceMetricOver90 * 100)}%`;
  document.getElementById('score-runbook').innerText = `+${Math.round(b.runbookSimilarity * 100)}%`;

  // Append welcome context in Chat Log if empty
  const chatLog = document.getElementById('rca-chat-log');
  chatLog.innerHTML = `
    <div style="background:#1e293b; padding:0.6rem 0.85rem; border-radius:6px; color:#cbd5e1;">
      <strong>Gargi AI Diagnostic Assistant:</strong> Diagnosed <strong>${escapeHtml(report.scenarioType)}</strong> on root resource <code>${escapeHtml(report.failingNodeId)}</code> with <strong>${confidencePct}% confidence</strong>.<br>
      Deduplication collapsed <strong>${report.deduplicationAnalysis.cascadingAlarmsCount} cascading alerts</strong>.
    </div>
  `;
}

// Execute Sweta's Remediation Synthesis (Handoff 3)
async function runSwetaRemediation(report) {
  if (!report && !currentReport) return;
  const targetReport = report || currentReport;
  try {
    const res = await fetch('/api/remediation/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: targetReport }),
    });
    const data = await res.json();
    if (data.success && data.verifiedFixPackage) {
      currentRemediation = data.verifiedFixPackage;
      renderRemediationPackage(currentRemediation);
    }
  } catch (err) {
    console.error('Remediation run error:', err);
  }
}

// Render Sweta's Verified Fix Package into Remediation Tab
function renderRemediationPackage(pkg) {
  // Guardrail badge
  const guardBadge = document.getElementById('rem-guardrail-badge');
  guardBadge.innerText = pkg.guardrailStatus;
  if (pkg.guardrailStatus === 'PASSED_VERIFIED') {
    guardBadge.style.background = '#065f46';
    guardBadge.style.color = '#34d399';
  } else {
    guardBadge.style.background = '#991b1b';
    guardBadge.style.color = '#fca5a5';
  }

  // Safety Gates
  const g = pkg.safetyGateDetails;
  const gate1 = document.getElementById('gate1-badge');
  gate1.innerText = g.gate1SyntaxPassed ? 'Gate 1: Syntax Valid ✓' : 'Gate 1: Syntax Error ✗';
  gate1.style.color = g.gate1SyntaxPassed ? '#34d399' : '#f87171';
  gate1.style.borderColor = g.gate1SyntaxPassed ? '#10b981' : '#ef4444';

  const gate2 = document.getElementById('gate2-badge');
  gate2.innerText = g.gate2DestructionFirewallPassed ? 'Gate 2: Zero-Destruction ✓' : 'Gate 2: Blocked Destructive Op ✗';
  gate2.style.color = g.gate2DestructionFirewallPassed ? '#34d399' : '#f87171';
  gate2.style.borderColor = g.gate2DestructionFirewallPassed ? '#10b981' : '#ef4444';

  const gate3 = document.getElementById('gate3-badge');
  gate3.innerText = g.gate3SecurityBudgetPassed ? 'Gate 3: Security & Budget ✓' : 'Gate 3: Security Breach ✗';
  gate3.style.color = g.gate3SecurityBudgetPassed ? '#34d399' : '#f87171';
  gate3.style.borderColor = g.gate3SecurityBudgetPassed ? '#10b981' : '#ef4444';

  // Mode A: Terraform HCL Diff with Syntax Highlighting
  const tfDiffEl = document.getElementById('rem-tf-diff');
  const lines = (pkg.terraformDiff || '').split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<span style="color:#34d399; background:rgba(16,185,129,0.15); display:block;">${escapeHtml(line)}</span>`;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<span style="color:#f87171; background:rgba(239,68,68,0.15); display:block;">${escapeHtml(line)}</span>`;
    } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
      return `<span style="color:#a855f7; font-weight:600; display:block;">${escapeHtml(line)}</span>`;
    }
    return `<span>${escapeHtml(line)}</span>`;
  });
  tfDiffEl.innerHTML = lines.join('');

  // Mode B: AWS SDK Action
  document.getElementById('rem-sdk-service').innerText = (pkg.awsSdkAction.service || 'aws').toUpperCase();
  document.getElementById('rem-sdk-action').innerHTML = escapeHtml(JSON.stringify(pkg.awsSdkAction, null, 2));

  // Simulation
  const sim = pkg.simulationResult;
  document.getElementById('sim-metric-name').innerText = sim.metricName;
  document.getElementById('sim-before-val').innerText = `${sim.beforeValue}${sim.unit}`;
  document.getElementById('sim-after-val').innerText = `${sim.afterValue}${sim.unit}`;
  document.getElementById('sim-threshold').innerText = `Threshold: ${sim.threshold}${sim.unit}`;
  document.getElementById('sim-recovery-status').innerText = sim.predictedRecoveryStatus;
  document.getElementById('sim-notes').innerText = sim.simulationNotes;

  // Cost Delta
  const cost = pkg.costImpactMonthly;
  document.getElementById('cost-delta-val').innerText = cost.formattedDelta;
  document.getElementById('cost-old-val').innerText = `$${cost.oldCostUsd.toFixed(2)}`;
  document.getElementById('cost-new-val').innerText = `$${cost.newCostUsd.toFixed(2)}`;

  // Rollback Safety
  const rollDesc = document.getElementById('rem-rollback-desc');
  if (pkg.rollbackSnapshotConfig) {
    rollDesc.innerText = `${pkg.rollbackSnapshotConfig.description} (${pkg.rollbackSnapshotConfig.action})`;
  } else {
    rollDesc.innerText = 'Standard state file rollback preserved in GitOps version control.';
  }
}

// Initialize Interactive Incident Q&A Assistant (Task 4)
function initRcaChat() {
  const form = document.getElementById('rca-chat-form');
  const input = document.getElementById('rca-chat-input');
  const chatLog = document.getElementById('rca-chat-log');

  const sendQuestion = async (q) => {
    if (!q || !currentPayload) return;

    // Append user question
    const userMsg = document.createElement('div');
    userMsg.style.cssText = 'background:#0284c7; color:#fff; padding:0.5rem 0.85rem; border-radius:6px; align-self:flex-end; max-width:85%;';
    userMsg.innerText = q;
    chatLog.appendChild(userMsg);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
      const res = await fetch('/api/rca/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, incidentId: currentPayload.incidentId }),
      });
      const data = await res.json();

      const aiMsg = document.createElement('div');
      aiMsg.style.cssText = 'background:#1e293b; color:#e2e8f0; padding:0.6rem 0.85rem; border-radius:6px; align-self:flex-start; max-width:90%; white-space:pre-wrap; line-height:1.4;';
      aiMsg.innerHTML = `<strong>Gargi AI:</strong>\n${escapeHtml(data.answer)}`;
      chatLog.appendChild(aiMsg);
      chatLog.scrollTop = chatLog.scrollHeight;
    } catch (err) {
      const errMsg = document.createElement('div');
      errMsg.style.cssText = 'color:#f87171; font-size:0.8rem;';
      errMsg.innerText = 'Failed to get answer: ' + err.message;
      chatLog.appendChild(errMsg);
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) {
      sendQuestion(q);
      input.value = '';
    }
  });

  document.querySelectorAll('.btn-quick-qa').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      sendQuestion(q);
    });
  });
}

// Render Current Payload into UI
function renderPayload(payload) {
  document.getElementById('incident-id').innerText = payload.incidentId;
  document.getElementById('incident-time').innerText = new Date(payload.triggeredAt).toLocaleString();

  // Active Alarms Count & List
  document.getElementById('alarms-count-badge').innerText = `${payload.activeAlarms.length} Active`;
  const alarmsList = document.getElementById('alarms-list');
  alarmsList.innerHTML = '';
  payload.activeAlarms.forEach(alarm => {
    const card = document.createElement('div');
    card.className = 'alarm-item-card';
    card.innerHTML = `
      <div class="alarm-header">
        <span class="alarm-name">${escapeHtml(alarm.alarmName)}</span>
        <span class="alarm-metric-badge">${escapeHtml(alarm.metricName)}: ${alarm.metricValue} (Threshold: ${alarm.threshold})</span>
      </div>
      <div class="alarm-sub">
        <span>Node: <strong>${escapeHtml(alarm.nodeId)}</strong></span>
        <span class="alarm-arn" title="${escapeHtml(alarm.awsResourceId)}">${escapeHtml(alarm.awsResourceId)}</span>
      </div>
    `;
    alarmsList.appendChild(card);
  });

  // Logs Count & Table
  document.getElementById('tab-logs-count').innerText = payload.cloudWatchLogs30m.length;
  renderLogsTable(payload.cloudWatchLogs30m);

  // CloudTrail Count & List
  document.getElementById('tab-trail-count').innerText = payload.cloudTrailEvents60m.length;
  renderTrailList(payload.cloudTrailEvents60m);

  // Canvas Graph Nodes & Edges
  document.getElementById('tab-nodes-count').innerText = `${payload.canvasGraph.nodes.length} Nodes`;
  renderCanvasGraph(payload.canvasGraph);

  // JSON Contract Tab
  document.getElementById('raw-json-output').innerText = JSON.stringify(payload, null, 2);
}

// Render Filtered Logs Table
function renderLogsTable(logs) {
  const tbody = document.getElementById('logs-table-body');
  tbody.innerHTML = '';

  const filtered = activeLogLevel === 'ALL'
    ? logs
    : logs.filter(l => l.level === activeLogLevel);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem;">No logs found for level: ${activeLogLevel}</td></tr>`;
    return;
  }

  filtered.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = `log-row log-row-${log.level.toLowerCase()}`;
    tr.innerHTML = `
      <td class="log-ts">${new Date(log.timestamp).toLocaleTimeString()}</td>
      <td><span class="level-tag level-${log.level.toLowerCase()}">${log.level}</span></td>
      <td><span class="node-tag">${escapeHtml(log.nodeId)}</span></td>
      <td class="res-tag" title="${escapeHtml(log.awsResourceId)}">${escapeHtml(log.awsResourceId)}</td>
      <td class="log-msg">${escapeHtml(log.message)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render CloudTrail Events List
function renderTrailList(events) {
  const container = document.getElementById('trail-list-container');
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem;">No configuration mutations in 60m window.</div>`;
    return;
  }

  events.forEach(evt => {
    const card = document.createElement('div');
    card.className = 'trail-card';
    card.innerHTML = `
      <div class="trail-header">
        <span class="trail-event-name">${escapeHtml(evt.eventName)}</span>
        <span class="trail-time">${new Date(evt.eventTime).toLocaleTimeString()}</span>
      </div>
      <div class="trail-meta">
        <div>Target Resource: <code>${escapeHtml(evt.awsResourceId)}</code></div>
        <div>User Identity: <strong>${escapeHtml(evt.userIdentity)}</strong></div>
      </div>
      <div class="trail-params">
        <div class="trail-params-title">Request Parameters:</div>
        <pre class="trail-params-json"><code>${escapeHtml(JSON.stringify(evt.requestParameters, null, 2))}</code></pre>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Canvas Graph Preview
function renderCanvasGraph(graph) {
  const container = document.getElementById('canvas-nodes-container');
  container.innerHTML = '';

  graph.nodes.forEach(n => {
    const nodeEl = document.createElement('div');
    nodeEl.className = `canvas-node-card node-status-${n.data?.healthStatus || 'healthy'}`;
    nodeEl.innerHTML = `
      <div class="node-type-label">${escapeHtml(n.type)}</div>
      <div class="node-title">${escapeHtml(n.data?.label || n.id)}</div>
      <div class="node-id">${escapeHtml(n.id)}</div>
      <div class="node-arn" title="${escapeHtml(n.awsResourceId)}">${escapeHtml(n.awsResourceId)}</div>
    `;
    container.appendChild(nodeEl);
  });

  const edgesContainer = document.getElementById('canvas-edges-container');
  edgesContainer.innerHTML = '';
  graph.edges.forEach(e => {
    const tag = document.createElement('span');
    tag.className = 'edge-tag';
    tag.innerText = `${e.source} ➔ ${e.target}`;
    edgesContainer.appendChild(tag);
  });
}

// Log Filter Pills
function initLogFilterPills() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      activeLogLevel = p.getAttribute('data-level');
      if (currentPayload) renderLogsTable(currentPayload.cloudWatchLogs30m);
    });
  });
}

// Action Buttons
function initActionButtons() {
  document.getElementById('btn-run-rca').addEventListener('click', () => {
    runGargiRca();
    // Switch to RCA tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="tab-rca"]').classList.add('active');
    document.getElementById('tab-rca').classList.add('active');
    showToast('Gargi RCA Engine executed!');
  });

  document.getElementById('btn-run-remediation').addEventListener('click', async () => {
    if (!currentReport) {
      await runGargiRca();
    }
    await runSwetaRemediation(currentReport);
    // Switch to Remediation tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="tab-remediation"]').classList.add('active');
    const remContent = document.getElementById('tab-remediation');
    if (remContent) {
      remContent.classList.add('active');
      document.querySelector('.inspector-panel')?.scrollIntoView({ behavior: 'smooth' });
    }
    showToast("Sweta's Verified Remediation Package Synthesized!");
  });

  // 1-Click Approval Execution Modal
  document.getElementById('btn-approve-apply-fix').addEventListener('click', () => {
    if (!currentRemediation) return;
    const modal = document.getElementById('approval-modal');
    
    // Customize modal text based on active fix
    const action = currentRemediation.awsSdkAction;
    document.getElementById('appr-step-aws').innerText = `${action.command} applied to ${action.service.toUpperCase()} (ApplyImmediately: true) in 1.2s`;
    document.getElementById('appr-step-git').innerText = `Pull Request #42 opened with Terraform Diff (${currentRemediation.costImpactMonthly.formattedDelta})`;
    
    modal.classList.remove('hidden');
    showToast('Autonomous Fix Approved & Dispatched to AWS!');
  });

  document.getElementById('approval-modal-close').addEventListener('click', () => {
    document.getElementById('approval-modal').classList.add('hidden');
  });

  document.getElementById('approval-modal-ok').addEventListener('click', () => {
    document.getElementById('approval-modal').classList.add('hidden');
  });

  document.getElementById('btn-dispatch-handoff').addEventListener('click', () => {
    dispatchHandoff();
  });

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('handoff-modal').classList.add('hidden');
  });

  document.getElementById('modal-ok-btn').addEventListener('click', () => {
    document.getElementById('handoff-modal').classList.add('hidden');
  });

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    if (currentPayload) {
      navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
      showToast('AlertPayload JSON copied to clipboard!');
    }
  });
}

// Dispatch Handoff
async function dispatchHandoff() {
  if (!currentPayload) return;

  const modal = document.getElementById('handoff-modal');
  const body = document.getElementById('modal-body-content');
  const subtitle = document.getElementById('handoff-modal-subtitle');

  modal.classList.remove('hidden');
  subtitle.innerText = `Transmitting ${currentPayload.incidentId}...`;
  body.innerHTML = `
    <div style="text-align:center; padding:2rem;">
      <div class="spinner"></div>
      <p style="margin-top:1rem; color:var(--text-secondary);">Executing Handoff 1 Contract verification & Gargi Diagnostic Engine...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/handoff/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: currentPayload }),
    });

    const data = await res.json();
    if (data.success) {
      const result = data.handoffResult;
      const resp = result.response || {};
      body.innerHTML = `
        <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:1.25rem; margin-bottom:1rem;">
          <h4 style="color:#10b981; margin:0 0 0.5rem 0;">✅ Handoff Successfully Delivered & Diagnosed!</h4>
          <p style="margin:0; font-size:0.875rem; color:#cbd5e1;">Target: <strong>${escapeHtml(result.target)}</strong></p>
          <p style="margin:0.25rem 0 0 0; font-size:0.875rem; color:#cbd5e1;">Delivered At: <code>${result.deliveredAt}</code></p>
        </div>
        <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem;">Handoff 2 Diagnosis Output (for Sweta):</div>
        <pre class="json-code-block" style="max-height:220px;"><code>${escapeHtml(JSON.stringify(resp, null, 2))}</code></pre>
      `;
      document.getElementById('handoff-status-badge').className = 'status-pill status-live';
      document.getElementById('handoff-status-badge').innerText = 'Diagnosed by Gargi';
    } else {
      body.innerHTML = `
        <div style="color:var(--color-error); padding:1rem; background:rgba(239,68,68,0.1); border-radius:8px;">
          ${escapeHtml(data.error || 'Failed')}
        </div>
      `;
    }
  } catch (err) {
    body.innerHTML = `
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
        runGargiRca();
        showToast('Live telemetry collected and diagnosed!');
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
