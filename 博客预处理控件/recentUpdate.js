/**
 * 最近动态数据生成 (Backend Script)
 *
 * 查询 #recentUpdate=true 且有标题的笔记，取创建时间最新的三条，附带图标。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-recentUpdate)
 */

async function generateRecentUpdate(api, rootNoteId, targetNoteId) {
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

    var result = [];
    for (var i = 0; i < nodes.length; i++) {
        var icon = "";
        try {
            var note = await api.getNote(nodes[i].noteId);
            if (note) {
                icon = note.getLabelValue("icon") || note.getLabelValue("iconClass") || "";
            }
        } catch (e) {
            // 跳过
        }
        result.push({
            noteId: nodes[i].noteId,
            title: nodes[i].title,
            noteIcon: icon,
            dateCreated: nodes[i].dateCreated,
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

module.exports = generateRecentUpdate;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateRecentUpdate(api, null, targetId);
            console.log("✅ 最近动态完成: " + r.count + " 条");
        } catch (e) {
            console.error("❌ 最近动态失败: " + e.message);
        }
    })();
}
