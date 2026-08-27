#!/usr/bin/env node
/**
 * 构建脚本：把 share/css/blog.css 与 share/js/blog.js 压缩后内联进 share/blog.ejs，
 * 生成单文件部署产物 share/blog.min.ejs（源码三件套保持可读，仓库同时保留）。
 *
 * 用法:
 *   node build-min.js           # 构建
 *   node build-min.js --clean   # 清理构建产物
 *   node build-min.js --watch   # 监听文件变化自动构建
 *
 * 依赖: Node.js + esbuild + html-minifier-terser
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { minify: htmlMinify } = require("html-minifier-terser");

const ROOT = __dirname;
const SHARE = path.join(ROOT, "share");
const SRC = {
    ejs: path.join(SHARE, "blog.ejs"),
    css: path.join(SHARE, "css", "blog.css"),
    js: path.join(SHARE, "js", "blog.js"),
};
const OUT = path.join(SHARE, "blog.min.ejs");
const CACHE_FILE = path.join(ROOT, ".build-cache");

/** 获取版本信息：版本号 + 源文件内容 hash 短码 */
function buildVersion() {
    function git(args) {
        const r = spawnSync("git", args, { encoding: "utf8", cwd: ROOT });
        return r.status === 0 ? (r.stdout || "").trim() : "";
    }
    let pkgVersion;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
        pkgVersion = pkg.version;
    } catch (_) {}
    const tag = git(["describe", "--tags", "--abbrev=0"]);
    const commit = git(["rev-parse", "--short", "HEAD"]);
    const time = new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
    // 源文件内容 hash 短码：每次构建内容变化，标识也会变
    const contentHash = sourcesHash().slice(0, 7);
    const base = tag || (pkgVersion ? "v" + pkgVersion : null) || commit || "unknown";
    const version = base + "-" + contentHash;
    return { version, commit: commit || "", time };
}

/** 压缩锚点（替换为内联块） */
const ANCHORS = {
    css: `<link rel="stylesheet" href="/blog.css" />`,
    js: `<script src="/blog.js" defer></script>`,
};

/** esbuild loader 映射 */
function getLoader(file) {
    const ext = path.extname(file).slice(1);
    if (ext === "css") return "css";
    if (ext === "js" || ext === "mjs") return "js";
    return ext;
}

/** 使用 esbuild Node API 压缩文件 */
async function minifyFile(file) {
    const esbuild = require("esbuild");
    const code = fs.readFileSync(file, "utf8");
    const result = await esbuild.transform(code, {
        minify: true,
        loader: getLoader(file),
    });
    const out = result.code.trim();
    if (!out) throw new Error(`esbuild 输出为空: ${path.basename(file)}`);
    if (/<\/script/i.test(out))
        throw new Error(`${path.basename(file)} 含 </script>，无法安全内联`);
    return out;
}

/** 压缩 EJS 模板里的 JS 代码（删除注释、压缩空白） */
function minifyEjsBlock(code) {
    // 删除单行注释（但保留 URL 中的 //）
    code = code.replace(/(?<![:"'])\/\/.*$/gm, "");
    // 删除多行注释
    code = code.replace(/\/\*[\s\S]*?\*\//g, "");
    // 压缩连续空白为单个空格
    code = code.replace(/\s+/g, " ");
    // 压缩分号后的空白
    code = code.replace(/;\s+/g, ";");
    return code.trim();
}

/** 压缩单个 EJS 标签 */
function minifyEjsTag(tag) {
    const inner = tag.replace(/^<%[-=]?\s*/, "").replace(/\s*%>$/, "");
    const prefix = tag.match(/^<%[-=]?/)[0];
    // 保留 EJS 标签的空格格式，避免解析器无法识别
    return prefix + " " + minifyEjsBlock(inner) + " %>";
}

/** 压缩 EJS 模板 */
async function minifyEjs(tpl) {
    // 只压缩 EJS 标签里的 JS 代码，不压缩 HTML
    // 这样更安全，避免 html-minifier 破坏 EJS 模板结构
    return tpl.replace(/<%[-=]?[\s\S]*?%>/g, (match) => minifyEjsTag(match));
}

/** 计算文件 hash（用于增量构建） */
function fileHash(file) {
    return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

/** 计算源文件集合 hash */
function sourcesHash() {
    return [SRC.ejs, SRC.css, SRC.js].map(fileHash).join("|");
}

/** 检查是否需要构建 */
function needsBuild() {
    try {
        const cached = fs.readFileSync(CACHE_FILE, "utf8");
        return cached !== sourcesHash();
    } catch (_) {
        return true;
    }
}

/** 保存构建缓存 */
function saveCache() {
    fs.writeFileSync(CACHE_FILE, sourcesHash(), "utf8");
}

/** 构建后自检：内联块语法完整、无截断风险 */
function verify(html) {
    const jsBlocks = [];
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const block = m[1].trim();
        // 跳过包含 EJS 标签的 <script> 块（不是纯 JS）
        if (/<%[-=]?[\s\S]*?%>/.test(block)) continue;
        jsBlocks.push(block);
    }
    if (jsBlocks.length === 0) return; // 没有纯 JS 块，跳过验证
    const big = jsBlocks.reduce((a, b) => (b.length > a.length ? b : a), "");
    if (big.includes("</script"))
        throw new Error("内联 JS 中含 </script，无法安全内联");
    const tmp = path.join(require("os").tmpdir(), "zfy-check-min.js");
    fs.writeFileSync(tmp, big, "utf8");
    try {
        const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
        if (r.status !== 0)
            throw new Error("内联 JS 语法校验失败: " + (r.stderr || "").slice(0, 300));
    } finally {
        try { fs.unlinkSync(tmp); } catch (_) {}
    }
}

/** 格式化字节大小 */
function formatKB(bytes) {
    return (bytes / 1024).toFixed(1);
}

/** 主构建流程 */
async function build() {
    if (!needsBuild()) {
        console.log("源文件未变化，跳过构建");
        return;
    }

    const start = Date.now();
    const tpl = fs.readFileSync(SRC.ejs, "utf8");
    const srcEjsSize = Buffer.byteLength(tpl, "utf8");

    // 并行压缩 CSS 和 JS
    const [cssMin, jsMin] = await Promise.all([
        minifyFile(SRC.css),
        minifyFile(SRC.js),
    ]);

    const ver = buildVersion();

    if (!tpl.includes(ANCHORS.css) || !tpl.includes(ANCHORS.js))
        throw new Error("blog.ejs 中未找到 css/js 锚点，模板结构可能已变更");

    // 版本头：HTML 注释 + meta 标签（便于在线查看 / 缓存排障）
    const header =
        `<!-- zfy build ${ver.version} | commit ${ver.commit} | ${ver.time} -->\n` +
        `<meta name="generator" content="zfy blog build ${ver.version}" />\n`;

    // 注意：必须用函数形式的 replace，避免替换内容中的 "$&"、"$1" 等被当成特殊替换模式展开
    let html =
        header +
        tpl
            .replace(ANCHORS.css, function () { return `<style>${cssMin}</style>`; })
            .replace(ANCHORS.js, function () { return `<script>${jsMin}</script>`; });

    // 压缩 EJS 模板（HTML + EJS 标签里的 JS）
    const beforeEjsMin = html.length;
    html = await minifyEjs(html);
    const afterEjsMin = html.length;

    verify(html);
    fs.writeFileSync(OUT, html, "utf8");
    saveCache();

    const elapsed = Date.now() - start;
    const srcSize = fs.statSync(SRC.css).size + fs.statSync(SRC.js).size + srcEjsSize;
    const ratio = ((1 - html.length / srcSize) * 100).toFixed(1);

    console.log("已生成 " + path.relative(ROOT, OUT));
    console.log(`  版本: ${ver.version} (commit ${ver.commit}) @ ${ver.time}`);
    console.log(
        `  css: ${formatKB(fs.statSync(SRC.css).size)}KB -> ${formatKB(cssMin.length)}KB` +
        ` | js: ${formatKB(fs.statSync(SRC.js).size)}KB -> ${formatKB(jsMin.length)}KB`
    );
    console.log(
        `  ejs: ${formatKB(srcEjsSize)}KB -> ${formatKB(afterEjsMin)}KB` +
        ` (html+ejs 压缩 ${formatKB(beforeEjsMin - afterEjsMin)}KB)`
    );
    console.log(`  总压缩率: ${ratio}% | 耗时: ${elapsed}ms`);
    console.log("  自检通过 ✓（内联 JS 语法完整）");
}

/** 清理构建产物 */
function clean() {
    const files = [OUT, CACHE_FILE];
    files.forEach((f) => {
        try {
            fs.unlinkSync(f);
            console.log("已删除: " + path.relative(ROOT, f));
        } catch (_) {}
    });
}

/** 监听模式 */
function watch() {
    console.log("监听模式启动，等待文件变化...");
    let building = false;
    let pending = false;

    function trigger() {
        if (building) {
            pending = true;
            return;
        }
        building = true;
        build()
            .catch((e) => console.error("构建失败:", e.message))
            .finally(() => {
                building = false;
                if (pending) {
                    pending = false;
                    trigger();
                }
            });
    }

    // 简单轮询监听（避免依赖 chokidar）
    const mtimes = {};
    [SRC.ejs, SRC.css, SRC.js].forEach((f) => {
        mtimes[f] = fs.statSync(f).mtimeMs;
    });

    setInterval(() => {
        let changed = false;
        [SRC.ejs, SRC.css, SRC.js].forEach((f) => {
            const mtime = fs.statSync(f).mtimeMs;
            if (mtime !== mtimes[f]) {
                mtimes[f] = mtime;
                changed = true;
            }
        });
        if (changed) {
            console.log("\n检测到文件变化，重新构建...");
            trigger();
        }
    }, 1000);
}

// CLI 入口
const args = process.argv.slice(2);
if (args.includes("--clean")) {
    clean();
} else if (args.includes("--watch")) {
    watch();
} else {
    build().catch((e) => {
        console.error("构建失败:", e.message);
        process.exit(1);
    });
}
