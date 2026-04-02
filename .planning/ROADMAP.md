# Roadmap: Yes Chief

## Overview

这份 roadmap 按研究建议与 v1 需求拆成 5 个自然阶段：先验证 `Bun` 下的 agent 运行时并立住 `api` 真相源，再打通实时语音指导闭环，然后补齐 Web companion lifecycle、恢复与幂等，最后用可观测性和厨房场景 UAT 建立发布门槛。整个顺序保持 `api` 是唯一业务真相源、`LiveKit` 只承载实时媒体与瞬时房间状态、WebUI 只是辅助视图、MVP 仅支持 preset recipes。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Runtime & Session Truth** - 在 `Bun` 下验证最小 agent stack，并建立以 `api` 为真相源的 session 基线。(completed 2026-04-01)
- [x] **Phase 2: Realtime Voice Guidance** - 打通 agent 实时讲解、打断问答、语音命令与 timer 主回路，并完成浏览器 voice gap closure。 (completed 2026-04-01)
- [x] **Phase 3: Web Companion Lifecycle** - 让用户能从浏览器稳定入会，并通过 companion UI 跟随会话。(completed 2026-04-02)
- [x] **Phase 03.1: WebUI Refactor, UX Polish & Voice Activity Visualizer (INSERTED)** - 拆分 WebUI 结构、重组 companion 三态体验，并加入真实 tutor 语音活动可视化。 (completed 2026-04-02)
- [ ] **Phase 4: Recovery & Idempotency** - 处理刷新、断线、重连与重复请求，确保恢复后仍以服务端状态为准。
- [ ] **Phase 5: Observability & Kitchen UAT** - 建立 session 级指标、厨房场景验证与发布门槛。

## Phase Details

### Phase 1: Runtime & Session Truth
**Goal**: 系统在 `Bun` 下稳定跑通最小 `api + agent` 组合，并能为 preset recipe 创建以 `api` 为业务真相源的 cooking session
**Depends on**: Nothing (first phase)
**Requirements**: SESS-01, SYST-01
**Success Criteria** (what must be TRUE):
  1. 用户可以选择一个 preset recipe，并拿到新的 cooking session 与初始 `SessionSnapshot`。
  2. session、step、timer 与 summary 的业务状态只能通过 `api` 写入并从服务端返回最新 snapshot，而不是依赖 LiveKit 房间状态或本地内存。
  3. `apps/api` 与 `apps/agent` 在 `Bun` 中通过最小 create/get session smoke test，不会因 `@livekit/agents` 或 `@livekit/rtc-node` 兼容性直接阻塞后续阶段。
**Plans**: 4 plans

Plans:
- [x] `01-01-PLAN.md` — 建立 `packages/shared` 最小契约、根 `.env.example` 与 API 测试基线
- [x] `01-02-PLAN.md` — 实现 preset recipe 列表与 API-owned session create/get 持久化
- [x] `01-03-PLAN.md` — 为 `apps/agent` 增加根 `.env` 预检与离线 Bun/LiveKit runtime smoke
- [x] `01-04-PLAN.md` — 为 `apps/webui` 增加最小 preset recipe 选择与 create-session 页面

### Phase 2: Realtime Voice Guidance
**Goal**: 用户可以在同一个 cooking session 中通过语音获取实时步骤指导、打断提问，并用语音驱动步骤与计时器
**Depends on**: Phase 1
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, GUID-01, GUID-02, GUID-03, GUID-04, TIME-01, TIME-02, TIME-03, TIME-04
**Success Criteria** (what must be TRUE):
  1. agent 进入会话后可以基于当前步骤给出简短、可执行的实时讲解，而不是泛化闲聊。
  2. 用户可以在 agent 讲话过程中打断，询问当前步骤、食材、火候、替代建议或 timer 相关问题，并得到基于最新 `SessionSnapshot` 的回答或澄清。
  3. 用户可以通过语音推进步骤、重复当前步骤、暂停会话、恢复会话和结束会话，且语音确认与服务端最新 snapshot 一致。
  4. 用户可以通过语音创建、查询和取消计时器；计时器到期时会收到语音提醒。
**Plans**: 6 plans

Plans:
- [x] `02-01-PLAN.md` — 扩展 shared recipe/session/timer 契约，并建立 richer snapshot 测试基线
- [x] `02-02-PLAN.md` — 升级 agent runtime，固定 tutor persona、clarification policy 和 interruption 基线
- [x] `02-03-PLAN.md` — 实现 API command reducer、server-time timers 和对应 routes/tests
- [x] `02-04-PLAN.md` — 接入 agent API client、自然语言工具和 timer expiry reminder 主回路
- [x] `02-05-PLAN.md` — 补齐 browser voice entrypoint：session connect route、room ensure、agent dispatch 与 WebUI join flow
- [x] `02-06-PLAN.md` — 补 companion 状态投影、真实浏览器回归，并修正 Phase 2 验证口径

### Phase 3: Web Companion Lifecycle
**Goal**: 用户可以从浏览器稳定进入会话，并通过 companion UI 看到当前步骤、计时器、连接状态与结束总结
**Depends on**: Phase 2
**Requirements**: SESS-02, SESS-04, COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. 用户可以授权麦克风、显式启动浏览器音频，并加入与当前 session 绑定的 LiveKit 房间。
  2. companion 页面可以展示当前 recipe、当前步骤、session 状态与当前活跃计时器的剩余时间。
  3. 页面可以清楚展示连接状态、麦克风/音频启动状态与 agent 就绪状态，同时保持语音优先而不是按钮驱动主流程。
  4. 会话结束后，用户可以在页面看到本次 session summary，而不会丢失最终服务端状态。
**Plans**: 3/3 plans executed
**UI hint**: yes

Plans:
- [x] `03-01-PLAN.md` — 补齐 completed session summary 契约与 API-owned truth source
- [x] `03-02-PLAN.md` — 把 WebUI 重构成 voice-first companion lifecycle，并接入 ended summary 终态
- [x] `03-03-PLAN.md` — 补 accessibility 语义、浏览器 completed-summary 回归，并回写 Phase 3 validation contract

### Phase 03.1: WebUI Refactor, UX Polish & Voice Activity Visualizer (INSERTED)

**Goal**: 把当前 WebUI companion 拆成可维护的组件和 hooks，重组为 `Discovery / Active / Completed` 三态体验，并加入真实 tutor 语音活动 visualizer
**Requirements**: TBD (inserted polish phase; no new formal REQ IDs)
**Depends on:** Phase 3
**Success Criteria** (what must be TRUE):
  1. `apps/webui/src/App.tsx` 不再直接承载 session polling、LiveKit room 生命周期和远端音频 attach 细节，而是退化成组合层。
  2. companion 页面以 `Discovery / Active / Completed` 三态表达用户旅程，当前步骤在 active state 中具备远距离可读性。
  3. 页面使用真实 tutor 音频活动驱动 voice activity visualizer，并保持 `aria-live` 无障碍播报与浏览器回归门槛不退化。
**Plans**: 3/3 plans executed

Plans:
- [x] `03.1-01-PLAN.md` — 抽离 `useCookingSession` / `useLiveKitRoom`，建立 WebUI runtime hooks 基线
- [x] `03.1-02-PLAN.md` — 增补 shadcn 原语并重构为 `Discovery / Active / Completed` 三态 companion
- [x] `03.1-03-PLAN.md` — 加入真实 voice activity visualizer、toast 表层反馈和浏览器回归收口

### Phase 4: Recovery & Idempotency
**Goal**: 用户在刷新、临时断线或 agent 恢复后，可以继续原有 cooking session，而不会产生重复业务状态
**Depends on**: Phase 3
**Requirements**: SESS-03, SYST-02, SYST-03
**Success Criteria** (what must be TRUE):
  1. 用户在临时断线或刷新后可以重新附着到原有 session，并拿到最新 snapshot，而不是生成新的业务 session。
  2. `create/connect/command/end` 等关键接口在重试场景下不会造成重复 dispatch、重复计时器或重复结束。
  3. 浏览器与 agent 在恢复后都会先以服务端 snapshot 和服务端 timer 时间为准完成 reconcile，再继续指导。
**Plans**: TBD

### Phase 5: Observability & Kitchen UAT
**Goal**: 团队可以用结构化指标和固定厨房场景，判断实时语音烹饪会话是否达到真实可验证的 MVP 水平
**Depends on**: Phase 4
**Requirements**: OPS-01, OPS-02
**Success Criteria** (what must be TRUE):
  1. 团队可以按 session 查看结构化实时链路指标，包括 interruptions、tool latency 以及主要语音处理阶段时延。
  2. 团队可以反复执行固定厨房场景 UAT，覆盖噪声、误打断、断线重连与会话恢复，并得到一致的通过/失败结果。
  3. 发布判断可以基于可追踪的延迟、失败率与恢复表现，而不是只靠主观 demo 体验。
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Runtime & Session Truth | 4/4 | Complete | 2026-04-01 |
| 2. Realtime Voice Guidance | 6/6 | Complete    | 2026-04-01 |
| 3. Web Companion Lifecycle | 3/3 | Complete | 2026-04-02 |
| 3.1. WebUI Refactor, UX Polish & Voice Activity Visualizer | 3/3 | Complete | 2026-04-02 |
| 4. Recovery & Idempotency | 0/TBD | Not started | - |
| 5. Observability & Kitchen UAT | 0/TBD | Not started | - |
