/**
 * 搜索索引数据生成 (Backend Script)
 *
 * 查询 #rootNoteId 下所有笔记，排除 #shareHiddenFromTree=true 和 #category=true，
 * 内容去 HTML 后截取 500 字，附带笔记图标。
 *
 * 标签:
 *   rootNoteId = <根笔记ID>  (必需)
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-search)
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

async function generateSearch(api, rootNoteId, targetNoteId) {
    var startTime = Date.now();

    var nodes = [];
    try {
        nodes = await api.sql.getRows(
            "WITH RECURSIVE subtree AS (" +
            "  SELECT n.noteId, n.title, 0 AS depth" +
            "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  WHERE n.noteId = ? AND n.isDeleted = 0" +
            "  UNION ALL" +
            "  SELECT n.noteId, n.title, s.depth + 1" +
            "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  JOIN subtree s ON b.parentNoteId = s.noteId" +
            "  WHERE n.isDeleted = 0 AND s.depth < ?" +
            ") SELECT DISTINCT noteId, title FROM subtree WHERE depth > 0",
            [rootNoteId, SEARCH_MAX_DEPTH],
        );
    } catch (e) {
        console.error("search 查询失败: " + e.message);
    }

    if (nodes.length === 0) throw new Error("根笔记下未找到笔记");

    // 批量查询标签
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
    }
    // 补充查询 iconClass（仅当 icon 未设置时作为 fallback）
    for (var i = 0; i < labels.length; i++) {
        if (labels[i].name === "iconClass" && !iconMap[labels[i].noteId]) {
            iconMap[labels[i].noteId] = labels[i].value;
        }
    }

    // 过滤并读取内容的笔记
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
        if (excludedIds[nodes[i].noteId]) continue;
        try {
            var note = await api.getNote(nodes[i].noteId);
            if (note && note.getContent) {
                var content = note.getContent();
                if (content && typeof content === "string") {
                    result.push({
                        noteId: nodes[i].noteId,
                        title: nodes[i].title,
                        noteIcon: iconMap[nodes[i].noteId] || "",
                        content: truncate(stripHtml(content), 500),
                    });
                }
            }
        } catch (e) {
            // 跳过
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

module.exports = generateSearch;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var rootId = api.currentNote.getLabelValue("rootNoteId");
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!rootId) throw new Error("缺少 #rootNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateSearch(api, rootId, targetId);
            console.log("✅ 搜索索引完成: " + r.count + " 条");
        } catch (e) {
            console.error("❌ 搜索索引失败: " + e.message);
        }
    })();
}
