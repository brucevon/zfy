(function () {
    // --------------------------------- 常量与状态 --------------------------------- //
    const CONFIG = {
        THEME_KEY: "bento-theme",
        FETCH_TIMEOUT: 3000,
        PLACEHOLDER_CLASS: "tag-placeholder",
        CHIP_CLASS: "tag-chip",
    };

    let state = {};

    var doc = document.documentElement;
    var themeBtn = document.getElementById('theme-toggle');
    var menuBtn = document.getElementById('menu-toggle');
    var mobileMenu = document.getElementById('mobile-menu');

    // --------------------------------- 工具函数 --------------------------------- //
    function escapeHtml(str) {
        if (!str) return "";
        return str.replace(/[&<>"']/g, function (m) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
        });
    }

    function fetchWithTimeout(url, options) {
        var timeout = (options && options.timeout) || CONFIG.FETCH_TIMEOUT;
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, timeout);
        return fetch(url, Object.assign({}, options, { signal: controller.signal }))
            .finally(function () { clearTimeout(timer); });
    }

    // --------------------------------- 主题 --------------------------------- //
    function setTheme(mode) {
        doc.setAttribute("data-theme", mode);
        try { localStorage.setItem(CONFIG.THEME_KEY, mode); } catch (_) {}
        if (themeBtn) themeBtn.textContent = mode === "dark" ? "☀" : "☾";
    }

    function toggleTheme() {
        setTheme(doc.getAttribute("data-theme") === "light" ? "dark" : "light");
    }

    var saved = (function () {
        try { return localStorage.getItem(CONFIG.THEME_KEY); } catch (_) { return null; }
    })();
    setTheme(saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    // --------------------------------- 移动端菜单 --------------------------------- //
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

    // --------------------------------- 分类面板 --------------------------------- //
    var catTriggers = document.querySelectorAll('[data-nav="category"]');
    var catPanel = document.getElementById("category-panel");
    var catTags = document.getElementById("category-tags");

    function closeCategory() { catPanel.classList.remove("open"); }

    async function loadCategories() {
        if (catTags.dataset.loaded === "1") return;
        catTags.innerHTML = '<span class="' + CONFIG.PLACEHOLDER_CLASS + '">加载中...</span>';
        try {
            var r = await fetchWithTimeout("/share/blog-tree");
            if (!r.ok) throw new Error("HTTP " + r.status);
            var data = await r.json();
            var cats = data.categories || [];
            if (cats.length === 0) {
                catTags.innerHTML = '<span class="' + CONFIG.PLACEHOLDER_CLASS + '">暂无分类</span>';
                return;
            }
            catTags.innerHTML = cats.map(function (n) {
                return '<span class="' + CONFIG.CHIP_CLASS + '" data-note-id="' + n.noteId + '">' + escapeHtml(n.title) + '</span>';
            }).join("");
            catPanel.dataset.loaded = "1";
        } catch (err) {
            console.warn("分类加载失败:", err);
            catTags.innerHTML = '<span class="' + CONFIG.PLACEHOLDER_CLASS + '">加载失败</span>';
        }
    }

    if (catTriggers.length && catPanel) {
        catTriggers.forEach(function (el) {
            el.addEventListener("click", function (e) {
                e.preventDefault();
                catPanel.classList.toggle("open");
                if (catPanel.classList.contains("open")) {
                    loadCategories();
                }
            });
        });

        catPanel.addEventListener("click", function (e) {
            if (e.target === catPanel) closeCategory();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeCategory();
        });
    }

    // --------------------------------- 运行天数 --------------------------------- //
    var runDaysEl = document.getElementById("run-days");
    if (runDaysEl) {
        runDaysEl.textContent = Math.max(0, Math.floor((Date.now() - new Date("2026-04-10").getTime()) / 86400000));
    }
})();
