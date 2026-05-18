/**
 * 热度地图数据生成 (Backend Script)
 *
 * 统计全部笔记的修改/修订日期，按天输出热力数据。
 *
 * SQL:
 *   SELECT date, COUNT(*) AS total FROM (
 *     SELECT noteId, SUBSTR(dateModified, 0, 11) AS date FROM notes
 *     UNION
 *     SELECT DISTINCT noteId, SUBSTR(dateCreated, 0, 11) AS date FROM revisions
 *   ) GROUP BY date
 *
 * 输出: [{ date: "2024-01-01", count: 3 }, ...]
 *   仅含每日日期与统计次数，前端绘制网格。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-heatmap)
 */

async function generateHeatmap(api, rootNoteId, targetNoteId) {
    var startTime = Date.now();

    var heatmap = [];
    try {
        var sqlRows = await api.sql.getRows(
            "SELECT date, COUNT(*) AS total FROM (" +
            "  SELECT noteId, SUBSTR(dateModified, 0, 11) AS date FROM notes" +
            "  UNION" +
            "  SELECT DISTINCT noteId, SUBSTR(dateCreated, 0, 11) AS date FROM revisions" +
            ") GROUP BY date ORDER BY date",
        );
        if (sqlRows && sqlRows.length) {
            for (var ri = 0; ri < sqlRows.length; ri++) {
                heatmap.push({ date: sqlRows[ri].date, count: parseInt(sqlRows[ri].total, 10) });
            }
        }
    } catch (e) {
        console.error("heatmap 查询失败: " + e.message);
    }

    var output = JSON.stringify(heatmap, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    console.log(
        "热度地图同步完成（" + heatmap.length + " 天，" + (Date.now() - startTime) + "ms）",
    );
    return { days: heatmap.length, elapsedMs: Date.now() - startTime };
}

module.exports = generateHeatmap;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateHeatmap(api, null, targetId);
            console.log("✅ 热度地图完成: " + r.days + " 天");
        } catch (e) {
            console.error("❌ 热度地图失败: " + e.message);
        }
    })();
}
