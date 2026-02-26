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
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationId = null;
    let originalCursor = "";
    let scrollTarget = null;
    const scrollSpeed = 1.5; // 滚动速度系数 (默认为 1.0)


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
            startAutoScroll(e);
        }
    }, { capture: true, passive: false });

    function getScrollParent(el) {
        let parent = el;
        while (parent && parent !== document.body && parent !== document.documentElement) {
            const style = window.getComputedStyle(parent);
            const overflow = style.overflowY + style.overflowX + style.overflow;
            const canScrollY = parent.scrollHeight > parent.clientHeight;
            const canScrollX = parent.scrollWidth > parent.clientWidth;
            if (/(auto|scroll)/.test(overflow) && (canScrollY || canScrollX)) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return window;
    }

    function startAutoScroll(e) {
        isScrolling = true;
        startX = e.clientX;
        startY = e.clientY;
        currentX = e.clientX;
        currentY = e.clientY;
        scrollTarget = getScrollParent(e.target);

        // --- 核心修改：改变指针状态 ---
        originalCursor = document.body.style.cursor;
        document.body.style.setProperty('cursor', 'move', 'important');
        // 同时也给 html 标签加一下，确保即使鼠标不在 body 范围内也生效
        document.documentElement.style.setProperty('cursor', 'move', 'important');

        // 视觉指示点
        const indicator = document.createElement('div');
        indicator.id = 'scroll-indicator';
        indicator.style = `
            position: fixed; top: ${startY - 5}px; left: ${startX - 5}px;
            width: 10px; height: 10px; background: rgba(255, 0, 0, 0.4);
            border: 2px solid white; border-radius: 50%; z-index: 999999; pointer-events: none;
        `;
        document.body.appendChild(indicator);

        window.addEventListener('mousemove', updatePosition);
        // 监听松开按键，校验距离
        window.addEventListener('mouseup', handleMouseUp, { capture: true, once: true });
        // 监听任意点击以取消
        window.addEventListener('mousedown', handleStopClick, { capture: true });

        animate();
    }

    function updatePosition(e) {
        currentX = e.clientX;
        currentY = e.clientY;
    }

    function handleStopClick(e) {
        // 停止滚动逻辑
        stopAutoScroll();
    }

    function handleMouseUp(e) {
        if (!isScrolling) return;

        const distance = Math.sqrt(
            Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2)
        );

        if (distance > 25) {
            stopAutoScroll();
        }
    }

    function stopAutoScroll() {
        if (!isScrolling) return;
        isScrolling = false;

        cancelAnimationFrame(animationId);

        // --- 核心修改：恢复指针状态 ---
        document.body.style.cursor = originalCursor;
        document.documentElement.style.cursor = originalCursor;

        window.removeEventListener('mousemove', updatePosition);
        window.removeEventListener('mouseup', handleMouseUp, { capture: true });
        window.removeEventListener('mousedown', handleStopClick, { capture: true });

        const indicator = document.getElementById('scroll-indicator');
        if (indicator) indicator.remove();
        scrollTarget = null;
    }

    function animate() {
        if (!isScrolling) return;
        if (!scrollTarget) return;

        const diffX = currentX - startX;
        const diffY = currentY - startY;

        const scrollData = { behavior: 'instant' };
        let shouldScroll = false;

        // 15px 的死区，防止微小位移
        if (Math.abs(diffX) > 7) {
            scrollData.left = Math.sign(diffX) * Math.pow(Math.abs(diffX) / 12, 1.5) * scrollSpeed;
            shouldScroll = true;
        }
        if (Math.abs(diffY) > 7) {
            scrollData.top = Math.sign(diffY) * Math.pow(Math.abs(diffY) / 12, 1.5) * scrollSpeed;
            shouldScroll = true;
        }

        if (shouldScroll) {
            // if (scrollTarget === window) {
            //     window.scrollBy(scrollData);
            // } else {
            //     scrollTarget.scrollBy(scrollData);
            // }
            scrollTarget.scrollBy(scrollData);
        }

        animationId = requestAnimationFrame(animate);
    }
})();