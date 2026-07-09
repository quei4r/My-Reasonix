// Minimal type declarations for Node.js APIs used by the VSCode extension.
// Roughly matches @types/node without needing network access to install it.
declare module "child_process" {
	import { EventEmitter } from "events";
	interface ChildProcess extends EventEmitter {
		stdout?: { on(event: "data", cb: (chunk: Buffer) => void): void };
		stderr?: { on(event: "data", cb: (chunk: Buffer) => void): void };
		kill(signal?: string): void;
		on(event: "exit", cb: (code: number | null) => void): this;
	}
	interface SpawnOptions {
		cwd?: string | URL;
		env?: Record<string, string | undefined>;
		stdio?: Array<"ignore" | "pipe" | "inherit">;
	}
	export function spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess;
}
declare module "path" {
	export function join(...paths: string[]): string;
}
declare module "http" {
	import { EventEmitter } from "events";
	interface IncomingMessage extends EventEmitter {
		statusCode?: number;
	}
	interface RequestOptions {
		hostname?: string;
		port?: number;
		path?: string;
		method?: string;
		timeout?: number;
	}
	interface ClientRequest extends EventEmitter {
		setTimeout(timeout: number, cb?: () => void): this;
		destroy(): void;
		abort(): void;
	}
	export function get(url: string, cb: (res: IncomingMessage) => void): ClientRequest;
	export function get(options: RequestOptions, cb: (res: IncomingMessage) => void): ClientRequest;
}
declare module "fs" {
	export function existsSync(path: string): boolean;
}
declare module "events" {
	class EventEmitter {
		on(event: string, cb: (...args: unknown[]) => void): this;
	}
	export { EventEmitter };
}
declare var process: { env: Record<string, string | undefined>; exit(code?: number): void };
interface Buffer {
	toString(encoding?: string): string;
}
declare var Buffer: {
	new(size: number): Buffer;
	from(data: string): Buffer;
};
declare function require(module: "fs"): { existsSync(path: string): boolean };
declare function setTimeout(cb: (...args: unknown[]) => void, ms: number, ...args: unknown[]): unknown;
