#!/usr/bin/env node
/**
 * 构建脚本：把 share/css/blog.css 与 share/js/blog.js 压缩后内联进 share/blog.ejs，
 * 生成单文件部署产物 share/blog.min.ejs（源码三件套保持可读，仓库同时保留）。
 *
 * 用法:
 *   node build-min.js
 *
 * 依赖: Node.js + npx（首次运行自动拉取 esbuild）
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SHARE = path.join(ROOT, "share");
const SRC = {
    ejs: path.join(SHARE, "blog.ejs"),
    css: path.join(SHARE, "css", "blog.css"),
    js: path.join(SHARE, "js", "blog.js"),
};
const OUT = path.join(SHARE, "blog.min.ejs");

/** 压缩锚点（替换为内联块） */
const ANCHORS = {
    css: `<link rel="stylesheet" href="/blog.css" />`,
    js: `<script src="/blog.js" defer></script>`,
};

/** 调用 esbuild CLI 压缩单个文件（输入文件根据扩展名自动选择 loader） */
function minify(file) {
    const res = spawnSync("npx", ["--yes", "esbuild", file, "--minify"], {
        encoding: "utf8",
        timeout: 120000,
    });
    if (res.error) throw new Error(`无法执行 npx esbuild: ${res.error.message}`);
    if (res.status !== 0)
        throw new Error(`esbuild 失败(${path.basename(file)}): ${res.stderr}`);
    const out = (res.stdout || "").trim();
    if (!out) throw new Error(`esbuild 输出为空: ${path.basename(file)}`);
    // 内联到 <script> 时的防截断处理
    if (/<\/script/i.test(out)) throw new Error(`${path.basename(file)} 含 </script>，无法安全内联`);
    return out;
}

/** 构建后自检：内联块语法完整、无截断风险 */
function verify(html) {
    const jsBlocks = [];
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html)) !== null) jsBlocks.push(m[1].trim());
    const big = jsBlocks.reduce((a, b) => (b.length > a.length ? b : a), "");
    if (big.includes("</script"))
        throw new Error("内联 JS 中含 </script，无法安全内联");
    const tmp = path.join(require("os").tmpdir(), "zfy-check-min.js");
    fs.writeFileSync(tmp, big, "utf8");
    const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
    if (r.status !== 0)
        throw new Error("内联 JS 语法校验失败: " + (r.stderr || "").slice(0, 300));
}

function build() {
    const tpl = fs.readFileSync(SRC.ejs, "utf8");
    const cssMin = minify(SRC.css);
    const jsMin = minify(SRC.js);

    if (!tpl.includes(ANCHORS.css) || !tpl.includes(ANCHORS.js))
        throw new Error("blog.ejs 中未找到 css/js 锚点，模板结构可能已变更");

    // 注意：必须用函数形式的 replace，避免替换内容中的 "$&"、"$1" 等被当成特殊替换模式展开
    const html = tpl
        .replace(ANCHORS.css, function () { return `<style>\n${cssMin}\n</style>`; })
        .replace(ANCHORS.js, function () { return `<script>\n${jsMin}\n</script>`; });

    verify(html);
    fs.writeFileSync(OUT, html, "utf8");
    const kb = (s) => (fs.statSync(s).size / 1024).toFixed(1);
    console.log("已生成 " + path.relative(ROOT, OUT));
    console.log(
        `  css: ${kb(SRC.css)}KB -> ${(cssMin.length / 1024).toFixed(1)}KB` +
        ` | js: ${kb(SRC.js)}KB -> ${(jsMin.length / 1024).toFixed(1)}KB` +
        ` | ejs 合计: ${(html.length / 1024).toFixed(1)}KB`
    );
    console.log("  自检通过 ✓（内联 JS 语法完整）");
}

build();