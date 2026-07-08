import * as vscode from "vscode";
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as http from "http";

const DEFAULT_PORT = 18765;
const BINARY_NAME = "reasonix-web";

let backendProcess: ChildProcess | null = null;

function findBinary(extensionPath: string): string {
	const fs = require("fs") as { existsSync(p: string): boolean };
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
	const binaryPath = findBinary(context.extensionPath);

	// Start the Go backend
	backendProcess = spawn(binaryPath, [], {
		env: {
			...process.env,
			REASONIX_WEB_ADDR: `127.0.0.1:${port}`,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	backendProcess.stdout?.on("data", (d: Buffer) => {
		console.log("[reasonix-web]", d.toString().trimEnd());
	});
	backendProcess.stderr?.on("data", (d: Buffer) => {
		console.error("[reasonix-web:err]", d.toString().trimEnd());
	});
	backendProcess.on("exit", (code) => {
		console.log(`[reasonix-web] exited with code ${code}`);
		backendProcess = null;
	});

	// Wait for backend to start, then register the webview provider
	waitForHealth(port)
		.then(() => {
			console.log("[reasonix-web] ready");
		})
		.catch((err) => {
			void vscode.window.showErrorMessage(`Reasonix backend failed: ${err.message}`);
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
