(function () {
    // 动态注入 viewport meta
    var meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    document.head.appendChild(meta);

    // 移动端检测兜底
    (function () {
        var MOBILE_BREAKPOINT = 768;
        var root = document.documentElement;
        function update() {
            root.classList.toggle(
                "mobile-view",
                window.innerWidth <= MOBILE_BREAKPOINT,
            );
        }
        update();
        setTimeout(update, 500);
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", function () {
            setTimeout(update, 200);
        });
    })();

    var KEY = "bento-theme";
    var doc = document.documentElement;
    var themeBtn = document.getElementById("theme-toggle");
    var menuBtn = document.getElementById("menu-toggle");
    var mobileMenu = document.getElementById("mobile-menu");
    var categoryBtn = document.getElementById("category-btn");
    var categoryPanel = document.getElementById("category-panel");

    /* --- theme --- */
    function setTheme(mode) {
        doc.setAttribute("data-theme", mode);
        try {
            localStorage.setItem(KEY, mode);
        } catch (_) {}
        if (themeBtn) themeBtn.textContent = mode === "dark" ? "☀" : "☾";
    }

    function toggleTheme() {
        var next =
            doc.getAttribute("data-theme") === "light" ? "dark" : "light";
        setTheme(next);
    }

    var saved = (function () {
        try {
            return localStorage.getItem(KEY);
        } catch (_) {
            return null;
        }
    })();

    if (saved) {
        setTheme(saved);
    } else {
        var prefersDark =
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDark ? "dark" : "light");
    }

    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    /* --- mobile menu --- */
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var isOpen = mobileMenu.classList.toggle("open");
            if (isOpen && categoryPanel) {
                categoryPanel.classList.remove("open");
            }
        });

        mobileMenu.querySelectorAll(".nav-item").forEach(function (link) {
            link.addEventListener("click", function () {
                mobileMenu.classList.remove("open");
            });
        });

        // capture 阶段捕获点击，确保点菜单外任意位置都能关闭
        document.addEventListener(
            "click",
            function (e) {
                if (
                    mobileMenu.classList.contains("open") &&
                    !mobileMenu.contains(e.target) &&
                    !menuBtn.contains(e.target)
                ) {
                    mobileMenu.classList.remove("open");
                }
            },
            true,
        );

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") mobileMenu.classList.remove("open");
        });
    }

    /* --- category panel --- */
    var TREE_JSON_URL = "/share/blog-tree";
    var treeData = null;
    var categoryBtnMobile = document.getElementById("category-btn-mobile");

    function closeCategoryPanel() {
        if (categoryPanel) categoryPanel.classList.remove("open");
    }

    function openCategoryPanel(e) {
        e.preventDefault();
        e.stopPropagation();
        if (mobileMenu) mobileMenu.classList.remove("open");
        categoryPanel.classList.add("open");
        loadCategoryTree();
    }

    if (categoryPanel) {
        if (categoryBtn)
            categoryBtn.addEventListener("click", openCategoryPanel);
        if (categoryBtnMobile)
            categoryBtnMobile.addEventListener("click", openCategoryPanel);

        // 点击面板背景（category-tags 之外）关闭
        categoryPanel.addEventListener("click", function (e) {
            var inner = document.getElementById("category-tags");
            if (inner && inner.contains(e.target)) return;
            closeCategoryPanel();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeCategoryPanel();
        });
    }

    /* ============================================
       顶部胶囊滚动显隐
       真实滚动容器：div.page（通过 document capture 捕获）
    ============================================ */
    var SCROLL_THRESHOLD = 10;
    var barVisible = true;
    var lastScrollY = 0;
    var scrollTicking = false;

    function setBarVisible(show) {
        if (show === barVisible) return;
        barVisible = show;
        var bar = document.querySelector(".top-bar");
        if (bar) bar.classList.toggle("top-bar--hidden", !show);
    }

    function onScroll(e) {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(function () {
            var target = (e && e.target) || document.documentElement;
            var sy =
                target && typeof target.scrollTop === "number"
                    ? target.scrollTop
                    : window.scrollY || 0;

            var delta = sy - lastScrollY;

            if (sy <= 5) {
                setBarVisible(true);
            } else if (delta > SCROLL_THRESHOLD) {
                setBarVisible(false);
            } else if (delta < -SCROLL_THRESHOLD) {
                setBarVisible(true);
            }

            lastScrollY = sy;
            scrollTicking = false;
        });
    }

    // capture:true 可以捕获冒泡不到 window 的 scroll 事件（如 div.page）
    document.addEventListener("scroll", onScroll, {
        capture: true,
        passive: true,
    });

    // 直接绑定 div.page，双重保险
    function bindPageScroll() {
        var pageEl = document.querySelector(".page");
        if (pageEl) {
            pageEl.addEventListener("scroll", onScroll, { passive: true });
            lastScrollY = pageEl.scrollTop;
        }
    }
    // DOM 可能还没渲染完，延迟一帧再绑
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindPageScroll);
    } else {
        bindPageScroll();
    }

    /* --- running days --- */
    var el = document.getElementById("run-days");
    if (el) {
        var days = Math.max(
            0,
            Math.floor(
                (Date.now() - new Date("2026-04-10").getTime()) / 86400000,
            ),
        );
        el.textContent = days;
    }

    // ===== 获取当前笔记 ID =====
    function getCurrentNoteId() {
        var path = window.location.pathname;
        var parts = path.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
    }

    // ===== 加载分类树 =====
    function loadCategoryTree() {
        var treeList = document.getElementById("tree-list");
        if (!treeList) return;

        var currentNoteId = getCurrentNoteId();

        if (treeData) {
            renderTreeFromJson(treeData, treeList, currentNoteId);
            return;
        }

        fetch(TREE_JSON_URL)
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                treeData = data;
                renderTreeFromJson(treeData, treeList, currentNoteId);
            })
            .catch(function (err) {
                console.log("加载目录失败:", err);
                treeList.innerHTML =
                    '<li class="tree-item"><span class="tag-chip">加载失败</span></li>';
            });
    }

    // ===== 递归渲染 JSON 到 DOM =====
    function renderTreeFromJson(items, container, currentNoteId) {
        container.innerHTML = "";
        var foundInThisLevel = false;

        items.forEach(function (item) {
            var li = document.createElement("li");
            li.className = "tree-item";

            var node = document.createElement("div");
            node.className = "tree-node";

            var hasChildren = item.children && item.children.length > 0;
            var toggle = document.createElement("span");
            toggle.className = "tree-toggle";
            if (hasChildren) {
                toggle.textContent = "▶";
                toggle.addEventListener("click", toggleTree);
            } else {
                toggle.classList.add("tree-toggle--empty");
                toggle.textContent = "▶";
            }

            var titleEl;
            var isCurrent = item.noteId === currentNoteId;
            if (item.category === true) {
                titleEl = document.createElement("span");
                titleEl.className = "tag-chip";
                titleEl.textContent = item.title;
                if (hasChildren) {
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
                    titleEl.style.cursor = "default";
                }
            } else {
                titleEl = document.createElement("a");
                titleEl.href = item.noteId;
                titleEl.className = "tag-chip";
                titleEl.textContent = item.title;
                titleEl.addEventListener("click", function () {
                    closeCategoryPanel();
                });
            }

            if (isCurrent) {
                titleEl.style.fontWeight = "bold";
                titleEl.style.color = "var(--accent, #3b82f6)";
                foundInThisLevel = true;
            }

            node.appendChild(toggle);
            node.appendChild(titleEl);
            li.appendChild(node);

            if (hasChildren) {
                var childContainer = document.createElement("ul");
                childContainer.className = "tree-children";
                childContainer.style.display = "none";

                var childFound = renderTreeFromJson(
                    item.children,
                    childContainer,
                    currentNoteId,
                );

                if (childFound) {
                    childContainer.style.display = "block";
                    toggle.classList.add("expanded");
                    toggle.textContent = "▼";
                    foundInThisLevel = true;
                }

                li.appendChild(childContainer);
            }

            container.appendChild(li);
        });

        return foundInThisLevel;
    }

    // ===== 树形菜单展开/折叠 =====
    function toggleTree(event) {
        event.preventDefault();
        event.stopPropagation();

        var toggle = event.currentTarget;
        var treeItem = toggle.closest(".tree-item");
        var children = treeItem.querySelector(":scope > .tree-children");

        if (!children) return;

        if (
            children.style.display === "none" ||
            children.style.display === ""
        ) {
            children.style.display = "block";
            toggle.classList.add("expanded");
            toggle.textContent = "▼";
        } else {
            children.style.display = "none";
            toggle.classList.remove("expanded");
            toggle.textContent = "▶";
        }
    }
})();
