import type { CanvasGraph, CanvasGraphNode, CanvasGraphEdge } from './alertPayload.js';

export interface TopologySummary {
  totalNodes: number;
  totalEdges: number;
  resourceMap: Record<string, string>; // awsResourceId -> nodeId
  reverseMap: Record<string, string>;  // nodeId -> awsResourceId
}

export function buildResourceIndex(graph: CanvasGraph): TopologySummary {
  const resourceMap: Record<string, string> = {};
  const reverseMap: Record<string, string> = {};

  for (const node of graph.nodes) {
    if (node.awsResourceId) {
      resourceMap[node.awsResourceId] = node.id;
      // Also map short IDs if resource ID is an ARN
      const shortId = node.awsResourceId.split('/').pop() || node.awsResourceId;
      if (shortId && shortId !== node.awsResourceId) {
        resourceMap[shortId] = node.id;
      }
    }
    reverseMap[node.id] = node.awsResourceId;
  }

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    resourceMap,
    reverseMap,
  };
}

export function findNodeIdForResource(graph: CanvasGraph, awsResourceId: string): string {
  const summary = buildResourceIndex(graph);
  if (summary.resourceMap[awsResourceId]) {
    return summary.resourceMap[awsResourceId];
  }
  const shortId = awsResourceId.split('/').pop() || awsResourceId;
  if (summary.resourceMap[shortId]) {
    return summary.resourceMap[shortId];
  }
  // Try partial match
  for (const [resId, nId] of Object.entries(summary.resourceMap)) {
    if (resId.includes(awsResourceId) || awsResourceId.includes(resId)) {
      return nId;
    }
  }
  return 'node-unknown';
}
