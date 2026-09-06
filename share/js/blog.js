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
    var pageEl = document.querySelector(".page");

    /* ── 页面数据全部由模板服务端实时注入（window.__SSR_*__），不再 fetch /blog-data / /blog-search 快照 ── */
    /* ── 通用一次性加载器：缓存命中即回掉，否则排队并在加载完成后统一回调 ── */
    function makeLoader(isLoaded, load) {
        var loading = false;
        var callbacks = [];
        return function ensure(cb) {
            if (isLoaded()) { if (cb) cb(); return; }
            if (cb) callbacks.push(cb);
            if (loading) return;
            loading = true;
            load().then(function () {
                loading = false;
                var cbs = callbacks; callbacks = [];
                cbs.forEach(function (fn) { fn(); });
            });
        };
    }

    /* shareAlias → noteId（别名 URL 反查）；noteId → 分类祖先链（面包屑）。均由 SSR 搜索索引构建 */
    var noteAliasMap = {};
    var categoryPathMap = {};
    (function () {
        var _search = window.__SSR_SEARCH__ || [];
        for (var _i = 0; _i < _search.length; _i++) {
            var _s = _search[_i];
            if (_s.shareAlias) noteAliasMap[_s.shareAlias] = _s.noteId;
            categoryPathMap[_s.noteId] = _s.cat || [];
        }
    })();

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

    /** 格式化为 YYYY-MM-DD（仅日期，用于 meta 行） */
    function fmtDateOnly(iso) {
        if (!iso) return "";
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0");
        } catch (e) { return iso; }
    }

    function isEmpty(obj) { return obj === null || obj === undefined || (Array.isArray(obj) && obj.length === 0); }

    /** 获取笔记的跳转地址：优先使用 shareAlias，否则使用 noteId */
    function noteUrl(item) {
        if (item.shareExternalLink) return item.shareExternalLink;
        return '/' + (item.shareAlias || item.noteId);
    }

    /* ── 统一滚动管理器（一次 rAF，共享滚动位置） ── */
    var _scrollHandlers = [];
    var _scrollTicking = false;
    var _cachedScrollY = -1;

    /** 获取当前滚动位置（单帧内缓存，避免重复计算） */
    function getScrollY() {
        if (_cachedScrollY >= 0) return _cachedScrollY;
        _cachedScrollY = Math.max(
            window.scrollY || 0,
            document.documentElement.scrollTop || 0,
            document.body.scrollTop || 0,
            pageEl ? (pageEl.scrollTop || 0) : 0
        );
        return _cachedScrollY;
    }

    /** 注册滚动回调，回调接收当前滚动位置参数 */
    function onScroll(fn) { _scrollHandlers.push(fn); }

    function _onScrollDispatch() {
        _cachedScrollY = -1;   // 重置缓存
        var y = getScrollY();
        for (var i = 0; i < _scrollHandlers.length; i++) _scrollHandlers[i](y);
        _scrollTicking = false;
    }

    window.addEventListener("scroll", function () {
        if (!_scrollTicking) { _scrollTicking = true; requestAnimationFrame(_onScrollDispatch); }
    }, { passive: true });
    if (pageEl) pageEl.addEventListener("scroll", function () {
        if (!_scrollTicking) { _scrollTicking = true; requestAnimationFrame(_onScrollDispatch); }
    }, { passive: true });

    function animateCount(el, target) {
        if (!el || target === undefined || target === null) return;
        target = parseInt(target, 10) || 0;
        var start = 0;
        var duration = 800;
        var step = Math.max(1, Math.ceil(target / (duration / 16)));
        var timer = setInterval(function () {
            start += step;
            if (start >= target) {
                el.textContent = target;
                clearInterval(timer);
            } else {
                el.textContent = start;
            }
        }, 16);
    }

    /* ── 搜索 ── */
    var searchToggle = document.getElementById("search-toggle");
    var searchDropdown = document.getElementById("search-dropdown");
    var searchInput = document.getElementById("search-input");
    var searchResults = document.getElementById("search-results");
    var searchData = null;
    var searchOpen = false;

    /* 标题索引已由模板内嵌（window.__SSR_SEARCH__），低于配时用枢纽笔记兜底，无需 /blog-search 快照 */
    var ensureSearchData = makeLoader(
        function () { return !!searchData; },
        function () {
            searchData = (window.__SSR_SEARCH__ && window.__SSR_SEARCH__.length)
                ? window.__SSR_SEARCH__
                : (window.__SSR_HUB__ || []);
            return Promise.resolve();
        }
    );

    function openSearch() {
        if (!searchDropdown || !searchInput) return;
        searchDropdown.classList.add("open");
        searchOpen = true;
        searchInput.focus();
        ensureSearchData(function () {
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
                /* 正文匹配: 基础 3 分 + 频次 bonus (每多一次 +2，上限 +6)，权重低于标题 */
                var ci = -1, cc = 0;
                while ((ci = content.indexOf(token, ci + 1)) !== -1 && cc < 4) { cc++; }
                if (cc > 0) score += 3 + Math.min(cc - 1, 3) * 2;
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
        /* 标题索引已内嵌（window.__SSR_SEARCH__），不再依赖 /blog-data / /blog-search */
        if (!searchData) {
            var tries = 0;
            ensureSearchData();
            (function check() {
                if (searchData) { renderResults(q); return; }
                if (tries++ < 60) setTimeout(check, 80);
            })();
            return;
        }
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
            /* 面包屑：优先使用标题索引里内嵌的分类路径 */
            var path = item.cat || categoryPathMap[item.noteId] || [];
            var crumb = "";
            if (path.length) {
                crumb = '<span class="search-result-crumb">';
                for (var b = 0; b < path.length; b++) {
                    if (b > 0) crumb += '<i class="search-crumb-sep">/</i>';
                    crumb += '<span class="search-crumb-item">' + escapeHtml(path[b].title) + '</span>';
                }
                crumb += '</span>';
            }
            /* 正文摘要：命中内容时在标题下方展示，关键词高亮 */
            var contentHl = "";
            if (item.content) {
                var escContent = escapeHtml(item.content);
                contentHl = highlightText(escContent, tokens);
                contentHl = '<span class="search-result-content">' + contentHl + "</span>";
            }
            html +=
                '<a class="search-result-item" href="' +
                noteUrl(item) +
                '">' +
                crumb +
                '<span class="search-result-title"' +
                (item.color ? ' style="color:' + escapeHtml(item.color) + '"' : "") +
                ">" +
                (item.noteIcon
                    ? '<i class="' + escapeHtml(item.noteIcon) + '"></i> '
                    : "") +
                titleHl +
                "</span>" +
                contentHl +
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
        var searchHighlightIdx = -1;

        function updateSearchHighlight() {
            if (!searchResults) return;
            var items = searchResults.querySelectorAll(".search-result-item");
            items.forEach(function (el, i) {
                el.classList.toggle("highlighted", i === searchHighlightIdx);
            });
            if (searchHighlightIdx >= 0 && items[searchHighlightIdx]) {
                items[searchHighlightIdx].scrollIntoView({ block: "nearest" });
            }
        }

        searchInput.addEventListener("input", function () {
            searchHighlightIdx = -1;
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                renderResults(searchInput.value.trim());
            }, 150);
        });
        searchInput.addEventListener("keydown", function (e) {
            var items = searchResults ? searchResults.querySelectorAll(".search-result-item") : [];
            if (e.key === "Escape") { closeSearch(); return; }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                searchHighlightIdx = Math.min(searchHighlightIdx + 1, items.length - 1);
                updateSearchHighlight();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                searchHighlightIdx = Math.max(searchHighlightIdx - 1, -1);
                updateSearchHighlight();
            } else if (e.key === "Enter") {
                var target = searchHighlightIdx >= 0 ? items[searchHighlightIdx] : items[0];
                if (target) {
                    window.location.href = target.getAttribute("href");
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

    /* 页面滚动自动关闭搜索（排除搜索框内部滚动） */
    document.addEventListener("scroll", function (e) {
        if (!searchOpen) return;
        if (searchDropdown && searchDropdown.contains(e.target)) return;
        closeSearch();
    }, { passive: true, capture: true });

    /* ── 当前笔记 ID ── */
    function getCurrentNoteId() {
        var parts = window.location.pathname.split("/").filter(Boolean);
        var raw = parts[parts.length - 1] || "";
        return noteAliasMap[raw] || raw;
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
    function setMenuScrollLock(locked) {
        if (document.body) document.body.classList.toggle("menu-open", !!locked);
    }
    function closeMobileMenu() {
        if (mobileMenu) mobileMenu.classList.remove("open");
        setMenuScrollLock(false);
    }
    function closeCategoryPanel() {
        if (categoryPanel) categoryPanel.classList.remove("open");
        var cb = document.getElementById("category-btn");
        var cbm = document.getElementById("category-btn-mobile");
        if (cb) cb.setAttribute("aria-expanded", "false");
        if (cbm) cbm.setAttribute("aria-expanded", "false");
        setMenuScrollLock(false);
    }

    /* ── 移动端菜单 ── */
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var opening = !mobileMenu.classList.contains("open");
            mobileMenu.classList.toggle("open");
            if (opening) {
                closeCategoryPanel();
                setMenuScrollLock(true);
            } else {
                setMenuScrollLock(false);
            }
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
                var inner = document.getElementById("cat-mega");
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

    /* 菜单内部触摸跟踪：菜单内触摸滚动时不关闭面板 */
    var _catMenuInteracting = false;
    document.addEventListener("touchstart", function (e) {
        var inner = document.getElementById("cat-mega");
        _catMenuInteracting = inner && inner.contains(e.target);
        if (categoryPanel && categoryPanel.classList.contains("open")) {
            var isOnBtn =
                (categoryBtn && categoryBtn.contains(e.target)) ||
                (categoryBtnM && categoryBtnM.contains(e.target));
            if (!_catMenuInteracting && !isOnBtn) {
                closeCategoryPanel();
            }
        }
    }, { passive: true });
    document.addEventListener("touchend", function () {
        _catMenuInteracting = false;
    }, { passive: true });

    document.addEventListener(
        "scroll",
        function (e) {
            closeMobileMenu();
            var mega = document.getElementById("cat-mega");
            if (mega && mega.contains(e.target)) return;
            closeCategoryPanel();
        },
        { capture: true, passive: true },
    );

    /* ── 分类面板 ── */
    var pendingCatId = null; /* 面包屑点击后待定位的分类节点 ID */
    function openCategoryPanel(e) {
        if (e) { e.preventDefault(); }
        if (!categoryPanel) categoryPanel = document.getElementById("category-panel");
        closeMobileMenu();
        if (categoryPanel) {
            categoryPanel.classList.add("open");
            var cb = document.getElementById("category-btn");
            var cbm = document.getElementById("category-btn-mobile");
            if (cb) cb.setAttribute("aria-expanded", "true");
            if (cbm) cbm.setAttribute("aria-expanded", "true");
            setMenuScrollLock(true);
            loadCategoryTree();
            loadCategoryMegaData();
        }
    }

    /* 面包屑分类点击（首页卡片 .rec-bc-link / 内容页 .note-bc-link）：打开分类面板并定位展开 */
    document.addEventListener("click", function (e) {
        var bc = e.target.closest ? e.target.closest(".rec-bc-link, .note-bc-link") : null;
        if (!bc) return;
        e.preventDefault();
        e.stopPropagation();
        pendingCatId = bc.getAttribute("data-cat-id") || null;
        openCategoryPanel();
    });

    if (categoryBtn) categoryBtn.addEventListener("click", openCategoryPanel);
    if (categoryBtnM) categoryBtnM.addEventListener("click", openCategoryPanel);
    /* ── Logo 点击跳转首页 ── */
    var logoArea = document.querySelector(".logo-area");
    if (logoArea) {
        logoArea.style.cursor = "pointer";
        logoArea.addEventListener("click", function () {
            window.location.href = "./";
        });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeMobileMenu();
            closeCategoryPanel();
        }
    });

    /* ── 页面滚动时关闭分类面板（.page 容器） ── */
    function bindPage() {
        pageEl = document.querySelector(".page");
        if (!pageEl) return;
        pageEl.addEventListener(
            "scroll",
            function () {
                if (!_catMenuInteracting) closeCategoryPanel();
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
                try {
                    var result = hljs.highlightElement(block);
                    /* highlight.js 识别后会在元素上添加 language-xxx class */
                } catch (_) {}
            });
        }
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
        document.addEventListener("DOMContentLoaded", function () { initHighlight(); initCopyButtons(); });
    } else {
        initHighlight();
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
        lb.setAttribute("role", "dialog");
        lb.setAttribute("aria-modal", "true");
        lb.setAttribute("aria-label", "图片预览");
        lb.innerHTML =
            '<button class="lightbox-close" aria-label="关闭">&times;</button>' +
            '<button class="lightbox-prev" aria-label="上一张">&#8249;</button>' +
            '<button class="lightbox-next" aria-label="下一张">&#8250;</button>' +
            '<img class="lightbox-img" alt="">';
        document.body.appendChild(lb);

        var lbImg = lb.querySelector(".lightbox-img");
        var lbClose = lb.querySelector(".lightbox-close");
        var lbPrev = lb.querySelector(".lightbox-prev");
        var lbNext = lb.querySelector(".lightbox-next");
        var images = [];
        var currentIndex = -1;
        var lastFocus = null;

        function getImageList() {
            var list = [];
            body.querySelectorAll("img").forEach(function (img) {
                if (!img.closest("a")) list.push(img);
            });
            return list;
        }

        function findIndex(list, src) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].src === src) return i;
            }
            return -1;
        }

        function updateNav() {
            var len = images.length;
            lbPrev.style.display = (len > 1 && currentIndex > 0) ? "" : "none";
            lbNext.style.display = (len > 1 && currentIndex < len - 1) ? "" : "none";
        }

        function open(src, trigger) {
            images = getImageList();
            currentIndex = findIndex(images, src);
            lbImg.src = src;
            updateNav();
            lb.classList.add("active");
            document.body.style.overflow = "hidden";
            lastFocus = trigger || document.activeElement;
            lbClose.focus();
        }

        function close() {
            lb.classList.remove("active");
            document.body.style.overflow = "";
            currentIndex = -1;
            if (lastFocus && lastFocus.focus) lastFocus.focus();
            lastFocus = null;
        }

        function prev() {
            if (currentIndex > 0) {
                currentIndex--;
                lbImg.src = images[currentIndex].src;
                updateNav();
            }
        }

        function next() {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                lbImg.src = images[currentIndex].src;
                updateNav();
            }
        }

        lb.addEventListener("click", function (e) {
            if (e.target === lb) close();
        });
        lbClose.addEventListener("click", close);
        lbPrev.addEventListener("click", function (e) { e.stopPropagation(); prev(); });
        lbNext.addEventListener("click", function (e) { e.stopPropagation(); next(); });
        document.addEventListener("keydown", function (e) {
            if (!lb.classList.contains("active")) return;
            if (e.key === "Escape") { close(); return; }
            if (e.key === "ArrowLeft") { e.preventDefault(); prev(); return; }
            if (e.key === "ArrowRight") { e.preventDefault(); next(); return; }
            if (e.key === "Tab") {
                var focusables = [lbClose, lbPrev, lbNext].filter(function (b) {
                    return b.style.display !== "none";
                });
                var first = focusables[0];
                var lastBtn = focusables[focusables.length - 1];
                var cur = document.activeElement;
                if (e.shiftKey) {
                    if (cur === first || cur === lb) {
                        e.preventDefault();
                        if (lastBtn.focus) lastBtn.focus();
                    }
                } else if (cur === lastBtn) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        body.addEventListener("click", function (e) {
            if (e.target.tagName === "IMG" && !e.target.closest("a")) {
                open(e.target.src, e.target);
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
        onScroll(function () {
            var p = pageEl || document.querySelector(".page");
            var scrollTop = getScrollY();
            var scrollHeight, clientH;
            if (p && p.scrollHeight > p.clientHeight) {
                scrollHeight = p.scrollHeight;
                clientH = p.clientHeight;
            } else {
                scrollHeight = document.documentElement.scrollHeight;
                clientH = window.innerHeight;
            }
            var pct = scrollHeight > clientH ? scrollTop / (scrollHeight - clientH) : 0;
            bar.style.width = Math.min(pct, 1) * 100 + "%";
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReadingProgress);
    } else {
        initReadingProgress();
    }

    /* ── 字数统计 & 阅读时长 & 创建/更新时间 ── */
    function initNoteMeta() {
        var meta = document.querySelector(".note-meta");
        if (!meta) return;
        var body = document.querySelector(".note-body");
        if (!body) return;
        function fill(created, modified) {
            var parts = [];
            if (created) parts.push("创建 " + fmtDateOnly(created));
            if (modified && modified !== created) parts.push("更新 " + fmtDateOnly(modified));
            var clone = body.cloneNode(true);
            clone.querySelectorAll("pre").forEach(function (el) { el.remove(); });
            var text = clone.textContent || "";
            var len = text.replace(/\s+/g, "").length;
            var min = Math.max(1, Math.ceil(len / 300));
            parts.push("约 " + len + " 字 · 预计阅读 " + min + " 分钟");
            meta.textContent = parts.join(" · ");
        }
        /* 优先用模板 data 属性（SSR 实时写入 #dateCreated #dateModified）；空则由内嵌索引兜底 */
        var art = document.querySelector(".mod");
        var created = art ? art.getAttribute("data-created") : "";
        var modified = art ? art.getAttribute("data-modified") : "";
        if (created || modified) { fill(created, modified); return; }
        var curId = noteAliasMap[getCurrentNoteId()] || getCurrentNoteId();
        var source = curId
            ? (window.__SSR_HUB__ || []).concat(window.__SSR_SEARCH__ || [])
            : [];
        for (var j = 0; j < source.length; j++) {
            if (source[j].noteId === curId) {
                fill(source[j].dateCreated, source[j].dateModified);
                return;
            }
        }
        fill("", "");
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNoteMeta);
    } else {
        initNoteMeta();
    }

    /* ── 首页模块：列表/公告/动态/热力全部由模板服务端实时渲染（window.__SSR_HOME__），客户端仅交互、无数据加载 ── */
    function loadHomeModules() {
        /* SSR 已渲染首页全部模块；保留入口便于 init 统一调度 */
    }

    /* ── 加载分类树（SSR 已在服务端渲染，客户端只做定位/滚动） ── */
    function scrollToCurrentNote(noteId) {
        var curId = noteId || getCurrentNoteId();
        if (!curId) return;
        var curLink = document.querySelector('#tree-list li[data-note-id="' + curId + '"] a');
        if (curLink) {
            curLink.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }
    /* 展开/收起某节点：动画 + 箭头旋转 + aria。
       展开过渡结束后把 max-height 释放为 none，祖先不再按固定像素钳制，
       避免嵌套展开时父级测量过早导致子笔记被裁掉（闪一下/不可见）。 */
    function clearTreeTx(el) {
        if (el._zfyTx) { clearTimeout(el._zfyTx); el._zfyTx = null; }
    }
    function setTreeOpen(kids, open) {
        if (!kids) return;
        var item = kids.parentElement;
        var toggle = item && item.querySelector(":scope > .tree-node > .tree-toggle");
        var wasOpen = kids.classList.contains("open");
        if (open) {
            kids.classList.add("open");
            kids.style.maxHeight = kids.scrollHeight + "px";
            clearTreeTx(kids);
            kids._zfyTx = setTimeout(function () {
                if (kids.classList.contains("open")) kids.style.maxHeight = "none";
            }, 320);
        } else {
            kids.classList.remove("open");
            if (wasOpen) {
                /* 已释放为 none：先回落到实际内容高度（强制重排），再动画收起 */
                if (kids.style.maxHeight === "none" || kids.style.maxHeight === "") {
                    kids.style.maxHeight = kids.scrollHeight + "px";
                    void kids.offsetHeight;
                }
                kids.style.maxHeight = "0px";
            }
            clearTreeTx(kids);
        }
        if (toggle) {
            toggle.classList.toggle("expanded", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }
    }
    /* 展开路径上的所有节点（含目标自身，若其有子项） */
    function expandToNote(path) {
        if (!path || path.length === 0) return;
        for (var i = 0; i < path.length; i++) {
            var li = document.querySelector('#tree-list li[data-note-id="' + path[i] + '"]');
            if (li) {
                var kids = li.querySelector(':scope > .tree-children');
                if (kids) setTreeOpen(kids, true);
            }
        }
    }
    /* 从 SSR 的 DOM 树中解析目标节点的祖先 noteId 路径（自下而上收集后反转） */
    function domPathTo(focusId) {
        var target = document.querySelector('#tree-list [data-note-id="' + focusId + '"]');
        if (!target) return [];
        var path = [], el = target;
        while (el && el.id !== "tree-list") {
            if (el.classList && el.classList.contains("tree-item")) {
                var nid = el.getAttribute("data-note-id");
                if (nid) path.push(nid);
            }
            el = el.parentElement;
        }
        return path.reverse();
    }

    function loadCategoryTree() {
        var treeList = document.getElementById("tree-list");
        if (!treeList) return;
        /* 分类树已由服务端实时渲染（SSR），客户端只做定位/滚动，不再 fetch 重绘 */
        /* 打开菜单一律先整体折叠：首页默认只显示主目录；文章页定位到当前文章路径，其余折叠 */
        var uls = treeList.querySelectorAll("ul.tree-children");
        for (var i = 0; i < uls.length; i++) setTreeOpen(uls[i], false);
        var sc = treeList.closest(".cat-mega-left") || treeList;
        /* 定位目标：优先面包屑指定；否则取当前文章（首页根笔记不在分类树时为空） */
        var targetId = pendingCatId || getCurrentNoteId();
        if (targetId) {
            var path = domPathTo(targetId);
            if (path && path.length) {
                expandToNote(path);
                scrollToCurrentNote(targetId);
            } else {
                sc.scrollTop = 0;
            }
        } else {
            sc.scrollTop = 0;
        }
        pendingCatId = null;
    }

    /* ── 加载分类 Mega Menu 右侧数据（统计 + 最近更新，均由 SSR 渲染，仅补计数动画） ── */
    function loadCategoryMegaData() {
        var dynEls = document.querySelectorAll('[data-ssr="st"].stat-pill__num');
        for (var d = 0; d < dynEls.length; d++) {
            var cur = parseInt(dynEls[d].textContent, 10) || 0;
            if (cur > 0) animateCount(dynEls[d], cur);
        }
    }

    /* 通过容器事件委托接管 SSR 渲染的树交互（折叠箭头 / 分类节点点击展开）。 */
    function initSsrTree() {
        ["tree-list", "about-menu", "about-menu-mobile"].forEach(function (id) {
            var c = document.getElementById(id);
            if (!c) return;
            c.addEventListener("click", function (e) {
                var el = e.target;
                if (el.nodeType !== 1) el = el.parentElement;
                if (!el || !el.closest) return;
                /* 折叠箭头：只切换本节点展开 */
                var toggle = el.closest(".tree-toggle");
                if (toggle) {
                    e.preventDefault(); e.stopPropagation();
                    var item = toggle.closest(".tree-item");
                    var kids = item && item.querySelector(":scope > .tree-children");
                    if (!kids) return;
                    setTreeOpen(kids, !kids.classList.contains("open"));
                    return;
                }
                var row = el.closest(".tree-item");
                if (!row) return;
                var link = row.querySelector(":scope > .tree-node > a[data-ssr-link], :scope > .tree-node > a[data-ssr='hdr']");
                var catSpan = row.querySelector(":scope > .tree-node > .tag-chip--category");
                var clickedA = el.closest("a");
                /* 点到了链接本身：交给浏览器默认行为（跳转/新开） */
                if (clickedA) return;
                if (catSpan) {
                    /* 分类节点：整行点击展开/收起 */
                    e.preventDefault(); e.stopPropagation();
                    var kids2 = row.querySelector(":scope > .tree-children");
                    if (!kids2) return;
                    setTreeOpen(kids2, !kids2.classList.contains("open"));
                    return;
                }
                if (link) {
                    /* 文章/外链：整行点击导航 */
                    e.preventDefault(); e.stopPropagation();
                    window.location.href = link.getAttribute("href");
                }
            });
            /* 键盘：Enter / Space 在折叠箭头上展开/收起 */
            c.addEventListener("keydown", function (e) {
                if (e.key !== "Enter" && e.key !== " ") return;
                var t = e.target && e.target.closest ? e.target.closest(".tree-toggle") : null;
                if (!t) return;
                e.preventDefault();
                var item = t.closest(".tree-item");
                var kids = item && item.querySelector(":scope > .tree-children");
                if (!kids) return;
                setTreeOpen(kids, !kids.classList.contains("open"));
            });
        });
    }

    /* ── 分类树：展开全部 / 折叠全部 ── */
    function initTreeActions() {
        var treeList = document.getElementById("tree-list");
        if (!treeList) return;
        var expAll = document.getElementById("tree-expand-all");
        var colAll = document.getElementById("tree-collapse-all");
        if (expAll) expAll.addEventListener("click", function () {
            var uls = treeList.querySelectorAll("ul.tree-children");
            for (var i = 0; i < uls.length; i++) setTreeOpen(uls[i], true);
        });
        if (colAll) colAll.addEventListener("click", function () {
            var uls = treeList.querySelectorAll("ul.tree-children");
            for (var j = 0; j < uls.length; j++) setTreeOpen(uls[j], false);
        });
    }

    /* ── "关于"下拉菜单（内容由 SSR 服务端渲染） ── */
    var aboutBtn = document.getElementById("about-btn");
    var aboutDropdown = document.getElementById("about-dropdown");

    function closeAboutDropdown() {
        if (aboutDropdown) aboutDropdown.classList.remove("open");
        if (aboutBtn) aboutBtn.setAttribute("aria-expanded", "false");
    }

    function toggleAboutDropdown(e) {
        if (e) e.preventDefault();
        if (!aboutDropdown) return;
        if (aboutDropdown.classList.contains("open")) {
            closeAboutDropdown();
        } else {
            aboutDropdown.classList.add("open");
            if (aboutBtn) aboutBtn.setAttribute("aria-expanded", "true");
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
    document.addEventListener(
        "scroll",
        function () {
            if (aboutDropdown && aboutDropdown.classList.contains("open")) {
                closeAboutDropdown();
            }
        },
        { passive: true, capture: true },
    );

    /* ── 移动端"关于"下拉（内容由 SSR 渲染） ── */
    var aboutBtnM = document.getElementById("about-btn-mobile");
    var aboutDropdownM = document.getElementById("about-dropdown-mobile");

    function toggleAboutMobile(e) {
        if (e) e.preventDefault();
        if (!aboutDropdownM) return;
        if (aboutDropdownM.classList.contains("open")) {
            aboutDropdownM.classList.remove("open");
            if (aboutBtnM) aboutBtnM.setAttribute("aria-expanded", "false");
        } else {
            aboutDropdownM.classList.add("open");
            if (aboutBtnM) aboutBtnM.setAttribute("aria-expanded", "true");
        }
    }

    if (aboutBtnM) aboutBtnM.addEventListener("click", toggleAboutMobile);

    /* ── 内容大纲 TOC ── */
    function initToc() {
        if (isHome) return;
        var noteBody = document.querySelector(".note-body");
        var tocBody = document.getElementById("toc-body");
        if (!noteBody || !tocBody) return;

        var headings = noteBody.querySelectorAll("h1, h2, h3, h4, h5");
        if (headings.length < 2) return;

        var tocId = 0;
        var items = [];

        headings.forEach(function (h) {
            if (!h.id) {
                h.id = "toc-" + ++tocId;
            }
            var tag = h.tagName.toLowerCase();
            var level = tag === "h1" ? 1 : tag === "h2" ? 2 : tag === "h3" ? 3 : tag === "h4" ? 4 : 5;
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
            else if (item.level === 4) cls += " toc-link--h4";
            else if (item.level === 5) cls += " toc-link--h5";
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
            var scrollY = getScrollY();
            var activeId = null;
            var viewportMid = scrollY + window.innerHeight / 2;

            for (var i = items.length - 1; i >= 0; i--) {
                var el = items[i].el;
                if (!el) continue;
                var rect = el.getBoundingClientRect();
                var elMid = rect.top + scrollY + rect.height / 2;
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
        onScroll(function () {
            requestAnimationFrame(updateActive);
        });
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

        onScroll(function () {
            var p = pageEl || document.querySelector(".page");
            var clientH = (p && p.scrollHeight > p.clientHeight) ? p.clientHeight : window.innerHeight;
            btn.classList.toggle("visible", getScrollY() > clientH);
        });

        btn.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (pageEl) pageEl.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    /* ── 标签 ── */
    var tagData = (window.__SSR_TAGDATA__ && Object.keys(window.__SSR_TAGDATA__).length) ? window.__SSR_TAGDATA__ : null;
    var _tagIcon = _cfg.tagCloudIconClass || "bx bx-purchase-tag-alt";
    var _isTagCloudPage = !!document.getElementById("tagCloudPage");
    var _tagCloudNoteId = _cfg.tagCloudNoteId || '';

    var TAG_COLORS = [
        '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
        '#3498db','#9b59b6','#e91e63','#00bcd4','#ff5722',
        '#795548','#607d8b','#4caf50','#03a9f4','#cddc39',
    ];
    function tagHash(s) {
        var h = 0;
        for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
        return Math.abs(h);
    }
    function tagStyle(name) {
        var c = TAG_COLORS[tagHash(name) % TAG_COLORS.length];
        return 'color:' + c + ';--tag-color:' + c;
    }

    var ensureTagData = function (cb) {
        /* 标签索引已由模板内嵌（window.__SSR_TAGDATA__），无需 /blog-data 快照；同步回掉 */
        if (cb) cb();
    };

    function renderNoteTags() {
        var body = document.querySelector(".note-body");
        if (!body || isHome) return;
        var layout = document.querySelector(".note-layout");
        var tagIndex = tagData || {};
        if (!Object.keys(tagIndex).length) return;
        /* curId 可能是 shareAlias，解析为真实 noteId */
        var curId = noteAliasMap[getCurrentNoteId()] || getCurrentNoteId();
        var noteTags = [];
        for (var k in tagIndex) {
            if (tagIndex[k].noteId.indexOf(curId) !== -1) noteTags.push(k);
        }
        if (!noteTags.length) return;
        var el = document.createElement("div");
        el.className = "note-tags";
        var h = '';
        for (var i = 0; i < noteTags.length; i++) {
            h += '<span class="tag-chip tag-chip--note" data-tag="' + escapeHtml(noteTags[i]) + '" style="' + tagStyle(noteTags[i]) + '"><i class="' + _tagIcon + '"></i> ' + escapeHtml(noteTags[i]) + '</span>';
        }
        el.innerHTML = h;
        if (layout) {
            var article = layout.querySelector('article.mod');
            if (article && article.nextSibling) {
                layout.insertBefore(el, article.nextSibling);
            } else if (layout) {
                layout.appendChild(el);
            }
        } else {
            body.parentNode.insertBefore(el, body.nextSibling);
        }
    }

    /* ── 标签云页面 ── */
    function initTagCloud() {
        var page = document.getElementById("tagCloudPage");
        if (!page) return;

        page.innerHTML = '';
        var wrap = document.createElement("div");
        wrap.className = "tagcloud-wrap";
        wrap.innerHTML = '<div class="tagcloud-tags" id="tagCloudTags"></div>' +
            '<div class="tagcloud-content" id="tagCloudContent"></div>';
        page.appendChild(wrap);

        var tagsEl = document.getElementById("tagCloudTags");
        var contentEl = document.getElementById("tagCloudContent");
        var activeTag = null;
        var pageSize = 10;
        var curPage = 0;

        function getUrlTag() {
            var m = window.location.search.match(/[?&]tag=([^&]+)/);
            return m ? decodeURIComponent(m[1]) : null;
        }

        ensureTagData(function () {
            var tagIndex = tagData || {};
            renderCloud(tagIndex);
            var urlTag = getUrlTag();
            if (urlTag && tagIndex[urlTag]) selectTag(urlTag);
        });

        function renderCloud(tagIndex) {
            var names = Object.keys(tagIndex);
            if (!names.length) { tagsEl.innerHTML = '<div class="tagcloud-empty">暂无标签</div>'; return; }
            var maxCount = 0;
            names.forEach(function (n) { if (tagIndex[n].count > maxCount) maxCount = tagIndex[n].count; });
            names.sort();
            var h = '';
            for (var i = 0; i < names.length; i++) {
                var info = tagIndex[names[i]];
                var ratio = maxCount > 1 ? info.count / maxCount : 1;
                var size = 0.85 + ratio * 0.65;
                var _h = tagHash(names[i]);
                var rot = ((_h % 60) - 30) / 10;   // -3.0 ~ +3.0 deg
                var delay = ((_h % 30) / 10).toFixed(1); // 0.0 ~ 2.9s
                h += '<span class="tagcloud-tag' + (activeTag === names[i] ? ' active' : '') + '" ' +
                    'style="font-size:' + size + 'em;' + tagStyle(names[i]) + ';' +
                    '--rot:' + rot.toFixed(1) + 'deg;--float-delay:' + delay + 's" ' +
                    'data-tag="' + escapeHtml(names[i]) + '">' +
                    escapeHtml(names[i]) + '<sup class="tagcloud-count">' + info.count + '</sup></span>';
            }
            tagsEl.innerHTML = h;
        }

        tagsEl.addEventListener("click", function (e) {
            var el = e.target.closest(".tagcloud-tag");
            if (el) selectTag(el.getAttribute("data-tag"));
        });

        function selectTag(tag) {
            activeTag = (activeTag === tag) ? null : tag;
            tagsEl.querySelectorAll(".tagcloud-tag").forEach(function (el) {
                el.classList.toggle("active", el.getAttribute("data-tag") === activeTag);
            });
            if (!activeTag) { contentEl.innerHTML = '<div class="tagcloud-empty">点击标签查看相关文章</div>'; curPage = 0; return; }
            curPage = 0;
            renderTagList();
            var url = new URL(window.location);
            url.searchParams.set("tag", activeTag);
            history.replaceState(null, "", url.toString());
        }
        window._selectTagCloud = selectTag;

        function renderTagList() {
            var info = tagData[activeTag];
            if (!info || !info.noteId || !info.noteId.length) {
                contentEl.innerHTML = '<div class="tagcloud-empty">该标签下暂无文章</div>';
                return;
            }
            var _hubArr = window.__SSR_HUB__ && window.__SSR_HUB__.length ? window.__SSR_HUB__ : null;
            var _worker = function (sData) {
                var notes = [];
                for (var i = 0; i < info.noteId.length; i++) {
                    for (var j = 0; j < sData.length; j++) {
                        if (sData[j].noteId === info.noteId[i]) { notes.push(sData[j]); break; }
                    }
                }
                /* 按创建时间倒序 */
                notes.sort(function (a, b) {
                    return String(b.dateCreated).localeCompare(String(a.dateCreated));
                });
                var total = notes.length;
                var totalPages = Math.ceil(total / pageSize) || 1;
                var start = curPage * pageSize;
                var pageItems = notes.slice(start, start + pageSize);

                var h = '<h3 class="tagcloud-list-title" style="' + tagStyle(activeTag) + '"><i class="' + _tagIcon + '"></i> ' + escapeHtml(activeTag) +
                    ' <span class="tagcloud-list-count">（' + total + ' 篇）</span></h3>';
                h += '<div class="tagcloud-list">';
                for (var i = 0; i < pageItems.length; i++) {
                    var n = pageItems[i];
                    var title = (n.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    var icon = n.noteIcon ? '<i class="' + escapeHtml(n.noteIcon) + '"></i> ' : '';
                    var snippet = n.content ? n.content.substring(0, 120).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
                    var noteOwnTags = [];
                    for (var tk in tagData) {
                        if (tagData[tk].noteId.indexOf(n.noteId) !== -1) noteOwnTags.push(tk);
                    }
                    var tagsHtml = '';
                    if (noteOwnTags.length) {
                        tagsHtml = '<div class="tagcloud-note-tags">';
                        for (var t = 0; t < noteOwnTags.length; t++) {
                            tagsHtml += '<span class="tag-chip tag-chip--note" data-tag="' + escapeHtml(noteOwnTags[t]) + '" style="' + tagStyle(noteOwnTags[t]) + '"><i class="' + _tagIcon + '"></i> ' + escapeHtml(noteOwnTags[t]) + '</span>';
                        }
                        tagsHtml += '</div>';
                    }
                    var _dates = '';
                    if (n.dateCreated || n.dateModified) {
                        /* 共享模板仅有 utcDateModified，避免创建=修改时重复显示 */
                        var _dp = [];
                        if (n.dateCreated && String(n.dateCreated) !== String(n.dateModified)) _dp.push('创建:' + fmtDate(n.dateCreated));
                        if (n.dateModified) _dp.push('修改:' + fmtDate(n.dateModified));
                        if (_dp.length) _dates = '<span class="tagcloud-note-dates">' + _dp.join(' · ') + '</span>';
                    }
                    var noteCls = 'tagcloud-note' + (n.cover ? ' tagcloud-note--has-cover' : '');
                    var noteStyle = n.cover ? ' style="--cover-url:url(\'' + escapeHtml(n.cover).replace(/'/g, "\\'") + '\')"' : '';
                    h += '<a class="' + noteCls + '"' + noteStyle + ' href="' + noteUrl(n) + '">';
                    h += '<span class="tagcloud-note-body">';
                    h += '<span class="tagcloud-note-title"' + (n.color ? ' style="color:' + escapeHtml(n.color) + '"' : '') + '>' +
                        '<span class="tagcloud-note-title-text">' + icon + title + '</span>' +
                        '</span>' +
                        (snippet ? '<span class="tagcloud-note-snippet">' + snippet + '</span>' : '') +
                        tagsHtml +
                        _dates;
                    h += '</span></a>';
                }
                h += '</div>';
                if (totalPages > 1) {
                    h += '<div class="tagcloud-pager">';
                    if (curPage > 0) h += '<button class="tagcloud-pager-btn" data-page="' + (curPage - 1) + '">上一页</button>';
                    h += '<span class="tagcloud-pager-info">第 ' + (curPage + 1) + '/' + totalPages + ' 页</span>';
                    if (curPage < totalPages - 1) h += '<button class="tagcloud-pager-btn" data-page="' + (curPage + 1) + '">下一页</button>';
                    h += '</div>';
                }
                contentEl.innerHTML = h;
                contentEl.querySelectorAll(".tagcloud-pager-btn").forEach(function (btn) {
                    btn.addEventListener("click", function () { curPage = parseInt(this.getAttribute("data-page"), 10); renderTagList(); });
                });
            };
            if (_hubArr) { _worker(_hubArr); }
            else { _worker(window.__SSR_SEARCH__ || []); }
        }
    }

    /* ── 标签点击：标签云页内切换 / 其他页跳转 ── */
    document.addEventListener("click", function (e) {
        var chip = e.target.closest(".tag-chip--note");
        if (!chip) return;
        var tag = chip.getAttribute("data-tag");
        if (!tag) return;
        if (_isTagCloudPage) {
            e.stopPropagation();
            e.preventDefault();
            if (window._selectTagCloud) window._selectTagCloud(tag);
        } else if (_tagCloudNoteId) {
            e.preventDefault();
            window.location.href = "/" + _tagCloudNoteId + "?tag=" + encodeURIComponent(tag);
        }
    });

    /* ── 初始化 ── */
    function renderNoteBreadcrumb() {
        var el = document.getElementById("note-breadcrumb");
        if (!el) return;
        /* 面包屑已由模板服务端实时渲染（data-ssr="bc" + .note-bc-link），点击定位由外层事件委托处理 */
    }

    /* 更新热力图悬浮提示：SSR/客户端渲染的 .hm-cell 通用（鼠标 + 触屏 + 键盘） */
    function initHeatmapTooltip() {
        var grid = document.getElementById("heatmap-grid");
        if (!grid) return;
        var tip = document.createElement("div");
        tip.className = "hm-tip";
        tip.style.display = "none";
        document.body.appendChild(tip);
        var activeCell = null;
        function show(cell) {
            var date = cell.getAttribute("data-date") || "";
            var cnt = parseInt(cell.getAttribute("data-count"), 10) || 0;
            tip.textContent = date + (cnt ? " · 更新 " + cnt + " 次" : "");
            tip.style.display = "block";
            if (activeCell && activeCell !== cell) activeCell.classList.remove("active");
            activeCell = cell;
            cell.classList.add("active");
        }
        function move(e) {
            tip.style.left = e.clientX + "px";
            tip.style.top = (e.clientY - 14) + "px";
        }
        function positionNear(cell) {
            var rect = cell.getBoundingClientRect();
            tip.style.left = (rect.left + rect.width / 2) + "px";
            tip.style.top = (rect.top - 8) + "px";
        }
        function hide() {
            tip.style.display = "none";
            if (activeCell) { activeCell.classList.remove("active"); activeCell = null; }
        }
        /* 鼠标悬浮 */
        grid.addEventListener("mouseover", function (e) {
            var c = e.target.closest ? e.target.closest(".hm-cell") : null;
            if (c) { show(c); move(e); }
        });
        grid.addEventListener("mousemove", function (e) {
            if (tip.style.display !== "none") move(e);
        });
        grid.addEventListener("mouseout", function (e) {
            var c = e.target.closest ? e.target.closest(".hm-cell") : null;
            if (!c) hide();
        });
        /* 触屏点击：点击显示，再点/移出隐藏 */
        grid.addEventListener("click", function (e) {
            var c = e.target.closest ? e.target.closest(".hm-cell") : null;
            if (!c) return;
            if (activeCell === c && tip.style.display !== "none") { hide(); return; }
            show(c); positionNear(c);
        });
        /* 键盘可达：Enter/Space 显示，失焦隐藏 */
        grid.addEventListener("keydown", function (e) {
            var c = e.target.closest ? e.target.closest(".hm-cell") : null;
            if (!c) return;
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (activeCell === c && tip.style.display !== "none") { hide(); return; }
                show(c); positionNear(c);
            }
        });
        grid.addEventListener("blur", function (e) {
            if (e.target.closest && e.target.closest(".hm-cell")) hide();
        }, true);
    }

    /* 首页最新文章分页：SSR 只渲染第一页，>5 条时由客户端翻页 */
    function initHomeArticlePager() {
        var list = document.getElementById("mod-article");
        if (!list) return;
        var articles = window.__SSR_ARTICLES__;
        if (!articles || !articles.length) return;
        var pageSize = 5;
        var totalPages = Math.max(1, Math.ceil(articles.length / pageSize));
        if (totalPages < 2) return; /* 不足一页交给 SSR 即可，不接管 */

        function artHtml(it) {
            var coverH = "";
            var cls = "article-mod";
            if (it.cover) {
                cls += " article-mod--has-cover";
                coverH = ' style="--cover-url:url(\'' + escapeHtml(it.cover).replace(/'/g, "\\'") + '\')"';
            }
            var body = '<div class="rec-card-body rec-card-body--wide">';
            if (it.cat && it.cat.length) {
                body += '<div class="rec-breadcrumb">';
                for (var b = 0; b < it.cat.length; b++) {
                    if (b > 0) body += '<span class="rec-bc-sep">/</span>';
                    body += '<a class="rec-bc-link" href="javascript:;" data-cat-id="' + escapeHtml(it.cat[b].noteId) + '">' + escapeHtml(it.cat[b].title) + '</a>';
                }
                body += '</div>';
            }
            body += '<h4 class="rec-title"><a href="' + escapeHtml(noteUrl(it)) + '"' +
                (it.ext ? ' target="_blank" rel="noopener"' : '') +
                (it.color ? ' style="color:' + escapeHtml(it.color) + '"' : '') + '>';
            if (it.icon) body += '<i class="' + escapeHtml(it.icon) + ' rec-item-icon"></i> ';
            body += escapeHtml(it.title) + '</a></h4>';
            if (it.snippet) body += '<div class="rec-summary">' + escapeHtml(it.snippet) + '</div>';
            if (it.tags && it.tags.length) {
                body += '<div class="module-tags">';
                for (var t = 0; t < it.tags.length; t++) {
                    body += '<span class="tag-chip tag-chip--note" data-tag="' + escapeHtml(it.tags[t]) + '" style="' + tagStyle(it.tags[t]) + '"><i class="' + escapeHtml(_tagIcon) + '"></i> ' + escapeHtml(it.tags[t]) + '</span>';
                }
                body += '</div>';
            }
            if (it.dateCreated) body += '<div class="rec-meta"><time class="rec-date">' + escapeHtml(fmtDateOnly(it.dateCreated)) + '</time></div>';
            body += '</div>';
            return '<div class="' + cls + '"' + coverH + '>' + body + '</div>';
        }

        var curPage = 0;
        var pager = document.getElementById("article-pager");

        function render() {
            var start = curPage * pageSize;
            var end = Math.min(start + pageSize, articles.length);
            var html = '';
            for (var i = start; i < end; i++) html += artHtml(articles[i]);
            list.innerHTML = html;
            renderPager();
        }

        function renderPager() {
            if (!pager) return;
            var h = '';
            var info = '<span class="article-pager-info">' + (curPage + 1) + ' / ' + totalPages + ' 页</span>';
            if (curPage > 0) {
                h += '<button class="article-pager-btn" data-page="' + (curPage - 1) + '">上一页</button>';
            } else {
                h += '<button class="article-pager-btn" disabled>上一页</button>';
            }
            h += info;
            if (curPage < totalPages - 1) {
                h += '<button class="article-pager-btn" data-page="' + (curPage + 1) + '">下一页</button>';
            } else {
                h += '<button class="article-pager-btn" disabled>下一页</button>';
            }
            pager.innerHTML = h;
            pager.querySelectorAll(".article-pager-btn:not([disabled])").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    curPage = parseInt(this.getAttribute("data-page"), 10);
                    render();
                });
            });
        }

        render();
    }

    /* 兜底：确保内容页面包屑最左侧不带 "/"（移除首节点若为分隔符） */
    function normalizeNoteBreadcrumb() {
        var el = document.getElementById("note-breadcrumb");
        if (!el) return;
        var first = el.firstElementChild;
        if (first && first.classList && first.classList.contains("note-bc-sep")) {
            el.removeChild(first);
        }
    }

    function init() {
        normalizeNoteBreadcrumb();
        initTagCloud();
        renderNoteTags();
        initToc();
        initTocMobile();
        initBackTop();
        initSsrTree();
        initTreeActions();
        if (isHome) {
            loadHomeModules();
            initHomeArticlePager();
            initHeatmapTooltip();
        } else if (document.getElementById("note-breadcrumb")) {
            renderNoteBreadcrumb();
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
        var aliasMap = {};
        (window.__SSR_SEARCH__ || []).concat(window.__SSR_HUB__ || []).forEach(function (it) {
            if (it.noteIcon) iconMap[it.noteId] = it.noteIcon;
            if (it.shareAlias) aliasMap[it.noteId] = it.shareAlias;
        });
        var noteLinks = document.querySelectorAll('.note-body a[href^="note://"]');
        noteLinks.forEach(function (link) {
            var href = link.getAttribute("href") || "";
            var noteId = href.replace("note://", "").split(/[?#]/)[0];
            if (noteId) {
                link.href = "/" + (aliasMap[noteId] || noteId);
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
            var noteId = href.replace(/^note:\/\//, "").replace(/^\.\//, "").split(/[?#]/)[0];
            if (noteId) {
                if (aliasMap[noteId]) link.href = "/" + aliasMap[noteId];
                if (iconMap[noteId]) link.setAttribute("data-icon", iconMap[noteId]);
            }
        });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", processInternalLinks);
    } else {
        processInternalLinks();
    }

    /* ── Favicon 动态设置 ── */
    var _noteIconCls = _cfg.noteIcon;
    if (_noteIconCls) {
        var _bxClass = "";
        var _parts = _noteIconCls.split(" ");
        for (var _i = 0; _i < _parts.length; _i++) {
            if (_parts[_i].indexOf("bx-") === 0) { _bxClass = _parts[_i]; break; }
        }
        if (_bxClass) {
            var _oldIcons = document.querySelectorAll('link[rel*="icon"]');
            for (var _oi = 0; _oi < _oldIcons.length; _oi++) {
                _oldIcons[_oi].remove();
            }
            var _fav = document.createElement("link");
            _fav.rel = "icon";
            _fav.type = "image/svg+xml";
            _fav.href = "https://unpkg.com/boxicons@2.1.4/svg/regular/" + _bxClass + ".svg";
            document.head.appendChild(_fav);
        }
    }

    /* ── Header 自动隐藏/显示 ── */
    var header = document.querySelector(".header");
    if (header) {
        var lastScroll = 0;
        var delta = 3;
        var touchStartY = -1;

        onScroll(function (curr) {
            if (curr <= delta) {
                header.classList.remove("hidden");
            } else if (curr > lastScroll) {
                header.classList.add("hidden");
            } else if (curr < lastScroll) {
                header.classList.remove("hidden");
            }
            lastScroll = curr;
        });

        // 移动端：触摸滑动方向判断
        document.addEventListener(
            "touchstart",
            function (e) {
                touchStartY = e.touches[0].clientY;
            },
            { passive: true }
        );
        document.addEventListener(
            "touchmove",
            function (e) {
                if (touchStartY < 0) return;
                var dy = e.touches[0].clientY - touchStartY;
                touchStartY = e.touches[0].clientY;
                var y = getScrollY();
                if (y <= delta) { header.classList.remove("hidden"); return; }
                if (dy < -delta * 2) header.classList.add("hidden");       // 手指上滑 => 隐藏
                else if (dy > delta * 2) header.classList.remove("hidden"); // 手指下滑 => 显示
            },
            { passive: true }
        );
    }
})();


