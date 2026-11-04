#!/usr/bin/env node

/**
 * ArchAutomation CLI: Inspect & Validate AlertPayload Contract
 *
 * Usage:
 *   npx tsx scripts/inspect-payload.ts
 *   npx tsx scripts/inspect-payload.ts --file alertPayload-rds_bottleneck.json
 */

import fs from 'fs';
import path from 'path';
import { SampleOutageGenerator, type ScenarioType } from '../src/generator/sampleOutageGenerator.js';
import { validateAlertPayloadContract } from '../src/handoff/gargiConnector.js';
import type { AlertPayload } from '../src/types/alertPayload.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let file = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) file = args[++i];
  }
  return { file };
}

function inspectPayload(payload: AlertPayload, title: string) {
  console.log(`\n======================================================`);
  console.log(`🔍 Inspecting Payload: ${title}`);
  console.log(`======================================================`);

  const result = validateAlertPayloadContract(payload);
  if (!result.valid) {
    console.error(`❌ FAILED CONTRACT VALIDATION:`);
    result.errors.forEach(e => console.error(`   - ${e}`));
    return false;
  }

  console.log(`✅ Handoff 1 Contract Check: PASSED`);
  console.log(`   Incident ID:         ${payload.incidentId}`);
  console.log(`   Triggered At:        ${payload.triggeredAt}`);
  console.log(`   Active Alarms:       ${payload.activeAlarms.length}`);
  console.log(`   30m CloudWatch Logs: ${payload.cloudWatchLogs30m.length} (Pre-filtered)`);
  console.log(`   60m CloudTrail Evts: ${payload.cloudTrailEvents60m.length}`);
  console.log(`   Canvas Nodes:        ${payload.canvasGraph.nodes.length}`);
  console.log(`   Canvas Edges:        ${payload.canvasGraph.edges.length}`);
  return true;
}

async function main() {
  const { file } = parseArgs();

  if (file) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const payload = JSON.parse(raw);
    const passed = inspectPayload(payload, file);
    process.exit(passed ? 0 : 1);
  }

  // Inspect all 5 target scenarios
  const scenarios: ScenarioType[] = [
    'rds_bottleneck',
    'container_crashloop',
    'security_group_drift',
    'api_5xx_timeouts',
    'finops_idle_waste',
  ];

  let allPassed = true;
  for (const sc of scenarios) {
    const payload = SampleOutageGenerator.generate(sc);
    const passed = inspectPayload(payload, `Scenario: ${sc}`);
    if (!passed) allPassed = false;
  }

  console.log(`\n======================================================`);
  if (allPassed) {
    console.log(`🎉 ALL 5 TARGET FAILURE SCENARIOS COMPLIANT WITH CONTRACT.`);
  } else {
    console.error(`⚠️ SOME SCENARIOS FAILED CONTRACT CHECKS.`);
  }
  console.log(`======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal inspection error:', err);
  process.exit(1);
});
