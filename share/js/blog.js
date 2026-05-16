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

    var HOME_ID = "s5augclsPgKT";
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

    /* ── 当前笔记 ID ── */
    function getCurrentNoteId() {
        var parts = window.location.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
    }
    var isHome = getCurrentNoteId() === HOME_ID;

    /* ── 主题 ── */
    function setTheme(m) {
        doc.setAttribute("data-theme", m);
        try {
            localStorage.setItem(KEY, m);
        } catch (_) {}
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
            link.addEventListener("click", closeMobileMenu);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeMobileMenu();
        });
    }

    /* ── 点击任意位置 / 滚动 关闭所有浮层 ──
       用 capture:true 确保能捕获到 div.page 内部的点击/滚动
    ── */
    document.addEventListener(
        "click",
        function (e) {
            // 关闭移动菜单
            if (mobileMenu && mobileMenu.classList.contains("open")) {
                if (
                    !mobileMenu.contains(e.target) &&
                    menuBtn &&
                    !menuBtn.contains(e.target)
                ) {
                    closeMobileMenu();
                }
            }
            // 关闭分类面板（点到 category-tags 内容区之外）
            if (categoryPanel && categoryPanel.classList.contains("open")) {
                var inner = document.getElementById("category-tags");
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

    // 滚动时关闭移动菜单
    document.addEventListener(
        "scroll",
        function () {
            closeMobileMenu();
        },
        { capture: true, passive: true },
    );

    /* ── 分类面板 ── */
    var TREE_JSON_URL = "/share/blog-tree";
    var treeData = null;

    function openCategoryPanel(e) {
        e.preventDefault();
        e.stopPropagation();
        closeMobileMenu();
        if (categoryPanel) {
            categoryPanel.classList.add("open");
            loadCategoryTree();
        }
    }

    if (categoryBtn) categoryBtn.addEventListener("click", openCategoryPanel);
    if (categoryBtnM) categoryBtnM.addEventListener("click", openCategoryPanel);
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeMobileMenu();
            closeCategoryPanel();
        }
    });

    /* ── 顶部胶囊滚动显隐 ──
       规则：
       - 首页（isHome）：永远显示，不隐藏
       - 笔记页：向下滚动超阈值隐藏，向上滚动超阈值显示，顶部始终显示
    ── */
    var THRESHOLD = 10;
    var barVisible = true; // 初始可见
    var lastY = 0;
    var ticking = false;

    // 初始化：首页不隐藏，笔记页初始隐藏（等第一次上划再显示）
    if (bar) {
        if (isHome) {
            bar.classList.remove("top-bar--hidden");
            barVisible = true;
        } else {
            // 笔记页初始显示，向下滚动再隐藏
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
            // 首页：永远显示
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

    // capture 监听，捕获 div.page 的 scroll（不冒泡到 window）
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

    // 直接绑 .page 双重保险
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
                (Date.now() - new Date("2026-04-10").getTime()) / 86400000,
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

    /* ── 加载分类树 ── */
    function loadCategoryTree() {
        var treeList = document.getElementById("tree-list");
        if (!treeList) return;
        var currentId = getCurrentNoteId();
        if (treeData) {
            renderTree(treeData, treeList, currentId);
            return;
        }
        fetch(TREE_JSON_URL)
            .then(function (r) {
                return r.json();
            })
            .then(function (d) {
                treeData = d;
                renderTree(d, treeList, currentId);
            })
            .catch(function () {
                treeList.innerHTML =
                    '<li class="tree-item"><span class="tag-chip">加载失败</span></li>';
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
            if (item.category === true) {
                titleEl = document.createElement("span");
                titleEl.className = "tag-chip";
                titleEl.textContent = item.title;
                titleEl.style.cursor = hasKids ? "pointer" : "default";
                if (hasKids) {
                    titleEl.addEventListener("click", function (e) {
                        e.stopPropagation();
                        toggleTree({
                            currentTarget: toggle,
                            preventDefault: function () {},
                            stopPropagation: function () {},
                        });
                    });
                }
            } else {
                titleEl = document.createElement("a");
                titleEl.href = item.noteId;
                titleEl.className = "tag-chip";
                titleEl.textContent = item.title;
                titleEl.addEventListener("click", closeCategoryPanel);
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
                h.id = "toc-" + (++tocId);
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
            var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
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

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /* ── 初始化 TOC ── */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            initToc();
            initTocMobile();
        });
    } else {
        initToc();
        initTocMobile();
    }
})();
