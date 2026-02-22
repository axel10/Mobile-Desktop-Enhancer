// ==UserScript==
// @name         Desktop Enhancement Suite
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  桌面增强套件：智能工具提示 | Shift文本选择模式 | 自定义滚动条 | 中键增强
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================
       模块1: 智能工具提示 (延迟显示版)
       ============================================ */
    (function TooltipModule() {
        const tooltip = document.createElement('div');
        Object.assign(tooltip.style, {
            position: 'fixed',
            zIndex: '999999',
            padding: '5px 10px',
            background: 'rgba(50, 50, 50, 0.9)',
            color: '#fff',
            fontSize: '12px',
            borderRadius: '4px',
            pointerEvents: 'none',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'opacity 0.2s ease'
        });
        document.body.appendChild(tooltip);

        let hoverTimer = null;
        let currentX = 0;
        let currentY = 0;

        function updateTooltipPosition() {
            const offset = 15;
            let x = currentX + offset;
            let y = currentY + offset;

            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (x + tooltipRect.width > viewportWidth) {
                x = currentX - tooltipRect.width - offset;
            }
            if (y + tooltipRect.height > viewportHeight) {
                y = currentY - tooltipRect.height - offset;
            }

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[title], [data-custom-title]');
            if (!target) return;

            if (target.hasAttribute('title')) {
                target.dataset.customTitle = target.getAttribute('title');
                target.removeAttribute('title');
            }

            const text = target.dataset.customTitle;
            if (!text) return;

            if (hoverTimer) clearTimeout(hoverTimer);

            hoverTimer = setTimeout(() => {
                tooltip.textContent = text;
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
                updateTooltipPosition();
            }, 1000);
        });

        document.addEventListener('mousemove', (e) => {
            currentX = e.clientX;
            currentY = e.clientY;

            if (tooltip.style.visibility === 'visible') {
                updateTooltipPosition();
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[title], [data-custom-title]');
            if (target) {
                if (hoverTimer) clearTimeout(hoverTimer);
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
            }
        });
    })();

    /* ============================================
       模块2: Shift切换文本选择模式
       ============================================ */
    (function KeyModule() {
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

                    el.style.outline = '2px dashed #007bff'; // 蓝色虚线视觉提示
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

    /* ============================================
       模块3: 全桌面样式滚动条 (带箭头)
       ============================================ */
    (function ScrollModule() {
        const CONFIG = {
            width: 12,
            arrowHeight: 20,
            stepSize: 100,
            scrollSpeed: 15,
            longPressDelay: 500,
            zIndex: 999999,
            color: 'rgba(128,128,128,0.5)',
            hoverBg: 'rgba(128,128,128,0.1)',
            minThumb: 20
        };

        const processed = new WeakSet();
        const instances = [];
        let rafPending = false;
        let scanTimer = null;

        function throttledScan() {
            if (scanTimer) return;
            scanTimer = setTimeout(() => {
                scan();
                scanTimer = null;
            }, 500);
        }

        function scheduleUpdate() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                for (let i = 0; i < instances.length; i++) instances[i].update();
                rafPending = false;
            });
        }

        function injectStyle() {
            if (document.getElementById('gm-sb-style')) return;
            const s = document.createElement('style');
            s.id = 'gm-sb-style';
            s.textContent = `
                .gm-no-sb { scrollbar-width: none !important; }
                .gm-no-sb::-webkit-scrollbar { display: none !important; }

                .gm-sb {
                    position: fixed;
                    width: ${CONFIG.width}px;
                    z-index: ${CONFIG.zIndex};
                    display: flex;
                    flex-direction: column;
                    user-select: none;
                    touch-action: none;
                    background: transparent;
                    pointer-events: none;
                    box-sizing: border-box;
                }
                .gm-sb .gm-sb-arr, .gm-sb .gm-sb-trk { pointer-events: auto; }
                .gm-sb .gm-sb-trk:hover { background: ${CONFIG.hoverBg}; }
                .gm-sb:hover .gm-sb-trk, .gm-sb:hover .gm-sb-arr { width: ${CONFIG.width}px; }

                .gm-sb-arr {
                    height: ${CONFIG.arrowHeight}px;
                    display: flex; visibility: hidden;
                    align-items: center; justify-content: center;
                    color: ${CONFIG.color}; cursor: default;
                    width: ${CONFIG.width / 2}px;
                    margin-left: auto;
                    transition: width .2s;
                }
                .gm-sb:hover .gm-sb-arr { visibility: visible; }

                .gm-sb-trk {
                    flex: 1; position: relative;
                    width: ${CONFIG.width / 2}px;
                    margin-left: auto;
                    transition: width .2s;
                }

                .gm-sb-thb {
                    position: absolute; width: 100%;
                    background: ${CONFIG.color};
                    border-radius: 10px;
                }
                .gm-sb-thb.active { background: rgba(100,100,100,.8); }
            `;
            document.head.appendChild(s);
        }

        function attachScrollbar(target) {
            const isWin = target === window;
            const el = isWin ? document.documentElement : target;

            if (processed.has(el)) return;
            if (!isWin && (el === document.documentElement || el === document.body)) return;
            processed.add(el);

            const ctr = document.createElement('div');
            ctr.className = 'gm-sb';

            const up = document.createElement('div');
            up.className = 'gm-sb-arr';
            up.innerHTML = '<svg viewBox="0 0 100 100"><path d="M50 20 L20 70 L80 70 Z" fill="currentColor"/></svg>';

            const down = document.createElement('div');
            down.className = 'gm-sb-arr';
            down.innerHTML = '<svg viewBox="0 0 100 100"><path d="M50 80 L20 30 L80 30 Z" fill="currentColor"/></svg>';

            const trk = document.createElement('div');
            trk.className = 'gm-sb-trk';
            const thb = document.createElement('div');
            thb.className = 'gm-sb-thb';

            trk.appendChild(thb);
            ctr.append(up, trk, down);
            document.body.appendChild(ctr);

            if (isWin) {
                document.documentElement.classList.add('gm-no-sb');
                document.body.classList.add('gm-no-sb');
            } else {
                el.classList.add('gm-no-sb');
            }

            let isDrag = false, startY = 0, startScr = 0, trkH = 0;

            function getInfo() {
                if (isWin) {
                    const d = document.documentElement;
                    return { sH: d.scrollHeight, cH: window.innerHeight, sT: window.scrollY || d.scrollTop };
                }
                return { sH: el.scrollHeight, cH: el.clientHeight, sT: el.scrollTop };
            }

            function getRect() {
                if (isWin) return { top: 0, right: window.innerWidth, bottom: window.innerHeight, height: window.innerHeight };
                return el.getBoundingClientRect();
            }

            function doScroll(pos) {
                if (isWin) window.scrollTo({ top: pos, behavior: 'instant' });
                else el.scrollTop = pos;
            }

            function doScrollBy(d) {
                if (isWin) window.scrollBy({ top: d, behavior: 'instant' });
                else el.scrollTop += d;
            }

            function update() {
                if (!isWin && !el.isConnected) { ctr.style.display = 'none'; return; }

                const { sH, cH, sT } = getInfo();
                const r = getRect();

                const vTop = Math.max(0, r.top);
                const vBot = Math.min(window.innerHeight, r.bottom);
                const vH = vBot - vTop;

                if (sH <= cH || vH <= 0) { ctr.style.display = 'none'; return; }

                ctr.style.display = 'flex';
                ctr.style.top = vTop + 'px';
                ctr.style.height = vH + 'px';
                ctr.style.right = (window.innerWidth - r.right) + 'px';

                trkH = trk.offsetHeight;
                let thumbH = Math.max(CONFIG.minThumb, (cH / sH) * trkH);

                const maxS = sH - cH;
                const ratio = maxS ? sT / maxS : 0;
                const thumbTop = (trkH - thumbH) * ratio;

                thb.style.height = thumbH + 'px';
                thb.style.transform = `translateY(${thumbTop}px)`;
            }

            thb.addEventListener('pointerdown', e => {
                if (e.pointerType !== 'mouse') return;
                isDrag = true; thb.classList.add('active');
                startY = e.clientY; startScr = getInfo().sT;
                thb.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            thb.addEventListener('pointermove', e => {
                if (!isDrag) return;
                const { sH, cH } = getInfo();
                const movable = trkH - thb.offsetHeight;
                if (movable <= 0) return;
                doScroll(startScr + ((e.clientY - startY) / movable) * (sH - cH));
            });

            thb.addEventListener('pointerup', () => { isDrag = false; thb.classList.remove('active'); });

            let aT = null, aF = null;

            function startAuto(dir) {
                doScrollBy(dir * CONFIG.stepSize);
                aT = setTimeout(() => {
                    (function lp() { doScrollBy(dir * CONFIG.scrollSpeed); aF = requestAnimationFrame(lp); })();
                }, CONFIG.longPressDelay);
                document.addEventListener('pointerup', stopAuto, { once: true });
            }
            function stopAuto() { clearTimeout(aT); cancelAnimationFrame(aF); }

            up.addEventListener('pointerdown', e => { e.stopPropagation(); startAuto(-1); });
            down.addEventListener('pointerdown', e => { e.stopPropagation(); startAuto(1); });

            trk.addEventListener('pointerdown', e => {
                if (e.target === thb) return;
                const tr = thb.getBoundingClientRect();
                doScrollBy((e.clientY > tr.bottom ? 1 : -1) * getInfo().cH * 0.9);
            });

            ctr.addEventListener('wheel', e => {
                e.preventDefault();
                doScrollBy(e.deltaY);
            }, { passive: false });

            (isWin ? window : el).addEventListener('scroll', scheduleUpdate, { passive: true });

            if (isWin) {
                new ResizeObserver(scheduleUpdate).observe(document.documentElement);
                new MutationObserver(scheduleUpdate).observe(document.documentElement, { childList: true, subtree: true });
            } else {
                new ResizeObserver(scheduleUpdate).observe(el);
            }

            instances.push({ update });
        }

        function scan() {
            attachScrollbar(window);

            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (processed.has(el)) continue;
                const cs = getComputedStyle(el);
                const ov = cs.overflow;
                const ovY = cs.overflowY;
                if (ov === 'auto' || ov === 'scroll' || ovY === 'auto' || ovY === 'scroll') {
                    if (el.scrollHeight > el.clientHeight) {
                        attachScrollbar(el);
                    }
                }
            }
        }

        function waitForDOM() {
            if (!document.body || !document.head) { requestAnimationFrame(waitForDOM); return; }
            injectStyle();
            scan();

            const observer = new MutationObserver(throttledScan);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }

        window.addEventListener('resize', scheduleUpdate);
        waitForDOM();
    })();

    /* ============================================
       模块4: 中键增强（超链接跳转 + 平滑自动滚动）
       ============================================ */
    (function MiddleMouseModule() {
        let isScrolling = false;
        let startY = 0;
        let currentY = 0;
        let animationId = null;
        let originalCursor = "";

        window.addEventListener('mousedown', function (e) {
            if (e.button !== 1) return;

            const target = e.target.closest('a');
            if (target && target.href) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (isScrolling) {
                stopAutoScroll();
            } else {
                startAutoScroll(e.clientY, e.clientX);
            }
        }, { capture: true, passive: false });

        function startAutoScroll(y, x) {
            isScrolling = true;
            startY = y;
            currentY = y;

            originalCursor = document.body.style.cursor;
            document.body.style.setProperty('cursor', 'move', 'important');
            document.documentElement.style.setProperty('cursor', 'move', 'important');

            const indicator = document.createElement('div');
            indicator.id = 'scroll-indicator';
            indicator.style = `
                position: fixed; top: ${y - 5}px; left: ${x - 5}px;
                width: 10px; height: 10px; background: rgba(255, 0, 0, 0.4);
                border: 2px solid white; border-radius: 50%; z-index: 999999; pointer-events: none;
            `;
            document.body.appendChild(indicator);

            window.addEventListener('mousemove', updatePosition);
            window.addEventListener('mousedown', handleStopClick, { capture: true });

            animate();
        }

        function updatePosition(e) {
            currentY = e.clientY;
        }

        function handleStopClick(e) {
            stopAutoScroll();
        }

        function stopAutoScroll() {
            if (!isScrolling) return;
            isScrolling = false;

            cancelAnimationFrame(animationId);

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

            if (Math.abs(diff) > 15) {
                const speed = Math.sign(diff) * Math.pow(Math.abs(diff) / 12, 1.5);
                window.scrollBy({ top: speed, behavior: 'instant' });
            }

            animationId = requestAnimationFrame(animate);
        }
    })();

})();
