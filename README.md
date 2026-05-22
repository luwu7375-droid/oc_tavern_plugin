# OC Tavern Plugin

SillyTavern 插件，将对话记忆从 Tavern 同步回 [OC Workbench](https://github.com/luwu7375-droid/oc-workbench)。

**设计理念：Tavern 演出，OC Workbench 记忆。**

---

## 功能

- 在聊天界面选取消息范围，提取记忆候选项
- 审阅、编辑候选内容后一键写回 Workbench
- 支持写回目标：Workbench 内容项、世界书、角色卡、Prompt 注入
- 切换对话时自动注入角色状态与近期片段到世界书
- 可选 slash 命令支持

## 安装

1. 在 SillyTavern 扩展面板中点击右上角的安装按钮，选择 **从 Git URL 安装**
2. 在弹窗中输入：
   ```
   https://github.com/luwu7375-droid/oc_tavern_plugin
   ```
3. 点击 **Install just for me** 完成安装
4. 重启 SillyTavern，在扩展面板启用 **OC Workbench**

## 配置

在插件设置抽屉中填写：

| 字段 | 说明 |
|------|------|
| Workbench URL | OC Workbench 本地地址，如 `http://localhost:3000` |
| Bridge Token | 可选，与 Workbench 端 `OC_BRIDGE_TOKEN` 环境变量一致 |

## 使用流程

1. 打开聊天，点击 **Extract** 进入消息选择模式
2. 勾选要提取的消息范围
3. 审阅 AI 提取的候选记忆，按需编辑
4. 点击 **Commit** 写回 OC Workbench

## Bridge API

插件通过 OC Workbench 的 `/api/tavern` 路由通信：

```
GET  /api/tavern/health              连接检查
POST /api/tavern/characters/resolve  角色名 → OC ID
POST /api/tavern/memory/extract      AI 提取记忆候选
POST /api/tavern/memory/commit       持久化确认的记忆
```

详见 [`docs/bridge-api.md`](docs/bridge-api.md)。

## 候选记忆类型

`event` · `relationship` · `persona_anchor` · `ooc_guardrail` · `worldbuilding` · `state` · `style_example`

## 开发状态

- [x] 插件骨架 + 设置面板
- [x] 消息选择 UI
- [x] 记忆候选审阅与编辑
- [x] Bridge API 集成
- [x] Tavern 写回（世界书 / 角色卡 / Prompt）
- [x] 上下文注入（Workbench → Tavern）

## 依赖

- SillyTavern（最新版）
- OC Workbench（本地运行）

## 文档

- [Bridge API 设计](docs/bridge-api.md)
- [写回映射](docs/writeback-mapping.md)
- [MVP 范围](docs/mvp-scope.md)
- [仓库边界](docs/repository-boundary.md)

## License

MIT
