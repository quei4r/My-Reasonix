import * as vscode from "vscode";
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as http from "http";

const DEFAULT_PORT = 18765;
const BINARY_NAME = "my-reasonix";

let backendProcess: ChildProcess | null = null;

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

	// Use the VSCode workspace folder (or active file's project root) as the
	// backend's working directory so that file operations resolve to the project
	// the user opened, not the extension host's default (e.g. ~ in WSL Remote).
	const workspaceRoot = resolveProjectRoot();

	// In dev mode, kill any stale backend on our port so the newly-built binary
	// starts fresh (otherwise the old backend still serves the old frontend).
	if (context.extensionMode === vscode.ExtensionMode.Development) {
		try {
			const _require: any = require;
			_require("child_process").execSync(`fuser -k ${port}/tcp 2>/dev/null`);
		} catch { /* fuser unavailable or nothing to kill */ }
	}

	// Start the Go backend
	backendProcess = spawn(binaryPath, [], {
		cwd: workspaceRoot,
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

	// Wait for backend to start, then register the webview provider
	// Helper: tell the backend which folder VSCode has open.
	function setWorkspaceRoot(p: number, path: string | undefined) {
		if (!path) return;
		fetch(`http://127.0.0.1:${p}/api/call/SetVSCodeWorkspaceRoot`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify([path]),
		}).then(() => console.log("[my-reasonix] workspace root set to", path))
		.catch((e) => console.error("[my-reasonix] failed to set workspace root", e));
	}

	waitForHealth(port)
		.then(async () => {
			// After backend starts, set workspace root to match VSCode current folder or active file.
			setWorkspaceRoot(port, resolveProjectRoot());

			// Also re-apply when workspace folders change (open/close a folder).
			context.subscriptions.push(
				vscode.workspace.onDidChangeWorkspaceFolders(() => {
						const f = vscode.workspace.workspaceFolders;
						setWorkspaceRoot(port, f && f.length > 0 ? f[0].uri.fsPath : resolveProjectRoot());
				}),
			);

			console.log("[my-reasonix] ready");
		});

	// Register the sidebar webview provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("reasonix.sidebarPanel", {
			resolveWebviewView(webviewView) {
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
	<iframe src="http://127.0.0.1:${port}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
</body>
</html>`;
			},
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
