(function () {
    // 动态注入 viewport meta（Trilium 默认不输出，缺少会导致移动端 media query 不触发）
    var meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    document.head.appendChild(meta);

    // 移动端检测兜底（@media 未触发时通过 .mobile-view class 启用移动样式）
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
            mobileMenu.classList.toggle("open");
        });

        mobileMenu.querySelectorAll(".nav-item").forEach(function (link) {
            link.addEventListener("click", function () {
                mobileMenu.classList.remove("open");
            });
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") mobileMenu.classList.remove("open");
        });
    }

    /* --- category panel --- */
    var TREE_JSON_URL = "/share/blog-tree";
    var treeData = null;

    var categoryBtnMobile = document.getElementById("category-btn-mobile");

    if (categoryPanel) {
        function openCategoryPanel(e) {
            e.preventDefault();
            e.stopPropagation();
            categoryPanel.classList.add("open");
            loadCategoryTree();
        }
        if (categoryBtn) categoryBtn.addEventListener("click", openCategoryPanel);
        if (categoryBtnMobile) categoryBtnMobile.addEventListener("click", openCategoryPanel);

        categoryPanel.addEventListener("click", function (e) {
            if (e.target === categoryPanel) {
                categoryPanel.classList.remove("open");
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") categoryPanel.classList.remove("open");
        });
    } else {
        if (!categoryBtn)
            console.log(
                '❌ category-btn 未找到！检查 HTML 中是否有 id="category-btn"',
            );
        if (!categoryPanel)
            console.log(
                '❌ category-panel 未找到！检查 HTML 中是否有 id="category-panel"',
            );
    }

    /* --- top bar scroll show/hide --- */
    var SCROLL_THRESHOLD = 15;
    var barVisible = true;
    var scrollTicking = false;

    function getScrollY() {
        var sy = window.scrollY;
        if (sy > 0) return sy;
        var ce = document.getElementById("content");
        return ce ? ce.scrollTop : 0;
    }

    function setBarVisible(show) {
        if (show === barVisible) return;
        barVisible = show;
        var bar = document.querySelector(".top-bar");
        if (bar) bar.classList.toggle("top-bar--hidden", !show);
    }

    function onScroll() {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(function () {
            var sy = getScrollY();
            var delta = sy - (window._lastScrollY || 0);

            if (sy <= 0) {
                setBarVisible(true);
            } else if (delta > SCROLL_THRESHOLD) {
                setBarVisible(false);
            } else if (delta < -SCROLL_THRESHOLD) {
                setBarVisible(true);
            }

            window._lastScrollY = sy;
            scrollTicking = false;
        });
    }

    window.addEventListener("scroll", onScroll);
    var contentEl = document.getElementById("content");
    if (contentEl) contentEl.addEventListener("scroll", onScroll);

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

    // ===== 递归渲染 JSON 到 DOM（支持定位展开） =====
    function renderTreeFromJson(items, container, currentNoteId) {
        container.innerHTML = "";
        var foundInThisLevel = false;

        items.forEach(function (item) {
            var li = document.createElement("li");
            li.className = "tree-item";

            var node = document.createElement("div");
            node.className = "tree-node";

            // 展开/折叠按钮
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

            // 标题
            var titleEl;
            var isCurrent = item.noteId === currentNoteId;
            if (item.category === true) {
                titleEl = document.createElement("span");
                titleEl.className = "tag-chip";
                titleEl.textContent = item.title;
                // 有子节点的分类：点击标题也展开/折叠
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
            }

            // 高亮当前笔记
            if (isCurrent) {
                titleEl.style.fontWeight = "bold";
                titleEl.style.color = "var(--accent, #3b82f6)";
                foundInThisLevel = true;
            }

            node.appendChild(toggle);
            node.appendChild(titleEl);
            li.appendChild(node);

            // 子节点
            if (hasChildren) {
                var childContainer = document.createElement("ul");
                childContainer.className = "tree-children";
                childContainer.style.display = "none";

                var childFound = renderTreeFromJson(
                    item.children,
                    childContainer,
                    currentNoteId,
                );

                // 如果子节点中包含当前笔记，展开当前层级
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
