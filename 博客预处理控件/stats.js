/**
 * 首页统计数据生成 (Backend Script)
 *
 * 按标签统计各类笔记数量。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-stats)
 */

async function sync() {
    var cfg = api._syncConfig || {};
    var targetNoteId = cfg.targetNoteId;
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var startTime = Date.now();

    var result = {
        article: 0,
        recommend: 0,
        recentUpdate: 0,
        announcement: 0,
    };

    // 一次查询完成全部统计（条件聚合避免4次独立计数）
    try {
        var row = await api.sql.getRow(
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
        if (row) {
            result.article = parseInt(row.article, 10) || 0;
            result.recommend = parseInt(row.recommend, 10) || 0;
            result.recentUpdate = parseInt(row.recentUpdate, 10) || 0;
            result.announcement = parseInt(row.announcement, 10) || 0;
        }
    } catch (e) {
        console.error("stats 查询失败: " + e.message);
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

module.exports = { sync: sync };

if (typeof api !== "undefined") {
    (async function () {
        try {
            api._syncConfig = api._syncConfig || {};
            if (!api._syncConfig.targetNoteId)
                api._syncConfig.targetNoteId = api.currentNote.getLabelValue("saveNoteId");
            if (!api._syncConfig.targetNoteId) throw new Error("缺少 #saveNoteId");
            var r = await sync();
            console.log("✅ 统计完成");
        } catch (e) {
            console.error("❌ 统计失败: " + e.message);
        }
    })();
}
