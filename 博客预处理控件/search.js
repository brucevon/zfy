/**
 * 搜索索引数据生成 (Backend Script)
 *
 * 查询 #rootNoteId 下所有笔记，排除 #shareHiddenFromTree=true 和 #category=true，
 * 内容去 HTML 后截取 500 字，附带笔记图标。
 *
 * 标签:
 *   rootNoteId = <根笔记ID>  (必需)
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-search)
 *   contentLen = <截取长度>  (可选，默认 500)
 */

var SEARCH_MAX_DEPTH = 50;

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

async function sync() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    var targetNoteId = cfg.targetNoteId;
    if (!rootNoteId) throw new Error("缺少配置: rootNoteId");
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var contentLen = (cfg.contentLen && cfg.contentLen > 0) ? cfg.contentLen : 500;
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
    var noteIds = nodes.map(function (n) {
        return n.noteId;
    });
    var labels = [];
    if (noteIds.length > 0) {
        var ph = noteIds
            .map(function () {
                return "?";
            })
            .join(",");
        labels = await api.sql.getRows(
            "SELECT noteId, name, value FROM attributes " +
                "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" + ph + ")",
            noteIds,
        );
    }

    var excludedIds = {};
    var iconMap = {};
    var colorMap = {};
    for (var i = 0; i < labels.length; i++) {
        if (
            (labels[i].name === "shareHiddenFromTree" && labels[i].value === "true") ||
            (labels[i].name === "category" && labels[i].value === "true")
        ) {
            excludedIds[labels[i].noteId] = true;
        }
        if (labels[i].name === "icon") {
            iconMap[labels[i].noteId] = labels[i].value;
        }
        if (labels[i].name === "color") {
            colorMap[labels[i].noteId] = labels[i].value;
        }
    }
    // 补充查询 iconClass（仅当 icon 未设置时作为 fallback）
    for (var i = 0; i < labels.length; i++) {
        if (labels[i].name === "iconClass" && !iconMap[labels[i].noteId]) {
            iconMap[labels[i].noteId] = labels[i].value;
        }
    }

    // 批量查询内容（避免循环中挨个 api.getNote），SUBSTR 限制读取量
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
    for (var i = 0; i < nodes.length; i++) {
        if (excludedIds[nodes[i].noteId]) continue;
        var content = contentMap[nodes[i].noteId] || "";
        if (content && content.trim().length > 0) {
            result.push({
                noteId: nodes[i].noteId,
                title: nodes[i].title,
                dateCreated: nodes[i].dateCreated || "",
                dateModified: nodes[i].dateModified || "",
                noteIcon: iconMap[nodes[i].noteId] || "",
                color: colorMap[nodes[i].noteId] || "",
                content: truncate(stripHtml(content), contentLen),
            });
        }
    }

    var output = JSON.stringify(result, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    console.log(
        "搜索索引同步完成（" + result.length + " 条，" + (Date.now() - startTime) + "ms）",
    );
    return { count: result.length, elapsedMs: Date.now() - startTime };
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
            if (!api._syncConfig.rootNoteId) throw new Error("缺少 #rootNoteId");
            if (!api._syncConfig.targetNoteId) throw new Error("缺少 #saveNoteId");
            var r = await sync();
            console.log("✅ 搜索索引完成: " + r.count + " 条");
        } catch (e) {
            console.error("❌ 搜索索引失败: " + e.message);
        }
    })();
}
