// ==UserScript==
// @name         Full Desktop Style Scrollbar (with Arrows) - 4.0
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  检测所有 overflow/overflowY 为 auto 或 scroll 的元素，套用自定义滚动条
// @author       ChatGPT
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        width: 12,
        arrowHeight: 20,
        stepSize: 100,
        scrollSpeed: 15,
        longPressDelay: 500,
        zIndex: 999999,
        color: 'rgba(128,128,128,0.5)',
        hoverBg: 'rgba(128,128,128,0.1)',
        minThumb: 20,
        skipSize: 100
    };

    const processed = new WeakSet();
    const instances = [];
    let rafPending = false;
    let scanTimer = null;

    const policy = window.trustedTypes && window.trustedTypes.createPolicy ?
        window.trustedTypes.createPolicy('gm-sb-policy', { createHTML: s => s }) :
        null;

    function throttledScan() {
        if (scanTimer) return;
        scanTimer = setTimeout(() => {
            scan();
            scheduleUpdate();
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
        if (!isWin && el.clientHeight < CONFIG.skipSize) return;
        processed.add(el);

        // Create scrollbar DOM
        const ctr = document.createElement('div');
        ctr.className = 'gm-sb';

        const up = document.createElement('div');
        up.className = 'gm-sb-arr';
        const svgUp = '<svg viewBox="0 0 100 100"><path d="M50 20 L20 70 L80 70 Z" fill="currentColor"/></svg>';
        up.innerHTML = policy ? policy.createHTML(svgUp) : svgUp;

        const down = document.createElement('div');
        down.className = 'gm-sb-arr';
        const svgDown = '<svg viewBox="0 0 100 100"><path d="M50 80 L20 30 L80 30 Z" fill="currentColor"/></svg>';
        down.innerHTML = policy ? policy.createHTML(svgDown) : svgDown;

        const trk = document.createElement('div');
        trk.className = 'gm-sb-trk';
        const thb = document.createElement('div');
        thb.className = 'gm-sb-thb';

        trk.appendChild(thb);
        ctr.append(up, trk, down);
        document.body.appendChild(ctr);

        // Hide native scrollbar
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

            // Visible rect clamped to viewport
            const vTop = Math.max(0, r.top);
            const vBot = Math.min(window.innerHeight, r.bottom);
            const vH = vBot - vTop;

            if (sH <= cH || vH <= 0) {
                ctr.style.display = 'none';
                return;
            }

            if (!isWin) {
                const cs = getComputedStyle(el);
                if (cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
                    ctr.style.display = 'none';
                    return;
                }
            }

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

        // === Drag ===
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

        // === Arrows ===
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

        // === Track click ===
        trk.addEventListener('pointerdown', e => {
            if (e.target === thb) return;
            const tr = thb.getBoundingClientRect();
            doScrollBy((e.clientY > tr.bottom ? 1 : -1) * getInfo().cH * 0.9);
        });

        // === Wheel Scroll on Scrollbar ===
        ctr.addEventListener('wheel', e => {
            e.preventDefault();
            doScrollBy(e.deltaY);
        }, { passive: false });

        // === Observers ===
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
        // Apply to window first
        attachScrollbar(window);

        // Scan all elements for overflow/overflowY = auto|scroll
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
