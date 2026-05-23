/**
 * 最近动态数据生成 (Backend Script)
 *
 * 查询 #recentUpdate=true 且有标题的笔记，取创建时间最新的三条，附带图标。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-recentUpdate)
 */

async function sync() {
    var cfg = api._syncConfig || {};
    var targetNoteId = cfg.targetNoteId;
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var startTime = Date.now();

    var nodes = [];
    try {
        nodes = await api.sql.getRows(
            "SELECT n.noteId, n.title, n.dateCreated FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'recentUpdate' AND a.value = 'true' " +
            "WHERE n.isDeleted = 0 AND n.title IS NOT NULL AND n.title != '' " +
            "ORDER BY n.dateCreated DESC LIMIT 3",
        );
    } catch (e) {
        console.error("recentUpdate 查询失败: " + e.message);
    }

    // 批量查询图标、标签
    var noteIds = nodes.map(function (n) { return n.noteId; });
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
            console.error("recentUpdate 图标/标签查询失败: " + e.message);
        }
    }

    var result = [];
    for (var i = 0; i < nodes.length; i++) {
        result.push({
            noteId: nodes[i].noteId,
            title: nodes[i].title,
            noteIcon: iconMap[nodes[i].noteId] || "",
            color: colorMap[nodes[i].noteId] || "",
            dateCreated: nodes[i].dateCreated,
            tags: tagsMap[nodes[i].noteId] || [],
        });
    }

    var output = JSON.stringify(result, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    console.log(
        "最近动态同步完成（" + result.length + " 条，" + (Date.now() - startTime) + "ms）",
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
            if (!api._syncConfig.targetNoteId) throw new Error("缺少 #saveNoteId");
            var r = await sync();
            console.log("✅ 最近动态完成: " + r.count + " 条");
        } catch (e) {
            console.error("❌ 最近动态失败: " + e.message);
        }
    })();
}
