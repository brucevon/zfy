(function () {
    // viewport meta
    var meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    document.head.appendChild(meta);

    // 移动端 class 兜底
    (function () {
        var root = document.documentElement;
        function update() {
            root.classList.toggle("mobile-view", window.innerWidth <= 768);
        }
        update();
        setTimeout(update, 500);
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", function () {
            setTimeout(update, 200);
        });
    })();

    var _cfg = window.__BLOG_CONFIG__ || {};
    var HOME_ID = _cfg.homeId || "";
    var KEY = "bento-theme";
    var doc = document.documentElement;
    var themeBtn = document.getElementById("theme-toggle");
    var menuBtn = document.getElementById("menu-toggle");
    var mobileMenu = document.getElementById("mobile-menu");
    var categoryBtn = document.getElementById("category-btn");
    var categoryBtnM = document.getElementById("category-btn-mobile");
    var categoryPanel = document.getElementById("category-panel");
    var bar = document.querySelector(".top-bar");
    var pageEl = document.querySelector(".page");

    /* ── 数据加载工具 ── */
    var cachedData = {};
    function fetchJSON(url) {
        if (cachedData[url]) return Promise.resolve(cachedData[url]);
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error("fetch " + url + " failed: " + r.status);
                return r.json();
            })
            .then(function (data) {
                cachedData[url] = data;
                return data;
            })
            .catch(function (e) {
                console.error(e);
                return null;
            });
    }

    function fmtDate(iso) {
        if (!iso) return "";
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0") + " " +
                String(d.getHours()).padStart(2, "0") + ":" +
                String(d.getMinutes()).padStart(2, "0") + ":" +
                String(d.getSeconds()).padStart(2, "0");
        } catch (e) { return iso; }
    }

    function isEmpty(obj) { return obj === null || obj === undefined || (Array.isArray(obj) && obj.length === 0); }

    /* ── 搜索 ── */
    var searchToggle = document.getElementById("search-toggle");
    var searchDropdown = document.getElementById("search-dropdown");
    var searchInput = document.getElementById("search-input");
    var searchResults = document.getElementById("search-results");
    var searchData = null;
    var searchDataLoading = false;
    var searchOpen = false;

    function ensureSearchData(cb) {
        if (searchData) { if (cb) cb(); return; }
        if (searchDataLoading) { if (cb) setTimeout(function () { ensureSearchData(cb); }, 100); return; }
        searchDataLoading = true;
        fetchJSON("/blog-search").then(function (data) {
            searchData = data || [];
            searchDataLoading = false;
            if (cb) cb();
        });
    }

    function openSearch() {
        if (!searchDropdown || !searchInput) return;
        searchDropdown.classList.add("open");
        searchOpen = true;
        ensureSearchData(function () {
            setTimeout(function () { searchInput.focus(); }, 100);
            renderResults(searchInput.value.trim());
        });
    }

    function closeSearch() {
        if (!searchDropdown || !searchInput) return;
        searchDropdown.classList.remove("open");
        searchOpen = false;
        searchInput.value = "";
        renderResults("");
    }

    function filterSearchData(q) {
        if (!q || !searchData) return [];
        var tokens = q.toLowerCase().split(/\s+/);
        var scored = [];
        for (var i = 0; i < searchData.length; i++) {
            var item = searchData[i];
            var title = (item.title || "").toLowerCase();
            var content = (item.content || "").toLowerCase();
            var score = 0;
            for (var t = 0; t < tokens.length; t++) {
                var token = tokens[t];
                if (!token) continue;
                /* 标题匹配: 基础 10 分 + 频次 bonus (每多一次 +5，上限 +15) */
                var ti = -1, tc = 0;
                while ((ti = title.indexOf(token, ti + 1)) !== -1 && tc < 4) { tc++; }
                if (tc > 0) score += 10 + Math.min(tc - 1, 3) * 5;
                /* 内容匹配: 基础 1 分 + 频次 bonus (每多一次 +0.5，上限 +2) */
                var ci = -1, cc = 0;
                while ((ci = content.indexOf(token, ci + 1)) !== -1 && cc < 6) { cc++; }
                if (cc > 0) score += 1 + Math.min(cc - 1, 4) * 0.5;
            }
            if (score > 0) scored.push({ item: item, s: score });
        }
        scored.sort(function (a, b) { return b.s - a.s; });
        var out = [];
        for (var j = 0; j < Math.min(scored.length, 30); j++) {
            out.push(scored[j].item);
        }
        return out;
    }

    function highlightText(text, tokens) {
        if (!tokens || !tokens.length) return text;
        var parts = [];
        for (var i = 0; i < tokens.length; i++) {
            if (!tokens[i]) continue;
            parts.push(tokens[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        }
        if (!parts.length) return text;
        var re = new RegExp("(" + parts.join("|") + ")", "gi");
        return text.replace(re, "<mark>$1</mark>");
    }

    function renderResults(q) {
        if (!searchResults) return;
        var items = q ? filterSearchData(q) : [];
        if (!q || items.length === 0) {
            searchResults.innerHTML =
                q
                    ? '<div class="search-no-results">未找到匹配的笔记</div>'
                    : '<div class="search-no-results">输入关键词搜索笔记</div>';
            return;
        }
        var tokens = q.toLowerCase().split(/\s+/);
        var html = "";
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var title = (item.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            var titleHl = highlightText(title, tokens);
            var snippet = item.content
                ? highlightText(
                      item.content.substring(0, 120).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
                      tokens
                  )
                : "";
            html +=
                '<a class="search-result-item" href="/' +
                item.noteId +
                '">' +
                '<span class="search-result-title">' +
                titleHl +
                "</span>" +
                (snippet
                    ? '<span class="search-result-content">' + snippet + "</span>"
                    : "") +
                "</a>";
        }
        searchResults.innerHTML = html;
    }

    if (searchToggle) {
        searchToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            if (searchOpen) {
                closeSearch();
            } else {
                closeCategoryPanel();
                closeMobileMenu();
                openSearch();
            }
        });
    }

    if (searchInput) {
        var searchTimer = null;
        searchInput.addEventListener("input", function () {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                renderResults(searchInput.value.trim());
            }, 150);
        });
        searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeSearch();
            if (e.key === "Enter") {
                var first = searchResults && searchResults.querySelector(".search-result-item");
                if (first) {
                    window.location.href = first.getAttribute("href");
                    closeSearch();
                }
            }
        });
    }

    document.addEventListener("click", function (e) {
        if (
            searchOpen &&
            searchDropdown &&
            !searchDropdown.contains(e.target) &&
            searchToggle &&
            !searchToggle.contains(e.target)
        ) {
            closeSearch();
        }
    });

    /* 页面滚动自动关闭搜索 */
    document.addEventListener("scroll", function () {
        if (searchOpen) closeSearch();
    }, { passive: true, capture: true });

    /* ── 当前笔记 ID ── */
    function getCurrentNoteId() {
        var parts = window.location.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
    }
    var isHome = _cfg.isHome || false;

    /* ── 主题 ── */
    function setTheme(m) {
        doc.setAttribute("data-theme", m);
        try {
            localStorage.setItem(KEY, m);
        } catch (_) {}
        /* 同步 Twikoo 主题 */
        var tc = document.getElementById("twikoo-container");
        if (tc) tc.setAttribute("data-theme", m);
        if (themeBtn) themeBtn.textContent = m === "dark" ? "☀" : "☾";
    }
    var saved = (function () {
        try {
            return localStorage.getItem(KEY);
        } catch (_) {
            return null;
        }
    })();
    setTheme(
        saved ||
            _cfg.defaultTheme ||
            (window.matchMedia &&
            window.matchMedia("(prefers-color-scheme:dark)").matches
                ? "dark"
                : "light"),
    );
    if (themeBtn)
        themeBtn.addEventListener("click", function () {
            setTheme(
                doc.getAttribute("data-theme") === "light" ? "dark" : "light",
            );
        });

    /* ── 浮层关闭 ── */
    function closeMobileMenu() {
        if (mobileMenu) mobileMenu.classList.remove("open");
    }
    function closeCategoryPanel() {
        if (categoryPanel) categoryPanel.classList.remove("open");
    }

    /* ── 移动端菜单 ── */
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var opening = !mobileMenu.classList.contains("open");
            mobileMenu.classList.toggle("open");
            if (opening) closeCategoryPanel();
        });
        mobileMenu.querySelectorAll(".nav-item").forEach(function (link) {
            if (link.id !== "about-btn-mobile") {
                link.addEventListener("click", closeMobileMenu);
            }
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeMobileMenu();
        });
    }

    /* ── 点击任意位置 / 滚动 关闭所有浮层 ── */
    document.addEventListener(
        "click",
        function (e) {
            if (mobileMenu && mobileMenu.classList.contains("open")) {
                if (
                    !mobileMenu.contains(e.target) &&
                    menuBtn &&
                    !menuBtn.contains(e.target)
                ) {
                    closeMobileMenu();
                }
            }
            if (categoryPanel && categoryPanel.classList.contains("open")) {
                var inner = document.getElementById("cat-drawer");
                var isInsideContent = inner && inner.contains(e.target);
                var isOnCategoryBtn =
                    (categoryBtn && categoryBtn.contains(e.target)) ||
                    (categoryBtnM && categoryBtnM.contains(e.target));
                if (!isInsideContent && !isOnCategoryBtn) {
                    closeCategoryPanel();
                }
            }
        },
        true,
    );

    document.addEventListener(
        "scroll",
        function () {
            closeMobileMenu();
        },
        { capture: true, passive: true },
    );

    /* ── 分类面板 ── */
    var TREE_JSON_URL = "/blog-tree";
    var treeData = null;
    function openCategoryPanel(e) {
        if (e) { e.preventDefault(); }
        if (!categoryPanel) categoryPanel = document.getElementById("category-panel");
        closeMobileMenu();
        if (categoryPanel) {
            categoryPanel.classList.add("open");
            loadCategoryTree();
            /* 滚动到高亮（当前笔记）位置 */
            var curId = getCurrentNoteId();
            if (curId) {
                var curLink = document.querySelector('#tree-list a[href="/' + curId + '"]');
                if (curLink) {
                    setTimeout(function () {
                        curLink.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 50);
                }
            }
        }
    }

    if (categoryBtn) categoryBtn.addEventListener("click", openCategoryPanel);
    if (categoryBtnM) categoryBtnM.addEventListener("click", openCategoryPanel);
    var closeBtn = document.getElementById("cat-drawer-close");
    if (closeBtn) closeBtn.addEventListener("click", closeCategoryPanel);
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeMobileMenu();
            closeCategoryPanel();
        }
    });

    /* ── 顶部胶囊滚动显隐 ── */
    var THRESHOLD = 10;
    var barVisible = true;
    var lastY = 0;
    var ticking = false;

    if (bar) {
        if (isHome) {
            bar.classList.remove("top-bar--hidden");
            barVisible = true;
        } else {
            bar.classList.remove("top-bar--hidden");
            barVisible = true;
        }
    }

    function setBarVisible(show) {
        if (show === barVisible) return;
        barVisible = show;
        if (bar) bar.classList.toggle("top-bar--hidden", !show);
    }

    function handleScroll(sy) {
        if (isHome) {
            setBarVisible(true);
            return;
        }
        var delta = sy - lastY;
        if (sy <= 5) {
            setBarVisible(true);
        } else if (delta > THRESHOLD) {
            setBarVisible(false);
        } else if (delta < -THRESHOLD) {
            setBarVisible(true);
        }
        lastY = sy;
    }

    document.addEventListener(
        "scroll",
        function (e) {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                var target = e.target;
                var sy =
                    target &&
                    target !== document &&
                    typeof target.scrollTop === "number"
                        ? target.scrollTop
                        : window.scrollY ||
                          document.documentElement.scrollTop ||
                          0;
                handleScroll(sy);
                ticking = false;
            });
        },
        { capture: true, passive: true },
    );

    function bindPage() {
        pageEl = document.querySelector(".page");
        if (!pageEl) return;
        lastY = pageEl.scrollTop;
        pageEl.addEventListener(
            "scroll",
            function () {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(function () {
                    handleScroll(pageEl.scrollTop);
                    ticking = false;
                });
            },
            { passive: true },
        );
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindPage);
    } else {
        bindPage();
    }

    /* ── 运行天数 ── */
    var runEl = document.getElementById("run-days");
    if (runEl) {
        runEl.textContent = Math.max(
            0,
            Math.floor(
                (Date.now() - new Date(_cfg.siteStartDate || "2026-04-10").getTime()) / 86400000,
            ),
        );
    }

    /* ── highlight.js 初始化 ── */
    function initHighlight() {
        if (window.hljs) {
            document.querySelectorAll("pre code").forEach(function (block) {
                hljs.highlightElement(block);
            });
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initHighlight);
    } else {
        initHighlight();
    }

    /* ── 代码块复制按钮 ── */
    function initCopyButtons() {
        document.querySelectorAll(".note-body pre").forEach(function (pre) {
            if (pre.querySelector(".copy-btn")) return;
            var btn = document.createElement("button");
            btn.className = "copy-btn";
            btn.innerHTML =
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            btn.setAttribute("aria-label", "复制代码");
            btn.addEventListener("click", function () {
                var code = pre.querySelector("code");
                var text = code ? code.textContent : pre.textContent;
                navigator.clipboard.writeText(text.trim()).then(function () {
                    btn.innerHTML = "✓";
                    btn.classList.add("copied");
                    setTimeout(function () {
                        btn.innerHTML =
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                        btn.classList.remove("copied");
                    }, 2000);
                });
            });
            pre.style.position = "relative";
            pre.appendChild(btn);
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCopyButtons);
    } else {
        initCopyButtons();
    }

    /* ── 分享按钮 ── */
    function initShareButton() {
        var btn = document.querySelector(".share-btn");
        if (!btn) return;

        function showCopied() {
            btn.classList.add("copied");
            setTimeout(function () { btn.classList.remove("copied"); }, 2000);
        }

        function copyUrl(url) {
            /* Clipboard API */
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(showCopied).catch(function () {
                    execCopy(url);
                });
                return;
            }
            execCopy(url);
        }

        function execCopy(url) {
            /* execCommand fallback (微信等不支持 Clipboard API) */
            try {
                var ta = document.createElement("textarea");
                ta.value = url;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                ta.style.pointerEvents = "none";
                document.body.appendChild(ta);
                ta.select();
                if (document.execCommand("copy")) {
                    showCopied();
                } else {
                    fallbackPrompt(url);
                }
                document.body.removeChild(ta);
            } catch (e) {
                fallbackPrompt(url);
            }
        }

        function fallbackPrompt(url) {
            prompt("复制链接", url);
        }

        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var url = window.location.href;
            var titleEl = document.querySelector(".note-title");
            var title = titleEl ? titleEl.textContent.trim() : document.title;
            /* 移动端: 系统分享面板 */
            if (navigator.share) {
                navigator.share({ title: title, url: url }).catch(function () {});
                return;
            }
            copyUrl(url);
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initShareButton);
    } else {
        initShareButton();
    }

    /* ── 图片灯箱 ── */
    function initLightbox() {
        var body = document.querySelector(".note-body");
        if (!body) return;

        var lb = document.createElement("div");
        lb.className = "lightbox";
        lb.innerHTML =
            '<button class="lightbox-close" aria-label="关闭">&times;</button>' +
            '<img class="lightbox-img" alt="">';
        document.body.appendChild(lb);

        var lbImg = lb.querySelector(".lightbox-img");
        var lbClose = lb.querySelector(".lightbox-close");

        function open(src) {
            lbImg.src = src;
            lb.classList.add("active");
            document.body.style.overflow = "hidden";
        }

        function close() {
            lb.classList.remove("active");
            document.body.style.overflow = "";
        }

        lb.addEventListener("click", function (e) {
            if (e.target === lb) close();
        });
        lbClose.addEventListener("click", close);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") close();
        });

        body.addEventListener("click", function (e) {
            if (e.target.tagName === "IMG" && !e.target.closest("a")) {
                open(e.target.src);
            }
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLightbox);
    } else {
        initLightbox();
    }

    /* ── 阅读进度条 ── */
    function initReadingProgress() {
        var bar = document.getElementById("reading-progress");
        if (!bar) return;
        var ticking = false;
        function calc() {
            var pageEl = document.querySelector(".page");
            var scrollTop, scrollHeight, clientH;
            if (pageEl && pageEl.scrollHeight > pageEl.clientHeight) {
                scrollTop = pageEl.scrollTop;
                scrollHeight = pageEl.scrollHeight;
                clientH = pageEl.clientHeight;
            } else {
                scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                scrollHeight = document.documentElement.scrollHeight;
                clientH = window.innerHeight;
            }
            var pct = scrollHeight > clientH ? scrollTop / (scrollHeight - clientH) : 0;
            bar.style.width = Math.min(pct, 1) * 100 + "%";
            ticking = false;
        }
        function onScroll() { if (!ticking) { requestAnimationFrame(calc); ticking = true; } }
        window.addEventListener("scroll", onScroll, { passive: true });
        var p = document.querySelector(".page");
        if (p) p.addEventListener("scroll", onScroll, { passive: true });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReadingProgress);
    } else {
        initReadingProgress();
    }

    /* ── 字数统计 & 阅读时长 ── */
    function initNoteMeta() {
        var meta = document.querySelector(".note-meta");
        if (!meta) return;
        var body = document.querySelector(".note-body");
        if (!body) return;
        var clone = body.cloneNode(true);
        clone.querySelectorAll("pre").forEach(function (el) { el.remove(); });
        var text = clone.textContent || "";
        var len = text.replace(/\s+/g, "").length;
        var min = Math.max(1, Math.ceil(len / 300));
        meta.textContent = "约 " + len + " 字 · 预计阅读 " + min + " 分钟";
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNoteMeta);
    } else {
        initNoteMeta();
    }

    /* ── 首页模块数据加载 ── */
    /* 预处理脚本输出字段:
       recommend: [{noteId, title, noteIcon, dateCreated, content}]
       article: {noteId, title, noteIcon, dateCreated, content} | null
       recentUpdate: [{noteId, title, noteIcon, dateCreated}]
       announcement: {noteId, title, noteIcon, dateCreated, content} | null
       stats: {article, recommend, recentUpdate, announcement}
       heatmap: [{date, count}]
       tree: [{noteId, title, noteIcon, category, children:[...]}]
       about-tree: [{noteId, title, noteIcon, category, children:[...]}]
    */

    function renderModule(containerId, emptyMsg, renderFn) {
        var el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = '<div class="rec-empty">加载中…</div>';
        return function (data) {
            if (isEmpty(data)) {
                el.innerHTML = '<div class="rec-empty">' + emptyMsg + '</div>';
            } else {
                el.innerHTML = renderFn(data);
            }
        };
    }

    function loadHomeModules() {
        /* 推荐阅读 */
        fetchJSON("/blog-recommend").then(function (data) {
            var render = renderModule("mod-recommend", "暂无推荐", function (items) {
                if (!items || !items.length) return '<div class="rec-empty">暂无推荐</div>';
                var item = items[Math.floor(Math.random() * items.length)];
                var html = "";
                if (item.dateCreated) html += '<time class="rec-date">' + fmtDate(item.dateCreated) + '</time>';
                html += '<h4 class="rec-title">';
                if (item.noteIcon) html += '<i class="' + escapeHtml(item.noteIcon) + ' rec-item-icon"></i> ';
                html += '<a href="/' + item.noteId + '">' + escapeHtml(item.title) + '</a></h4>';
                if (item.content) html += '<p class="rec-summary">' + escapeHtml(item.content) + '</p>';
                return html;
            });
            render(data);
        });

        /* 最近发布 */
        fetchJSON("/blog-article").then(function (data) {
            var render = renderModule("mod-article", "暂无文章", function (item) {
                if (!item) return '<div class="rec-empty">暂无文章</div>';
                var html = "";
                if (item.dateCreated) html += '<time class="rec-date">' + fmtDate(item.dateCreated) + '</time>';
                html += '<h4 class="rec-title">';
                if (item.noteIcon) html += '<i class="' + escapeHtml(item.noteIcon) + ' rec-item-icon"></i> ';
                html += '<a href="/' + item.noteId + '">' + escapeHtml(item.title) + '</a></h4>';
                if (item.content) html += '<p class="rec-summary">' + escapeHtml(item.content) + '</p>';
                return html;
            });
            render(data);
        });

        /* 最近动态 */
        fetchJSON("/blog-recentUpdate").then(function (data) {
            var el = document.getElementById("mod-updates");
            if (!el) return;
            if (isEmpty(data)) {
                el.innerHTML = '<div class="rec-empty">暂无动态</div>';
                return;
            }
            var html = "";
            for (var i = 0; i < data.length; i++) {
                var u = data[i];
                html += '<div class="rec-upd-item">';
                if (u.noteIcon) html += '<i class="' + escapeHtml(u.noteIcon) + ' upd-item-icon"></i> ';
                html += '<time class="rec-date">' + fmtDate(u.dateCreated) + '</time>';
                html += '<h4 class="rec-title"><a href="/' + u.noteId + '">' + escapeHtml(u.title) + '</a></h4>';
                html += '</div>';
            }
            el.innerHTML = html;
        });

        /* 公告 */
        fetchJSON("/blog-announcement").then(function (data) {
            var render = renderModule("mod-announcement", "暂无公告", function (item) {
                if (!item) return '<div class="rec-empty">暂无公告</div>';
                var html = "";
                if (item.dateCreated) html += '<time class="rec-date">' + fmtDate(item.dateCreated) + '</time>';
                html += '<h4 class="rec-title">';
                if (item.noteIcon) html += '<i class="' + escapeHtml(item.noteIcon) + ' rec-item-icon"></i> ';
                html += '<a href="/' + item.noteId + '">' + escapeHtml(item.title) + '</a></h4>';
                if (item.content) html += '<p class="rec-summary">' + escapeHtml(item.content) + '</p>';
                return html;
            });
            render(data);
        });

        /* 统计 */
        fetchJSON("/blog-stats").then(function (data) {
            if (!data) return;
            var m = function (id) { return document.getElementById(id); };
            if (data.recommend !== undefined && m("stat-recommend")) m("stat-recommend").textContent = data.recommend;
            if (data.article !== undefined && m("stat-article")) m("stat-article").textContent = data.article;
            if (data.recentUpdate !== undefined && m("stat-recentUpdate")) m("stat-recentUpdate").textContent = data.recentUpdate;
            if (data.announcement !== undefined && m("stat-announcement")) m("stat-announcement").textContent = data.announcement;
        });

        /* 热力图 */
        fetchJSON("/blog-heatmap").then(function (data) {
            renderHeatmap(data || []);
        });
    }

    /* ── 热力图网格渲染 ── */
    function renderHeatmap(dateFreqArr) {
        var grid = document.getElementById("heatmap-grid");
        if (!grid) return;

        var dateFreq = {};
        var hmMax = 1;
        for (var i = 0; i < dateFreqArr.length; i++) {
            dateFreq[dateFreqArr[i].date] = parseInt(dateFreqArr[i].count, 10) || 0;
            if (dateFreq[dateFreqArr[i].date] > hmMax) hmMax = dateFreq[dateFreqArr[i].date];
        }

        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var start = new Date(now);
        start.setDate(start.getDate() - 363);
        while (start.getDay() !== 1) { start.setDate(start.getDate() - 1); }

        var cur = new Date(start);
        var prevMonth = -1;
        var hmWeeks = [];
        var hmMonths = [];

        while (cur <= now) {
            if (cur.getMonth() !== prevMonth) {
                if (prevMonth !== -1) {
                    hmMonths.push({ label: (prevMonth + 1) + "月", start: monthStart, span: hmWeeks.length - monthStart });
                }
                prevMonth = cur.getMonth();
                var monthStart = hmWeeks.length;
            }
            var week = [];
            for (var d = 0; d < 7; d++) {
                var key = cur.getFullYear() + "-" + String(cur.getMonth()+1).padStart(2,"0") + "-" + String(cur.getDate()).padStart(2,"0");
                week.push({ date: key, count: dateFreq[key] || 0, future: cur > now });
                cur.setDate(cur.getDate() + 1);
            }
            hmWeeks.push(week);
        }
        if (prevMonth !== -1) {
            hmMonths.push({ label: (prevMonth + 1) + "月", start: monthStart, span: hmWeeks.length - monthStart });
        }

        for (var wi = 0; wi < hmWeeks.length; wi++) {
            for (var di = 0; di < 7; di++) {
                if (hmWeeks[wi][di].count > hmMax) hmMax = hmWeeks[wi][di].count;
            }
        }

        var cols = hmWeeks.length;
        grid.style.gridTemplateColumns = "28px repeat(" + cols + ", 13px)";
        grid.style.gridTemplateRows = "18px repeat(7, 13px)";

        var html = "";
        for (var mi = 0; mi < hmMonths.length; mi++) {
            var m = hmMonths[mi];
            html += '<div class="hm-month" style="grid-column: ' + (2 + m.start) + ' / span ' + m.span + '; grid-row: 1">' + escapeHtml(m.label) + '</div>';
        }

        var wdays = ["一","二","三","四","五","六","日"];
        for (var di = 0; di < 7; di++) {
            html += '<div class="hm-wday" style="grid-column: 1; grid-row: ' + (di + 2) + '">' + wdays[di] + '</div>';
            for (var wi = 0; wi < hmWeeks.length; wi++) {
                var cell = hmWeeks[wi][di];
                var level = 0;
                if (cell.count > 0) { level = Math.ceil((cell.count / hmMax) * 4); if (level < 1) level = 1; if (level > 4) level = 4; }
                var cls = cell.future ? 'hm-future' : 'hm-cell hm-l' + level;
                html += '<div class="' + cls + '" style="grid-column: ' + (wi + 2) + '; grid-row: ' + (di + 2) + '" data-date="' + cell.date + '" data-count="' + cell.count + '"></div>';
            }
        }

        grid.innerHTML = html;

        /* 移动端默认滚动到最右侧 */
        if (window.innerWidth <= 768) {
            var wrap = document.querySelector(".hm-wrap");
            if (wrap) wrap.scrollLeft = wrap.scrollWidth - wrap.clientWidth;
        }
    }

    /* ── 加载分类树（fetch /blog-tree） ── */
    function loadCategoryTree() {
        var treeList = document.getElementById("tree-list");
        if (!treeList) return;
        if (treeData) {
            renderTree(treeData, treeList, getCurrentNoteId());
            return;
        }
        treeList.innerHTML = '<li class="tree-item" style="padding:8px;color:var(--text-muted)">加载中…</li>';
        fetchJSON(TREE_JSON_URL).then(function (data) {
            if (data && data.length) {
                treeData = data;
                renderTree(treeData, treeList, getCurrentNoteId());
            } else {
                treeList.innerHTML = '<li class="tree-item"><span class="tag-chip">暂无分类</span></li>';
            }
        });
    }

    function renderTree(items, container, currentId) {
        container.innerHTML = "";
        var found = false;
        items.forEach(function (item) {
            var li = document.createElement("li");
            li.className = "tree-item";
            var node = document.createElement("div");
            node.className = "tree-node";
            var hasKids = item.children && item.children.length > 0;

            var toggle = document.createElement("span");
            toggle.className =
                "tree-toggle" + (hasKids ? "" : " tree-toggle--empty");
            toggle.textContent = "▶";
            if (hasKids) toggle.addEventListener("click", toggleTree);

            var titleEl;
            var iconCls = item.noteIcon || item.icon || "";
            if (item.category === true) {
                titleEl = document.createElement("span");
                titleEl.className = "tag-chip tag-chip--category";
                titleEl.style.cursor = "pointer";
                titleEl.addEventListener("click", function (e) {
                    e.stopPropagation();
                    toggleTree({
                        currentTarget: toggle,
                        preventDefault: function () {},
                        stopPropagation: function () {},
                    });
                });
            } else {
                titleEl = document.createElement("a");
                titleEl.href = "/" + item.noteId;
                titleEl.className = "tag-chip";
                titleEl.addEventListener("click", closeCategoryPanel);
            }
            if (iconCls) {
                var iconEl = document.createElement("i");
                iconEl.className = iconCls;
                titleEl.appendChild(iconEl);
                titleEl.appendChild(document.createTextNode(" " + item.title));
            } else {
                titleEl.textContent = item.title;
            }

            if (item.noteId === currentId) {
                titleEl.style.fontWeight = "bold";
                titleEl.style.color = "var(--accent, #3b82f6)";
                found = true;
            }

            node.appendChild(toggle);
            node.appendChild(titleEl);
            li.appendChild(node);

            if (hasKids) {
                var ul = document.createElement("ul");
                ul.className = "tree-children";
                ul.style.display = "none";
                var childFound = renderTree(item.children, ul, currentId);
                if (childFound) {
                    ul.style.display = "block";
                    toggle.classList.add("expanded");
                    toggle.textContent = "▼";
                    found = true;
                }
                li.appendChild(ul);
            }
            container.appendChild(li);
        });
        return found;
    }

    function toggleTree(e) {
        e.preventDefault();
        e.stopPropagation();
        var toggle = e.currentTarget;
        var item = toggle.closest(".tree-item");
        var kids = item.querySelector(":scope > .tree-children");
        if (!kids) return;
        var open = kids.style.display !== "none" && kids.style.display !== "";
        kids.style.display = open ? "none" : "block";
        toggle.textContent = open ? "▶" : "▼";
        toggle.classList.toggle("expanded", !open);
    }

    /* ── "关于"下拉菜单（fetch /blog-about-tree） ── */
    var aboutBtn = document.getElementById("about-btn");
    var aboutDropdown = document.getElementById("about-dropdown");
    var aboutMenu = document.getElementById("about-menu");
    var aboutData = null;

    function ensureAboutData(cb) {
        if (aboutData) { if (cb) cb(); return; }
        fetchJSON("/blog-about-tree").then(function (data) {
            aboutData = data || [];
            if (cb) cb();
        });
    }

    function renderAboutMenu(items, container) {
        if (!items || !items.length) {
            container.innerHTML =
                '<li class="tree-item"><span class="tag-chip">暂无内容</span></li>';
            return;
        }
        items.forEach(function (item) {
            var li = document.createElement("li");
            li.className = "tree-item";
            var node = document.createElement("div");
            node.className = "tree-node";
            var hasKids = item.children && item.children.length > 0;

            var toggle = document.createElement("span");
            toggle.className =
                "tree-toggle" + (hasKids ? "" : " tree-toggle--empty");
            toggle.textContent = "▶";
            if (hasKids)
                toggle.addEventListener("click", toggleAboutSub);

            var titleEl;
            var iconCls = item.noteIcon || item.icon || "";
            if (item.category === true) {
                titleEl = document.createElement("span");
                titleEl.className = "tag-chip tag-chip--category";
                titleEl.style.cursor = "pointer";
                titleEl.addEventListener("click", function (e) {
                    e.stopPropagation();
                    toggleAboutSub({
                        currentTarget: toggle,
                        preventDefault: function () {},
                        stopPropagation: function () {},
                    });
                });
            } else {
                titleEl = document.createElement("a");
                titleEl.href = "/" + item.noteId;
                titleEl.className = "tag-chip";
            }
            if (iconCls) {
                var iconEl = document.createElement("i");
                iconEl.className = iconCls;
                titleEl.appendChild(iconEl);
                titleEl.appendChild(
                    document.createTextNode(" " + item.title)
                );
            } else {
                titleEl.textContent = item.title;
            }

            node.appendChild(toggle);
            node.appendChild(titleEl);
            li.appendChild(node);

            if (hasKids) {
                var ul = document.createElement("ul");
                ul.className = "tree-children";
                ul.style.display = "none";
                renderAboutMenu(item.children, ul);
                li.appendChild(ul);
            }
            container.appendChild(li);
        });
    }

    function toggleAboutSub(e) {
        e.preventDefault();
        e.stopPropagation();
        var toggle = e.currentTarget;
        var item = toggle.closest(".tree-item");
        var kids = item.querySelector(":scope > .tree-children");
        if (!kids) return;
        var open =
            kids.style.display !== "none" && kids.style.display !== "";
        kids.style.display = open ? "none" : "block";
        toggle.textContent = open ? "▶" : "▼";
        toggle.classList.toggle("expanded", !open);
    }

    function closeAboutDropdown() {
        if (aboutDropdown) aboutDropdown.classList.remove("open");
    }

    function toggleAboutDropdown(e) {
        if (e) e.preventDefault();
        if (!aboutDropdown) return;
        var open = aboutDropdown.classList.contains("open");
        if (open) {
            closeAboutDropdown();
        } else {
            if (aboutMenu) {
                aboutMenu.innerHTML = '<li class="tree-item" style="padding:8px;color:var(--text-muted)">加载中…</li>';
            }
            ensureAboutData(function () {
                if (aboutMenu) {
                    aboutMenu.innerHTML = "";
                    renderAboutMenu(aboutData, aboutMenu);
                }
            });
            aboutDropdown.classList.add("open");
        }
    }

    if (aboutBtn) aboutBtn.addEventListener("click", toggleAboutDropdown);
    document.addEventListener(
        "click",
        function (e) {
            var wrap = document.getElementById("about-wrap");
            if (
                aboutDropdown &&
                aboutDropdown.classList.contains("open") &&
                wrap &&
                !wrap.contains(e.target)
            ) {
                closeAboutDropdown();
            }
        },
        true,
    );

    /* ── 移动端"关于"下拉 ── */
    var aboutBtnM = document.getElementById("about-btn-mobile");
    var aboutDropdownM = document.getElementById("about-dropdown-mobile");
    var aboutMenuM = document.getElementById("about-menu-mobile");

    function toggleAboutMobile(e) {
        if (e) e.preventDefault();
        if (!aboutDropdownM) return;
        var open = aboutDropdownM.classList.contains("open");
        if (open) {
            aboutDropdownM.classList.remove("open");
        } else {
            if (aboutMenuM) {
                aboutMenuM.innerHTML = '<li class="tree-item" style="padding:8px;color:var(--text-muted)">加载中…</li>';
            }
            ensureAboutData(function () {
                if (aboutMenuM) {
                    aboutMenuM.innerHTML = "";
                    renderAboutMenu(aboutData, aboutMenuM);
                }
            });
            aboutDropdownM.classList.add("open");
        }
    }

    if (aboutBtnM) aboutBtnM.addEventListener("click", toggleAboutMobile);

    /* ── 内容大纲 TOC ── */
    function initToc() {
        if (isHome) return;
        var noteBody = document.querySelector(".note-body");
        var tocBody = document.getElementById("toc-body");
        if (!noteBody || !tocBody) return;

        var headings = noteBody.querySelectorAll("h1, h2, h3");
        if (headings.length < 2) return;

        var tocId = 0;
        var items = [];

        headings.forEach(function (h) {
            if (!h.id) {
                h.id = "toc-" + ++tocId;
            }
            var tag = h.tagName.toLowerCase();
            var level = tag === "h1" ? 1 : tag === "h2" ? 2 : 3;
            items.push({
                id: h.id,
                text: h.textContent.trim(),
                level: level,
                el: h,
            });
        });

        if (items.length === 0) return;

        var html = "";
        items.forEach(function (item) {
            var cls = "toc-link";
            if (item.level === 2) cls += " toc-link--h2";
            else if (item.level === 3) cls += " toc-link--h3";
            html +=
                '<a class="' +
                cls +
                '" href="#' +
                item.id +
                '" data-toc-id="' +
                item.id +
                '">' +
                escapeHtml(item.text) +
                "</a>";
        });
        tocBody.innerHTML = html;

        tocBody.addEventListener("click", function (e) {
            var link = e.target.closest(".toc-link");
            if (!link) return;
            e.preventDefault();
            var targetId = link.getAttribute("data-toc-id");
            var targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
                history.replaceState(null, "", "#" + targetId);
            }
        });

        function updateActive() {
            var scrollY =
                window.scrollY || document.documentElement.scrollTop || 0;
            var activeId = null;
            var viewportMid = scrollY + window.innerHeight / 2;

            for (var i = items.length - 1; i >= 0; i--) {
                var el = items[i].el;
                if (!el) continue;
                var rect = el.getBoundingClientRect();
                var elMid = rect.top + window.scrollY + rect.height / 2;
                if (elMid < viewportMid) {
                    activeId = items[i].id;
                    break;
                }
            }

            if (!activeId && items.length > 0) {
                activeId = items[0].id;
            }

            tocBody.querySelectorAll(".toc-link.active").forEach(function (a) {
                a.classList.remove("active");
            });
            if (activeId) {
                var activeLink = tocBody.querySelector(
                    '[data-toc-id="' + activeId + '"]',
                );
                if (activeLink) activeLink.classList.add("active");
            }
        }

        updateActive();
        document.addEventListener(
            "scroll",
            function () {
                requestAnimationFrame(updateActive);
            },
            { passive: true },
        );
    }

    /* ── TOC 移动端浮层 ── */
    function initTocMobile() {
        if (isHome) return;
        var toc = document.getElementById("toc");
        if (!toc) return;

        var btn = document.createElement("button");
        btn.className = "toc-mobile-btn";
        btn.id = "toc-mobile-btn";
        btn.textContent = "☰";
        btn.setAttribute("aria-label", "打开目录");
        document.body.appendChild(btn);

        var overlay = document.createElement("div");
        overlay.className = "toc-overlay";
        overlay.id = "toc-overlay";
        document.body.appendChild(overlay);

        function openTocMobile() {
            toc.classList.add("open");
            overlay.classList.add("open");
        }

        function closeTocMobile() {
            toc.classList.remove("open");
            overlay.classList.remove("open");
        }

        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            if (toc.classList.contains("open")) {
                closeTocMobile();
            } else {
                openTocMobile();
            }
        });

        overlay.addEventListener("click", closeTocMobile);

        toc.querySelectorAll(".toc-link").forEach(function (link) {
            link.addEventListener("click", closeTocMobile);
        });
    }

    /* ── 回到顶部 ── */
    function initBackTop() {
        var btn = document.createElement("button");
        btn.id = "back-top";
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
        btn.setAttribute("aria-label", "回到顶部");
        document.body.appendChild(btn);

        var pageEl = document.querySelector(".page");
        var ticking = false;

        function calc() {
            var scrollTop, clientH;
            if (pageEl && pageEl.scrollHeight > pageEl.clientHeight) {
                scrollTop = pageEl.scrollTop;
                clientH = pageEl.clientHeight;
            } else {
                scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                clientH = window.innerHeight;
            }
            btn.classList.toggle("visible", scrollTop > clientH);
            ticking = false;
        }
        function onScroll() { if (!ticking) { requestAnimationFrame(calc); ticking = true; } }

        btn.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (pageEl) pageEl.scrollTo({ top: 0, behavior: "smooth" });
        });

        window.addEventListener("scroll", onScroll, { passive: true });
        if (pageEl) pageEl.addEventListener("scroll", onScroll, { passive: true });
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    /* ── 初始化 ── */
    function init() {
        initToc();
        initTocMobile();
        initBackTop();
        /* 静默预加载搜索数据 */
        ensureSearchData();
        if (isHome) {
            loadHomeModules();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* ── Trilium Internal Links 处理 ── */
    function processInternalLinks() {
        var iconMap = {};
        if (treeData) {
            function walkTree(arr) {
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i].icon || arr[i].noteIcon) iconMap[arr[i].noteId] = arr[i].icon || arr[i].noteIcon;
                    if (arr[i].children) walkTree(arr[i].children);
                }
            }
            walkTree(treeData);
        }
        var noteLinks = document.querySelectorAll('.note-body a[href^="note://"]');
        noteLinks.forEach(function (link) {
            var href = link.getAttribute("href") || "";
            var noteId = href.replace("note://", "").split(/[?#]/)[0];
            if (noteId) {
                link.href = "/" + noteId;
                link.classList.add("trilium-ref-link");
                if (iconMap[noteId]) {
                    link.setAttribute("data-icon", iconMap[noteId]);
                }
            }
        });
        var refLinks = document.querySelectorAll('.note-body a.reference-link');
        refLinks.forEach(function (link) {
            if (!link.id) link.id = "ref-" + Math.random().toString(36).slice(2, 8);
            link.classList.add("trilium-ref-link");
            var href = link.getAttribute("href") || "";
            var noteId = href.replace(/^note:\/\//, "").split(/[?#]/)[0];
            if (noteId && iconMap[noteId]) {
                link.setAttribute("data-icon", iconMap[noteId]);
            }
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", processInternalLinks);
    } else {
        processInternalLinks();
    }
})();
