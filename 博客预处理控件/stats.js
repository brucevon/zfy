/**
 * 首页统计数据生成 (Backend Script)
 *
 * 按标签统计各类笔记数量。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-stats)
 */

async function generateStats(api, rootNoteId, targetNoteId) {
    var startTime = Date.now();

    var result = {
        article: 0,
        recommend: 0,
        recentUpdate: 0,
        announcement: 0,
    };

    try {
        var row1 = await api.sql.getRow(
            "SELECT COUNT(*) AS cnt FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'article' AND a.value = 'true' " +
            "WHERE n.isDeleted = 0",
        );
        result.article = parseInt(row1.cnt, 10) || 0;
    } catch (e) {
        console.error("stats article 查询失败: " + e.message);
    }

    try {
        var row2 = await api.sql.getRow(
            "SELECT COUNT(*) AS cnt FROM notes n " +
            "INNER JOIN attributes a1 ON n.noteId = a1.noteId AND a1.name = 'article' AND a1.value = 'true' " +
            "INNER JOIN attributes a2 ON n.noteId = a2.noteId AND a2.name = 'recommend' AND a2.value = 'true' " +
            "WHERE n.isDeleted = 0",
        );
        result.recommend = parseInt(row2.cnt, 10) || 0;
    } catch (e) {
        console.error("stats recommend 查询失败: " + e.message);
    }

    try {
        var row3 = await api.sql.getRow(
            "SELECT COUNT(*) AS cnt FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'recentUpdate' AND a.value = 'true' " +
            "WHERE n.isDeleted = 0",
        );
        result.recentUpdate = parseInt(row3.cnt, 10) || 0;
    } catch (e) {
        console.error("stats recentUpdate 查询失败: " + e.message);
    }

    try {
        var row4 = await api.sql.getRow(
            "SELECT COUNT(*) AS cnt FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'announcement' AND a.value = 'true' " +
            "WHERE n.isDeleted = 0",
        );
        result.announcement = parseInt(row4.cnt, 10) || 0;
    } catch (e) {
        console.error("stats announcement 查询失败: " + e.message);
    }

    var output = JSON.stringify(result, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    console.log(
        "统计同步完成（" + (Date.now() - startTime) + "ms）",
    );
    return { elapsedMs: Date.now() - startTime };
}

module.exports = generateStats;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateStats(api, null, targetId);
            console.log("✅ 统计完成");
        } catch (e) {
            console.error("❌ 统计失败: " + e.message);
        }
    })();
}
