/**
 * 博客聚合数据生成 (Backend Script)
 *
 * 汇总「博客预处理控件」里除 search 外的全部接口数据到单一 JSON，
 * 保留各接口原有数据格式不变，外层按 key 区分：
 *
 *   {
 *     "tree":         [ { noteId, title, noteIcon, color, category, shareExternalLink, children }, ... ],
 *     "aboutTree":    [ { noteId, title, noteIcon, color, category, shareExternalLink, children }, ... ],
 *     "tags":         { tagName: { count, noteId: [...] }, ... },
 *     "article":      [ { noteId, title, noteIcon, color, cover?, content, dateCreated, dateModified, tags }, ... ],
 *     "recentUpdate": [ { noteId, title, noteIcon, color, cover?, dateCreated, tags }, ... ],
 *     "announcement": { noteId, title, noteIcon, color, cover?, content, dateCreated, tags } | null,
 *     "recommend":    [ { noteId, title, noteIcon, color, cover?, content, dateCreated, dateModified, tags }, ... ],
 *     "stats":        { article, recommend, recentUpdate, announcement },
 *     "heatmap":      [ { date, count }, ... ]
 *   }
 *
 * 说明:
 *   - article 查询所有 #article=true 且有内容的笔记，按创建时间倒序（原为单条）
 *   - recentUpdate 最多 3 条；announcement 取最新一条有内容的笔记
 *   - tree / aboutTree / tags 需要 #rootNoteId，未配置时输出空
 *   - 数据获取与属性聚合尽量在 SQL 中完成，JS 仅做 HTML 清理、树结构构建与组装
 *
 * 标签:
 *   rootNoteId = <根笔记ID>  (可选，tree/aboutTree/tags 需要)
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-data)
 *   contentLen = <截取长度>  (可选，默认 150)
 */

var TREE_MAX_DEPTH = 50;

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

    var labels = [];
    if (noteIds.length > 0) {
        var ph = noteIds.map(function () { return "?"; }).join(",");
        try {
            labels = await api.sql.getRows(
                "SELECT noteId, name, value FROM attributes " +
                "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" + ph + ")",
                noteIds,
            );
        } catch (e) {
            console.error("tree 标签查询失败: " + e.message);
        }
    }

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

async function sync() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    var targetNoteId = cfg.targetNoteId;
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var contentLen = (cfg.contentLen && cfg.contentLen > 0) ? cfg.contentLen : 150;
    // 查询时限制内容读取量，避免大笔记拖慢服务器（留余量给 HTML 标签）
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

    // ── 3. 一次聚合查询全部属性（图标/颜色/标签），标签在 SQL 内聚合成 JSON 数组 ──
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

    // ── 4. 结构化组装（仅 HTML 清理与对象构造，无额外查询） ──
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

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

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

module.exports = { sync: sync };

if (typeof api !== "undefined") {
    (async function () {
        try {
            api._syncConfig = api._syncConfig || {};
            if (!api._syncConfig.rootNoteId)
                api._syncConfig.rootNoteId = api.currentNote.getLabelValue("rootNoteId");
            if (!api._syncConfig.targetNoteId)
                api._syncConfig.targetNoteId = api.currentNote.getLabelValue("saveNoteId");
            if (!api._syncConfig.contentLen && !api._syncConfig.hasOwnProperty("contentLen")) {
                var contentLenTag = api.currentNote.getLabelValue("contentLen");
                if (contentLenTag) {
                    var parsed = parseInt(contentLenTag, 10);
                    if (!isNaN(parsed) && parsed > 0) api._syncConfig.contentLen = parsed;
                }
            }
            if (!api._syncConfig.targetNoteId) throw new Error("缺少 #saveNoteId");
            var r = await sync();
            console.log("✅ 聚合数据完成");
        } catch (e) {
            console.error("❌ 聚合数据失败: " + e.message);
        }
    })();
}