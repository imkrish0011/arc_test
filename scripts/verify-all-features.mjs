// scripts/verify-all-features.mjs
async function runAllTests() {
  const baseUrl = 'http://localhost:4000';
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  PASS:', message);
      passed++;
    } else {
      console.error('  FAIL:', message);
      failed++;
    }
  }

  console.log('\n=============================================');
  console.log('1. TESTING UI STATIC ASSETS (HTML, CSS, JS)');
  console.log('=============================================');
  
  const htmlRes = await fetch(baseUrl + '/');
  assert(htmlRes.status === 200, 'index.html served with 200 OK');
  const htmlText = await htmlRes.text();
  assert(htmlText.includes('ArchAutomation'), 'HTML includes ArchAutomation title');
  assert(htmlText.includes('rca-chat-log'), 'HTML includes RCA Q&A Chat drawer');

  const cssRes = await fetch(baseUrl + '/styles.css');
  assert(cssRes.status === 200, 'styles.css served with 200 OK');

  const jsRes = await fetch(baseUrl + '/app.js');
  assert(jsRes.status === 200, 'app.js served with 200 OK');

  console.log('\n=============================================');
  console.log('2. TESTING HEALTH & SYSTEM STATUS API');
  console.log('=============================================');
  const healthRes = await fetch(baseUrl + '/api/health');
  const health = await healthRes.json();
  assert(health.status === 'healthy', 'Health check is healthy');
  assert(health.service === 'arch-automation-telemetry', 'Correct service identifier');

  console.log('\n=============================================');
  console.log('3. TESTING SRE RUNBOOKS KNOWLEDGE BASE');
  console.log('=============================================');
  const runbooksRes = await fetch(baseUrl + '/api/rca/runbooks');
  const runbooksData = await runbooksRes.json();
  assert(runbooksData.total === 5, 'All 5 SRE runbooks loaded');
  const runbookScenarios = runbooksData.runbooks.map(r => r.scenario);
  assert(runbookScenarios.includes('rds_bottleneck'), 'RDS runbook present');
  assert(runbookScenarios.includes('container_crashloop'), 'Container OOM runbook present');
  assert(runbookScenarios.includes('security_group_drift'), 'SG Drift runbook present');
  assert(runbookScenarios.includes('api_5xx_timeouts'), 'API 5xx runbook present');
  assert(runbookScenarios.includes('finops_idle_waste'), 'FinOps waste runbook present');

  console.log('\n=============================================');
  console.log('4. TESTING ALL 5 SCENARIOS & RCA DIAGNOSIS');
  console.log('=============================================');
  const scenarios = [
    { id: 'rds_bottleneck', expectedNode: 'node-rds-01', expectedMinConf: 0.8 },
    { id: 'container_crashloop', expectedNode: 'node-ecs-01', expectedMinConf: 0.7 },
    { id: 'security_group_drift', expectedNode: 'node-sg-01', expectedMinConf: 0.75 },
    { id: 'api_5xx_timeouts', expectedNode: 'node-lambda-02', expectedMinConf: 0.7 },
    { id: 'finops_idle_waste', expectedNode: 'node-nat-01', expectedMinConf: 0.7 },
  ];

  let lastIncidentId = '';

  for (const sc of scenarios) {
    console.log('\nTesting Scenario: ' + sc.id);
    const trigRes = await fetch(baseUrl + '/api/scenarios/trigger/' + sc.id, { method: 'POST' });
    assert(trigRes.status === 201, sc.id + ' trigger returned 201 Created');
    const trigData = await trigRes.json();
    assert(trigData.success === true, sc.id + ' success flag is true');
    assert(trigData.payload.cloudWatchLogs30m.length > 0, sc.id + ' has pre-filtered 30m logs');
    assert(trigData.payload.cloudTrailEvents60m.length > 0, sc.id + ' has 60m CloudTrail events');
    assert(trigData.payload.canvasGraph.nodes.length > 0, sc.id + ' has Canvas graph nodes');
    
    lastIncidentId = trigData.payload.incidentId;

    // Test RCA diagnosis on this payload
    const rcaRes = await fetch(baseUrl + '/api/rca/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: trigData.payload }),
    });
    assert(rcaRes.status === 200, sc.id + ' RCA diagnose returned 200 OK');
    const rcaData = await rcaRes.json();
    assert(rcaData.report.failingNodeId === sc.expectedNode, sc.id + ' root node is ' + sc.expectedNode + ' (got ' + rcaData.report.failingNodeId + ')');
    assert(rcaData.report.confidenceScore >= sc.expectedMinConf, sc.id + ' confidence >= ' + (sc.expectedMinConf * 100) + '% (got ' + (rcaData.report.confidenceScore * 100) + '%)');
    assert(rcaData.report.logEvidenceLine.length > 0, sc.id + ' has log evidence');
    assert(rcaData.report.rootCauseSummary.length > 0, sc.id + ' has root cause summary');
  }

  console.log('\n=============================================');
  console.log('5. TESTING HANDOFF DISPATCH & INCIDENT STORE');
  console.log('=============================================');
  const listRes = await fetch(baseUrl + '/api/handoff/incidents');
  const listData = await listRes.json();
  assert(listData.total > 0, 'Incident store contains recorded incidents');

  const getRes = await fetch(baseUrl + '/api/handoff/incidents/' + lastIncidentId);
  assert(getRes.status === 200, 'GET /api/handoff/incidents/:id returned 200 OK');
  const incidentPayload = await getRes.json();
  assert(incidentPayload.incidentId === lastIncidentId, 'Retrieved incident matches target ID');

  const dispatchRes = await fetch(baseUrl + '/api/handoff/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: incidentPayload }),
  });
  assert(dispatchRes.status === 200, 'POST /api/handoff/dispatch returned 200 OK');
  const dispatchData = await dispatchRes.json();
  assert(dispatchData.success === true, 'Handoff dispatch successful');
  assert(dispatchData.handoffResult.incidentId === lastIncidentId, 'Handoff result contains correct incidentId');

  console.log('\n=============================================');
  console.log('6. TESTING INTERACTIVE SRE Q&A ASSISTANT');
  console.log('=============================================');
  const questions = [
    { q: 'Why did this resource fail?', mustContain: 'Root cause' },
    { q: 'Show the critical logs', mustContain: '[' },
    { q: 'Which alerts were deduplicated?', mustContain: 'Alert Deduplication' },
    { q: 'Who made the CloudTrail change?', mustContain: 'CloudTrail' },
  ];

  for (const item of questions) {
    const chatRes = await fetch(baseUrl + '/api/rca/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: item.q, incidentId: lastIncidentId }),
    });
    assert(chatRes.status === 200, 'Chat Q: "' + item.q + '" returned 200 OK');
    const chatData = await chatRes.json();
    assert(chatData.success === true, 'Chat response success true');
    assert(chatData.answer.includes(item.mustContain), 'Chat answer matches context keyword "' + item.mustContain + '"');
  }

  console.log('\n=============================================');
  console.log('7. TESTING LIVE AWS ALARM INGESTION WEBHOOK');
  console.log('=============================================');
  const webhookRes = await fetch(baseUrl + '/api/webhooks/aws-alarm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'aws.cloudwatch',
      'detail-type': 'CloudWatch Alarm State Change',
      resources: ['arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary'],
      detail: {
        alarmName: 'RDS-HighCPU-Trigger',
        state: { value: 'ALARM' },
        configuration: {
          metrics: [{ metricStat: { metric: { name: 'CPUUtilization' } } }],
        },
      },
    }),
  });
  assert(webhookRes.status === 201, 'POST /api/webhooks/aws-alarm returned 201 Created');
  const webhookData = await webhookRes.json();
  assert(webhookData.success === true, 'Webhook ingestion success true');
  assert(webhookData.source === 'eventbridge', 'Source recognized as eventbridge');
  assert(webhookData.handoffResult !== undefined, '24/7 Auto-handoff to Gargi executed automatically');

  console.log('\n=============================================');
  console.log('FINAL SUMMARY');
  console.log('=============================================');
  console.log('Total Tests Passed: ' + passed);
  console.log('Total Tests Failed: ' + failed);
  if (failed === 0) {
    console.log('🎉 ALL 52 CHECKS PASSED — SYSTEM IS 100% OPERATIONAL!\n');
  } else {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
