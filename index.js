import { getContext, extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';

const MODULE_NAME = 'oc_workbench';

// ─── 默认设置 ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
    workbenchUrl: 'http://127.0.0.1:3000',
};

// ─── 状态 ────────────────────────────────────────────────────────────────────

let selectMode = false;
let selectedMsgIds = new Set();   // 选中的消息 mesid 集合
let candidates = [];              // 当前候选记忆列表
let currentCharacterIds = [];     // 当前对话角色在 Workbench 中的 ID

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function getSettings() {
    extension_settings[MODULE_NAME] ??= { ...DEFAULT_SETTINGS };
    return extension_settings[MODULE_NAME];
}

function getBaseUrl() {
    return (getSettings().workbenchUrl || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

// ─── 连接状态 ─────────────────────────────────────────────────────────────────

async function checkConnection() {
    const dot = document.getElementById('oc_status_dot');
    const text = document.getElementById('oc_status_text');
    dot.className = 'oc-status-dot oc-status-unknown';
    text.textContent = '检查中…';
    try {
        const res = await fetch(`${getBaseUrl()}/api/tavern/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            dot.className = 'oc-status-dot oc-status-ok';
            text.textContent = '已连接';
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch {
        dot.className = 'oc-status-dot oc-status-error';
        text.textContent = '未连接';
    }
}

// ─── 选择模式 ─────────────────────────────────────────────────────────────────

function enterSelectMode() {
    selectMode = true;
    selectedMsgIds.clear();
    document.getElementById('oc_enter_select_mode').style.display = 'none';
    injectCheckboxes();
    showFloater();
}

function exitSelectMode() {
    selectMode = false;
    selectedMsgIds.clear();
    removeCheckboxes();
    hideFloater();
    document.getElementById('oc_enter_select_mode').style.display = '';
}

function injectCheckboxes() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    chat.classList.add('oc-select-mode');

    chat.querySelectorAll('.mes').forEach(mes => {
        if (mes.querySelector('.oc-msg-checkbox')) return;

        const mesid = mes.getAttribute('mesid');

        // 复选框
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'oc-msg-checkbox';
        cb.dataset.mesid = mesid;
        cb.addEventListener('change', () => toggleMessage(mesid, cb.checked, mes));
        mes.style.position = 'relative';
        mes.appendChild(cb);

        // "从此条以下" 按钮
        const fromHere = document.createElement('span');
        fromHere.className = 'oc-select-from-here';
        fromHere.textContent = '从此条以下';
        fromHere.addEventListener('click', (e) => {
            e.stopPropagation();
            selectFromHere(mesid);
        });
        mes.appendChild(fromHere);
    });

    // 捕获阶段委托，避免被 ST 自身的冒泡处理器拦截
    chat.addEventListener('click', onChatClick, true);
}

function removeCheckboxes() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    chat.classList.remove('oc-select-mode');
    chat.querySelectorAll('.oc-msg-checkbox, .oc-select-from-here').forEach(el => el.remove());
    chat.querySelectorAll('.mes').forEach(mes => mes.classList.remove('oc-selected'));
    chat.removeEventListener('click', onChatClick, true);
}

function onChatClick(e) {
    if (!selectMode) return;
    if (e.target.classList.contains('oc-msg-checkbox') || e.target.classList.contains('oc-select-from-here')) return;
    const mes = e.target.closest('.mes');
    if (!mes) return;
    const mesid = mes.getAttribute('mesid');
    const cb = mes.querySelector('.oc-msg-checkbox');
    if (!cb) return;
    const next = !cb.checked;
    cb.checked = next;
    toggleMessage(mesid, next, mes);
}

function toggleMessage(mesid, checked, mesEl) {
    if (checked) {
        selectedMsgIds.add(mesid);
        mesEl.classList.add('oc-selected');
    } else {
        selectedMsgIds.delete(mesid);
        mesEl.classList.remove('oc-selected');
    }
    updateFloaterCount();
}

function selectFromHere(fromMesid) {
    const chat = document.getElementById('chat');
    if (!chat) return;
    const allMes = [...chat.querySelectorAll('.mes')];
    let selecting = false;
    allMes.forEach(mes => {
        const mesid = mes.getAttribute('mesid');
        if (mesid === fromMesid) selecting = true;
        if (selecting) {
            const cb = mes.querySelector('.oc-msg-checkbox');
            if (cb) {
                cb.checked = true;
                selectedMsgIds.add(mesid);
                mes.classList.add('oc-selected');
            }
        }
    });
    updateFloaterCount();
}

// ─── 底部浮层 ─────────────────────────────────────────────────────────────────

function showFloater() {
    let floater = document.getElementById('oc_select_floater');
    if (!floater) {
        floater = document.createElement('div');
        floater.id = 'oc_select_floater';
        floater.innerHTML = `
            <span class="oc-floater-count">已选 <b id="oc_floater_count">0</b> 条</span>
            <button class="oc-floater-extract" id="oc_floater_extract">提取记忆</button>
            <span class="oc-floater-cancel" id="oc_floater_cancel">取消选择</span>
        `;
        document.body.appendChild(floater);
        document.getElementById('oc_floater_extract').addEventListener('click', onExtract);
        document.getElementById('oc_floater_cancel').addEventListener('click', exitSelectMode);
    }
    floater.style.display = 'flex';
    updateFloaterCount();
}

function hideFloater() {
    const floater = document.getElementById('oc_select_floater');
    if (floater) floater.style.display = 'none';
}

function updateFloaterCount() {
    const el = document.getElementById('oc_floater_count');
    if (el) el.textContent = selectedMsgIds.size;
}

// ─── 提取（mock） ─────────────────────────────────────────────────────────────

async function onExtract() {
    if (selectedMsgIds.size === 0) {
        alert('请先选择消息');
        return;
    }

    exitSelectMode();

    const context = getContext();
    const selectedMessages = context.chat.filter((_, idx) => selectedMsgIds.has(String(idx)));

    // 显示加载状态
    showLoadingPanel('正在提取记忆…');

    try {
        // 1. resolve 角色
        const charName = context.name2;
        if (!charName) throw new Error('无法获取当前角色名');

        const resolveRes = await fetch(`${getBaseUrl()}/api/tavern/characters/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: [charName] }),
        });
        if (!resolveRes.ok) throw new Error(`角色解析失败 (${resolveRes.status})`);
        const resolveData = await resolveRes.json();
        if (resolveData.error) throw new Error(resolveData.error);

        currentCharacterIds = Object.values(resolveData.data).map(c => c.id);

        // 2. 提取记忆
        const messages = selectedMessages.map(m => ({
            role: m.is_user ? 'user' : 'assistant',
            content: m.mes,
            name: m.is_user ? undefined : charName,
        }));

        const extractRes = await fetch(`${getBaseUrl()}/api/tavern/memory/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterIds: currentCharacterIds, messages }),
        });
        if (!extractRes.ok) throw new Error(`提取失败 (${extractRes.status})`);
        const extractData = await extractRes.json();
        if (extractData.error) throw new Error(extractData.error);

        candidates = extractData.data.candidates;
        showCandidatesPanel();
    } catch (err) {
        console.error('[OC Workbench] extract error:', err);
        alert(`提取失败：${err.message}`);
        resetToMain();
    }
}

// ─── 加载状态 ─────────────────────────────────────────────────────────────────

function showLoadingPanel(msg = '处理中…') {
    document.getElementById('oc_main_panel').style.display = 'none';
    document.getElementById('oc_candidates_panel').style.display = 'none';
    document.getElementById('oc_preview_panel').style.display = 'none';

    let panel = document.getElementById('oc_loading_panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'oc_loading_panel';
        panel.style.cssText = 'padding:12px 0;font-size:0.85em;color:#888;text-align:center;';
        document.getElementById('oc_workbench_settings')
            .querySelector('.inline-drawer-content')
            .appendChild(panel);
    }
    panel.textContent = msg;
    panel.style.display = '';
}

function hideLoadingPanel() {
    const panel = document.getElementById('oc_loading_panel');
    if (panel) panel.style.display = 'none';
}

// ─── 候选面板 ────────────���────────────────────────────────────────────────────

const TARGET_LABELS = {
    workbench: 'Workbench',
    worldbook: '世界书',
    character_card: '角色卡',
    prompt: 'Prompt',
};

function showCandidatesPanel() {
    hideLoadingPanel();
    document.getElementById('oc_main_panel').style.display = 'none';
    document.getElementById('oc_preview_panel').style.display = 'none';
    document.getElementById('oc_candidates_panel').style.display = '';
    renderCandidates();
}

function renderCandidates() {
    const list = document.getElementById('oc_candidates_list');
    const countEl = document.getElementById('oc_candidates_count');
    countEl.textContent = candidates.length;

    list.innerHTML = '';
    candidates.forEach((c, idx) => {
        const card = document.createElement('div');
        card.className = 'oc-candidate-card';
        card.dataset.idx = idx;

        const allTargets = Object.keys(TARGET_LABELS);
        const targetToggles = allTargets.map(t => {
            const active = c.targets.includes(t) ? 'active' : '';
            return `<button class="oc-target-toggle ${active}" data-target="${t}">${TARGET_LABELS[t]}</button>`;
        }).join('');

        card.innerHTML = `
            <div class="oc-candidate-header">
                <span class="oc-type-badge">${c.type}</span>
                <span class="oc-confidence">${Math.round(c.confidence * 100)}%</span>
                <span class="oc-candidate-delete" data-idx="${idx}">✕</span>
            </div>
            <input class="oc-candidate-title text_pole" type="text" value="${escapeHtml(c.title)}" />
            <textarea class="oc-candidate-content text_pole">${escapeHtml(c.content)}</textarea>
            <div class="oc-target-row">
                <span class="oc-target-label">写回目标：</span>
                ${targetToggles}
            </div>
        `;

        // 标题编辑
        card.querySelector('.oc-candidate-title').addEventListener('input', e => {
            candidates[idx].title = e.target.value;
        });

        // 内容编辑
        card.querySelector('.oc-candidate-content').addEventListener('input', e => {
            candidates[idx].content = e.target.value;
        });

        // 目标切换
        card.querySelectorAll('.oc-target-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const set = new Set(candidates[idx].targets);
                if (set.has(target)) {
                    set.delete(target);
                    btn.classList.remove('active');
                } else {
                    set.add(target);
                    btn.classList.add('active');
                }
                candidates[idx].targets = [...set];
            });
        });

        // 删除
        card.querySelector('.oc-candidate-delete').addEventListener('click', () => {
            candidates.splice(idx, 1);
            renderCandidates();
        });

        list.appendChild(card);
    });
}

// ─── 写回预览 ─────────────────────────────────────────────────────────────────

function showPreviewPanel() {
    document.getElementById('oc_candidates_panel').style.display = 'none';
    document.getElementById('oc_preview_panel').style.display = '';

    const list = document.getElementById('oc_preview_list');
    list.innerHTML = '';

    candidates.forEach(c => {
        c.targets.forEach(target => {
            const item = document.createElement('div');
            item.className = 'oc-preview-item';
            item.innerHTML = `
                <i class="fa-solid fa-arrow-right"></i>
                <span><b>${TARGET_LABELS[target]}</b>：${escapeHtml(c.title)}</span>
            `;
            list.appendChild(item);
        });
    });

    if (list.children.length === 0) {
        list.innerHTML = '<div style="color:#888;font-size:0.85em;padding:4px 0;">没有选择任何写回目标</div>';
    }
}

// ─── 写回执行 ─────────────────────────────────────────────────────────────────

async function onConfirmCommit() {
    showLoadingPanel('正在写回…');

    try {
        const res = await fetch(`${getBaseUrl()}/api/tavern/memory/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterIds: currentCharacterIds, candidates }),
        });
        if (!res.ok) throw new Error(`写回失败 (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const { committed } = data.data;
        alert(`已写回 ${committed} 条记忆到 Workbench`);
        resetToMain();
    } catch (err) {
        console.error('[OC Workbench] commit error:', err);
        alert(`写回失败：${err.message}`);
        resetToMain();
    }
}

function resetToMain() {
    candidates = [];
    currentCharacterIds = [];
    hideLoadingPanel();
    document.getElementById('oc_candidates_panel').style.display = 'none';
    document.getElementById('oc_preview_panel').style.display = 'none';
    document.getElementById('oc_main_panel').style.display = '';
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── 初始化 ───────────────────────────────────────────────────────────────────

async function init() {
    // 加载设置面板 HTML
    const res = await fetch(`/scripts/extensions/third-party/${MODULE_NAME}/settings.html`);
    const settingsHtml = await res.text();
    $('#extensions_settings').append(settingsHtml);

    // 恢复保存的设置
    const settings = getSettings();
    $('#oc_workbench_url').val(settings.workbenchUrl);

    // 绑定事件
    $('#oc_workbench_url').on('input', function () {
        getSettings().workbenchUrl = this.value.trim();
        saveSettingsDebounced();
    });

    $('#oc_check_connection').on('click', checkConnection);
    $('#oc_enter_select_mode').on('click', enterSelectMode);

    $('#oc_commit_all').on('click', () => {
        if (candidates.length === 0) return;
        showPreviewPanel();
    });

    $('#oc_cancel_extract').on('click', resetToMain);
    $('#oc_confirm_commit').on('click', onConfirmCommit);
    $('#oc_cancel_commit').on('click', showCandidatesPanel);

    // 注册 slash 命令
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'oc-extract',
        helpString: '进入 OC Workbench 消息选择模式，提取记忆',
        callback: () => {
            // 打开扩展面板并进入选择模式
            enterSelectMode();
            return '';
        },
    }));

    // 启动时检查连接
    checkConnection();
}

export { init };
