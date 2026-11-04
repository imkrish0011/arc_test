import type { ActiveAlarm, CanvasGraph } from '../types/alertPayload.js';

export interface RootFailureAnalysis {
  rootFailingNodeId: string;
  rootAlarm: ActiveAlarm;
  cascadingAlarms: ActiveAlarm[];
  cascadePath: string[]; // Node IDs from root down to furthest impacted node
}

/**
 * Gargi's Task 1: Graph-Based Alert Deduplication
 * 
 * Collapses cascading upstream/downstream alarms into a single root failing node
 * by analyzing topological flow and dependency directions in the canvas graph.
 */
export function findRootFailingNode(
  activeAlarms: ActiveAlarm[],
  graph: CanvasGraph
): RootFailureAnalysis {
  if (!activeAlarms || activeAlarms.length === 0) {
    throw new Error('Cannot find root failing node with empty active alarms');
  }

  if (activeAlarms.length === 1) {
    return {
      rootFailingNodeId: activeAlarms[0].nodeId,
      rootAlarm: activeAlarms[0],
      cascadingAlarms: [],
      cascadePath: [activeAlarms[0].nodeId],
    };
  }

  // 1. Build adjacency list: source -> targets (downstream dependencies)
  const downstreamAdj: Map<string, string[]> = new Map();
  const upstreamAdj: Map<string, string[]> = new Map();

  for (const node of graph.nodes) {
    downstreamAdj.set(node.id, []);
    upstreamAdj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!downstreamAdj.has(edge.source)) downstreamAdj.set(edge.source, []);
    if (!upstreamAdj.has(edge.target)) upstreamAdj.set(edge.target, []);
    downstreamAdj.get(edge.source)!.push(edge.target);
    upstreamAdj.get(edge.target)!.push(edge.source);
  }

  const alarmNodeIds = new Set(activeAlarms.map(a => a.nodeId));
  const alarmMap = new Map<string, ActiveAlarm[]>();
  for (const alarm of activeAlarms) {
    const list = alarmMap.get(alarm.nodeId) || [];
    list.push(alarm);
    alarmMap.set(alarm.nodeId, list);
  }

  /**
   * In cloud architectures:
   * Traffic flows: Ingress (APIGW/ALB) -> Middle (Lambda/ECS) -> Data (RDS/Dynamo/Redis).
   * Failures usually propagate backwards: If DB fails, Lambda fails, then APIGW throws 504.
   * Deepest failing downstream node (or dependency source) is the root cause.
   * 
   * We calculate for each alarming node:
   * 1. Can this node reach other alarming nodes via reverse dependencies?
   * 2. Earliest timestamp among alarms for that node.
   */
  const scores: Map<string, number> = new Map();

  for (const nodeId of alarmNodeIds) {
    let reachableAlarmCount = 0;
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      // Look at upstream callers that depend on this node
      const callers = upstreamAdj.get(curr) || [];
      for (const caller of callers) {
        if (!visited.has(caller)) {
          visited.add(caller);
          if (alarmNodeIds.has(caller)) {
            reachableAlarmCount++;
          }
          queue.push(caller);
        }
      }
    }

    scores.set(nodeId, reachableAlarmCount);
  }

  // Sort by:
  // 1. Most upstream dependencies affected (highest reachability score)
  // 2. Earliest alarm timestamp
  const sortedCandidates = Array.from(alarmNodeIds).sort((a, b) => {
    const scoreDiff = (scores.get(b) || 0) - (scores.get(a) || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const alarmsA = alarmMap.get(a) || [];
    const alarmsB = alarmMap.get(b) || [];
    const minTimeA = Math.min(...alarmsA.map(x => new Date(x.timestamp).getTime()));
    const minTimeB = Math.min(...alarmsB.map(x => new Date(x.timestamp).getTime()));

    return minTimeA - minTimeB;
  });

  const rootNodeId = sortedCandidates[0];
  const rootAlarms = alarmMap.get(rootNodeId) || [];
  const rootAlarm = rootAlarms[0];

  const cascadingAlarms = activeAlarms.filter(a => a.nodeId !== rootNodeId);

  // Trace the cascade path from root upstream to the outer edge (safeguarded against cyclic graphs)
  const cascadePath: string[] = [rootNodeId];
  const visitedCascade = new Set<string>([rootNodeId]);
  let current = rootNodeId;
  while (true) {
    const parents = (upstreamAdj.get(current) || []).filter(
      p => alarmNodeIds.has(p) && !visitedCascade.has(p)
    );
    if (parents.length === 0) break;
    current = parents[0];
    visitedCascade.add(current);
    cascadePath.push(current);
  }

  return {
    rootFailingNodeId: rootNodeId,
    rootAlarm,
    cascadingAlarms,
    cascadePath,
  };
}

