// ==UserScript==
// @name         自定义中键增强：超链接跳转 + 平滑自动滚动 (带指针反馈)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  屏蔽原生中键滚动，链接则新开标签，非链接则触发自定义加速滚动，并改变鼠标指针状态
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let isScrolling = false;
    let startY = 0;
    let currentY = 0;
    let animationId = null;
    let originalCursor = ""; // 用于记录原始指针样式

    // 1. 监听中键按下
    window.addEventListener('mousedown', function (e) {
        if (e.button !== 1) return; // 只处理中键 (0:左, 1:中, 2:右)

        const target = e.target.closest('a');
        if (target && target.href) {
            // 如果是链接，不做拦截，让浏览器执行默认的新标签打开逻辑
            return;
        }

        // 屏蔽原生滚动模式
        e.preventDefault();
        e.stopPropagation();

        if (isScrolling) {
            stopAutoScroll();
        } else {
            startAutoScroll(e.clientY);
        }
    }, { capture: true, passive: false });

    function startAutoScroll(y) {
        isScrolling = true;
        startY = y;
        currentY = y;

        // --- 核心修改：改变指针状态 ---
        originalCursor = document.body.style.cursor;
        document.body.style.setProperty('cursor', 'move', 'important');
        // 同时也给 html 标签加一下，确保即使鼠标不在 body 范围内也生效
        document.documentElement.style.setProperty('cursor', 'move', 'important');

        // 视觉指示点
        const indicator = document.createElement('div');
        indicator.id = 'scroll-indicator';
        indicator.style = `
            position: fixed; top: ${y - 5}px; left: ${event.clientX - 5}px;
            width: 10px; height: 10px; background: rgba(255, 0, 0, 0.4);
            border: 2px solid white; border-radius: 50%; z-index: 999999; pointer-events: none;
        `;
        document.body.appendChild(indicator);

        window.addEventListener('mousemove', updatePosition);
        // 监听任意点击以取消
        window.addEventListener('mousedown', handleStopClick, { capture: true });

        animate();
    }

    function updatePosition(e) {
        currentY = e.clientY;
    }

    function handleStopClick(e) {
        // 停止滚动逻辑
        stopAutoScroll();
    }

    function stopAutoScroll() {
        if (!isScrolling) return;
        isScrolling = false;

        cancelAnimationFrame(animationId);

        // --- 核心修改：恢复指针状态 ---
        document.body.style.cursor = originalCursor;
        document.documentElement.style.cursor = originalCursor;

        window.removeEventListener('mousemove', updatePosition);
        window.removeEventListener('mousedown', handleStopClick, { capture: true });

        const indicator = document.getElementById('scroll-indicator');
        if (indicator) indicator.remove();
    }

    function animate() {
        if (!isScrolling) return;

        const diff = currentY - startY;

        // 15px 的死区，防止微小位移
        if (Math.abs(diff) > 15) {
            // 滚动算法：方向 * (距离/系数)^1.5，系数越大滚动越慢
            const speed = Math.sign(diff) * Math.pow(Math.abs(diff) / 12, 1.5);
            window.scrollBy({ top: speed, behavior: 'instant' });
        }

        animationId = requestAnimationFrame(animate);
    }
})();