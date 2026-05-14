(function () {
    'use strict';

    var CONFIG = {
        FETCH_TIMEOUT: 5000,
        STATS_ID: 's2UQkJmTfouM',
        RECENT_ID: 'home-recent',
        SHUOSHUO_ID: 'home-shuoshuo',
        RECOMMEND_ID: 'home-recommend',
        QUOTE_ID: 'home-quote'
    };

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (!str) return '';
        var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, function (c) { return m[c] || c; });
    }

    function fetchWithTimeout(url, timeout) {
        return new Promise(function (resolve, reject) {
            var controller = new AbortController();
            var timer = setTimeout(function () {
                controller.abort();
                reject(new Error('timeout'));
            }, timeout || CONFIG.FETCH_TIMEOUT);
            fetch(url, { signal: controller.signal })
                .then(function (r) { clearTimeout(timer); resolve(r); })
                .catch(function (e) { clearTimeout(timer); reject(e); });
        });
    }

    function showError(el, msg) {
        el.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem">' + (msg || '加载失败') + '</p>';
    }

    function loadRecent() {
        var el = $('recent-posts');
        if (!el) return;
        fetchWithTimeout('./' + CONFIG.RECENT_ID)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                if (!data || !data.length) { showError(el, '暂无文章'); return; }
                var html = '<ul class="post-list">';
                data.forEach(function (item) {
                    html += '<li><a href="./' + encodeURIComponent(item.id) + '">' + escapeHtml(item.title) + '</a><span class="post-date">' + escapeHtml(item.date) + '</span></li>';
                });
                html += '</ul>';
                el.innerHTML = html;
            })
            .catch(function (err) { console.warn('文章加载失败:', err); showError(el); });
    }

    function loadShuoshuo() {
        var el = $('shuoshuo-list');
        if (!el) return;
        fetchWithTimeout('./' + CONFIG.SHUOSHUO_ID)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                if (!data || !data.length) { showError(el, '暂无说说'); return; }
                var html = '';
                data.forEach(function (item) {
                    html += '<div class="thought-item"><p class="thought-text">' + escapeHtml(item.summary || item.title) + '</p><span class="thought-date">' + escapeHtml(item.date) + '</span></div>';
                });
                el.innerHTML = html;
            })
            .catch(function (err) { console.warn('说说加载失败:', err); showError(el); });
    }

    function loadQuote() {
        var el = $('quote-text');
        if (!el) return;
        fetchWithTimeout('./' + CONFIG.QUOTE_ID)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (html) {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');
                var contentDiv = doc.getElementById('content');
                if (contentDiv) {
                    var text = contentDiv.textContent || '';
                    text = text.replace(/^(首页寄语|子非鱼的数字空间)/, '').trim();
                    if (text) {
                        el.innerHTML = '<blockquote class="quote-block">' + escapeHtml(text) + '</blockquote>';
                        return;
                    }
                }
                el.innerHTML = '<blockquote class="quote-block">流水不腐，户枢不蠹。</blockquote>';
            })
            .catch(function (err) {
                console.warn('寄语加载失败:', err);
                el.innerHTML = '<blockquote class="quote-block">流水不腐，户枢不蠹。</blockquote>';
            });
    }

    function loadStats() {
        var el = $('stats-summary');
        if (!el) return;
        fetchWithTimeout('./' + CONFIG.STATS_ID)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var s = data.stats || {};
                var html = '<div class="stat-grid">' +
                    '<div class="stat-item"><span class="stat-num">' + (s.article || 0) + '</span><span class="stat-label">文章</span></div>' +
                    '<div class="stat-item"><span class="stat-num">' + (s.shuoshuo || 0) + '</span><span class="stat-label">说说</span></div>' +
                    '<div class="stat-item"><span class="stat-num">' + (s.recommend || 0) + '</span><span class="stat-label">推荐</span></div>' +
                    '<div class="stat-item"><span class="stat-num">' + (s.announcement || 0) + '</span><span class="stat-label">公告</span></div>' +
                    '</div>';
                var start = new Date('2026-04-11');
                var days = Math.floor((Date.now() - start.getTime()) / 86400000);
                html += '<p class="stat-days">已运行 ' + days + ' 天</p>';
                el.innerHTML = html;
            })
            .catch(function (err) { console.warn('统计加载失败:', err); showError(el); });
    }

    function init() {
        var statusEl = $('live-status');
        if (statusEl) {
            statusEl.textContent = 'Live';
            statusEl.style.background = '#22c55e';
        }
        var timeEl = $('time');
        if (timeEl) {
            timeEl.textContent = new Date().toLocaleString('zh-CN');
        }

        loadRecent();
        loadShuoshuo();
        loadQuote();
        loadStats();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
