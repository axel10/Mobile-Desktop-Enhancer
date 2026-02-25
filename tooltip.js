// ==UserScript==
// @name         智能工具提示 (延迟显示版)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  屏蔽原生title，支持所有带title属性的元素，悬停2秒后自定义随动提示，优化屏幕边缘显示
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    // 0. 属性拦截：拦截 HTMLElement.prototype.title
    // 防止其他 JS 依赖 title 属性导致发生错误（因为我们为了屏蔽原生工具提示而移除了 title 属性）
    const originalTitleDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'title');
    if (originalTitleDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'title', {
            get() {
                // 如果存在自定义标题（说明已被接管），则返回自定义标题；否则调用原始 getter
                return this.dataset.customTitle !== undefined ? this.dataset.customTitle : originalTitleDescriptor.get.call(this);
            },
            set(value) {
                // 如果存在自定义标题（正在被接管），则同步更新自定义标题
                if (this.dataset.customTitle !== undefined) {
                    this.dataset.customTitle = value;
                } else {
                    // 否则按正常流程设置（如果元素还没被接管，依然会让它走原始 setter）
                    originalTitleDescriptor.set.call(this, value);
                }
            },
            configurable: true,
            enumerable: true
        });
    }

    // 1. 创建自定义提示框元素
    const tooltip = document.createElement('div'); // 容器层
    const tooltipContent = document.createElement('div'); // 内容层
    tooltip.appendChild(tooltipContent);

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
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'opacity 0.2s ease',
        maxWidth: '320px', // 包含 padding 的总宽度
        boxSizing: 'border-box'
    });

    Object.assign(tooltipContent.style, {
        maxWidth: '300px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: '5',
        WebkitBoxOrient: 'vertical',
        wordBreak: 'break-all'
    });

    document.body.appendChild(tooltip);

    let hoverTimer = null; // 用于记录延迟的定时器
    let currentX = 0;      // 记录当前鼠标 X 坐标
    let currentY = 0;      // 记录当前鼠标 Y 坐标

    // 统一处理位置更新和边界检测的函数
    function updateTooltipPosition() {
        const offset = 15;
        let x = currentX + offset;
        let y = currentY + offset;

        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 右侧边界检查
        if (x + tooltipRect.width > viewportWidth) {
            x = currentX - tooltipRect.width - offset;
        }

        // 底部边界检查
        if (y + tooltipRect.height > viewportHeight) {
            y = currentY - tooltipRect.height - offset;
        }

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    // 2. 监听鼠标移入
    document.addEventListener('mouseover', (e) => {
        // 查找带有 title 属性，或者已经被我们接管了的元素 (不再局限于 'a' 标签)
        const target = e.target.closest('[title], [data-custom-title]');
        if (!target) return;

        // 立即接管并屏蔽原生 title，防止浏览器在 2 秒内弹出原生黑框
        if (target.hasAttribute('title')) {
            target.dataset.customTitle = target.getAttribute('title');
            target.removeAttribute('title');
        }

        const text = target.dataset.customTitle;
        if (!text) return;

        // 清除之前的定时器（防止快速滑动时触发多个）
        if (hoverTimer) clearTimeout(hoverTimer);

        // 设置 1 秒 (1000毫秒) 延迟
        hoverTimer = setTimeout(() => {
            tooltipContent.textContent = text;
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            // 文本内容填入后，计算宽高并更新位置
            updateTooltipPosition();
        }, 1000);
    });

    // 3. 监听鼠标移动
    document.addEventListener('mousemove', (e) => {
        // 实时更新鼠标坐标记录
        currentX = e.clientX;
        currentY = e.clientY;

        // 只有当提示框已经显示时，才让它跟随鼠标移动
        if (tooltip.style.visibility === 'visible') {
            updateTooltipPosition();
        }
    });

    // 4. 监听鼠标移出
    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[title], [data-custom-title]');
        if (target) {
            // 如果鼠标在 2 秒内移出，取消定时器，阻止提示框出现
            if (hoverTimer) clearTimeout(hoverTimer);

            // 隐藏提示框
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        }
    });

    // 5. 点击时隐藏提示框
    document.addEventListener('mousedown', () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
    });

})();