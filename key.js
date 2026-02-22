// ==UserScript==
// @name         Shift Toggle Selection Mode / Shift 切换文本选择模式
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在文本框内按下Shift后进入选择模式，方向键移动将自动选中文本，再按一次退出。
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

    // 判断是否是支持的常规文本编辑框
    function isTextInput(el) {
        if (!el) return false;
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'textarea') return true;
        if (tagName === 'input') {
            const type = el.type.toLowerCase();
            return ['text', 'search', 'url', 'tel', 'email', 'password'].includes(type);
        }
        return false;
    }

    // 退出选择模式的统一处理函数
    function exitSelectionMode(el) {
        if (selectionMode && el) {
            selectionMode = false;
            el.style.outline = ''; // 移除高亮边框
        }
    }

    // 监听 Shift 的按下和抬起
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Shift') {
            const el = document.activeElement;
            if (isTextInput(el) && !selectionMode) {
                // 进入选择模式
                selectionMode = true;
                activeElement = el;
                // 记录当前的锚点（起点）和当前光标位置
                anchorIndex = el.selectionDirection === 'backward' ? el.selectionEnd : el.selectionStart;
                currentIndex = el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd;
                el.style.outline = '2px dashed #007bff'; // 蓝色虚线视觉提示
            }
        }
    }, true);

    document.addEventListener('keyup', function (e) {
        if (e.key === 'Shift') {
            exitSelectionMode(activeElement);
        }
    }, true);

    // 辅助函数：根据索引获取当前行号和列号 (用于上下方向键)
    function getLineCol(text, pos) {
        const before = text.substring(0, pos);
        const lines = before.split('\n');
        return { line: lines.length - 1, col: lines[lines.length - 1].length };
    }

    // 辅助函数：根据行号和列号计算新的光标位置
    function getPos(text, line, col) {
        const lines = text.split('\n');
        if (line < 0) return 0;
        if (line >= lines.length) return text.length;

        let pos = 0;
        for (let i = 0; i < line; i++) {
            pos += lines[i].length + 1; // +1 是为了加上 '\n' 的长度
        }
        return pos + Math.min(col, lines[line].length);
    }

    // 拦截方向键，执行选中逻辑
    document.addEventListener('keydown', function (e) {
        const el = document.activeElement;
        if (!selectionMode || el !== activeElement) return;

        const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (!validKeys.includes(e.key)) return;

        // 既然是按住 Shift 进入模式，所有的方向键操作都会带有 shiftKey: true
        // 我们只在没有 Ctrl/Alt/Meta 时拦截，或者即使按了 Shift 我们也处理（这是必须的）
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        e.preventDefault(); // 阻止默认的光标移动（因为默认移动会取消选中状态）

        const text = el.value;
        let newPos = currentIndex;
        const lineCol = getLineCol(text, currentIndex);

        switch (e.key) {
            case 'ArrowLeft':
                newPos = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowRight':
                newPos = Math.min(text.length, currentIndex + 1);
                break;
            case 'ArrowUp':
                newPos = getPos(text, lineCol.line - 1, lineCol.col);
                break;
            case 'ArrowDown':
                newPos = getPos(text, lineCol.line + 1, lineCol.col);
                break;
            case 'Home':
                newPos = getPos(text, lineCol.line, 0);
                break;
            case 'End':
                newPos = getPos(text, lineCol.line, Infinity);
                break;
        }

        currentIndex = newPos;

        // 设置文本选中范围
        const start = Math.min(anchorIndex, currentIndex);
        const end = Math.max(anchorIndex, currentIndex);
        const direction = currentIndex < anchorIndex ? 'backward' : 'forward';

        el.setSelectionRange(start, end, direction);
    }, true);

    // --- 自动退出机制，防止模式卡死 ---

    // 鼠标点击其他地方或框内时退出
    document.addEventListener('mousedown', function () {
        exitSelectionMode(activeElement);
    });

    // 输入框失去焦点时退出
    document.addEventListener('blur', function (e) {
        if (e.target === activeElement) {
            exitSelectionMode(activeElement);
        }
    }, true);

    // 用户敲击键盘输入了内容时退出
    document.addEventListener('input', function (e) {
        if (e.target === activeElement) {
            exitSelectionMode(activeElement);
        }
    }, true);

})();