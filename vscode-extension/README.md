# My Reasonix — VSCode Extension

[Reasonix](https://github.com/esengine/DeepSeek-Reasonix) 的 VSCode 端适配。将 Reasonix 的内核能力带入编辑器侧边栏，支持多 tab 会话、项目级 workspace 管理和 Agent 交互。

A VSCode extension that brings the [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) kernel into your editor sidebar — multi-tab agent sessions, project-scoped workspaces, and inline interactions.

## 独有功能 / VSCode-specific Features

- **侧边栏集成** — Reasonix 作为 VSCode 的 Activity Bar 面板运行，与编辑器并列，不占独立窗口
  (Embedded in the VSCode sidebar as an Activity Bar view, side-by-side with your editor.)

- **编辑器设置页** — 点击「Settings」齿轮图标，设置面板以 VSCode Editor Tab 形式打开（带齿轮图标），可拖拽分栏
  (Click the gear icon to open settings as a VSCode Editor Tab with a gear icon — draggable, pinnable, split-view capable.)

- **项目工作区感知** — 自动跟随 VSCode 当前打开的项目文件夹，切换文件夹时 session/tab 自动对应
  (Automatically tracks the VSCode workspace folder. Switch projects — your session tabs follow.)

- **生命周期管理** — Reasonix 后端作为 VSCode 子进程运行，关闭编辑器时自动清理，无需手动启停
  (The Reasonix backend runs as a managed child process. Close VSCode — it cleans up. No manual start/stop.)

- **非静默错误** — 所有兜底的 `.catch(() => {})` 已替换为带完整调用栈的错误日志，不再吞异常
  (All silent `.catch(() => {})` are replaced with full-stacktrace error logging — no exceptions swallowed.)

## 架构 / Architecture

```
VSCode Extension Host          Frontend (iframe)           Go Backend
  (VSCode API)                    (orchestrator)             (Reasonix kernel)
       │                              │                          │
       │◄───postMessage(双向)────────►  │                          │
       │                              │────HTTP/SSE──────────────►│
       │                              │◄───HTTP/SSE───────────────│
       │                              │                          │
  spawn/kill backend         编排：谁的数据找谁          纯业务逻辑
  提供 VSCode 信息            无需关心信息来源            无 VSCode 概念
```

- **extension.ts** — 启停 Go 后端进程，通过 postMessage 将 workspace root、VSCode 事件推送给前端
- **Frontend（iframe）** — 从 Extension 拿 VSCode 信息，从 Go 后端拿 Reasonix 数据，前端编排
- **Go Backend** — 无 VSCode 专用代码，纯 Reasonix 内核，通过 HTTP/SSE 与前端通信

## 开发 / Development

```sh
# 先构建前端
cd frontend
pnpm install
pnpm build

# 再构建 Go 后端
cd ..
CGO_ENABLED=0 go build -o my-reasonix .

# 在 VSCode 中按 F5 启动 Extension Host 调试
```

一键构建（自动执行上述三个步骤）：
```sh
# 在 VSCode 中 Run Task → build:all，或
# 在项目根目录按 Cmd+Shift+B
```

F5 启动后，VSCode 会打开一个新的 Extension Development Host 窗口，Reasonix 侧边栏图标出现在左侧 Activity Bar 中。

## 配置 / Configuration

- `MY_REASONIX_ADDR` — 后端监听地址（默认 `127.0.0.1:18765`）
- 使用标准的 `reasonix.toml` / `~/.reasonix/config.toml` 配置

## 原项目 / Original Project

[DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix) — 一个基于 Claude AI 的多会话推理与编码助手，支持 Desktop（Wails）、CLI、HTTP 三种运行模式。

Reasonix is a multi-session reasoning & coding assistant built on Claude AI, available as a Desktop app (Wails), CLI, and HTTP server.
