// bridge is the single seam between the React app and the Go kernel. In the
// VSCode extension mode it proxies every call through /api/call/{method} via
// the HTTP bridge. Events arrive over an SSE stream from /api/events.

import { addBreadcrumb } from "./breadcrumbs";

import type {
  AutoResearchFindingView,
  AutoResearchEvidenceView,
  AutoResearchStatusView,
  BalanceInfo,
  BotConnectionDiagnostic,
  BotInstallPollResult,
  BotInstallStartResult,
  BotRuntimeStatusView,
  BotSettingsView,
  CapabilitiesView,
  CheckpointMeta,
  CommandInfo,
  ContextInfo,
  ContextPanelInfo,
  DirEntry,
  DesktopStartupSettingsView,
  DroppedItem,
  EffortInfo,
  FilePreview,
  HistoryMessage,
  HistoryPage,
  HookConfigView,
  HooksSettingsView,
  JobView,
  MCPServerInput,
  MemorySuggestion,
  MemorySuggestionsView,
  MemoryView,
  Meta,
  ModelInfo,
  NetworkView,
  PluginInstallOptions,
  PluginView,
  ProjectNode,
  PromptHistoryResult,
  ProviderView,
  QuestionAnswer,
  ServerView,
  SessionMeta,
  SessionRecoveryFailedEvent,
  SessionRecoveryEvent,
  SettingsView,
  SkillsSettingsView,
  SkillSuggestion,
  SlashArgsResult,
  TabMeta,
  TopicMeta,
  WireEvent,
  WorkspaceChangesView,
  GitCommitView,
  GitCommitDetailView,
  WorkspaceView,
} from "./types";

// AppBindings is derived from the Wails-generated Go → TS method signatures, so
// the compiler catches drift between the Go binding surface and the frontend mock.
// Run `wails generate module` after adding/renaming a bound method on App, then
// `pnpm typecheck` to verify the mock still satisfies the contract.
//
// Types for the new native-feel bindings — kept inline since they are
// bridge-specific and only used in AppBindings / the dev mock.
interface NativeConfirmRequest {
  title: string;
  message: string;
  detail: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
}

// AppBindings is the hand-written contract between the React app and the Go
// kernel. It uses local types (types.ts) so components don't import generated
// model classes.
// to AppBindings, then run `pnpm typecheck` to verify.
export interface AppBindings {
  Platform(): Promise<string>;
  // ── Heartbeat ──
  HeartbeatListTasks(): Promise<unknown>;
  HeartbeatReloadTasks(): Promise<unknown>;
  HeartbeatSaveTasks(tasks: unknown): Promise<void>;
  HeartbeatTriggerNow(id: string): Promise<void>;
  HeartbeatGenerateID(): Promise<string>;
  Submit(input: string): Promise<void>;
  SubmitToTab(tabID: string, input: string): Promise<void>;
  SubmitDisplay(display: string, input: string): Promise<void>;
  SubmitDisplayToTab(tabID: string, display: string, input: string): Promise<void>;
  SubmitEditedDisplayToTab(tabID: string, display: string, input: string, original: string): Promise<void>;
  RunShell(command: string): Promise<void>;
  RunShellForTab(tabID: string, command: string): Promise<void>;
  Steer(text: string): Promise<void>;
  SteerForTab(tabID: string, text: string): Promise<void>;
  Cancel(): Promise<void>;
  CancelTab(tabID: string): Promise<void>;
  Approve(id: string, allow: boolean, session: boolean, persist: boolean): Promise<void>;
  ApproveTab(tabID: string, id: string, allow: boolean, session: boolean, persist: boolean): Promise<void>;
  AnswerQuestion(id: string, answers: QuestionAnswer[]): Promise<void>;
  AnswerQuestionForTab(tabID: string, id: string, answers: QuestionAnswer[]): Promise<void>;
  ReplayPendingPrompts(): Promise<void>;
  SetPlanMode(on: boolean): Promise<void>;
  SetMode(mode: string): Promise<void>;
  SetModeForTab(tabID: string, mode: string): Promise<void>;
  SetAutoApproveTools(on: boolean): Promise<void>;
  SetCollaborationMode(mode: string): Promise<void>;
  SetCollaborationModeForTab(tabID: string, mode: string): Promise<void>;
  SetToolApprovalMode(mode: string): Promise<void>;
  SetToolApprovalModeForTab(tabID: string, mode: string): Promise<void>;
  SetGoal(goal: string): Promise<void>;
  SetGoalForTab(tabID: string, goal: string): Promise<void>;
  ClearGoal(): Promise<void>;
  ClearGoalForTab(tabID: string): Promise<void>;
  Compact(): Promise<void>;
  NewSession(): Promise<void>;
  ClearSession(): Promise<void>;
  History(): Promise<HistoryMessage[]>;
  HistoryForTab(tabID: string): Promise<HistoryMessage[]>;
  HistoryPage(beforeTurn: number, limit: number): Promise<HistoryPage>;
  HistoryPageForTab(tabID: string, beforeTurn: number, limit: number): Promise<HistoryPage>;
  HistoryCheckpointTurnsForTab(tabID: string): Promise<number[]>;
  Checkpoints(): Promise<CheckpointMeta[]>;
  CheckpointsForTab(tabID: string): Promise<CheckpointMeta[]>;
  Rewind(turn: number, scope: string): Promise<void>;
  Fork(turn: number): Promise<TabMeta>;
  SummarizeFrom(turn: number): Promise<void>;
  SummarizeUpTo(turn: number): Promise<void>;
  ListSessions(): Promise<SessionMeta[]>;
  ListTrashedSessions(): Promise<SessionMeta[]>;
  ResumeSession(path: string): Promise<HistoryMessage[]>;
  ResumeSessionForTab(tabID: string, path: string): Promise<HistoryMessage[]>;
  ResumeSessionPage(path: string, limit: number): Promise<HistoryPage>;
  ResumeSessionPageForTab(tabID: string, path: string, limit: number): Promise<HistoryPage>;
  OpenChannelSessionForTab(tabID: string, path: string): Promise<HistoryMessage[]>;
  OpenChannelSessionPageForTab(tabID: string, path: string, limit: number): Promise<HistoryPage>;
  PreviewSession(path: string): Promise<HistoryMessage[]>;
  DeleteSession(path: string): Promise<void>;
  RestoreSession(path: string): Promise<void>;
  PurgeTrashedSession(path: string): Promise<void>;
  RenameSession(path: string, title: string): Promise<void>;
  ScanPromptHistory(nonce: string): Promise<PromptHistoryResult>;
  ListWorkspaces(): Promise<WorkspaceView[]>;
  PickWorkspace(): Promise<string>;
  SwitchWorkspace(path: string): Promise<string>;
  RemoveWorkspace(path: string): Promise<void>;
  ContextUsage(): Promise<ContextInfo>;
  ContextUsageForTab(tabID: string): Promise<ContextInfo>;
  Balance(): Promise<BalanceInfo>;
  BalanceForTab(tabID: string): Promise<BalanceInfo>;
  Jobs(): Promise<JobView[]>;
  JobsForTab(tabID: string): Promise<JobView[]>;
  ToolResultForTab(tabID: string, toolID: string): Promise<{ args: string; output: string } | null>;
  Meta(): Promise<Meta>;
  MetaForTab(tabID: string): Promise<Meta>;
  AutoResearchCurrent(): Promise<AutoResearchStatusView>;
  AutoResearchStatus(tabID: string): Promise<AutoResearchStatusView>;
  AutoResearchList(tabID: string): Promise<AutoResearchStatusView[]>;
  AutoResearchFindings(tabID: string, limit: number): Promise<AutoResearchFindingView[]>;
  AutoResearchOpenTask(tabID: string): Promise<void>;
  AutoResearchRecordEvidence(tabID: string, criterionID: string, input: AutoResearchEvidenceView): Promise<void>;
  Commands(): Promise<CommandInfo[]>;
  Capabilities(): Promise<CapabilitiesView>;
  MCPServers(): Promise<ServerView[]>;
  SkillsSettings(): Promise<SkillsSettingsView>;
  Plugins(): Promise<PluginView[]>;
  PlanPluginInstall(source: string, options: PluginInstallOptions): Promise<string>;
  InstallPlugin(source: string, options: PluginInstallOptions): Promise<string>;
  RemovePlugin(name: string): Promise<void>;
  SetPluginEnabled(name: string, enabled: boolean): Promise<void>;
  UpdatePlugin(name: string): Promise<string>;
  PluginDoctor(name: string): Promise<PluginView>;
  AddMCPServer(input: MCPServerInput): Promise<number>;
  UpdateMCPServer(name: string, input: MCPServerInput): Promise<void>;
  RemoveMCPServer(name: string): Promise<void>;
  ReconnectMCPServer(name: string): Promise<void>;
  ClearMCPServerAuthentication(name: string): Promise<void>;
  TrustMCPServerTool(name: string, toolName: string): Promise<void>;
  TrustMCPServerTools(name: string, toolNames: string[]): Promise<void>;
  UntrustMCPServerTool(name: string, toolName: string): Promise<void>;
  PickSkillFolder(): Promise<string>;
  PickPluginFolder(): Promise<string>;
  AddSkillPath(path: string): Promise<void>;
  RemoveSkillPath(path: string): Promise<void>;
  RefreshSkills(): Promise<void>;
  ReloadCommands(): Promise<void>;
  SetSkillEnabled(name: string, enabled: boolean): Promise<void>;
  SetMCPServerEnabled(name: string, enabled: boolean): Promise<void>;
  SetMCPServerTier(name: string, tier: string): Promise<void>;
  SlashArgs(input: string): Promise<SlashArgsResult>;
  ListDir(rel: string): Promise<DirEntry[]>;
  SearchFileRefs(query: string): Promise<DirEntry[]>;
  ReadFile(rel: string): Promise<FilePreview>;
  WorkspaceChanges(tabID: string): Promise<WorkspaceChangesView>;
  GitBranches(): Promise<string[]>;
  GitCheckout(branch: string): Promise<void>;
  WorkspaceGitHistory(tabID: string, path: string): Promise<GitCommitView[]>;
  WorkspaceGitCommitDetail(tabID: string, hash: string, path: string): Promise<GitCommitDetailView>;
  OpenWorkspacePath(rel: string): Promise<void>;
  RevealWorkspacePath(rel: string): Promise<void>;
  RevealPath(path: string): Promise<void>;
  SavePastedImage(dataUrl: string): Promise<string>;
  SaveClipboardImage(): Promise<string>;
  SavePastedFile(name: string, dataUrl: string): Promise<string>;
  PickExportFile(defaultFilename: string, mimeType: string): Promise<string>;
  SaveExportFile(path: string, payload: string, base64Encoded: boolean): Promise<void>;
  AttachDropped(path: string): Promise<DroppedItem>;
  AttachmentDataURL(path: string): Promise<string>;
  Models(): Promise<ModelInfo[]>;
  SetModel(name: string): Promise<void>;
  ModelsForTab(tabID: string): Promise<ModelInfo[]>;
  SetModelForTab(tabID: string, name: string): Promise<void>;
  Effort(): Promise<EffortInfo>;
  SetEffort(level: string): Promise<void>;
  EffortForTab(tabID: string): Promise<EffortInfo>;
  SetEffortForTab(tabID: string, level: string): Promise<void>;
  SetTokenMode(mode: string): Promise<void>;
  SetTokenModeForTab(tabID: string, mode: string): Promise<void>;
  Memory(): Promise<MemoryView>;
  MemorySuggestions(): Promise<MemorySuggestionsView>;
  AcceptMemorySuggestion(suggestion: MemorySuggestion): Promise<string>;
  AcceptSkillSuggestion(suggestion: SkillSuggestion): Promise<string>;
  MemoryForTab(tabID: string): Promise<MemoryView>;
  MemorySuggestionsForTab(tabID: string): Promise<MemorySuggestionsView>;
  AcceptMemorySuggestionForTab(tabID: string, suggestion: MemorySuggestion): Promise<string>;
  AcceptSkillSuggestionForTab(tabID: string, suggestion: SkillSuggestion): Promise<string>;
  Remember(scope: string, note: string): Promise<string>;
  RememberForTab(tabID: string, scope: string, note: string): Promise<string>;
  Forget(name: string): Promise<void>;
  ForgetForTab(tabID: string, name: string): Promise<void>;
  SaveDoc(path: string, body: string): Promise<string>;
  SaveDocForTab(tabID: string, path: string, body: string): Promise<string>;
  DesktopStartupSettings(): Promise<DesktopStartupSettingsView>;
  Settings(): Promise<SettingsView>;
  HooksSettings(scope: string): Promise<HooksSettingsView>;
  SaveHooksSettings(scope: string, hooks: HookConfigView[]): Promise<void>;
  SaveHooksSettingsForRoot(scope: string, projectRoot: string, hooks: HookConfigView[]): Promise<void>;
  TrustProjectHooks(): Promise<void>;
  TrustProjectHooksForRoot(projectRoot: string): Promise<void>;
  SetDefaultModel(ref: string): Promise<void>;
  SetPlannerModel(ref: string): Promise<void>;
  SetSubagentModel(ref: string): Promise<void>;
  SetGuardianModel(ref: string): Promise<void>;
  SetSubagentEffort(level: string): Promise<void>;
  SetMaxSubagentDepth(depth: number): Promise<void>;
  SetAutoPlan(mode: string): Promise<void>;
  SetDefaultToolApprovalMode(mode: string): Promise<void>;
  SaveProvider(p: ProviderView): Promise<void>;
  SaveProviderWithKey(p: ProviderView, key: string): Promise<string>;
  AddOfficialProviderAccess(kind: string, key: string): Promise<string>;
  AddProviderPresetAccess(id: string, key: string): Promise<string>;
  ResetProviderPresetAccess(id: string): Promise<void>;
  FetchProviderModels(p: ProviderView): Promise<string[]>;
  DeleteProvider(name: string): Promise<void>;
  RemoveProviderAccess(name: string): Promise<void>;
  SaveProviderKey(apiKeyEnv: string, value: string): Promise<string>;
  SetProviderKey(apiKeyEnv: string, value: string): Promise<string>;
  ClearProviderKey(apiKeyEnv: string): Promise<void>;
  SetPermissionMode(mode: string): Promise<void>;
  AddPermissionRule(list: string, rule: string): Promise<void>;
  RemovePermissionRule(list: string, rule: string): Promise<void>;
  ReloadSettings(): Promise<void>;
  SetSandbox(bash: string, network: boolean, workspaceRoot: string, allowWrite: string[], shell: string): Promise<void>;
  SetNetwork(n: NetworkView): Promise<void>;
  SetBotSettings(b: BotSettingsView): Promise<void>;
  SetBotConnectionToolApprovalMode(connID: string, mode: string): Promise<void>;
  SetBotSecret(envName: string, value: string): Promise<void>;
  ClearBotSecret(envName: string): Promise<void>;
  StartBotConnectionInstall(provider: string, domain: string): Promise<BotInstallStartResult>;
  PollBotConnectionInstall(installID: string): Promise<BotInstallPollResult>;
  BotRuntimeStatus(): Promise<BotRuntimeStatusView>;
  DiagnoseBotConnection(id: string): Promise<BotConnectionDiagnostic>;
  TestBotConnection(id: string, target?: string): Promise<BotConnectionDiagnostic>;
  SetCloseBehavior(mode: string): Promise<void>;
  SetDisplayMode(mode: string): Promise<void>;
  SetStatusBarStyle(style: string): Promise<void>;
  SetStatusBarItems(items: string[]): Promise<void>;
  SetDesktopLanguage(lang: string): Promise<void>;
  SetDesktopAppearance(theme: string, style: string): Promise<void>;
  SetDesktopLayoutStyle(style: string): Promise<void>;
  SetMemoryCompilerEnabled(enabled: boolean): Promise<void>;
  MigrateDesktopPreferences(language: string, theme: string, style: string): Promise<void>;
  SetAgentParams(temperature: number, maxSteps: number, plannerMaxSteps: number, systemPrompt: string): Promise<void>;
  SetColdResumePrune(enabled: boolean): Promise<void>;
  SetReasoningLanguage(lang: string): Promise<void>;
  SetTrayLocale(locale: "en" | "zh" | "zh-TW"): Promise<void>;
  // SetBypass is the legacy Wails name for YOLO/full-access tool auto-approval
  // (ask questions and plan approvals still wait; deny rules still apply).
  // Runtime-only.
  SetBypass(on: boolean): Promise<void>;
  Version(): Promise<string>;
  NeedsOnboarding(): Promise<boolean>;
  ConnectKey(apiKey: string): Promise<string>;
  // Crash overlay "Send report" (desktop/crash_app.go): scrubs user paths, attaches
  // version/os/arch, POSTs to the collection endpoint. Only ever sent on user click.
  ReportCrash(kind: string, detail: string): Promise<void>;
  ListTabs(): Promise<TabMeta[]>;
  OpenProjectTab(workspaceRoot: string, topicID: string): Promise<TabMeta>;
  OpenGlobalTab(topicID: string): Promise<TabMeta>;
  OpenTopicSession(scope: string, workspaceRoot: string, topicID: string, sessionPath: string): Promise<TabMeta>;
  EnsureBlankTab(scope: string, workspaceRoot: string): Promise<TabMeta>;
  ActivateTopic(scope: string, workspaceRoot: string, topicID: string, sessionPath: string): Promise<TabMeta>;
  EnsureBlankSurface(scope: string, workspaceRoot: string): Promise<TabMeta>;
  SetActiveTab(tabID: string): Promise<void>;
  ReorderTabs(tabIDs: string[]): Promise<void>;
  CloseTab(tabID: string): Promise<void>;
  ListProjectTree(): Promise<ProjectNode[]>;
  RenameProject(workspaceRoot: string, title: string): Promise<void>;
  SetProjectColor(workspaceRoot: string, color: string): Promise<void>;
  SetProjectPinned(workspaceRoot: string, pinned: boolean): Promise<void>;
  ReorderProjects(workspaceRoots: string[]): Promise<void>;
  CreateTopic(scope: string, workspaceRoot: string, title: string): Promise<TopicMeta>;
  RenameTopic(topicID: string, title: string): Promise<void>;
  DeleteTopic(topicID: string): Promise<void>;
  TrashTopic(topicID: string): Promise<void>;
  SetTopicPinned(topicID: string, pinned: boolean): Promise<void>;
  ContextPanel(tabID: string): Promise<ContextPanelInfo>;
  // New native-feel bindings (added with the desktop native-feel plan).
  ConfirmAction(req: NativeConfirmRequest): Promise<boolean>;
}

declare global {
  interface Window {
    runtime?: Record<string, any>;
    go?: Record<string, any>;
  }
}

// Must match desktop/app.go's eventChannel constant.
const EVENT_CHANNEL = "agent:event";
// isHttpMode is true when the frontend is served by reasonix-web instead of the
// Wails shell. In this mode all App calls go through /api/call/{method} and events
// come from /api/events.
export function isHttpMode(): boolean {
  return true;
}

async function httpCall(method: string, args: unknown[]): Promise<unknown> {
  try {
    const url = `/api/call/${method}`;
    console.log("[bridge] RPC call", method, args);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok) {
      console.error("[bridge] RPC error", method, "status", res.status, data.error || `HTTP ${res.status}`);
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    console.log("[bridge] RPC ok", method);
    return data.result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bridge] RPC failed", method, "message:", msg);
    throw err;
  }
}

function httpApp(): AppBindings {
  return new Proxy({} as AppBindings, {
    get(_t, prop) {
      return (...args: unknown[]) => httpCall(String(prop), args);
    },
  }) as AppBindings;
}

// Shared EventSource: all event subscriptions use ONE connection instead of
// creating one EventSource per subscriber. Browsers limit HTTP/1.1 to 6
// concurrent connections per domain; each long-lived EventSource occupies a
// slot, starving fetch() requests for API calls.
// (see https://chromium.googlesource.com/chromium/src/+/main/net/socket/client_socket_pool_manager.cc#36)
type sseSubscriber = { name: string; cb: (...data: unknown[]) => void };
let sharedES: EventSource | null = null;
let sharedESRefCount = 0;
const sseSubs: sseSubscriber[] = [];
let sseInitialized = false;

function initSharedSSE(): void {
  if (sseInitialized) return;
  sseInitialized = true;
  sharedES = new EventSource("/api/events");
  sharedES.onopen = () => console.log("[bridge] SSE open (shared)");
  sharedES.onerror = (err) => console.error("[bridge] SSE error (shared)", err);
  sharedES.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as { name: string; data: unknown };
      for (let i = sseSubs.length - 1; i >= 0; i--) {
        if (sseSubs[i].name === msg.name) {
          const payload = Array.isArray(msg.data) ? msg.data : [msg.data];
          try { sseSubs[i].cb(...payload); } catch { /* subscriber error */ }
        }
      }
    } catch { /* malformed SSE payload */ }
  };
}

function subscribeSSE(name: string, cb: (...data: unknown[]) => void): () => void {
  initSharedSSE();
  const entry: sseSubscriber = { name, cb };
  sseSubs.push(entry);
  sharedESRefCount++;
  return () => {
    const idx = sseSubs.indexOf(entry);
    if (idx >= 0) sseSubs.splice(idx, 1);
    sharedESRefCount--;
    if (sharedESRefCount <= 0 && sharedES) {
      sharedES.close();
      sharedES = null;
      sseInitialized = false;
    }
  };
}

function realApp(): AppBindings {
  return httpApp();
}

// onEvent subscribes to the agent's typed event stream; returns an unsubscribe.
export function onEvent(cb: (e: WireEvent) => void): () => void {
  return subscribeSSE(EVENT_CHANNEL, (payload) => cb(payload as WireEvent));
}

// onFilesDropped subscribes to native OS file drops. In HTTP mode, file drops
// are handled via HTML drag-and-drop, not the Wails runtime.
export function onFilesDropped(_cb: (paths: string[]) => void): () => void {
  return () => {};
}

// onReady subscribes to the agent:ready event fired when boot.Build completes.
export function onReady(cb: (tabId?: string) => void): () => void {
  return subscribeSSE("agent:ready", (tabId?: unknown) => cb(typeof tabId === "string" ? tabId : undefined));
}

export function onProjectTreeChanged(cb: () => void): () => void {
  return subscribeSSE("project-tree:changed", () => cb());
}

export function onSessionRecovered(cb: (payload: SessionRecoveryEvent) => void): () => void {
  return subscribeSSE("session:recovered", (payload?: unknown) => cb((payload ?? {}) as SessionRecoveryEvent));
}

export function onSessionRecoveryFailed(cb: (payload: SessionRecoveryFailedEvent) => void): () => void {
  return subscribeSSE("session:recovery-failed", (payload?: unknown) => cb((payload ?? {}) as SessionRecoveryFailedEvent));
}

export function onSettingsChanged(cb: () => void): () => void {
  return subscribeSSE("settings:changed", () => cb());
}

// app proxies each call to the live binding (or the dev mock only when truly
// outside the shell), so a late-injected window.go is picked up transparently.
function bridgeBreadcrumb(method: string): string {
  if (method === "ReportCrash") return "";
  if (/^(Submit|SubmitDisplay|RunShell|Steer|Cancel|Approve|AnswerQuestion|ReplayPendingPrompts)/.test(method))
    return `turn ${method}`;
  if (/^(SetModel|SetEffort|SetTokenMode|SetDefaultModel|SetPlannerModel|SetSubagentModel|SetGuardianModel|SetSubagentEffort|SetMaxSubagentDepth)/.test(method))
    return `model ${method}`;
  if (/^(SetCloseBehavior|SetDisplayMode|SetStatusBar|SetAutoPlan|SetDefaultToolApprovalMode|SetMemoryCompilerEnabled|SetReasoningLanguage)/.test(method))
    return `settings ${method}`;
  if (/^(SaveProvider|AddOfficialProviderAccess|AddProviderPresetAccess|ResetProviderPresetAccess|RemoveProviderAccess|DeleteProvider|SaveProviderKey|SetProviderKey|ClearProviderKey|FetchProviderModels|ConnectKey)/.test(method))
    return `provider ${method}`;
  if (/^(AddMCPServer|UpdateMCPServer|RemoveMCPServer|ReconnectMCPServer|ClearMCPServerAuthentication|TrustMCPServerTool|TrustMCPServerTools|UntrustMCPServerTool|SetMCPServer)/.test(method))
    return `mcp ${method}`;
  if (/^(AddSkillPath|RemoveSkillPath|RefreshSkills|SetSkillEnabled|AcceptSkillSuggestion)/.test(method))
    return `skill ${method}`;
  if (/^(OpenProjectTab|OpenGlobalTab|OpenTopicSession|EnsureBlankTab|ActivateTopic|EnsureBlankSurface|SetActiveTab|CloseTab|ReorderTabs|CreateTopic|RenameTopic|DeleteTopic|TrashTopic|RenameProject|RemoveWorkspace|SwitchWorkspace|PickWorkspace)/.test(method))
    return `nav ${method}`;
  return "";
}

export const app: AppBindings = new Proxy({} as AppBindings, {
  get(_t, prop) {
    const target = realApp();
    const v = (target as unknown as Record<string, unknown>)[String(prop)];
    if (typeof v !== "function") return v;
    return (...args: unknown[]) => {
      const method = String(prop);
      const crumb = bridgeBreadcrumb(method);
      if (crumb) addBreadcrumb("bridge", crumb);
      try {
        const result = (v as (...a: unknown[]) => unknown).apply(target, args);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          return (result as Promise<unknown>).catch((err) => {
            if (crumb) addBreadcrumb("bridge.error", method);
            throw err;
          });
        }
        return result;
      } catch (err) {
        if (crumb) addBreadcrumb("bridge.error", method);
        throw err;
      }
    };
  },
});

// Expose the bridge for browser-console diagnostics.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__reasonixApp = app;
}

// openExternal opens a URL in the system browser.
export function openExternal(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
  }
}



