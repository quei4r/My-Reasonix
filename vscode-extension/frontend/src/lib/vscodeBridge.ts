// vscodeBridge is the frontend-side communication layer with the VSCode
// extension host. It wraps postMessage between the iframe and the webview
// bridge script in extension.ts, and is only used in VSCode extension mode.
// In a plain browser (pnpm dev), calling these methods is a no-op.

type VSCodeMessageHandler = (msg: any) => void;
const handlers = new Map<string, VSCodeMessageHandler[]>();
let bridgeStarted = false;

function isVSCode(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

function onMessage(type: string, fn: VSCodeMessageHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, []);
  const arr = handlers.get(type)!;
  arr.push(fn);
  return () => {
    const idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

/** Initialize the postMessage listener. Call once on app mount. */
export function startVSCodeBridge(): void {
  if (bridgeStarted || !isVSCode()) return;
  bridgeStarted = true;
  window.addEventListener("message", (e) => {
    if (e.data?.source === "vscode-extension") {
      const fns = handlers.get(e.data.type) || [];
      for (const fn of fns) fn(e.data);
    }
  });
}

/**
 * Request the current workspace root from the VSCode extension host.
 * Resolves to the path string, or undefined if no workspace folder is open.
 * Has a 5-second timeout fallback.
 */
export function requestWorkspaceRoot(): Promise<string | undefined> {
  if (!isVSCode()) return Promise.resolve(undefined);
  return new Promise<string | undefined>((resolve) => {
    const cancel = onMessage("workspace-root", (msg) => {
      resolve(msg.path || undefined);
      cancel();
    });
    window.parent.postMessage({ command: "getWorkspaceRoot" }, "*");
    setTimeout(() => {
      cancel();
      console.warn("[vscode-bridge] requestWorkspaceRoot timed out after 5s, resolving undefined");
      resolve(undefined);
    }, 5000);
  });
}

/**
 * Subscribe to workspace root changes pushed from the extension host
 * (fired when the user opens/closes a workspace folder).
 * Returns an unsubscribe function.
 */
export function onWorkspaceRootChanged(cb: (path: string | undefined) => void): () => void {
  if (!isVSCode()) return () => {};
  return onMessage("workspace-root", (msg) => cb(msg.path || undefined));
}

/**
 * Send a command to the VSCode extension host.
 * Currently used for "openSettings".
 */
export function sendToExtension(command: string, payload?: Record<string, unknown>): void {
  if (!isVSCode()) return;
  window.parent.postMessage({ command, ...payload }, "*");
}
