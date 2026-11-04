#!/usr/bin/env node

/**
 * ArchAutomation CLI: Simulate AWS Alarm & Trigger Ingestion
 *
 * Usage:
 *   npx tsx scripts/simulate-alarm.ts --scenario rds_bottleneck
 *   npx tsx scripts/simulate-alarm.ts --scenario container_crashloop --save
 *   npx tsx scripts/simulate-alarm.ts --post http://localhost:4000/api/webhooks/aws-alarm
 */

import fs from 'fs';
import path from 'path';
import { SampleOutageGenerator, type ScenarioType } from '../src/generator/sampleOutageGenerator.js';
import { validateAlertPayloadContract, handoffToGargiEngine } from '../src/handoff/gargiConnector.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scenario: 'rds_bottleneck' as ScenarioType,
    save: false,
    handoff: false,
    postUrl: '',
    output: '',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) options.scenario = args[++i] as ScenarioType;
    else if (args[i] === '--save') options.save = true;
    else if (args[i] === '--handoff') options.handoff = true;
    else if (args[i] === '--post' && args[i + 1]) options.postUrl = args[++i];
    else if (args[i] === '--output' && args[i + 1]) options.output = args[++i];
  }

  return options;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n======================================================`);
  console.log(`🚀 ArchAutomation AWS Alarm Simulator`);
  console.log(`Target Scenario: ${opts.scenario}`);
  console.log(`======================================================\n`);

  // Generate complete payload
  const payload = SampleOutageGenerator.generate(opts.scenario);

  // Validate contract
  const validation = validateAlertPayloadContract(payload);
  if (!validation.valid) {
    console.error(`❌ Contract validation failed:`);
    validation.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log(`✅ AlertPayload contract validated: Handoff 1 compliant.`);

  console.log(`\n📋 Payload Summary:`);
  console.log(`   Incident ID:         ${payload.incidentId}`);
  console.log(`   Triggered At:        ${payload.triggeredAt}`);
  console.log(`   Active Alarms:       ${payload.activeAlarms.length}`);
  payload.activeAlarms.forEach(a => {
    console.log(`     • ${a.alarmName} (${a.awsResourceId}) -> Node: ${a.nodeId} [${a.metricName}: ${a.metricValue} > ${a.threshold}]`);
  });

  console.log(`\n🔍 Filtered 30m CloudWatch Logs (${payload.cloudWatchLogs30m.length} lines):`);
  payload.cloudWatchLogs30m.forEach(l => {
    console.log(`     [${l.level.padEnd(7)}] ${l.message.slice(0, 90)}...`);
  });

  console.log(`\n📜 60m CloudTrail Events (${payload.cloudTrailEvents60m.length} events):`);
  payload.cloudTrailEvents60m.forEach(e => {
    console.log(`     • ${e.eventName} by ${e.userIdentity} on ${e.awsResourceId}`);
  });

  console.log(`\n🗺️ ArchViz Canvas Graph:`);
  console.log(`   Nodes (${payload.canvasGraph.nodes.length}): ${payload.canvasGraph.nodes.map(n => n.id).join(', ')}`);
  console.log(`   Edges (${payload.canvasGraph.edges.length}): ${payload.canvasGraph.edges.map(e => `${e.source} -> ${e.target}`).join(', ')}`);

  // Save if requested
  if (opts.save || opts.output) {
    const filename = opts.output || `alertPayload-${opts.scenario}.json`;
    const outPath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`\n💾 Saved payload file: ${outPath}`);
  }

  // POST to webhook endpoint if requested
  if (opts.postUrl) {
    console.log(`\n📡 Dispatching to webhook: ${opts.postUrl}...`);
    try {
      const res = await fetch(opts.postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: opts.scenario }),
      });
      const data = await res.json();
      console.log(`✅ Webhook Response (${res.status}):`, data);
    } catch (err: unknown) {
      console.error(`❌ Webhook dispatch failed: ${(err as Error).message}`);
    }
  }

  // Handoff to Gargi's engine if requested
  if (opts.handoff) {
    console.log(`\n🤝 Executing handoffToGargiEngine(alertPayload)...`);
    const handoff = await handoffToGargiEngine(payload);
    console.log(`✅ Handoff result:`, handoff);
  }

  console.log(`\n✨ Simulation completed successfully.\n`);
}

main().catch(err => {
  console.error('Fatal error during simulation:', err);
  process.exit(1);
});
