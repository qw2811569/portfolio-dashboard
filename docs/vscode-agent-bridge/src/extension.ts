import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import WebSocket, { WebSocketServer } from 'ws';

// ─── Agent Detection Patterns ───────────────────────────────────
interface AgentProfile {
  id: string;
  name: string;
  icon: string;     // emoji
  color: string;    // hex
  patterns: RegExp[];
}

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    icon: '🟠',
    color: '#E87B35',
    patterns: [/claude/i, /anthropic/i, /cline/i, /claude-code/i],
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    icon: '🟢',
    color: '#10A37F',
    patterns: [/codex/i, /openai/i],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    icon: '🔵',
    color: '#615EFF',
    patterns: [/qwen/i, /tongyi/i, /alibaba/i],
  },
  {
    id: 'gemini',
    name: 'Gemini / Google',
    icon: '🔴',
    color: '#EA4335',
    patterns: [/gemini/i, /google.*code.*assist/i, /google/i],
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    icon: '⚪',
    color: '#6E40C9',
    patterns: [/copilot/i, /github/i],
  },
];

// ─── Terminal Agent Session ─────────────────────────────────────
interface AgentSession {
  id: string;
  terminalIndex: number;
  terminalName: string;
  agent: AgentProfile;
  buffer: string[];          // circular buffer of recent output lines
  lastActivity: number;
  isActive: boolean;
}

type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
type TaskConsensusState = 'none' | 'pending' | 'approved' | 'rejected';
type TaskConsensusDecision = 'approved' | 'rejected';

interface TaskEvidence {
  changedFiles: string[];
  verificationRuns: string[];
  risksNoted: string[];
  nextStep: string;
}

interface TaskConsensusReview {
  agentId: string;
  decision: TaskConsensusDecision;
  summary: string;
  updatedAt: number;
}

interface BridgeTask {
  id: string;
  title: string;
  lane: string;
  owner: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependsOn: string[];
  writeScope: string[];
  sourcePlanRef: string;
  summary: string;
  dispatchPrompt: string;
  assignedSessionId: string | null;
  lastDispatchedAt: number | null;
  dispatchCount: number;
  evidence: TaskEvidence;
  requiresConsensus: boolean;
  consensusReviews: TaskConsensusReview[];
  completedAt: number | null;
  consensusState: TaskConsensusState;
  createdAt: number;
  updatedAt: number;
}

interface TaskSeedFile {
  version?: number;
  generatedFrom?: string;
  tasks?: Partial<BridgeTask>[];
}

const MAX_BUFFER_LINES = 500;
const CONSENSUS_APPROVAL_QUORUM = 2;
const TASK_STORE_KEY = 'agentBridge.tasks.v1';
const TASK_SEED_RELATIVE_PATH = path.join('coordination', 'llm-bus', 'agent-bridge-tasks.json');
const sessions = new Map<string, AgentSession>();
const tasks = new Map<string, BridgeTask>();
let wsClients: Set<WebSocket> = new Set();
let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let extensionCtx: vscode.ExtensionContext | null = null;

type TerminalDataEvent = {
  terminal: vscode.Terminal;
  data: string;
};

// ─── Activate ───────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
  extensionCtx = context;
  outputChannel = vscode.window.createOutputChannel('Agent Bridge');
  log('Agent Bridge activating...');

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'agentBridge.start';
  statusBarItem.text = '$(radio-tower) Agent Bridge';
  statusBarItem.tooltip = 'Click to start Agent Bridge server';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agentBridge.start', () => startServer(context)),
    vscode.commands.registerCommand('agentBridge.stop', stopServer),
    vscode.commands.registerCommand('agentBridge.showQR', showConnectionInfo),
  );

  // Terminal monitoring
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(onTerminalOpened),
    vscode.window.onDidCloseTerminal(onTerminalClosed),
    vscode.window.onDidChangeActiveTerminal(onTerminalChanged),
  );

  // Monitor terminal data output when supported by the local VS Code API surface.
  const terminalWindow = vscode.window as typeof vscode.window & {
    onDidWriteTerminalData?: (
      listener: (event: TerminalDataEvent) => void
    ) => vscode.Disposable;
  };
  if (terminalWindow.onDidWriteTerminalData) {
    context.subscriptions.push(
      terminalWindow.onDidWriteTerminalData((event: TerminalDataEvent) => {
        onTerminalData(event.terminal, event.data);
      })
    );
  } else {
    log('Terminal data events are not available in this VS Code runtime');
  }

  // Scan existing terminals
  vscode.window.terminals.forEach(t => onTerminalOpened(t));
  loadTasks(context);
  reconcileTaskAssignments();

  // Auto-start
  const config = vscode.workspace.getConfiguration('agentBridge');
  if (config.get<boolean>('autoStart', true)) {
    startServer(context);
  }

  log('Agent Bridge activated');
}

export function deactivate() {
  stopServer();
}

// ─── Terminal Monitoring ────────────────────────────────────────
function detectAgent(terminalName: string): AgentProfile | null {
  for (const profile of AGENT_PROFILES) {
    for (const pattern of profile.patterns) {
      if (pattern.test(terminalName)) {
        return profile;
      }
    }
  }
  return null;
}

function getTerminalId(terminal: vscode.Terminal): string {
  // Use name + processId as unique key
  return `term_${terminal.name}_${terminal.processId ?? Date.now()}`;
}

function onTerminalOpened(terminal: vscode.Terminal) {
  const agent = detectAgent(terminal.name);
  const id = getTerminalId(terminal);
  const idx = vscode.window.terminals.indexOf(terminal);

  const session: AgentSession = {
    id,
    terminalIndex: idx,
    terminalName: terminal.name,
    agent: agent ?? {
      id: 'unknown',
      name: terminal.name,
      icon: '⬜',
      color: '#888888',
      patterns: [],
    },
    buffer: [],
    lastActivity: Date.now(),
    isActive: true,
  };

  sessions.set(id, session);
  broadcast({ type: 'session:open', session: serializeSession(session) });
  broadcastTasksSnapshot();
  log(`Terminal opened: ${terminal.name} → detected as ${session.agent.name}`);
}

function onTerminalClosed(terminal: vscode.Terminal) {
  const id = findSessionByTerminal(terminal);
  if (id) {
    const session = sessions.get(id);
    if (session) {
      session.isActive = false;
      broadcast({ type: 'session:close', sessionId: id });
    }
    // Keep in sessions for history, mark inactive
    reconcileTaskAssignments();
    broadcastTasksSnapshot();
  }
}

function onTerminalChanged(terminal: vscode.Terminal | undefined) {
  // Broadcast active terminal change
  if (terminal) {
    const id = findSessionByTerminal(terminal);
    broadcast({ type: 'session:focus', sessionId: id ?? null });
  }
}

function onTerminalData(terminal: vscode.Terminal, data: string) {
  const id = findSessionByTerminal(terminal);
  if (!id) return;

  const session = sessions.get(id);
  if (!session) return;

  // Clean ANSI escape codes for readability
  const cleaned = stripAnsi(data);
  if (cleaned.trim().length === 0) return;

  // Split into lines, push to buffer
  const lines = cleaned.split('\n');
  for (const line of lines) {
    if (line.trim().length > 0) {
      session.buffer.push(line);
      if (session.buffer.length > MAX_BUFFER_LINES) {
        session.buffer.shift();
      }
    }
  }
  session.lastActivity = Date.now();

  // Re-detect agent from output content if unknown
  if (session.agent.id === 'unknown') {
    for (const profile of AGENT_PROFILES) {
      for (const pattern of profile.patterns) {
        if (pattern.test(data)) {
          session.agent = profile;
          broadcast({ type: 'session:update', session: serializeSession(session) });
          break;
        }
      }
    }
  }

  // Broadcast to all connected mobile clients
  broadcast({
    type: 'terminal:data',
    sessionId: id,
    data: cleaned,
    timestamp: Date.now(),
  });
}

function findSessionByTerminal(terminal: vscode.Terminal): string | null {
  for (const [id, session] of sessions) {
    if (session.terminalName === terminal.name) {
      return id;
    }
  }
  return null;
}

function sendToTerminal(sessionId: string, text: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.isActive) return false;

  const terminal = vscode.window.terminals.find(t => t.name === session.terminalName);
  if (!terminal) return false;

  terminal.sendText(text);
  log(`Sent to ${session.agent.name}: ${text.substring(0, 80)}...`);
  return true;
}

function getWorkspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

function parseTaskStatus(value: unknown): TaskStatus {
  switch (value) {
    case 'pending':
    case 'in_progress':
    case 'blocked':
    case 'completed':
      return value;
    case 'queued':
      return 'pending';
    case 'done':
      return 'completed';
    default:
      return 'pending';
  }
}

function parseTaskPriority(value: unknown): TaskPriority {
  switch (value) {
    case 'low':
    case 'medium':
    case 'high':
    case 'critical':
      return value;
    default:
      return 'medium';
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
}

function normalizeOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseConsensusState(value: unknown): TaskConsensusState {
  switch (value) {
    case 'pending':
    case 'approved':
    case 'rejected':
      return value;
    default:
      return 'none';
  }
}

function parseConsensusDecision(value: unknown): TaskConsensusDecision | null {
  switch (value) {
    case 'approved':
    case 'rejected':
      return value;
    default:
      return null;
  }
}

function normalizeTaskEvidence(value: unknown, current?: TaskEvidence): TaskEvidence {
  const raw = value && typeof value === 'object' ? (value as Partial<TaskEvidence>) : {};

  return {
    changedFiles: normalizeStringArray(raw.changedFiles ?? current?.changedFiles),
    verificationRuns: normalizeStringArray(raw.verificationRuns ?? current?.verificationRuns),
    risksNoted: normalizeStringArray(raw.risksNoted ?? current?.risksNoted),
    nextStep: normalizeOptionalText(raw.nextStep ?? current?.nextStep),
  };
}

function normalizeTaskConsensusReviews(
  value: unknown,
  current: TaskConsensusReview[] = []
): TaskConsensusReview[] {
  const source = Array.isArray(value) ? value : current;
  const reviews = new Map<string, TaskConsensusReview>();

  for (const item of source) {
    const raw = item && typeof item === 'object'
      ? (item as Partial<TaskConsensusReview>)
      : null;
    const agentId = normalizeOptionalText(raw?.agentId);
    const decision = parseConsensusDecision(raw?.decision);
    if (!agentId || !decision) continue;

    reviews.set(agentId, {
      agentId,
      decision,
      summary: normalizeOptionalText(raw?.summary),
      updatedAt: normalizeOptionalTimestamp(raw?.updatedAt) ?? Date.now(),
    });
  }

  return Array.from(reviews.values()).sort((a, b) => a.agentId.localeCompare(b.agentId));
}

function deriveConsensusState(
  requiresConsensus: boolean,
  reviews: TaskConsensusReview[]
): TaskConsensusState {
  if (!requiresConsensus) return 'none';
  if (reviews.some(review => review.decision === 'rejected')) return 'rejected';
  return reviews.filter(review => review.decision === 'approved').length >= CONSENSUS_APPROVAL_QUORUM
    ? 'approved'
    : 'pending';
}

function hasTaskCompletionEvidence(task: BridgeTask): boolean {
  return task.evidence.changedFiles.length > 0 && task.evidence.verificationRuns.length > 0;
}

function sanitizeTaskMutationPayload(
  raw: Partial<BridgeTask> & { evidence?: unknown; consensusState?: unknown; consensusReviews?: unknown }
) {
  const next = { ...raw } as Partial<BridgeTask> & { consensusState?: unknown; consensusReviews?: unknown };
  delete next.consensusState;
  delete next.consensusReviews;
  return next;
}

function normalizeTask(
  raw: Partial<BridgeTask> & { id?: unknown; preferredAgentId?: unknown },
  current?: BridgeTask
): BridgeTask {
  const now = Date.now();
  const id = normalizeOptionalText(raw.id) || current?.id || `task-${now}`;
  const owner =
    normalizeOptionalText(raw.owner) ||
    normalizeOptionalText(raw.preferredAgentId) ||
    current?.owner ||
    'unknown';
  const requiresConsensus = Boolean(
    (raw as { requiresConsensus?: unknown }).requiresConsensus ?? current?.requiresConsensus
  );
  const consensusReviews = normalizeTaskConsensusReviews(
    (raw as { consensusReviews?: unknown }).consensusReviews,
    current?.consensusReviews
  );

  return {
    id,
    title: normalizeOptionalText(raw.title) || current?.title || 'Untitled task',
    lane: normalizeOptionalText(raw.lane) || current?.lane || 'general',
    owner,
    status: parseTaskStatus(raw.status ?? current?.status),
    priority: parseTaskPriority(raw.priority ?? current?.priority),
    dependsOn: normalizeStringArray(raw.dependsOn ?? current?.dependsOn),
    writeScope: normalizeStringArray(raw.writeScope ?? current?.writeScope),
    sourcePlanRef:
      normalizeOptionalText(raw.sourcePlanRef) || current?.sourcePlanRef || '',
    summary: normalizeOptionalText(raw.summary) || current?.summary || '',
    dispatchPrompt:
      normalizeOptionalText(raw.dispatchPrompt) ||
      current?.dispatchPrompt ||
      normalizeOptionalText(raw.summary) ||
      current?.summary ||
      normalizeOptionalText(raw.title) ||
      current?.title ||
      '',
    assignedSessionId:
      normalizeOptionalText(raw.assignedSessionId) || current?.assignedSessionId || null,
    lastDispatchedAt:
      normalizeOptionalTimestamp(raw.lastDispatchedAt) ?? current?.lastDispatchedAt ?? null,
    dispatchCount:
      typeof raw.dispatchCount === 'number' && Number.isFinite(raw.dispatchCount)
        ? raw.dispatchCount
        : current?.dispatchCount ?? 0,
    evidence: normalizeTaskEvidence((raw as { evidence?: unknown }).evidence, current?.evidence),
    requiresConsensus,
    consensusReviews,
    completedAt:
      normalizeOptionalTimestamp((raw as { completedAt?: unknown }).completedAt) ??
      current?.completedAt ??
      null,
    consensusState: deriveConsensusState(requiresConsensus, consensusReviews),
    createdAt:
      (typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : null) ??
      current?.createdAt ??
      now,
    updatedAt: now,
  };
}

function persistTasks() {
  if (!extensionCtx) return;

  const payload = Object.fromEntries(
    Array.from(tasks.entries()).map(([id, task]) => [id, task])
  );
  void extensionCtx.globalState.update(TASK_STORE_KEY, payload);
}

function readSeedTasks(): Array<Partial<BridgeTask>> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return [];

  const seedPath = path.join(workspaceRoot, TASK_SEED_RELATIVE_PATH);
  if (!fs.existsSync(seedPath)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as TaskSeedFile;
    return Array.isArray(parsed.tasks) ? parsed.tasks : [];
  } catch (error) {
    log(`Failed to read task seed file: ${String(error)}`);
    return [];
  }
}

function loadTasks(context: vscode.ExtensionContext) {
  tasks.clear();

  const persisted = context.globalState.get<Record<string, Partial<BridgeTask>>>(TASK_STORE_KEY, {});
  for (const [id, raw] of Object.entries(persisted)) {
    tasks.set(id, normalizeTask({ id, ...raw }));
  }

  for (const seed of readSeedTasks()) {
    const seedId = normalizeOptionalText(seed.id);
    if (!seedId) continue;
    const current = tasks.get(seedId);
    tasks.set(seedId, normalizeTask({ ...seed, id: seedId }, current));
  }

  persistTasks();
}

function findRecommendedSessionForTask(task: BridgeTask): AgentSession | null {
  const assigned = task.assignedSessionId ? sessions.get(task.assignedSessionId) : null;
  if (assigned?.isActive) {
    return assigned;
  }

  const candidates = Array.from(sessions.values())
    .filter(session => session.isActive && session.agent.id === task.owner)
    .sort((a, b) => b.lastActivity - a.lastActivity);

  return candidates[0] ?? null;
}

function serializeTask(task: BridgeTask) {
  const recommendedSession = findRecommendedSessionForTask(task);
  const hasEvidence = hasTaskCompletionEvidence(task);
  const consensusApprovalCount = task.consensusReviews.filter(
    review => review.decision === 'approved'
  ).length;
  const consensusRequiredCount = task.requiresConsensus ? CONSENSUS_APPROVAL_QUORUM : 0;
  const verificationState =
    task.status !== 'completed'
      ? 'open'
      : !hasEvidence
        ? 'draft'
        : task.consensusState === 'rejected'
          ? 'rejected'
          : task.requiresConsensus && task.consensusState !== 'approved'
            ? 'pending_consensus'
            : 'verified';

  return {
    id: task.id,
    title: task.title,
    lane: task.lane,
    owner: task.owner,
    status: task.status,
    priority: task.priority,
    dependsOn: task.dependsOn,
    writeScope: task.writeScope,
    sourcePlanRef: task.sourcePlanRef,
    summary: task.summary,
    dispatchPrompt: task.dispatchPrompt,
    assignedSessionId: task.assignedSessionId,
    recommendedSessionId: recommendedSession?.id ?? null,
    recommendedSessionName: recommendedSession?.terminalName ?? null,
    dispatchCount: task.dispatchCount,
    lastDispatchedAt: task.lastDispatchedAt,
    evidence: task.evidence,
    requiresConsensus: task.requiresConsensus,
    consensusReviews: task.consensusReviews,
    consensusApprovalCount,
    consensusRequiredCount,
    completedAt: task.completedAt,
    consensusState: task.consensusState,
    verificationState,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function broadcastTasksSnapshot() {
  broadcast({
    type: 'tasks:snapshot',
    tasks: Array.from(tasks.values()).map(serializeTask),
  });
}

function reconcileTaskAssignments() {
  let changed = false;

  for (const task of tasks.values()) {
    if (!task.assignedSessionId) continue;

    const assigned = sessions.get(task.assignedSessionId);
    if (assigned?.isActive) continue;

    task.assignedSessionId = null;
    if (task.status === 'in_progress') {
      task.status = 'pending';
    }
    task.updatedAt = Date.now();
    changed = true;
  }

  if (changed) {
    persistTasks();
    broadcastTasksSnapshot();
  }
}

function upsertTask(raw: Partial<BridgeTask> & { id?: unknown; preferredAgentId?: unknown }) {
  const id = normalizeOptionalText(raw.id);
  const current = id ? tasks.get(id) : undefined;
  const next = normalizeTask(raw, current);
  tasks.set(next.id, next);
  persistTasks();
  broadcast({ type: current ? 'task:updated' : 'task:created', task: serializeTask(next) });
  return next;
}

function applyConsensusReview(
  taskId: string,
  raw: { agentId?: unknown; decision?: unknown; summary?: unknown }
) {
  const current = tasks.get(taskId);
  if (!current) {
    return { ok: false, error: 'Task not found' };
  }
  if (!current.requiresConsensus) {
    return { ok: false, error: 'Task does not require consensus' };
  }

  const agentId = normalizeOptionalText(raw.agentId);
  const decision = parseConsensusDecision(raw.decision);
  if (!agentId || !decision) {
    return { ok: false, error: 'Consensus review requires agentId and decision' };
  }

  const nextReviews = current.consensusReviews.filter(review => review.agentId !== agentId);
  nextReviews.push({
    agentId,
    decision,
    summary: normalizeOptionalText(raw.summary),
    updatedAt: Date.now(),
  });

  const task = normalizeTask(
    {
      ...current,
      id: taskId,
      consensusReviews: nextReviews,
    },
    current
  );

  tasks.set(taskId, task);
  persistTasks();
  broadcast({ type: 'task:consensus', task: serializeTask(task) });
  return { ok: true, task: serializeTask(task) };
}

function completeTask(
  taskId: string,
  raw: Partial<BridgeTask> & { evidence?: unknown; consensusState?: unknown }
) {
  const current = tasks.get(taskId);
  if (!current) {
    return { ok: false, error: 'Task not found' };
  }

  const evidence = normalizeTaskEvidence(raw.evidence, current.evidence);
  if (evidence.changedFiles.length === 0 || evidence.verificationRuns.length === 0) {
    return {
      ok: false,
      error: 'Completion evidence requires changedFiles and verificationRuns',
    };
  }

  const task = normalizeTask(
    {
      ...current,
      ...sanitizeTaskMutationPayload(raw),
      id: taskId,
      status: 'completed',
      evidence,
      completedAt: Date.now(),
    },
    current
  );

  tasks.set(taskId, task);
  persistTasks();
  broadcast({ type: 'task:completed', task: serializeTask(task) });
  return { ok: true, task: serializeTask(task) };
}

function dispatchTask(taskId: string, requestedSessionId?: string) {
  const task = tasks.get(taskId);
  if (!task) {
    return { ok: false, error: 'Task not found' };
  }

  for (const dependencyId of task.dependsOn) {
    const dependency = tasks.get(dependencyId);
    if (!dependency) continue;
    if (dependency.status !== 'completed') {
      return {
        ok: false,
        error: `Dependency ${dependencyId} is not completed`,
      };
    }
    if (dependency.requiresConsensus && dependency.consensusState !== 'approved') {
      return {
        ok: false,
        error: `Dependency ${dependencyId} is waiting for consensus`,
      };
    }
  }

  const target =
    (requestedSessionId ? sessions.get(requestedSessionId) ?? null : null) ??
    findRecommendedSessionForTask(task);

  if (!target?.isActive) {
    return { ok: false, error: 'No active session available for this task' };
  }

  const text = task.dispatchPrompt || task.summary || task.title;
  const ok = sendToTerminal(target.id, text);
  if (!ok) {
    return { ok: false, error: 'Failed to send task to terminal' };
  }

  task.assignedSessionId = target.id;
  task.status = 'in_progress';
  task.dispatchCount += 1;
  task.lastDispatchedAt = Date.now();
  task.updatedAt = Date.now();
  persistTasks();
  broadcast({ type: 'task:dispatched', task: serializeTask(task) });

  return {
    ok: true,
    task: serializeTask(task),
    sessionId: target.id,
  };
}

// ─── HTTP + WebSocket Server ────────────────────────────────────
function startServer(context: vscode.ExtensionContext) {
  if (server) {
    vscode.window.showInformationMessage('Agent Bridge server is already running');
    return;
  }

  const config = vscode.workspace.getConfiguration('agentBridge');
  const port = config.get<number>('port', 9527);

  // Read dashboard HTML
  const dashboardPath = path.join(context.extensionPath, 'dashboard', 'index.html');
  let dashboardHtml = '';
  try {
    dashboardHtml = fs.readFileSync(dashboardPath, 'utf-8');
  } catch {
    log('Dashboard HTML not found, using embedded fallback');
    dashboardHtml = '<html><body><h1>Agent Bridge</h1><p>Dashboard file missing</p></body></html>';
  }

  server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '/';
    const pathname = new URL(url, 'http://127.0.0.1').pathname;

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(dashboardHtml);
      return;
    }

    if (pathname === '/api/sessions') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const data = Array.from(sessions.values()).map(serializeSession);
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: process.uptime(),
        sessions: sessions.size,
        tasks: tasks.size,
        clients: wsClients.size,
        workspace: vscode.workspace.name ?? 'unknown',
      }));
      return;
    }

    if (pathname === '/api/tasks' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Array.from(tasks.values()).map(serializeTask)));
      return;
    }

    // POST /api/send  { sessionId, text }
    if (pathname === '/api/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { sessionId, text } = JSON.parse(body);
          const ok = sendToTerminal(sessionId, text);
          res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok, sessionId }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // POST /api/terminal/create  { name, command? }
    if (pathname === '/api/terminal/create' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { name, command } = JSON.parse(body);
          const terminal = vscode.window.createTerminal(name ?? 'Agent Bridge');
          if (command) {
            terminal.sendText(command);
          }
          terminal.show();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, name: terminal.name }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (pathname === '/api/tasks' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const task = upsertTask(sanitizeTaskMutationPayload(JSON.parse(body)));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, task: serializeTask(task) }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (pathname === '/api/tasks/sync' && req.method === 'POST') {
      loadTasks(context);
      reconcileTaskAssignments();
      broadcastTasksSnapshot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, tasks: Array.from(tasks.values()).map(serializeTask) }));
      return;
    }

    const dispatchMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/dispatch$/);
    if (dispatchMatch && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = dispatchTask(decodeURIComponent(dispatchMatch[1]), parsed.sessionId);
          res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    const completeMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/complete$/);
    if (completeMatch && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = completeTask(decodeURIComponent(completeMatch[1]), parsed);
          res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    const consensusMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/consensus$/);
    if (consensusMatch && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = applyConsensusReview(decodeURIComponent(consensusMatch[1]), parsed);
          res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && (req.method === 'PATCH' || req.method === 'POST')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const task = upsertTask({
            ...sanitizeTaskMutationPayload(parsed),
            id: decodeURIComponent(taskMatch[1]),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, task: serializeTask(task) }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // WebSocket server
  wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    wsClients.add(ws);
    log(`Mobile client connected (total: ${wsClients.size})`);

    // Send current state snapshot
    ws.send(JSON.stringify({
      type: 'snapshot',
      sessions: Array.from(sessions.values()).map(serializeSession),
      workspace: vscode.workspace.name ?? 'unknown',
    }));
    ws.send(JSON.stringify({
      type: 'tasks:snapshot',
      tasks: Array.from(tasks.values()).map(serializeTask),
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleWsMessage(ws, msg);
      } catch {
        log('Invalid WS message');
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
      log(`Mobile client disconnected (total: ${wsClients.size})`);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    statusBarItem.text = `$(radio-tower) Agent Bridge :${port}`;
    statusBarItem.tooltip = `Server running on port ${port} — click to show connection info`;
    statusBarItem.command = 'agentBridge.showQR';
    log(`Server started on 0.0.0.0:${port}`);
    vscode.window.showInformationMessage(
      `Agent Bridge running on port ${port}. Open http://<your-ip>:${port} on your phone.`
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      vscode.window.showErrorMessage(`Port ${port} is already in use. Change agentBridge.port in settings.`);
    } else {
      vscode.window.showErrorMessage(`Server error: ${err.message}`);
    }
    server = null;
  });
}

function stopServer() {
  if (wss) {
    wsClients.forEach(ws => ws.close());
    wsClients.clear();
    wss.close();
    wss = null;
  }
  if (server) {
    server.close();
    server = null;
  }
  statusBarItem.text = '$(radio-tower) Agent Bridge';
  statusBarItem.tooltip = 'Click to start Agent Bridge server';
  statusBarItem.command = 'agentBridge.start';
  log('Server stopped');
}

function handleWsMessage(ws: WebSocket, msg: any) {
  switch (msg.type) {
    case 'send': {
      // Send text to a terminal
      const ok = sendToTerminal(msg.sessionId, msg.text);
      ws.send(JSON.stringify({ type: 'send:ack', ok, sessionId: msg.sessionId }));
      break;
    }
    case 'terminal:create': {
      const terminal = vscode.window.createTerminal(msg.name ?? 'Agent Bridge');
      if (msg.command) terminal.sendText(msg.command);
      terminal.show();
      ws.send(JSON.stringify({ type: 'terminal:created', name: terminal.name }));
      break;
    }
    case 'session:history': {
      // Return buffer for a session
      const session = sessions.get(msg.sessionId);
      if (session) {
        ws.send(JSON.stringify({
          type: 'session:history',
          sessionId: msg.sessionId,
          lines: session.buffer,
        }));
      }
      break;
    }
    case 'task:list':
      ws.send(JSON.stringify({
        type: 'tasks:snapshot',
        tasks: Array.from(tasks.values()).map(serializeTask),
      }));
      break;
    case 'task:create': {
      const task = upsertTask(sanitizeTaskMutationPayload(msg.task ?? msg));
      ws.send(JSON.stringify({ type: 'task:created:ack', task: serializeTask(task) }));
      break;
    }
    case 'task:update': {
      const task = upsertTask(sanitizeTaskMutationPayload(msg.task ?? msg));
      ws.send(JSON.stringify({ type: 'task:updated:ack', task: serializeTask(task) }));
      break;
    }
    case 'task:dispatch': {
      const result = dispatchTask(msg.taskId, msg.sessionId);
      ws.send(JSON.stringify({ type: 'task:dispatch:ack', ...result }));
      break;
    }
    case 'task:complete': {
      const result = completeTask(msg.taskId, msg.task ?? msg);
      ws.send(JSON.stringify({ type: 'task:complete:ack', ...result }));
      break;
    }
    case 'task:consensus': {
      const result = applyConsensusReview(msg.taskId, msg.review ?? msg);
      ws.send(JSON.stringify({ type: 'task:consensus:ack', ...result }));
      break;
    }
    case 'task:sync':
      if (extensionCtx) {
        loadTasks(extensionCtx);
        reconcileTaskAssignments();
      }
      ws.send(JSON.stringify({
        type: 'tasks:snapshot',
        tasks: Array.from(tasks.values()).map(serializeTask),
      }));
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

function showConnectionInfo() {
  const config = vscode.workspace.getConfiguration('agentBridge');
  const port = config.get<number>('port', 9527);

  const msg = [
    `🌐 Agent Bridge Dashboard`,
    ``,
    `Local:     http://localhost:${port}`,
    `Tailscale: http://<tailscale-ip>:${port}`,
    ``,
    `Open this URL on your phone to control your agents.`,
    `Connected mobile clients: ${wsClients.size}`,
    `Active sessions: ${sessions.size}`,
    `Tracked tasks: ${tasks.size}`,
  ].join('\n');

  vscode.window.showInformationMessage(
    `Agent Bridge on port ${port} | ${wsClients.size} clients | ${sessions.size} sessions | ${tasks.size} tasks`,
    'Copy URL'
  ).then(choice => {
    if (choice === 'Copy URL') {
      vscode.env.clipboard.writeText(`http://localhost:${port}`);
    }
  });

  outputChannel.show();
  outputChannel.appendLine(msg);
}

// ─── Utilities ──────────────────────────────────────────────────
function broadcast(data: any) {
  const json = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

function serializeSession(s: AgentSession) {
  return {
    id: s.id,
    terminalName: s.terminalName,
    agent: {
      id: s.agent.id,
      name: s.agent.name,
      icon: s.agent.icon,
      color: s.agent.color,
    },
    bufferLength: s.buffer.length,
    lastLines: s.buffer.slice(-20),
    lastActivity: s.lastActivity,
    isActive: s.isActive,
  };
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')
            .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '');
}

function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  outputChannel.appendLine(`[${ts}] ${msg}`);
}
