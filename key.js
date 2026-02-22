// ==UserScript==
// @name         Shift Toggle Selection Mode / Shift 切换文本选择模式 (含富文本支持)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  在文本框或富文本编辑器内按下Shift后进入选择模式，方向键自动选中文本，再按一次退出。
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let selectionMode = false;
    let anchorIndex = -1;
    let currentIndex = -1;
    let activeElement = null;
    let activeElementType = null; // 'input' 或 'rte' (Rich Text Editor)

    // 综合判断元素类型：常规输入框还是富文本编辑器
    function getElementType(el) {
        if (!el) return null;
        const tagName = el.tagName.toLowerCase();

        // 常规文本框
        if (tagName === 'textarea') return 'input';
        if (tagName === 'input') {
            const type = el.type.toLowerCase();
            if (['text', 'search', 'url', 'tel', 'email', 'password'].includes(type)) return 'input';
        }

        // 现代富文本编辑器 (元素带有 contenteditable 属性)
        if (el.isContentEditable) return 'rte';

        // 老式/iframe版富文本编辑器 (整个文档开启了设计模式)
        if (el.ownerDocument && el.ownerDocument.designMode === 'on') return 'rte';

        return null;
    }

    // 退出选择模式统一处理
    function exitSelectionMode(el) {
        if (selectionMode && el) {
            selectionMode = false;
            el.style.outline = ''; // 移除高亮边框
            activeElementType = null;
        }
    }

    // 监听按键按下 (按下 Shift 进入模式)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Shift' && !selectionMode) {
            const el = document.activeElement;
            const type = getElementType(el);

            if (type) {
                // 进入选择模式
                selectionMode = true;
                activeElement = el;
                activeElementType = type;

                if (type === 'input') {
                    anchorIndex = el.selectionDirection === 'backward' ? el.selectionEnd : el.selectionStart;
                    currentIndex = el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd;
                }

                //   el.style.outline = '1px dashed #007bff'; // 蓝色虚线视觉提示
            }
        }
    }, true);

    // 监听按键释放 (松开 Shift 退出模式)
    document.addEventListener('keyup', function (e) {
        if (e.key === 'Shift') {
            exitSelectionMode(activeElement);
        }
    }, true);

    // [Input 专用] 辅助函数：根据索引获取当前行号和列号
    function getLineCol(text, pos) {
        const before = text.substring(0, pos);
        const lines = before.split('\n');
        return { line: lines.length - 1, col: lines[lines.length - 1].length };
    }

    // [Input 专用] 辅助函数：根据行号和列号计算新光标位置
    function getPos(text, line, col) {
        const lines = text.split('\n');
        if (line < 0) return 0;
        if (line >= lines.length) return text.length;
        let pos = 0;
        for (let i = 0; i < line; i++) pos += lines[i].length + 1;
        return pos + Math.min(col, lines[line].length);
    }

    // 核心：拦截方向键并扩展选区
    document.addEventListener('keydown', function (e) {
        const el = document.activeElement;
        if (!selectionMode || el !== activeElement) return;

        const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (!validKeys.includes(e.key)) return;

        // 如果用户按了 Ctrl/Alt/Meta，交还给浏览器默认处理
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        e.preventDefault();

        if (activeElementType === 'input') {
            // === 常规文本框处理逻辑 ===
            const text = el.value;
            let newPos = currentIndex;
            const lineCol = getLineCol(text, currentIndex);

            switch (e.key) {
                case 'ArrowLeft': newPos = Math.max(0, currentIndex - 1); break;
                case 'ArrowRight': newPos = Math.min(text.length, currentIndex + 1); break;
                case 'ArrowUp': newPos = getPos(text, lineCol.line - 1, lineCol.col); break;
                case 'ArrowDown': newPos = getPos(text, lineCol.line + 1, lineCol.col); break;
                case 'Home': newPos = getPos(text, lineCol.line, 0); break;
                case 'End': newPos = getPos(text, lineCol.line, Infinity); break;
            }

            currentIndex = newPos;
            const start = Math.min(anchorIndex, currentIndex);
            const end = Math.max(anchorIndex, currentIndex);
            const direction = currentIndex < anchorIndex ? 'backward' : 'forward';
            el.setSelectionRange(start, end, direction);

        } else if (activeElementType === 'rte') {
            // === 富文本编辑器处理逻辑 (调用原生 Selection API) ===
            const sel = window.getSelection();
            if (!sel) return;

            // 使用 modify(alter, direction, granularity) 扩展选区
            switch (e.key) {
                case 'ArrowLeft':
                    sel.modify('extend', 'backward', 'character');
                    break;
                case 'ArrowRight':
                    sel.modify('extend', 'forward', 'character');
                    break;
                case 'ArrowUp':
                    sel.modify('extend', 'backward', 'line');
                    break;
                case 'ArrowDown':
                    sel.modify('extend', 'forward', 'line');
                    break;
                case 'Home':
                    sel.modify('extend', 'backward', 'lineboundary');
                    break;
                case 'End':
                    sel.modify('extend', 'forward', 'lineboundary');
                    break;
            }
        }
    }, true);

    // --- 自动退出机制 ---
    document.addEventListener('mousedown', function () { exitSelectionMode(activeElement); });
    document.addEventListener('blur', function (e) {
        if (e.target === activeElement) exitSelectionMode(activeElement);
    }, true);
    document.addEventListener('input', function (e) {
        if (e.target === activeElement) exitSelectionMode(activeElement);
    }, true);

})();