# Yes Chief

`Yes Chief` 是一个基于 `LiveKit` 和 `LiveKit Agents` 的实时语音烹饪导师 Web 应用。

它的核心不是“菜谱管理系统”，而是“做菜过程中始终在线、可被打断、能继续引导你的语音教练”。

## 核心想法

用户进入一个烹饪会话后，主要通过语音与 agent 交互：

- agent 主动讲解当前步骤
- 用户可以随时打断提问
- 用户和agent可以用语音推进步骤、创建计时器、暂停或结束会话
- 页面只负责展示当前步骤、计时器和总结，不依赖按钮驱动流程

首版 MVP 只支持 `preset recipes only`：

- 不做账号系统
- 不做 recipe upload
- 不做自动解析菜谱
- 不做复杂后台

这让实现重点集中在“实时语音 tutoring 体验”而不是内容生产链路。

## 架构原则

项目采用三应用架构：

```text
apps/
  webui/
  api/
  agent/
packages/
  shared/
```

职责边界非常明确：

- `webui`：语音入口和辅助展示层
- `api`：业务真相源
- `agent`：实时语音执行层

核心数据流：

```text
User mic -> WebUI -> LiveKit Room -> Agent
Agent speech -> LiveKit Room -> WebUI speaker

WebUI -> API -> SQLite
Agent -> API -> SQLite
```

这套划分的目的很直接：

- 避免把实时语音、业务状态和持久化耦合在一起
- 保证 session、step、timer 的权威状态统一落在 `api`
- 让 `agent` 专注于“现在该对用户说什么”

## MVP 交互模型

一次会话的理想体验如下：

1. 用户打开 Web 页面并授权麦克风。
2. `webui` 创建 session，加入对应的 `LiveKit room`。
3. `agent` 进入房间后读取当前 `SessionSnapshot`，开始语音引导。
4. 用户一边做菜，一边通过语音提问、汇报进度或控制计时器。
5. `agent` 只在需要改变状态时调用 `api`，普通问答直接基于快照回答。
6. 会话结束后，`api` 生成并持久化一份 summary，供页面展示。

这里有两个关键约束：

- 业务状态变化只能通过 `api` 命令完成
- 自然对话本身不应该让 session 状态漂移

## 为什么这样设计

这个项目的重点不是把所有能力都做出来，而是用最小但完整的系统证明以下几点：

- 语音优先的人机协作流程是成立的
- `LiveKit + LiveKit Agents` 适合承载实时烹饪导师场景
- `snapshot + event log` 足够支撑 MVP，而不需要引入更重的 event sourcing
- `polling` 对首版 UI 状态同步已经足够稳定且简单

换句话说，`Yes Chief` 的核心价值是：

`一个以实时语音为中心、以 API 为业务真相源、以 Web 页面为辅助视图的烹饪指导系统。`

## 当前设计范围

技术选型已经明确：

- Monorepo：`bun workspaces`
- WebUI：`React + Vite + Tailwind CSS + ShadcnUI`
- API：`Elysia`
- Database：`SQLite + Drizzle`
- Agent：`TypeScript + @livekit/agents`
- Shared contracts：`packages/shared`
- Tooling：`oxlint + oxfmt`

补充约束：

- 前端不引入 `React Router`
- `zod` 仅用于 agent tool 参数 schema
- 所有环境变量统一放在根 `.env`
- 本地开发入口统一为根目录 `bun run dev`
- Agent 首次运行前先在根目录执行 `bun run agent:download-files`
- 最终部署入口目标是 `docker compose`
