/**
 * 博客聚合数据 + 搜索索引 (Backend Script)
 *
 * 合并 data 与 search 两个模块为单一脚本，按 moduleName 参数决定执行哪个，
 * 无参数时默认全部执行，写入各自目标笔记。
 *
 * 标签:
 *   rootNoteId      = <根笔记ID>            (可选，tree/aboutTree/tags 需要)
 *   dataSaveNoteId  = <聚合数据目标笔记ID>   (必需)
 *   searchSaveNoteId= <搜索索引目标笔记ID>   (必需)
 *   dataLen         = <聚合数据截取长度>      (可选，默认 150)
 *   searchLen       = <搜索索引截取长度>      (可选，默认 500)
 *
 * 前端通过 api._syncConfig.moduleName = "data" | "search" 指定执行单个模块。
 * Trilium 直接执行 / #run 定时任务时，无 moduleName 则全部执行。
 */

var TREE_MAX_DEPTH = 50;
var SEARCH_MAX_DEPTH = 50;

// ── 共享工具函数 ──

function stripHtml(str) {
    if (!str) return "";
    return str
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
}

function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str || "";
    return str.substring(0, maxLen) + "…";
}

/** 从 HTML 内容中提取第一张图片的 src，没有则返回空字符串 */
function extractCoverImg(html) {
    if (!html) return "";
    var m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : "";
}

// ── 共享查询函数 ──

/**
 * 通用目录树构建：递归查询 rootId 下所有后代构建嵌套树。
 * skipId 为构建根自身（避免根节点被包进 children）。
 */
async function buildTree(rootId, skipId) {
    var nodes = [];
    try {
        nodes = await api.sql.getRows(
            "WITH RECURSIVE subtree AS (" +
            "  SELECT n.noteId, n.title, b.parentNoteId, 0 AS depth" +
            "  FROM notes n" +
            "  INNER JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  WHERE b.parentNoteId = ? AND n.isDeleted = 0" +
            "  UNION ALL" +
            "  SELECT n.noteId, n.title, b.parentNoteId, s.depth + 1" +
            "  FROM notes n" +
            "  INNER JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  INNER JOIN subtree s ON b.parentNoteId = s.noteId" +
            "  WHERE n.isDeleted = 0 AND s.depth < ?" +
            ") SELECT DISTINCT noteId, title, parentNoteId FROM subtree",
            [rootId, TREE_MAX_DEPTH],
        );
    } catch (e) {
        console.error("tree 查询失败: " + e.message);
        return [];
    }
    if (!nodes.length) return [];

    var noteIds = [];
    for (var i = 0; i < nodes.length; i++) {
        if (noteIds.indexOf(nodes[i].noteId) === -1) noteIds.push(nodes[i].noteId);
    }

    var labels = await queryLabels(noteIds);

    var catSet = {};
    var hiddenSet = {};
    var iconMap = {};
    var colorMap = {};
    var externalLinkMap = {};
    var shareAliasMap = {};
    for (var li = 0; li < labels.length; li++) {
        var la = labels[li];
        if (la.name === "category" && la.value === "true") catSet[la.noteId] = true;
        if (la.name === "shareHiddenFromTree" && la.value === "true") hiddenSet[la.noteId] = true;
        if (la.name === "icon") iconMap[la.noteId] = la.value;
        if (la.name === "color") colorMap[la.noteId] = la.value;
        if (la.name === "shareExternalLink") externalLinkMap[la.noteId] = la.value;
        if (la.name === "shareAlias") shareAliasMap[la.noteId] = la.value;
    }
    for (var li2 = 0; li2 < labels.length; li2++) {
        if (labels[li2].name === "iconClass" && !iconMap[labels[li2].noteId]) {
            iconMap[labels[li2].noteId] = labels[li2].value;
        }
    }

    var childrenMap = {};
    for (var ni = 0; ni < nodes.length; ni++) {
        var pid = nodes[ni].parentNoteId;
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(nodes[ni]);
    }

    function buildChildren(parentId) {
        var children = childrenMap[parentId] || [];
        var result = [];
        for (var ci = 0; ci < children.length; ci++) {
            var n = children[ci];
            if (n.noteId === skipId) continue;
            if (hiddenSet[n.noteId]) continue;
            result.push({
                noteId: n.noteId,
                title: n.title,
                noteIcon: iconMap[n.noteId] || "",
                color: colorMap[n.noteId] || "",
                category: !!catSet[n.noteId],
                shareExternalLink: externalLinkMap[n.noteId] || "",
                shareAlias: shareAliasMap[n.noteId] || "",
                children: buildChildren(n.noteId),
            });
        }
        return result;
    }

    return buildChildren(rootId);
}

/** 批量查询标签（labels），返回原始行数组 */
async function queryLabels(noteIds) {
    if (!noteIds || noteIds.length === 0) return [];
    var ph = noteIds.map(function () { return "?"; }).join(",");
    try {
        return await api.sql.getRows(
            "SELECT noteId, name, value FROM attributes " +
            "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" + ph + ")",
            noteIds,
        );
    } catch (e) {
        console.error("标签查询失败: " + e.message);
        return [];
    }
}

/**
 * 标签云聚合：根笔记后代中所有 #noteTag 标签。
 * SQL 内完成去重与聚合，返回 { tagName: { count, noteId: [...] } }。
 */
async function buildTags(rootId) {
    var tags = {};
    try {
        var rows = await api.sql.getRows(
            "WITH RECURSIVE descendants AS (" +
            "  SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0" +
            "  UNION ALL" +
            "  SELECT b.noteId FROM branches b INNER JOIN descendants d ON b.parentNoteId = d.noteId WHERE b.isDeleted = 0" +
            ") " +
            "SELECT tag, COUNT(*) AS count, json_group_array(noteId ORDER BY dateCreated DESC) AS ids FROM (" +
            "  SELECT DISTINCT a.noteId AS noteId, a.value AS tag, n.dateCreated" +
            "  FROM attributes a" +
            "  INNER JOIN descendants d ON a.noteId = d.noteId" +
            "  INNER JOIN notes n ON n.noteId = a.noteId" +
            "  WHERE a.type = 'label' AND a.name = 'noteTag' AND a.isDeleted = 0 AND n.isDeleted = 0" +
            ") GROUP BY tag",
            [rootId],
        );
        for (var i = 0; i < rows.length; i++) {
            var noteIdArr = [];
            if (rows[i].ids) {
                try { noteIdArr = JSON.parse(rows[i].ids) || []; } catch (_e) { noteIdArr = []; }
            }
            tags[rows[i].tag] = { count: parseInt(rows[i].count, 10) || 0, noteId: noteIdArr };
        }
    } catch (e) {
        console.error("tags 查询失败: " + e.message);
    }
    return tags;
}

// ── 模块：聚合数据 ──

async function syncData() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    var targetNoteId = cfg.dataSaveNoteId;
    if (!targetNoteId) throw new Error("缺少配置: dataSaveNoteId");

    var contentLen = (cfg.dataLen && cfg.dataLen > 0) ? cfg.dataLen : 150;
    var queryContentLimit = contentLen * 3 + 500;

    var startTime = Date.now();
    var data = {
        tree: [],
        aboutTree: [],
        tags: {},
        article: [],
        recentUpdate: [],
        announcement: null,
        recommend: [],
        stats: { article: 0, recommend: 0, recentUpdate: 0, announcement: 0 },
        heatmap: [],
    };

    // ── 1. 目录树 + 关于树 + 标签云（需要 rootNoteId） ──
    if (rootNoteId) {
        try {
            data.tree = await buildTree(rootNoteId, rootNoteId);
        } catch (e) {
            console.error("tree 构建失败: " + e.message);
        }
        try {
            var aboutNote = await api.sql.getRow(
                "SELECT n.noteId FROM notes n " +
                "INNER JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0 " +
                "WHERE b.parentNoteId = ? AND n.isDeleted = 0 AND n.title = '关于'",
                [rootNoteId],
            );
            if (aboutNote) {
                data.aboutTree = await buildTree(aboutNote.noteId, aboutNote.noteId);
            }
        } catch (e) {
            console.error("about-tree 构建失败: " + e.message);
        }
        try {
            data.tags = await buildTags(rootNoteId);
        } catch (e) {
            console.error("tags 构建失败: " + e.message);
        }
    }

    // ── 2. 一次合并查询全部模块笔记（region 区分），按创建时间倒序 ──
    var rows = [];
    try {
        rows = await api.sql.getRows(
            "SELECT a.name AS region, n.noteId, n.title, n.dateCreated, n.dateModified, " +
            "  COALESCE(SUBSTR(COALESCE(b.content, ''), 1, ?), '') AS c " +
            "FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.isDeleted = 0 " +
            "  AND a.name IN ('article', 'recentUpdate', 'announcement', 'recommend') AND a.value = 'true' " +
            "LEFT JOIN blobs b ON n.blobId = b.blobId " +
            "WHERE n.isDeleted = 0 AND (a.name != 'recentUpdate' OR (n.title IS NOT NULL AND n.title != '')) " +
            "ORDER BY a.name, n.dateCreated DESC",
            [queryContentLimit],
        );
    } catch (e) {
        console.error("data 笔记查询失败: " + e.message);
    }

    // ── 3. 一次聚合查询全部属性（图标/颜色/标签） ──
    var noteIds = [];
    for (var i = 0; i < rows.length; i++) {
        if (noteIds.indexOf(rows[i].noteId) === -1) noteIds.push(rows[i].noteId);
    }
    var attrsMap = {};
    if (noteIds.length > 0) {
        var ph = noteIds.map(function () { return "?"; }).join(",");
        try {
            var attrRows = await api.sql.getRows(
                "SELECT a.noteId, " +
                "  MAX(CASE WHEN a.name = 'icon' THEN a.value END) AS icon, " +
                "  MAX(CASE WHEN a.name = 'iconClass' THEN a.value END) AS iconClass, " +
                "  MAX(CASE WHEN a.name = 'color' THEN a.value END) AS color, " +
                "  MAX(CASE WHEN a.name = 'shareAlias' THEN a.value END) AS shareAlias, " +
                "  MAX(CASE WHEN a.name = 'articleCover' THEN a.value END) AS articleCover, " +
                "  (SELECT json_group_array(t.value) FROM attributes t " +
                "    WHERE t.noteId = a.noteId AND t.name = 'noteTag' AND t.isDeleted = 0) AS tags " +
                "FROM attributes a " +
                "WHERE a.isDeleted = 0 AND a.noteId IN (" + ph + ") AND a.name IN ('icon', 'iconClass', 'color', 'shareAlias', 'articleCover') " +
                "GROUP BY a.noteId",
                noteIds,
            );
            for (var ai = 0; ai < attrRows.length; ai++) {
                var at = attrRows[ai];
                var tagArr = [];
                if (at.tags) {
                    try { tagArr = JSON.parse(at.tags) || []; } catch (_e) { tagArr = []; }
                }
                attrsMap[at.noteId] = {
                    noteIcon: at.icon || at.iconClass || "",
                    color: at.color || "",
                    shareAlias: at.shareAlias || "",
                    cover: at.articleCover || "",
                    tags: tagArr,
                };
            }
        } catch (e) {
            console.error("data 属性查询失败: " + e.message);
        }
    }

    // ── 4. 结构化组装 ──
    for (var ri = 0; ri < rows.length; ri++) {
        var r = rows[ri];
        var content = typeof r.c === "string" ? r.c : (r.c ? r.c.toString() : "");
        var plain = stripHtml(content);
        var hasContent = plain.trim().length > 0;
        var attr = attrsMap[r.noteId] || { noteIcon: "", color: "", shareAlias: "", cover: "", tags: [] };
        var cover = attr.cover || extractCoverImg(content);

        if (r.region === "article") {
            if (hasContent) {
                var artItem = {
                    noteId: r.noteId,
                    title: r.title,
                    noteIcon: attr.noteIcon,
                    color: attr.color,
                    content: truncate(plain, contentLen),
                    dateCreated: r.dateCreated,
                    dateModified: r.dateModified,
                    tags: attr.tags,
                };
                if (attr.shareAlias) artItem.shareAlias = attr.shareAlias;
                if (cover) artItem.cover = cover;
                data.article.push(artItem);
            }
        } else if (r.region === "recentUpdate") {
            if (data.recentUpdate.length < 3) {
                var updItem = {
                    noteId: r.noteId,
                    title: r.title,
                    noteIcon: attr.noteIcon,
                    color: attr.color,
                    dateCreated: r.dateCreated,
                    tags: attr.tags,
                };
                if (attr.shareAlias) updItem.shareAlias = attr.shareAlias;
                if (cover) updItem.cover = cover;
                data.recentUpdate.push(updItem);
            }
        } else if (r.region === "announcement") {
            if (hasContent && !data.announcement) {
                var annItem = {
                    noteId: r.noteId,
                    title: r.title,
                    noteIcon: attr.noteIcon,
                    color: attr.color,
                    content: truncate(plain, contentLen),
                    dateCreated: r.dateCreated,
                    tags: attr.tags,
                };
                if (attr.shareAlias) annItem.shareAlias = attr.shareAlias;
                if (cover) annItem.cover = cover;
                data.announcement = annItem;
            }
        } else if (r.region === "recommend") {
            if (hasContent) {
                var recItem = {
                    noteId: r.noteId,
                    title: r.title,
                    noteIcon: attr.noteIcon,
                    color: attr.color,
                    content: truncate(plain, contentLen),
                    dateCreated: r.dateCreated,
                    dateModified: r.dateModified,
                    tags: attr.tags,
                };
                if (attr.shareAlias) recItem.shareAlias = attr.shareAlias;
                if (cover) recItem.cover = cover;
                data.recommend.push(recItem);
            }
        }
    }

    // ── 5. 统计（条件聚合，一次查询） ──
    try {
        var statRow = await api.sql.getRow(
            "SELECT " +
            "  COUNT(DISTINCT CASE WHEN a.name = 'article' AND a.value = 'true' THEN n.noteId END) AS article, " +
            "  COUNT(DISTINCT CASE WHEN a.name = 'recommend' AND a.value = 'true' AND article_tag.noteId IS NOT NULL THEN n.noteId END) AS recommend, " +
            "  COUNT(DISTINCT CASE WHEN a.name = 'recentUpdate' AND a.value = 'true' THEN n.noteId END) AS recentUpdate, " +
            "  COUNT(DISTINCT CASE WHEN a.name = 'announcement' AND a.value = 'true' THEN n.noteId END) AS announcement " +
            "FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId " +
            "LEFT JOIN (SELECT noteId FROM attributes WHERE name = 'article' AND value = 'true' AND isDeleted = 0) article_tag ON n.noteId = article_tag.noteId " +
            "WHERE n.isDeleted = 0 AND a.isDeleted = 0",
        );
        if (statRow) {
            data.stats.article = parseInt(statRow.article, 10) || 0;
            data.stats.recommend = parseInt(statRow.recommend, 10) || 0;
            data.stats.recentUpdate = parseInt(statRow.recentUpdate, 10) || 0;
            data.stats.announcement = parseInt(statRow.announcement, 10) || 0;
        }
    } catch (e) {
        console.error("data 统计查询失败: " + e.message);
    }

    // ── 6. 热力图（修改/修订日期按天统计） ──
    try {
        var hmRows = await api.sql.getRows(
            "SELECT date, COUNT(*) AS total FROM (" +
            "  SELECT noteId, SUBSTR(dateModified, 0, 11) AS date FROM notes" +
            "  UNION" +
            "  SELECT DISTINCT noteId, SUBSTR(dateCreated, 0, 11) AS date FROM revisions" +
            ") GROUP BY date ORDER BY date",
        );
        if (hmRows && hmRows.length) {
            for (var hi = 0; hi < hmRows.length; hi++) {
                data.heatmap.push({ date: hmRows[hi].date, count: parseInt(hmRows[hi].total, 10) });
            }
        }
    } catch (e) {
        console.error("data 热力图查询失败: " + e.message);
    }

    var output = JSON.stringify(data);
    await writeNote(targetNoteId, output);

    console.log(
        "聚合数据同步完成（tree " + data.tree.length + " / aboutTree " + data.aboutTree.length +
        " / tags " + Object.keys(data.tags).length + " / article " + data.article.length +
        " / recentUpdate " + data.recentUpdate.length + " / heatmap " + data.heatmap.length +
        " 天，" + (Date.now() - startTime) + "ms）",
    );
    return {
        tree: data.tree.length,
        aboutTree: data.aboutTree.length,
        tags: Object.keys(data.tags).length,
        article: data.article.length,
        recentUpdate: data.recentUpdate.length,
        recommend: data.recommend.length,
        heatmap: data.heatmap.length,
        elapsedMs: Date.now() - startTime,
    };
}

// ── 模块：搜索索引 ──

async function syncSearch() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    var targetNoteId = cfg.searchSaveNoteId;
    if (!rootNoteId) throw new Error("缺少配置: rootNoteId");
    if (!targetNoteId) throw new Error("缺少配置: searchSaveNoteId");

    var contentLen = (cfg.searchLen && cfg.searchLen > 0) ? cfg.searchLen : 500;
    var queryContentLimit = contentLen * 3 + 500;

    var startTime = Date.now();

    var nodes = [];
    try {
        nodes = await api.sql.getRows(
            "WITH RECURSIVE subtree AS (" +
            "  SELECT n.noteId, n.title, n.dateCreated, n.dateModified, 0 AS depth" +
            "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  WHERE n.noteId = ? AND n.isDeleted = 0" +
            "  UNION ALL" +
            "  SELECT n.noteId, n.title, n.dateCreated, n.dateModified, s.depth + 1" +
            "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  JOIN subtree s ON b.parentNoteId = s.noteId" +
            "  WHERE n.isDeleted = 0 AND s.depth < ?" +
            ") SELECT DISTINCT noteId, title, dateCreated, dateModified FROM subtree WHERE depth > 0",
            [rootNoteId, SEARCH_MAX_DEPTH],
        );
    } catch (e) {
        console.error("search 查询失败: " + e.message);
    }

    if (nodes.length === 0) throw new Error("根笔记下未找到笔记");

    // 批量查询标签（排除 + 图标）
    var noteIds = nodes.map(function (n) { return n.noteId; });
    var labels = await queryLabels(noteIds);

    var excludedIds = {};
    var iconMap = {};
    var colorMap = {};
    var aliasMap = {};
    var coverMap = {};
    for (var i = 0; i < labels.length; i++) {
        if (
            (labels[i].name === "shareHiddenFromTree" && labels[i].value === "true") ||
            (labels[i].name === "category" && labels[i].value === "true")
        ) {
            excludedIds[labels[i].noteId] = true;
        }
        if (labels[i].name === "icon") iconMap[labels[i].noteId] = labels[i].value;
        if (labels[i].name === "color") colorMap[labels[i].noteId] = labels[i].value;
        if (labels[i].name === "shareAlias") aliasMap[labels[i].noteId] = labels[i].value;
        if (labels[i].name === "articleCover") coverMap[labels[i].noteId] = labels[i].value;
    }
    // 补充 iconClass（仅当 icon 未设置时作为 fallback）
    for (var i2 = 0; i2 < labels.length; i2++) {
        if (labels[i2].name === "iconClass" && !iconMap[labels[i2].noteId]) {
            iconMap[labels[i2].noteId] = labels[i2].value;
        }
    }

    // 批量查询内容，SUBSTR 限制读取量
    var contentMap = {};
    if (noteIds.length > 0) {
        var ph = noteIds.map(function () { return "?"; }).join(",");
        try {
            var contentRows = await api.sql.getRows(
                "SELECT n.noteId, SUBSTR(COALESCE(b.content, ''), 1, ?) AS c " +
                "FROM notes n " +
                "LEFT JOIN blobs b ON n.blobId = b.blobId " +
                "WHERE n.isDeleted = 0 AND n.noteId IN (" + ph + ")",
                [queryContentLimit].concat(noteIds),
            );
            for (var ci = 0; ci < contentRows.length; ci++) {
                var raw = contentRows[ci].c;
                contentMap[contentRows[ci].noteId] = (typeof raw === 'string') ? raw : (raw ? raw.toString() : "");
            }
        } catch (e) {
            console.error("search 内容查询失败: " + e.message);
        }
    }

    // 过滤并截取内容
    var result = [];
    for (var ni = 0; ni < nodes.length; ni++) {
        if (excludedIds[nodes[ni].noteId]) continue;
        var content = contentMap[nodes[ni].noteId] || "";
        if (content && content.trim().length > 0) {
            var cover = coverMap[nodes[ni].noteId] || extractCoverImg(content);
            var item = {
                noteId: nodes[ni].noteId,
                title: nodes[ni].title,
                dateCreated: nodes[ni].dateCreated || "",
                dateModified: nodes[ni].dateModified || "",
                noteIcon: iconMap[nodes[ni].noteId] || "",
                color: colorMap[nodes[ni].noteId] || "",
                shareAlias: aliasMap[nodes[ni].noteId] || "",
                content: truncate(stripHtml(content), contentLen),
            };
            if (cover) item.cover = cover;
            result.push(item);
        }
    }

    var output = JSON.stringify(result);
    await writeNote(targetNoteId, output);

    console.log(
        "搜索索引同步完成（" + result.length + " 条，" + (Date.now() - startTime) + "ms）",
    );
    return { count: result.length, elapsedMs: Date.now() - startTime };
}

// ── 写入目标笔记 ──

async function writeNote(noteId, content) {
    var note = await api.getNote(noteId);
    if (!note) throw new Error("目标笔记不存在: " + noteId);
    if (note.isProtected) await api.protectNote(noteId, false, false);
    await note.setContent(content);
}

// ── 导出 ──

module.exports = { syncData: syncData, syncSearch: syncSearch };
