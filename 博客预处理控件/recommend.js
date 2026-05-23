/**
 * 推荐阅读数据生成 (Backend Script)
 *
 * 查询所有 #recommend=true 且有内容的笔记。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-recommend)
 *   contentLen = <截取长度>  (可选，默认 150)
 */

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
    var targetNoteId = cfg.targetNoteId;
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var contentLen = (cfg.contentLen && cfg.contentLen > 0) ? cfg.contentLen : 150;
    // 查询时限制内容读取量，避免大笔记拖慢服务器（留余量给 HTML 标签）
    var queryContentLimit = contentLen * 3 + 500;

    var startTime = Date.now();

    var rows = [];
    try {
        rows = await api.sql.getRows(
            "SELECT n.noteId, n.title, n.dateCreated, n.dateModified, " +
            "  SUBSTR(COALESCE(b.content, ''), 1, ?) AS c " +
            "FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'recommend' AND a.value = 'true' " +
            "LEFT JOIN blobs b ON n.blobId = b.blobId " +
            "WHERE n.isDeleted = 0 " +
            "ORDER BY n.dateCreated DESC",
            [queryContentLimit],
        );
    } catch (e) {
        console.error("recommend 查询失败: " + e.message);
    }

    // 批量查询图标、标签
    var noteIds = rows.map(function (r) { return r.noteId; });
    var iconMap = {};
    var colorMap = {};
    var tagsMap = {};
    if (noteIds.length > 0) {
        var ph = noteIds.map(function () { return "?"; }).join(",");
        try {
            var attrs = await api.sql.getRows(
                "SELECT noteId, name, value FROM attributes " +
                "WHERE isDeleted = 0 AND noteId IN (" + ph + ") AND name IN ('icon', 'iconClass', 'color', 'noteTag')",
                noteIds,
            );
            for (var i = 0; i < attrs.length; i++) {
                if (attrs[i].name === "icon") iconMap[attrs[i].noteId] = attrs[i].value;
            }
            for (var i = 0; i < attrs.length; i++) {
                if (attrs[i].name === "iconClass" && !iconMap[attrs[i].noteId]) iconMap[attrs[i].noteId] = attrs[i].value;
            }
            for (var i = 0; i < attrs.length; i++) {
                if (attrs[i].name === "color") colorMap[attrs[i].noteId] = attrs[i].value;
            }
            for (var i = 0; i < attrs.length; i++) {
                if (attrs[i].name === "noteTag") {
                    if (!tagsMap[attrs[i].noteId]) tagsMap[attrs[i].noteId] = [];
                    if (tagsMap[attrs[i].noteId].indexOf(attrs[i].value) === -1) tagsMap[attrs[i].noteId].push(attrs[i].value);
                }
            }
        } catch (e) {
            console.error("recommend 图标/标签查询失败: " + e.message);
        }
    }

    var result = [];
    for (var i = 0; i < rows.length; i++) {
        var content = rows[i].c;
        if (typeof content !== 'string') content = content ? content.toString() : "";
        if (content && content.trim().length > 0) {
            var plain = stripHtml(content);
            result.push({
                noteId: rows[i].noteId,
                title: rows[i].title,
                noteIcon: iconMap[rows[i].noteId] || "",
                color: colorMap[rows[i].noteId] || "",
                dateCreated: rows[i].dateCreated,
                dateModified: rows[i].dateModified,
                content: truncate(plain, contentLen),
                tags: tagsMap[rows[i].noteId] || [],
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
        "推荐阅读同步完成（" + result.length + " 条，" + (Date.now() - startTime) + "ms）",
    );
    return { count: result.length, elapsedMs: Date.now() - startTime };
}

module.exports = { sync: sync };

if (typeof api !== "undefined") {
    (async function () {
        try {
            api._syncConfig = api._syncConfig || {};
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
            console.log("✅ 推荐阅读完成: " + r.count + " 条");
        } catch (e) {
            console.error("❌ 推荐阅读失败: " + e.message);
        }
    })();
}
