export type Kind = 'review' | 'collaborate' | 'research' | 'image';
export type Mode = 'chat' | 'pro' | 'research' | 'image';
export type Status = 'queued' | 'prepared' | 'bound' | 'send_pending' | 'running' | 'waiting_user' | 'partial' | 'completed' | 'failed' | 'cancel_requested' | 'cancelled';
export interface Binding { browser: string; tab: string; conversation?: string }
export interface SourceFile { path: string; sha256: string; lines: number; text: string; bundleStart?: number }
export interface Snapshot {
  id: string; root: string; head: string; baseline: string; scope: 'changes' | 'repository' | 'files';
  requestedFiles: string[]; files: SourceFile[]; diff: string; omitted: { path: string; reason: string }[];
  coverage: string; fingerprint: string; maxBytes?: number;
}
export interface Artifact { id: string; path: string; sha256: string; bytes: number; width: number; height: number; mime: string; sourceTurn: string; original: true }
export interface Finding { title: string; severity: 'P0'|'P1'|'P2'|'P3'; path: string; line: number; evidence: string; suggestion: string; disposition?: 'apply'|'consider'|'reject'|'needs_user'; validation?: string }
export interface Observation {
  binding: Binding; turn: string; phase: 'thinking'|'clarification'|'planning'|'researching'|'generating'|'complete'|'partial'|'error';
  text?: string; model: string; mode: Mode; effort?: string; generating: boolean;
  citations?: string[]; reportOwnerTurn?: string; researchStarted?: boolean; stopVisible?: boolean; error?: string;
}
export interface Job {
  id: string; kind: Kind; status: Status; created: number; updated: number; repoId?: string; snapshot?: Snapshot;
  parent?: string; prompt: string; promptHash: string; expectedImages: number; outputDir: string;
  binding?: Binding; mode?: Mode; expectedMode?: Mode; expectedModel?: string; expectedEffort?: string; baselineTurns: string[]; nonce?: string; turn?: string;
  submitted?: number; actualModel?: string; actualMode?: Mode; actualEffort?: string; researchStarted?: boolean;
  observations: { at: number; phase: string; hash?: string; textLength?: number }[];
  candidate?: { hash: string; since: number; observation: Observation }; result?: Observation;
  artifacts: Artifact[]; findings: Finding[]; error?: string; stale?: boolean;
  capability?: { tokenHash: string; expires: number }; cancelConfirmed?: boolean;
  userQuestion?: string;
  history?: { turn: string; promptHash: string; submitted?: number; model?: string; mode?: Mode; effort?: string }[];
}
export interface DesktopResult {
  turnId: string; userMessageId: string; assistantMessageId: string; text: string;
  turnCompleted: true; truncated: false;
}
export interface DesktopJob {
  id: string; kind: 'review'|'collaborate'; status: Status; created: number; updated: number;
  threadId: string; threadKind: 'chatgpt'; parent?: string; prompt: string; renderedPrompt: string;
  modelEvidence: { requested: 'pro'; confirmedBy: 'user'; actual: 'unknown' };
  snapshot?: Snapshot; baselineTurns: string[]; nonce?: string; turnId?: string; userMessageId?: string;
  submitted?: number; assistantMessageId?: string; partialText?: string; result?: DesktopResult; error?: string;
}
export interface Database { version: 1; jobs: Record<string, Job>; maxConcurrent: number; desktopJobs?: Record<string, DesktopJob> }
