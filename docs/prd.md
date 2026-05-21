# OC Tavern Plugin — PRD

> 版本：v0.2
> 更新日期：2026-05-21
> 来源整合：bridge-api.md / writeback-mapping.md / mvp-scope.md / repository-boundary.md / memory052101.md

---

## 一、产品定位

**一句话：** Tavern 负责演出，OC Workbench 负责记忆。

插件是一个薄适配层，不复制 Workbench 的功能，只做三件事：
1. 从 Tavern 对话中提取候选记忆
2. 让用户审查并确认
3. 把确认的内容写回 Workbench 和 Tavern 两侧

---

## 二、同步方向与优先级

| 方向 | 描述 | 优先级 |
|---|---|---|
| Workbench → Tavern | 开始对话前，从 Workbench 拉取角色状态和近期事件，注入为临时世界书条目 | P0（MVP 后） |
| Tavern → Workbench | 对话结束后，提取关键事件，用户确认后写入 Workbench 时间线 | **MVP** |
| 实时双向（每条消息同步） | 每条消息后自动触发 | 暂缓 |

---

## 三、核心工作流

```
用户在聊天界面叠加选择消息范围
    ↓
插件调用 generateQuietPrompt() 静默提取
    ↓
POST /api/tavern/memory/extract
    ↓
展示候选记忆列表（用户可编辑/删除/调整目标）
    ↓
用户确认
    ↓
POST /api/tavern/memory/commit（写入 Workbench）
    ↓
插件执行 Tavern 侧写回（世界书 / 角色卡 / Prompt 注入）
```

**安全原则：** AI 输出全部是候选，未经用户确认不写入任何系统。每次写回必须可预览。

---

## 四、消息范围选择交互

在 ST 原生聊天界面上叠加操作（不另开副本列表）：
- 进入"选择模式"后，每条消息左侧出现复选框
- 点击单条消息 → 选中/取消
- 点击"从此条以下" → 批���选中到最新消息
- 选中消息高亮显示，底部浮层显示"已选 N 条  [提取记忆]"
- 点击"提取记忆"退出选择模式，进入候选审查流程

---

## 五、Bridge API 契约

**Base URL：** `http://127.0.0.1:3000/api/tavern`

认证：无（MVP 阶段跳过，见 todo.md）

### 5.1 健康检查

```
GET /api/tavern/health
→ { "data": { "status": "ok", "version": "1" }, "error": null }
```

### 5.2 角色解析

```
POST /api/tavern/characters/resolve
Body: { "names": ["角色A", "角色B"] }
→ {
    "data": {
      "resolved": [{ "name": "角色A", "id": "cuid..." }],
      "unresolved": ["角色B"]
    },
    "error": null
  }
```

匹配失败时，Workbench 侧自动创建同名角色并返回新 ID（不提示用户）。

### 5.3 记忆提取

```
POST /api/tavern/memory/extract
Body: {
  "messages": [{ "role": "user"|"assistant", "content": "..." }],
  "characters": [{ "name": "角色A", "id": "cuid..." }],
  "worldbook": "当前世界书内容（可选）"
}
→ {
    "data": {
      "candidates": [
        {
          "id": "temp-uuid",
          "type": "event"|"relationship"|"persona_anchor"|"ooc_guardrail"|"worldbuilding"|"state"|"style_example",
          "title": "候选标题",
          "content": "候选内容",
          "confidence": 0.85,
          "suggestedTargets": ["workbench", "worldbook"],
          "characterIds": ["cuid..."]
        }
      ]
    },
    "error": null
  }
```

### 5.4 记忆提交

```
POST /api/tavern/memory/commit
Body: {
  "candidates": [
    {
      "id": "temp-uuid",
      "type": "event",
      "title": "...",
      "content": "...",
      "targets": ["workbench"],
      "characterIds": ["cuid..."]
    }
  ]
}
→ {
    "data": {
      "committed": ["temp-uuid"],
      "failed": []
    },
    "error": null
  }
```

### 5.5 统一响应格式

成功：`{ "data": {...}, "error": null }`
失败：`{ "data": null, "error": { "code": "invalid_payload", "message": "..." } }`

---

## 六、候选类型与写回目标映射

| 候选类型 | Workbench 写入（Item.itemType） | Tavern 写入 |
|---|---|---|
| event | snippet | 世界书条目 |
| relationship | reference | 角色卡 profile 区块 |
| persona_anchor | profile / state_card | 角色卡 patch |
| ooc_guardrail | state_card | Prompt 注入 |
| worldbuilding | reference | 世界书条目 |
| state | state_card | Prompt 注入 |
| style_example | reference | 角色卡 examples 区块 |

Tavern 侧写入规则：
- 世界书条目带 `oc_sync` 标记，防止重复写入
- 角色卡更新只 patch 标记区块，不覆盖全卡
- Prompt 注入写入 `extension_prompt`，对话结束后可清除

---

## 七、UI 结构

### 插件抽屉

```
[OC Workbench 连接状态] ● 已连接 / ✕ 未连接

[操作区]
  [进入选择模式]   ← 点击后在聊天界面叠加复选框

[候选记忆列表]（提取后展示）
  每条候选：
    类型标签  置信度
    标题（可编辑）
    内容（可编辑）
    写回目标：[Workbench ✓] [世界书 ✓] [角色卡 □] [Prompt □]
    [删除此条]
  底部：[全部确认写回]

[写回预览]（确认前展示）
  列出将要执行的操作
  [确认执行] [取消]
```

### 聊天界面叠加（选择模式）

```
每条消息左侧：[ ] 复选框
每条消息右侧：[从此条以下]
底部浮层：已选 N 条  [提取记忆]  [取消选择]
```

可选 Slash 命令：
- `/oc-extract` — 触发提取流程

---

## 八、SillyTavern 扩展技术细节

**ST 版本：** 1.18.0，安装路径 `~/SillyTavern`
**扩展目录：** `~/SillyTavern/public/scripts/extensions/third-party/oc-tavern-plugin/`

**文件结构：**
```
oc-tavern-plugin/
├── manifest.json
├── index.js
├── style.css
└── settings.html
```

**可用 ST API：**
- `getContext()` — 获取当前聊天上下文（含 `context.chat` 消息数组）
- `generateQuietPrompt(prompt)` — 后台静默调用 AI
- `eventSource.on(event_types.MESSAGE_RECEIVED, cb)` — 监听新消息
- `writeExtensionField(charId, field, value)` — 写回角色卡字段

**Bridge 调用：** 浏览器端直接 `fetch('http://127.0.0.1:3000/api/tavern/...')`，同机器无跨域问题。

---

## 九、Workbench 侧需要新增的内容

以下路由在 `oc-workbench` 的 `app/api/tavern/` 下新增，不影响现有功能：

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/tavern/health` | GET | 健康检查 |
| `/api/tavern/characters/resolve` | POST | 按名字解析角色 ID，未找到则自动创建 |
| `/api/tavern/memory/extract` | POST | AI 提取候选记忆（复用 OpenRouter 配置） |
| `/api/tavern/memory/commit` | POST | 持久化确认的候选到 Item 表 |

---

## 十、开发顺序

**阶段一：插件骨架 + mock**
1. 创建插件目录和 `manifest.json`
2. 实现聊天界面叠加选择模式（读取 `context.chat`，不调用 API）
3. mock 候选列表展示和审查 UI
4. 验证完整 UI 流程可用

**阶段二：Workbench Bridge API**
5. 新增 `/api/tavern/health` 和 `/api/tavern/characters/resolve`
6. 实现 `/api/tavern/memory/extract`（接入 AI）
7. 实现 `/api/tavern/memory/commit`（写入 Item 表）

**阶段三：对接 + Tavern 写回**
8. 插件替换 mock，接入真实 Bridge API
9. 实现世界书写入
10. 实现角色卡 patch
11. 实现 Prompt 注入

**阶段��（MVP 后）：上下文注入**
12. 见 todo.md

---

## 十一、不做的事（MVP 范围内）

- 不在 Tavern 内嵌入 Workbench 完整 UI
- 不做后台自动分析（无用户确认不写入）
- 不做实时双向同步
- 不替换 Tavern 原生编辑器
- 不做多用户 / 权限系统
- 不做 Bridge Token 认证
- 不做上下文注入（Workbench → Tavern 方向）
