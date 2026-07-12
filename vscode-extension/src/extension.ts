import * as vscode from "vscode";
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as http from "http";

const DEFAULT_PORT = 18765;
const BINARY_NAME = "my-reasonix";

let backendProcess: ChildProcess | null = null;
// Sidebar webview reference, set when the webview is resolved.
// Used to push workspace root changes from onDidChangeWorkspaceFolders.
let sidebarWebview: vscode.Webview | null = null;

function resolveProjectRoot(): string | undefined {
	const wsFolders = vscode.workspace.workspaceFolders;
	if (wsFolders && wsFolders.length > 0) return wsFolders[0].uri.fsPath;
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.isUntitled) return undefined;
	const filePath = editor.document.uri.fsPath;
	if (!filePath) return undefined;
	const __require: any = require;
	const p = __require("path");
	const f = __require("fs");
	let dir = p.dirname(filePath);
	for (let i = 0; i < 8; i++) {
		if (f.existsSync(p.join(dir, ".git"))) return dir;
		const parent = p.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return p.dirname(filePath);
}

function findBinary(extensionPath: string, isDev: boolean): string {
	const fs = require("fs") as { existsSync(p: string): boolean };
	// In dev/debug mode, prefer the binary built by F5 in the workspace source
	// directory over the installed extension dir, so rebuilds don't need a
	// separate deploy step and never hit "text file busy".
	// Try multiple paths since the workspace root may be the repo root,
	// the vscode-extension subdirectory, or something else entirely.
	if (isDev) {
		const wsFolders = vscode.workspace.workspaceFolders;
		if (wsFolders && wsFolders.length > 0) {
			const wsRoot = wsFolders[0].uri.fsPath;
			const devCandidates = [
				path.join(wsRoot, BINARY_NAME),                          // ws = vscode-extension/
				path.join(wsRoot, "vscode-extension", BINARY_NAME),      // ws = repo root
			];
			for (const c of devCandidates) {
				try { if (fs.existsSync(c)) return c; } catch { /* try next */ }
			}
		}
	}
	const candidates = [
		path.join(extensionPath, BINARY_NAME),
		path.join(extensionPath, BINARY_NAME + ".exe"),
	];
	for (const c of candidates) {
		try {
			if (fs.existsSync(c)) return c;
		} catch {
			// continue
		}
	}
	return candidates[0];
}

function waitForHealth(port: number, timeoutMs = 15000): Promise<void> {
	const start = Date.now();
	return new Promise((resolve, reject) => {
		function poll() {
			const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
				if (res.statusCode === 200) return resolve();
				retry();
			});
			req.on("error", () => retry());
			req.setTimeout(2000, () => {
				req.destroy();
				retry();
			});
			function retry() {
				if (Date.now() - start > timeoutMs) {
					return reject(new Error(`Backend not ready after ${timeoutMs}ms`));
				}
				setTimeout(poll, 300);
			}
		}
		poll();
	});
}

export function activate(context: vscode.ExtensionContext) {
	const port = DEFAULT_PORT;
	const binaryPath = findBinary(context.extensionPath, context.extensionMode === vscode.ExtensionMode.Development);

	// In dev mode, kill any stale backend on our port so the newly-built binary
	// starts fresh (otherwise the old backend still serves the old frontend).
	if (context.extensionMode === vscode.ExtensionMode.Development) {
		try {
			const _require: any = require;
			_require("child_process").execSync(`fuser -k ${port}/tcp 2>/dev/null`);
		} catch { /* fuser unavailable or nothing to kill */ }
	}

	// Start the Go backend with the workspace folder as cwd so that file
	// operations resolve to the project the user opened.
	const wsRoot = resolveProjectRoot();
	backendProcess = spawn(binaryPath, [], {
		cwd: wsRoot,
		env: {
			...process.env,
			MY_REASONIX_ADDR: `127.0.0.1:${port}`,
			REASONIX_MODE: "vscode",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	backendProcess.stdout?.on("data", (d: Buffer) => {
		console.log("[reasonix-web]", d.toString().trimEnd());
	});
	backendProcess.stderr?.on("data", (d: Buffer) => {
		console.error("[my-reasonix:err]", d.toString().trimEnd());
	});
	backendProcess.on("exit", (code) => {
		console.log(`[my-reasonix] exited with code ${code}`);
		backendProcess = null;
	});

	// Wait for the backend HTTP server to be healthy, then signal ready.
	waitForHealth(port).then(() => {
		console.log("[my-reasonix] ready");
	});

	// Helper: open a webview panel in the editor area for settings.
	let settingsPanel: vscode.WebviewPanel | undefined;
	function openSettingsPanel() {
		if (settingsPanel) {
			settingsPanel.reveal();
			return;
		}
		settingsPanel = vscode.window.createWebviewPanel(
			"reasonix.settings",
			"My Reasonix Settings",
			vscode.ViewColumn.One,
			{ enableScripts: true, retainContextWhenHidden: true },
		);
		settingsPanel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		html, body { width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; }
		iframe { width: 100%; height: 100%; border: none; }
	</style>
</head>
<body>
	<iframe src="http://127.0.0.1:${port}/?panel=settings" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
</body>
</html>`;
		settingsPanel.onDidDispose(() => { settingsPanel = undefined; });
	}

	// Register the sidebar webview provider + message bridge
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("reasonix.sidebarPanel", {
			resolveWebviewView(webviewView) {
				sidebarWebview = webviewView.webview;
				webviewView.onDidDispose(() => { sidebarWebview = null; });
				webviewView.webview.options = {
					enableScripts: true,
				};
				webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		html, body { width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; }
		iframe { width: 100%; height: 100%; border: none; }
	</style>
</head>
<body>
	<iframe id="app" src="http://127.0.0.1:${port}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
	<script>
		const iframe = document.getElementById("app");
		const vscode = acquireVsCodeApi();

			// VSCode → iframe: forward messages not from the iframe
			window.addEventListener("message", (e) => {
				if (e.source !== iframe.contentWindow) {
					iframe.contentWindow.postMessage({ source: "vscode-extension", ...e.data }, "*");
				}
			});

			// iframe → VSCode: forward messages from the iframe
			window.addEventListener("message", (e) => {
				if (e.source === iframe.contentWindow) {
					vscode.postMessage(e.data);
				}
			});
	</script>
</body>
</html>`;
				webviewView.webview.onDidReceiveMessage((msg) => {
					if (msg.command === "openSettings") {
						openSettingsPanel();
					} else if (msg.command === "getWorkspaceRoot") {
						const root = resolveProjectRoot();
						console.log("[my-reasonix] getWorkspaceRoot responding with:", root);
						webviewView.webview.postMessage({
							type: "workspace-root",
							path: root,
						});
					}
				});
			},
		}),
	);

	// Push workspace folder changes to the frontend.
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			if (!sidebarWebview) return;
			const root = resolveProjectRoot();
			sidebarWebview.postMessage({
				type: "workspace-root",
				path: root,
			});
		}),
	);
}

export function deactivate() {
	if (backendProcess) {
		backendProcess.kill("SIGTERM");
		// Give it a moment, then force kill
		setTimeout(() => {
			if (backendProcess) {
				try { backendProcess.kill("SIGKILL"); } catch { /* already dead */ }
			}
		}, 3000);
		backendProcess = null;
	}
}
