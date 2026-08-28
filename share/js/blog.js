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

    /* ── 聚合数据加载（/blog-data 一次性拉取除 search 外的全部模块数据） ── */
    var blogData = null;
    var blogDataLoading = false;
    var blogDataCallbacks = [];
    function ensureBlogData(cb) {
        if (blogData) { if (cb) cb(); return; }
        if (cb) blogDataCallbacks.push(cb);
        if (blogDataLoading) return;
        blogDataLoading = true;
        fetchJSON("/blog-data").then(function (data) {
            blogData = data || {};
            blogDataLoading = false;
            var cbs = blogDataCallbacks; blogDataCallbacks = [];
            cbs.forEach(function (fn) { fn(); });
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
    var searchDataLoading = false;
    var searchOpen = false;

    var searchDataCallbacks = [];
    function ensureSearchData(cb) {
        if (searchData) { if (cb) cb(); return; }
        if (cb) searchDataCallbacks.push(cb);
        if (searchDataLoading) return;
        searchDataLoading = true;
        fetchJSON("/blog-search").then(function (data) {
            searchData = data || [];
            searchDataLoading = false;
            var cbs = searchDataCallbacks; searchDataCallbacks = [];
            cbs.forEach(function (fn) { fn(); });
        });
    }

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
                '<span class="search-result-title"' +
                (item.color ? ' style="color:' + escapeHtml(item.color) + '"' : "") +
                ">" +
                (item.noteIcon
                    ? '<i class="' + escapeHtml(item.noteIcon) + '"></i> '
                    : "") +
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
    var treeData = null;
    function openCategoryPanel(e) {
        if (e) { e.preventDefault(); }
        if (!categoryPanel) categoryPanel = document.getElementById("category-panel");
        closeMobileMenu();
        if (categoryPanel) {
            categoryPanel.classList.add("open");
            loadCategoryTree();
            loadCategoryMegaData();
        }
    }

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
            /* 菜单内部滚动不触发胶囊显隐 */
            var mega = document.getElementById("cat-mega");
            if (mega && mega.contains(e.target)) return;
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
                if (!_catMenuInteracting) closeCategoryPanel();
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

        function open(src) {
            images = getImageList();
            currentIndex = findIndex(images, src);
            lbImg.src = src;
            updateNav();
            lb.classList.add("active");
            document.body.style.overflow = "hidden";
        }

        function close() {
            lb.classList.remove("active");
            document.body.style.overflow = "";
            currentIndex = -1;
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
            if (e.key === "Escape") close();
            if (e.key === "ArrowLeft") prev();
            if (e.key === "ArrowRight") next();
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
       article: [{noteId, title, noteIcon, dateCreated, content}] 全量按创建时间倒序
       recentUpdate: [{noteId, title, noteIcon, dateCreated}]
       announcement: {noteId, title, noteIcon, dateCreated, content} | null
       stats: {article, recommend, recentUpdate, announcement}
       heatmap: [{date, count}]
       tree: [{noteId, title, noteIcon, category, children:[...]}]
       about-tree: [{noteId, title, noteIcon, category, children:[...]}]
    */

    function updateRecClips() {
        document.querySelectorAll(".grid-bento .rec-clip").forEach(function (clip) {
            var summary = clip.querySelector(".rec-summary");
            if (!summary) {
                clip.classList.remove("rec-clip--overflow");
                return;
            }
            clip.classList.toggle("rec-clip--overflow", summary.scrollHeight > clip.clientHeight + 1);
        });
    }

    function renderModule(containerId, emptyMsg, renderFn) {
        var el = document.getElementById(containerId);
        if (!el) return function () {};
        el.innerHTML = '<div class="rec-empty">加载中…</div>';
        return function (data) {
            if (isEmpty(data)) {
                el.innerHTML = '<div class="rec-empty">' + emptyMsg + '</div>';
            } else {
                el.innerHTML = renderFn(data);
            }
            updateRecClips();
        };
    }

    function renderArticleCard(item, opts) {
        opts = opts || {};
        if (!item) return '<div class="rec-empty">暂无文章</div>';
        var html = '<div class="rec-card-body';
        if (opts.featured) html += ' rec-card-body--featured';
        else if (opts.wide) html += ' rec-card-body--wide';
        else if (opts.compact) html += ' rec-card-body--compact';
        html += '">';
        html += '<h4 class="rec-title">';
        if (item.noteIcon) html += '<i class="' + escapeHtml(item.noteIcon) + ' rec-item-icon"></i> ';
        html += '<a href="/' + item.noteId + '"' +
            (item.color ? ' style="color:' + escapeHtml(item.color) + '"' : "") +
            ">" + escapeHtml(item.title) + '</a></h4>';
        if (item.content) {
            var excerpt = item.content.length > 60 ? item.content.slice(0, 60) + '…' : item.content;
            html += '<div class="rec-clip"><p class="rec-summary">' + escapeHtml(excerpt) + '</p></div>';
        }
        if (item.tags && item.tags.length || item.dateCreated) {
            html += '<div class="rec-meta">';
            if (item.tags && item.tags.length) html += renderModuleTags(item.tags);
            if (item.dateCreated) {
                html += '<time class="rec-date">' + fmtDate(item.dateCreated) + '</time>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    /* ── 最新文章分页模块（一篇文章为一个模块，每页最多 5 篇） ── */
    var articlePage = 0;
    var ARTICLE_PAGE_SIZE = 5;
    function renderArticleModules() {
        var el = document.getElementById("mod-article");
        if (!el) return;
        var items = blogData.article || [];
        if (!items.length) {
            el.innerHTML = '<div class="rec-empty">暂无文章</div>';
            return;
        }
        var totalPages = Math.ceil(items.length / ARTICLE_PAGE_SIZE);
        if (articlePage >= totalPages) articlePage = totalPages - 1;
        if (articlePage < 0) articlePage = 0;
        var start = articlePage * ARTICLE_PAGE_SIZE;
        var html = "";
        for (var i = start; i < start + ARTICLE_PAGE_SIZE && i < items.length; i++) {
            html += '<div class="article-mod">' + renderArticleCard(items[i], { wide: true }) + '</div>';
        }
        el.innerHTML = html;
        if (totalPages > 1) {
            var pager = '<div class="article-pager">';
            if (articlePage > 0) pager += '<button class="article-pager-btn" data-page="' + (articlePage - 1) + '">上一页</button>';
            pager += '<span class="article-pager-info">' + (articlePage + 1) + ' / ' + totalPages + ' 页</span>';
            if (articlePage < totalPages - 1) pager += '<button class="article-pager-btn" data-page="' + (articlePage + 1) + '">下一页</button>';
            pager += '</div>';
            el.insertAdjacentHTML("beforeend", pager);
            el.querySelectorAll(".article-pager-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    articlePage = parseInt(btn.getAttribute("data-page"), 10);
                    renderArticleModules();
                });
            });
        }
        updateRecClips();
    }

    function loadHomeModules() {
        ensureBlogData(function () {
            /* 推荐阅读 */
            var recRender = renderModule("mod-recommend", "暂无推荐", function (items) {
                if (!items || !items.length) return '<div class="rec-empty">暂无推荐</div>';
                var item = items[Math.floor(Math.random() * items.length)];
                return renderArticleCard(item, { wide: true });
            });
            recRender(blogData.recommend || []);

            /* 最新文章（一篇文章一个模块，每页最多 5 篇，分页展示） */
            var articleEl = document.getElementById("mod-article");
            if (articleEl) articleEl.innerHTML = '<div class="rec-empty">加载中…</div>';
            renderArticleModules();

            /* 最近动态 */
            var el = document.getElementById("mod-updates");
            if (el) {
                var updates = blogData.recentUpdate || [];
                if (isEmpty(updates)) {
                    el.innerHTML = '<div class="rec-empty">暂无动态</div>';
                } else {
                    var html = "";
                    var limit = Math.min(updates.length, 3);
                    for (var i = 0; i < limit; i++) {
                        var u = updates[i];
                        html += '<div class="rec-upd-item">';
                        if (u.noteIcon) html += '<i class="' + escapeHtml(u.noteIcon) + ' upd-item-icon"></i> ';
                        html += '<time class="rec-date">' + fmtDate(u.dateCreated) + '</time>';
                        html += '<h4 class="rec-title"><a href="/' + u.noteId + '"' +
                            (u.color ? ' style="color:' + escapeHtml(u.color) + '"' : "") +
                            ">" + escapeHtml(u.title) + '</a></h4>';
                        if (u.tags && u.tags.length) html += renderModuleTags(u.tags);
                        html += '</div>';
                    }
                    el.innerHTML = html;
                }
            }

            /* 公告 */
            var annRender = renderModule("mod-announcement", "暂无公告", function (item) {
                return renderArticleCard(item, { compact: true });
            });
            annRender(blogData.announcement);

            /* 统计 */
            var st = blogData.stats || {};
            var m = function (id) { return document.getElementById(id); };
            animateCount(m("stat-recommend"), st.recommend);
            animateCount(m("stat-article"), st.article);
            animateCount(m("stat-recentUpdate"), st.recentUpdate);
            animateCount(m("stat-announcement"), st.announcement);

            /* 热力图 */
            renderHeatmap(blogData.heatmap || []);

            setTimeout(updateRecClips, 0);
        });
    }

    window.addEventListener("resize", function () {
        if (document.querySelector(".grid-bento")) updateRecClips();
    });

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

        /* 默认滚动到最右侧（最新日期） */
        var wrap = document.querySelector(".hm-wrap");
        if (wrap) wrap.scrollLeft = wrap.scrollWidth - wrap.clientWidth;
    }

    /* ── 加载分类树（blogData.tree） ── */
    function scrollToCurrentNote() {
        var curId = getCurrentNoteId();
        if (!curId) return;
        var curLink = document.querySelector('#tree-list li[data-note-id="' + curId + '"] a');
        if (curLink) {
            curLink.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }
    /* 查找目标笔记在树中的路径 */
    function findPathToNote(items, targetId, path) {
        path = path || [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.noteId === targetId) {
                return path.concat([item.noteId]);
            }
            if (item.children && item.children.length > 0) {
                var found = findPathToNote(item.children, targetId, path.concat([item.noteId]));
                if (found) return found;
            }
        }
        return null;
    }
    /* 展开路径上的所有父节点 */
    function expandToNote(path) {
        if (!path || path.length <= 1) return;
        for (var i = 0; i < path.length - 1; i++) {
            var parentId = path[i];
            var li = document.querySelector('#tree-list li[data-note-id="' + parentId + '"]');
            if (li) {
                var kids = li.querySelector(':scope > .tree-children');
                var toggle = li.querySelector(':scope > .tree-node > .tree-toggle');
                if (kids && toggle) {
                    kids.style.display = 'block';
                    toggle.textContent = '▼';
                    toggle.classList.add('expanded');
                }
            }
        }
    }
    function loadCategoryTree() {
        var treeList = document.getElementById("tree-list");
        if (!treeList) return;
        var currentId = getCurrentNoteId();
        if (treeData) {
            renderTree(treeData, treeList, currentId);
            expandToNote(findPathToNote(treeData, currentId));
            scrollToCurrentNote();
            return;
        }
        treeList.innerHTML = '<li class="tree-item" style="padding:8px;color:var(--muted)">加载中…</li>';
        ensureBlogData(function () {
            treeData = blogData.tree || [];
            if (treeData.length) {
                processInternalLinks();
                renderTree(treeData, treeList, currentId);
                expandToNote(findPathToNote(treeData, currentId));
                scrollToCurrentNote();
            } else {
                treeList.innerHTML = '<li class="tree-item"><span class="tag-chip">暂无分类</span></li>';
            }
        });
    }

    /* ── 加载分类 Mega Menu 右侧数据（统计 + 最近更新） ── */
    function loadCategoryMegaData() {
        ensureBlogData(function () {
            /* 统计（原站点统计动画效果） */
            var st = blogData.stats || {};
            animateCount(document.getElementById("cms-article"), st.article);
            animateCount(document.getElementById("cms-update"), st.recentUpdate);
            animateCount(document.getElementById("cms-recommend"), st.recommend);
            animateCount(document.getElementById("cms-announce"), st.announcement);

            /* 最近更新 */
            var el = document.getElementById("cms-updates");
            if (!el) return;
            var data = blogData.recentUpdate || [];
            if (isEmpty(data)) {
                el.innerHTML = '<li class="cat-mega-update-item">暂无动态</li>';
                return;
            }
            var html = "";
            for (var i = 0; i < data.length; i++) {
                var u = data[i];
                html += '<li class="cat-mega-update-item">';
                if (u.noteIcon) html += '<i class="' + escapeHtml(u.noteIcon) + '"></i> ';
                html += '<a href="/' + u.noteId + '"' +
                    (u.color ? ' style="color:' + escapeHtml(u.color) + '"' : "") +
                    '>' + escapeHtml(u.title) + '</a>';
                html += '<time>' + fmtDate(u.dateCreated) + '</time>';
                html += '</li>';
            }
            el.innerHTML = html;
        });
    }

    function renderTree(items, container, currentId) {
        container.innerHTML = "";
        var found = false;
        items.forEach(function (item) {
            var li = document.createElement("li");
            li.className = "tree-item";
            li.setAttribute("data-note-id", item.noteId);
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
            if (item.shareExternalLink) {
                titleEl = document.createElement("a");
                titleEl.href = item.shareExternalLink;
                titleEl.target = "_blank";
                titleEl.rel = "noopener";
                titleEl.className = "tag-chip";
                titleEl.addEventListener("click", function (e) {
                    e.stopPropagation();
                    closeCategoryPanel();
                });
            } else if (item.category === true) {
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
                found = true;
            }
            if (item.color) {
                titleEl.style.color = item.color;
            }

            node.appendChild(toggle);
            node.appendChild(titleEl);
            li.appendChild(node);

            li.addEventListener("click", function (e) {
                e.stopPropagation();
                if (e.target.closest(".tree-toggle") || e.target.closest("a") || e.target.closest("button")) return;
                if (item.category === true) {
                    if (!hasKids) return;
                    toggleAboutSub({
                        currentTarget: toggle,
                        preventDefault: function () {},
                        stopPropagation: function () {},
                    });
                } else if (item.shareExternalLink) {
                    window.open(item.shareExternalLink, '_blank');
                    closeCategoryPanel();
                } else {
                    window.location.href = "/" + item.noteId;
                }
            });

            if (hasKids) {
                var ul = document.createElement("ul");
                ul.className = "tree-children";
                ul.style.display = "none";
                renderTree(item.children, ul, currentId);
                li.appendChild(ul);
            }
            container.appendChild(li);
        });
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

    /* ── "关于"下拉菜单（blogData.aboutTree） ── */
    var aboutBtn = document.getElementById("about-btn");
    var aboutDropdown = document.getElementById("about-dropdown");
    var aboutMenu = document.getElementById("about-menu");
    var aboutData = null;

    function ensureAboutData(cb) {
        if (aboutData) { if (cb) cb(); return; }
        ensureBlogData(function () {
            aboutData = blogData.aboutTree || [];
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
            li.setAttribute("data-note-id", item.noteId);
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
            if (item.shareExternalLink) {
                titleEl = document.createElement("a");
                titleEl.href = item.shareExternalLink;
                titleEl.target = "_blank";
                titleEl.rel = "noopener";
                titleEl.className = "tag-chip";
                titleEl.addEventListener("click", function (e) {
                    e.stopPropagation();
                    closeCategoryPanel();
                });
            } else if (item.category === true) {
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
                titleEl.appendChild(
                    document.createTextNode(" " + item.title)
                );
            } else {
                titleEl.textContent = item.title;
            }

            if (item.color) {
                titleEl.style.color = item.color;
            }

            node.appendChild(toggle);
            node.appendChild(titleEl);
            li.appendChild(node);

            li.addEventListener("click", function (e) {
                e.stopPropagation();
                if (e.target.closest(".tree-toggle") || e.target.closest("a") || e.target.closest("button")) return;
                if (item.category === true) {
                    if (!hasKids) return;
                    toggleAboutSub({
                        currentTarget: toggle,
                        preventDefault: function () {},
                        stopPropagation: function () {},
                    });
                } else if (item.shareExternalLink) {
                    window.open(item.shareExternalLink, '_blank');
                    closeCategoryPanel();
                } else {
                    window.location.href = "/" + item.noteId;
                }
            });

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
                aboutMenu.innerHTML = '<li class="tree-item" style="padding:8px;color:var(--muted)">加载中…</li>';
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
    document.addEventListener(
        "scroll",
        function () {
            if (aboutDropdown && aboutDropdown.classList.contains("open")) {
                closeAboutDropdown();
            }
        },
        { passive: true, capture: true },
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
                aboutMenuM.innerHTML = '<li class="tree-item" style="padding:8px;color:var(--muted)">加载中…</li>';
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
    var tagData = null;
    var tagDataLoading = false;
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

    var tagDataCallbacks = [];
    function ensureTagData(cb) {
        if (tagData) { if (cb) cb(); return; }
        if (cb) tagDataCallbacks.push(cb);
        if (tagDataLoading) return;
        tagDataLoading = true;
        ensureBlogData(function () {
            tagData = blogData.tags || {};
            tagDataLoading = false;
            var cbs = tagDataCallbacks; tagDataCallbacks = [];
            cbs.forEach(function (fn) { fn(); });
        });
    }

    function renderModuleTags(tags) {
        if (!tags || !tags.length) return '';
        var h = '<div class="module-tags">';
        for (var i = 0; i < tags.length; i++) {
            h += '<span class="tag-chip tag-chip--note" data-tag="' + escapeHtml(tags[i]) + '" style="' + tagStyle(tags[i]) + '"><i class="' + _tagIcon + '"></i> ' + escapeHtml(tags[i]) + '</span>';
        }
        return h + '</div>';
    }

    function renderNoteTags() {
        var body = document.querySelector(".note-body");
        if (!body || isHome) return;
        var layout = document.querySelector(".note-layout");
        var curId = getCurrentNoteId();
        ensureTagData(function () {
            var noteTags = [];
            for (var k in tagData) {
                if (tagData[k].noteId.indexOf(curId) !== -1) noteTags.push(k);
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
        });
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
            ensureSearchData(function () {
                var notes = [];
                var sData = searchData || [];
                for (var i = 0; i < info.noteId.length; i++) {
                    for (var j = 0; j < sData.length; j++) {
                        if (sData[j].noteId === info.noteId[i]) { notes.push(sData[j]); break; }
                    }
                }
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
                        _dates = '<span class="tagcloud-note-dates">' +
                            (n.dateCreated ? '创建:' + fmtDate(n.dateCreated) : '') +
                            (n.dateCreated && n.dateModified ? ' · ' : '') +
                            (n.dateModified ? '修改:' + fmtDate(n.dateModified) : '') +
                            '</span>';
                    }
                    h += '<a class="tagcloud-note" href="/' + n.noteId + '">' +
                        '<span class="tagcloud-note-title"' + (n.color ? ' style="color:' + escapeHtml(n.color) + '"' : '') + '>' +
                        '<span class="tagcloud-note-title-text">' + icon + title + '</span>' + _dates +
                        '</span>' +
                        (snippet ? '<span class="tagcloud-note-snippet">' + snippet + '</span>' : '') +
                        tagsHtml +
                        '</a>';
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
            });
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
    function init() {
        initTagCloud();
        renderNoteTags();
        initToc();
        initTocMobile();
        initBackTop();
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
                var y = getScroll();
                if (y <= delta) { header.classList.remove("hidden"); return; }
                if (dy < -delta * 2) header.classList.add("hidden");       // 手指上滑 => 隐藏
                else if (dy > delta * 2) header.classList.remove("hidden"); // 手指下滑 => 显示
            },
            { passive: true }
        );
    }
})();
