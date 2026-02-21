/**
 * Save Chart/Diagram as High-Resolution Image Utility
 * Adds a "حفظ كصورة" (Save as Image) button to every .mermaid element
 * and every canvas element (Chart.js) in the page.
 * Also adds a floating "حفظ جميع المخططات" (Save All) button.
 * Uses html2canvas for DOM elements, and native Canvas toDataURL for Chart.js.
 * Writes the section/chart title on top of the saved image.
 */
(function () {
    'use strict';

    const SCALE_FACTOR = 3; // 3x resolution for crisp output
    const TITLE_FONT_SIZE = 28; // Title font size in px (at 1x, will be scaled)
    const TITLE_PADDING = 20; // Padding around the title area
    const TITLE_BG_COLOR = '#0f172a'; // Dark background for title bar
    const TITLE_TEXT_COLOR = '#ffffff'; // White text
    const SAVE_ALL_DELAY = 800; // ms delay between each chart save

    // ─── Button Styles ───
    const BUTTON_STYLES = `
        .save-chart-btn {
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 100;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff;
            font-family: 'Cairo', 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
            transition: all 0.25s ease;
            opacity: 0;
            transform: translateY(-4px);
        }
        .save-chart-wrapper:hover .save-chart-btn,
        .save-chart-btn:focus {
            opacity: 1;
            transform: translateY(0);
        }
        .save-chart-btn:hover {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5);
            transform: translateY(-1px) !important;
        }
        .save-chart-btn:active {
            transform: scale(0.97) !important;
        }
        .save-chart-btn.saving {
            background: #64748b;
            cursor: wait;
            pointer-events: none;
        }
        .save-chart-btn svg {
            width: 14px;
            height: 14px;
            fill: currentColor;
        }

        /* ── Save All Floating Button ── */
        .save-all-charts-btn {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 9999;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 22px;
            border: none;
            border-radius: 14px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: #fff;
            font-family: 'Cairo', 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.45);
            transition: all 0.3s ease;
        }
        .save-all-charts-btn:hover {
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
            box-shadow: 0 6px 28px rgba(99, 102, 241, 0.6);
            transform: translateY(-2px);
        }
        .save-all-charts-btn:active {
            transform: scale(0.97);
        }
        .save-all-charts-btn.saving {
            background: #64748b;
            cursor: wait;
            pointer-events: none;
        }
        .save-all-charts-btn svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        .save-all-charts-btn .progress-text {
            font-size: 11px;
            opacity: 0.9;
        }

        @media print {
            .save-chart-btn,
            .save-all-charts-btn {
                display: none !important;
            }
        }
    `;

    // ─── Icons ───
    const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4h14v-2H5v2z"/></svg>`;
    const DOWNLOAD_ALL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2zM7 9l1.41 1.41L11 7.83V16h2V7.83l2.59 2.58L17 9l-5-5-5 5z" transform="rotate(180 12 12)"/></svg>`;
    const SPINNER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".3"/><path d="M20 12h2A10 10 0 0 0 12 2v2a8 8 0 0 1 8 8z"/></svg>`;

    // ─── Inject styles ───
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = BUTTON_STYLES + `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
        document.head.appendChild(style);
    }

    // ─── Load html2canvas dynamically ───
    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) {
                resolve(window.html2canvas);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve(window.html2canvas);
            script.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
        });
    }

    // ─── Trigger download ───
    function downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename + '.png';
        link.href = dataUrl;
        link.click();
    }

    // ─── Generate chart info from nearby heading ───
    function getChartInfo(element, index) {
        const section = element.closest('section') || element.closest('div.section-card') || element.closest('div');
        let title = '';

        if (section) {
            const headings = section.querySelectorAll('h2, h3, h4');
            if (headings.length > 0) {
                let bestHeading = null;
                let bestDistance = Infinity;
                const chartRect = element.getBoundingClientRect();

                headings.forEach(h => {
                    const hRect = h.getBoundingClientRect();
                    if (hRect.top <= chartRect.top) {
                        const distance = chartRect.top - hRect.top;
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            bestHeading = h;
                        }
                    }
                });

                if (!bestHeading && headings.length > 0) {
                    bestHeading = headings[0];
                }

                if (bestHeading) {
                    title = bestHeading.textContent.trim();
                }
            }
        }

        if (!title) {
            let prev = element.previousElementSibling;
            while (prev) {
                if (['H2', 'H3', 'H4'].includes(prev.tagName)) {
                    title = prev.textContent.trim();
                    break;
                }
                prev = prev.previousElementSibling;
            }
        }

        if (!title && element.parentElement && element.parentElement.classList.contains('save-chart-wrapper')) {
            let prev = element.parentElement.previousElementSibling;
            while (prev) {
                if (['H2', 'H3', 'H4'].includes(prev.tagName)) {
                    title = prev.textContent.trim();
                    break;
                }
                prev = prev.previousElementSibling;
            }
        }

        let filename = title || ('مخطط-' + (index + 1));
        filename = filename.replace(/[^\u0600-\u06FFa-zA-Z0-9\s\-]/g, '').trim();
        if (filename.length > 60) filename = filename.substring(0, 60);

        return {
            title: title || ('مخطط ' + (index + 1)),
            filename: filename || ('مخطط-' + (index + 1))
        };
    }

    // ─── Add title bar to a canvas ───
    function addTitleToCanvas(sourceCanvas, titleText) {
        const scaledFontSize = TITLE_FONT_SIZE * SCALE_FACTOR;
        const scaledPadding = TITLE_PADDING * SCALE_FACTOR;
        const titleBarHeight = scaledFontSize + (scaledPadding * 2);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = sourceCanvas.width;
        finalCanvas.height = sourceCanvas.height + titleBarHeight;
        const ctx = finalCanvas.getContext('2d');

        ctx.fillStyle = TITLE_BG_COLOR;
        ctx.fillRect(0, 0, finalCanvas.width, titleBarHeight);

        ctx.fillStyle = TITLE_TEXT_COLOR;
        ctx.font = `bold ${scaledFontSize}px Cairo, Tajawal, "IBM Plex Sans Arabic", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';
        ctx.fillText(titleText, finalCanvas.width / 2, titleBarHeight / 2);

        ctx.drawImage(sourceCanvas, 0, titleBarHeight);

        return finalCanvas;
    }

    // ─── Save a single Mermaid/DOM element as image (returns Promise) ───
    async function saveElementAsImage(element, chartInfo, button) {
        try {
            if (button) {
                button.classList.add('saving');
                button.innerHTML = SPINNER_ICON + ' جاري الحفظ...';
            }

            const h2c = await loadHtml2Canvas();

            const originalOverflow = element.style.overflow;
            element.style.overflow = 'visible';

            const chartCanvas = await h2c(element, {
                scale: SCALE_FACTOR,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight,
            });

            element.style.overflow = originalOverflow;

            const finalCanvas = addTitleToCanvas(chartCanvas, chartInfo.title);
            const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
            downloadImage(dataUrl, chartInfo.filename);

            if (button) {
                button.innerHTML = DOWNLOAD_ICON + ' ✅ تم الحفظ!';
                setTimeout(() => {
                    button.classList.remove('saving');
                    button.innerHTML = DOWNLOAD_ICON + ' حفظ كصورة';
                }, 2000);
            }

            return true;
        } catch (err) {
            console.error('Error saving chart:', err);
            if (button) {
                button.classList.remove('saving');
                button.innerHTML = DOWNLOAD_ICON + ' ❌ خطأ';
                setTimeout(() => {
                    button.innerHTML = DOWNLOAD_ICON + ' حفظ كصورة';
                }, 2000);
            }
            return false;
        }
    }

    // ─── Save a single Chart.js canvas as image (returns Promise) ───
    function saveCanvasAsImage(canvas, chartInfo, button) {
        try {
            if (button) {
                button.classList.add('saving');
                button.innerHTML = SPINNER_ICON + ' جاري الحفظ...';
            }

            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            tempCanvas.width = canvas.width * SCALE_FACTOR;
            tempCanvas.height = canvas.height * SCALE_FACTOR;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

            const finalCanvas = addTitleToCanvas(tempCanvas, chartInfo.title);
            const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
            downloadImage(dataUrl, chartInfo.filename);

            if (button) {
                button.innerHTML = DOWNLOAD_ICON + ' ✅ تم الحفظ!';
                setTimeout(() => {
                    button.classList.remove('saving');
                    button.innerHTML = DOWNLOAD_ICON + ' حفظ كصورة';
                }, 2000);
            }
            return true;
        } catch (err) {
            console.error('Error saving canvas:', err);
            if (button) {
                button.classList.remove('saving');
                button.innerHTML = DOWNLOAD_ICON + ' ❌ خطأ';
                setTimeout(() => {
                    button.innerHTML = DOWNLOAD_ICON + ' حفظ كصورة';
                }, 2000);
            }
            return false;
        }
    }

    // ─── Utility: pause ───
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ─── Save ALL charts sequentially ───
    async function saveAllCharts(allCharts, saveAllBtn) {
        saveAllBtn.classList.add('saving');
        const total = allCharts.length;

        for (let i = 0; i < allCharts.length; i++) {
            const { element, chartInfo, type } = allCharts[i];
            saveAllBtn.innerHTML = SPINNER_ICON + ` <span>جاري الحفظ... <span class="progress-text">(${i + 1}/${total})</span></span>`;

            if (type === 'mermaid') {
                await saveElementAsImage(element, chartInfo, null);
            } else {
                saveCanvasAsImage(element, chartInfo, null);
            }

            // Wait between downloads so browser doesn't block them
            await sleep(SAVE_ALL_DELAY);
        }

        saveAllBtn.innerHTML = DOWNLOAD_ALL_ICON + ` ✅ تم حفظ ${total} مخططات!`;
        setTimeout(() => {
            saveAllBtn.classList.remove('saving');
            saveAllBtn.innerHTML = DOWNLOAD_ALL_ICON + ` حفظ جميع المخططات (${total})`;
        }, 3000);
    }

    // ─── Create single save button ───
    function createSaveButton() {
        const btn = document.createElement('button');
        btn.className = 'save-chart-btn no-print';
        btn.type = 'button';
        btn.innerHTML = DOWNLOAD_ICON + ' حفظ كصورة';
        return btn;
    }

    // ─── Wrap element in a relative container ───
    function wrapInContainer(element) {
        if (element.parentElement && element.parentElement.classList.contains('save-chart-wrapper')) {
            return element.parentElement;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'save-chart-wrapper';
        wrapper.style.position = 'relative';
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
    }

    // ─── Initialize ───
    function init() {
        injectStyles();

        const allCharts = [];

        // ── Mermaid diagrams ──
        const mermaidElements = document.querySelectorAll('.mermaid');
        mermaidElements.forEach((el, i) => {
            const wrapper = wrapInContainer(el);
            const btn = createSaveButton();
            const chartInfo = getChartInfo(el, i);
            btn.addEventListener('click', () => saveElementAsImage(el, chartInfo, btn));
            wrapper.insertBefore(btn, el);
            allCharts.push({ element: el, chartInfo, type: 'mermaid' });
        });

        // ── Chart.js canvases ──
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas, i) => {
            const wrapper = wrapInContainer(canvas);
            const btn = createSaveButton();
            const chartInfo = getChartInfo(canvas, i);
            btn.addEventListener('click', () => saveCanvasAsImage(canvas, chartInfo, btn));
            wrapper.insertBefore(btn, canvas);
            allCharts.push({ element: canvas, chartInfo, type: 'canvas' });
        });

        // ── Save All Button (only if there are 2+ charts) ──
        if (allCharts.length >= 1) {
            const saveAllBtn = document.createElement('button');
            saveAllBtn.className = 'save-all-charts-btn no-print';
            saveAllBtn.type = 'button';
            saveAllBtn.innerHTML = DOWNLOAD_ALL_ICON + ` حفظ جميع المخططات (${allCharts.length})`;
            saveAllBtn.addEventListener('click', () => saveAllCharts(allCharts, saveAllBtn));
            document.body.appendChild(saveAllBtn);
        }
    }

    // Wait for Mermaid to finish rendering
    function waitForMermaidAndInit() {
        if (window.mermaid) {
            const checkInterval = setInterval(() => {
                const mermaidDivs = document.querySelectorAll('.mermaid');
                let allRendered = true;
                mermaidDivs.forEach(div => {
                    if (!div.querySelector('svg') && !div.getAttribute('data-processed')) {
                        allRendered = false;
                    }
                });
                if (allRendered || mermaidDivs.length === 0) {
                    clearInterval(checkInterval);
                    init();
                }
            }, 500);

            setTimeout(() => {
                clearInterval(checkInterval);
                if (!document.querySelector('.save-chart-btn')) {
                    init();
                }
            }, 5000);
        } else {
            init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitForMermaidAndInit, 1000);
        });
    } else {
        setTimeout(waitForMermaidAndInit, 1000);
    }
})();
