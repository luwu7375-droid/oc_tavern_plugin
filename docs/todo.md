# OC Tavern Plugin — MVP 后待办事项

> 创建日期：2026-05-21
> 说明：以下功能在 MVP 阶段有意跳过，待核心流程稳定后迭代。

---

## T1. Bridge Token 认证

**背景：** MVP 阶段 Bridge API 完全无认证，任何本地进程都可以调用。

**待做：**
- 在 Workbench 生成并存储 `OC_TAVERN_BRIDGE_TOKEN`（环境变量或本地配置文件）
- 插件在 settings.html 提供 Token 输入框，存入 `extension_settings`
- 所有 Bridge 请求带 `X-OC-Bridge-Token` header
- Workbench API 中间件校验 Token，不匹配返回 401

**优先级：** 中。本地单机使用风险低，但如果用户将 Workbench 暴露到局域网则需要。

---

## T2. 上下文注入（Workbench → Tavern）

**背景：** memory052101 中标记为 P0，但依赖 Workbench 的角色状态卡数据积累，MVP 阶段数据还不够。

**待做：**
- Workbench 新增 `GET /api/tavern/context/inject?characterIds=...` 端点
  - 返回：角色当前 `state_card` 内容 + 最近 N 条 `snippet` 事件
- 插件在对话开始时（`CHAT_CHANGED` 事件）自动调用
- 将返回内容注入为临时世界书条目（带 `oc_inject` 标记）
- 对话结束或切换角色时清除注入条目

**依赖：** 需要用户在 Workbench 中已积累足够的 state_card 和 snippet 数据。

**优先级：** 高。这是 memory052101 中标记的最高价值功能。

---

## T3. 角色匹配失败的用户提示

**背景：** MVP 阶段角色匹配失败时 Workbench 自动创建同名角色，用户无感知。

**待做：**
- resolve 端点返回 `auto_created` 字段标记自动创建的角色
- 插件在候选审查界面提示"已在 Workbench 自动创建角色 [名字]"
- 提供"查看 Workbench"快捷链接（打开 `http://127.0.0.1:3000`）
- 长期：考虑让用户选择映射到已有角色，而不是自动创建

**优先级：** 低。自动创建不会造成数据损失，只是体验粗糙。

---

## T4. 世界书写入 API 确认

**背景：** ST 1.18.0 的世界书写入接口在实现阶段三时需要确认具体方法名和参数格式。

**待确认：**
- `getWorldInfoPrompt()` 的返回格式
- 写入新世界书条目的 API（可能是 `createWorldInfoEntry()` 或类似）
- `oc_sync` 标记的存储位置���条目的 `comment` 字段或 `extensions` 字段）
- 重复检测逻辑：按标题匹配还是按标记匹配

**行动：** 实现阶段三前，读取 ST 源码中 `public/scripts/world-info.js` 确认接口。

**优先级：** 阶段三开始前必须解决。

---

## T5. 叙事分支 / AU 管理

**背景：** memory052101 中提到的长期差异化功能，竞品无此能力。

**待做：**
- Workbench 数据模型支持 `branch` 概念（同一角色在不同 AU 下的状态分开存储）
- 插件提取时允许用户指定写入哪个分支
- 时间线视图支持分支切换

**优先级：** 低，长期规划。

---

## T6. 多角色群组聊天同步

**背景：** ST 支持群组聊天（多角色同时在场），当前 MVP 只处理单角色对话。

**待做：**
- 群组聊天时，resolve 多个角色名
- 候选记忆支持关联多个角色（`characterIds` 数组已预留）
- 共现页面对应 Tavern 群组聊天场景

**优先级：** 中。群组聊天是 OC 创作的高频场景。

---

## T7. 角色卡导入（ST → Workbench）

**背景：** memory052101 中 MVP 阶段功能，但与插件主流程独立，可单独迭代。

**待做：**
- 插件读取当前角色卡的完整 JSON（`getContext().characters`）
- 调用 Workbench 新增的 `POST /api/tavern/characters/import` 端点
- Workbench 解析 ST 角色卡格式，创建 Character + 若干 profile Item
- 支持 PNG 格式（需要先解析嵌入的 JSON 数据）

**优先级：** 中。降低用户迁移成本的关键功能。

---

## T8. 时间线 → 世界书导出

**背景：** memory052101 中 MVP 阶段功能，Workbench 侧功能，与插件关系较弱。

**待做：**
- Workbench 新增导出功能：把共现时间线事件转成 ST 世界书 JSON 格式
- 用户手动下载后导入 ST（不需要插件参与）
- 长期：插件提供一键导入按钮

**优先级：** 低，Workbench 侧独立实现。
