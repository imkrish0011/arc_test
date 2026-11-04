import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CloudWatchLogEntry, CloudTrailEventEntry } from '../types/alertPayload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunbookDocument {
  id: string;
  title: string;
  scenario: string;
  targetService: string;
  fixIntent: string;
  patterns: string[];
  rootCauses: string[];
  remediation: string[];
  rawContent: string;
}

export interface RagMatchResult {
  runbook: RunbookDocument;
  score: number; // 0.0 to 1.0 similarity score
  matchedPatterns: string[];
  keyEvidenceLine?: string;
}

/**
 * Gargi's Task 2: Log, CloudTrail & Runbook Search via RAG
 */
export class RagRetriever {
  private static runbooks: RunbookDocument[] = [];

  public static loadRunbooks(runbooksDir?: string): RunbookDocument[] {
    if (this.runbooks.length > 0) return this.runbooks;

    const baseDir = runbooksDir || path.resolve(__dirname, '../data/sre-runbooks');
    if (!fs.existsSync(baseDir)) {
      return [];
    }

    const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.md'));
    const loaded: RunbookDocument[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
      const doc = this.parseRunbookMarkdown(file, content);
      loaded.push(doc);
    }

    this.runbooks = loaded;
    return loaded;
  }

  private static parseRunbookMarkdown(filename: string, content: string): RunbookDocument {
    const id = filename.replace('.md', '');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const scenarioMatch = content.match(/-\s+\*\*Scenario\*\*:\s*([a-zA-Z0-9_-]+)/i);
    const serviceMatch = content.match(/-\s+\*\*Target Service\*\*:\s*(.+)$/m);
    const fixMatch = content.match(/-\s+\*\*Fix Intent\*\*:\s*(.+)$/m);

    // Extract code/pattern strings
    const patterns: string[] = [];
    const patternSection = content.split('## Error Signatures & Patterns')[1]?.split('##')[0] || '';
    const codeMatches = patternSection.matchAll(/`([^`]+)`/g);
    for (const match of codeMatches) {
      patterns.push(match[1]);
    }

    return {
      id,
      title: titleMatch ? titleMatch[1].trim() : id,
      scenario: scenarioMatch ? scenarioMatch[1].trim() : id,
      targetService: serviceMatch ? serviceMatch[1].trim() : 'AWS',
      fixIntent: fixMatch ? fixMatch[1].trim() : 'MANUAL_INSPECTION',
      patterns,
      rootCauses: [],
      remediation: [],
      rawContent: content,
    };
  }

  /**
   * Searches the runbooks knowledge base against incoming CloudWatch logs & CloudTrail events
   */
  public static query(
    logs: CloudWatchLogEntry[],
    trailEvents: CloudTrailEventEntry[],
    rootNodeId?: string
  ): RagMatchResult[] {
    const runbooks = this.loadRunbooks();
    if (runbooks.length === 0) return [];

    // Filter logs for root node if provided, else take all non-info logs
    const relevantLogs = rootNodeId
      ? logs.filter(l => l.nodeId === rootNodeId)
      : logs;

    const logMessages = relevantLogs.map(l => l.message.toLowerCase());
    const trailEventNames = trailEvents.map(e => e.eventName.toLowerCase());

    const results: RagMatchResult[] = [];

    for (const rb of runbooks) {
      let matchedPatterns: string[] = [];
      let bestEvidenceLine: string | undefined;

      for (const pattern of rb.patterns) {
        const pLower = pattern.toLowerCase();

        // 1. Check in logs
        for (const log of relevantLogs) {
          if (log.message.toLowerCase().includes(pLower)) {
            matchedPatterns.push(pattern);
            if (!bestEvidenceLine) {
              bestEvidenceLine = log.message;
            }
          }
        }

        // 2. Check in CloudTrail
        for (const evt of trailEvents) {
          if (
            evt.eventName.toLowerCase().includes(pLower) ||
            JSON.stringify(evt.requestParameters || {}).toLowerCase().includes(pLower)
          ) {
            matchedPatterns.push(pattern);
            if (!bestEvidenceLine) {
              bestEvidenceLine = `CloudTrail Event: ${evt.eventName} on ${evt.awsResourceId}`;
            }
          }
        }
      }

      // Deduplicate matched patterns
      matchedPatterns = Array.from(new Set(matchedPatterns));

      // Calculate confidence similarity score
      // Score based on ratio of matched patterns to total patterns + log presence
      let score = 0;
      if (rb.patterns.length > 0) {
        score = Math.min(1.0, matchedPatterns.length / Math.max(1, rb.patterns.length * 0.4));
      }

      // Boost if direct CloudTrail or FATAL log match
      if (matchedPatterns.length > 0) {
        results.push({
          runbook: rb,
          score: Number(score.toFixed(2)),
          matchedPatterns,
          keyEvidenceLine: bestEvidenceLine,
        });
      }
    }

    // Sort by best score descending
    return results.sort((a, b) => b.score - a.score);
  }
}

