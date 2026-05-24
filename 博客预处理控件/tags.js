/**
 * 标签云数据生成 (Backend Script)
 *
 * 查询所有 #noteTag 标签，按标签名聚合。
 *
 * 标签:
 *   rootNoteId = <根笔记ID>  (必需)
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-tag)
 */

async function sync() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    var targetNoteId = cfg.targetNoteId;
    if (!rootNoteId) throw new Error("缺少配置: rootNoteId");
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var startTime = Date.now();

    var labels = [];
    try {
        labels = await api.sql.getRows(`
            WITH RECURSIVE descendants AS (
              SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0
              UNION ALL
              SELECT b.noteId FROM branches b INNER JOIN descendants d ON b.parentNoteId = d.noteId WHERE b.isDeleted = 0
            ) SELECT a.noteId, a.value FROM attributes a
            INNER JOIN descendants d ON a.noteId = d.noteId
            LEFT JOIN notes n ON n.noteId = d.noteId
            WHERE a.type = 'label' AND a.name = 'noteTag' AND a.isDeleted = 0
            ORDER BY n.dateCreated DESC
            `,
            [rootNoteId],
        );
    } catch (e) {
        console.error("tags 查询失败: " + e.message);
    }

    var tags = {};
    var noteTags = {};

    for (var i = 0; i < labels.length; i++) {
        var noteId = labels[i].noteId;
        var tagName = labels[i].value;
        if (!tagName) continue;

        if (!tags[tagName]) tags[tagName] = { count: 0, noteId: [] };
        if (tags[tagName].noteId.indexOf(noteId) === -1) {
            tags[tagName].noteId.push(noteId);
            tags[tagName].count++;
        }

        if (!noteTags[noteId]) noteTags[noteId] = [];
        if (noteTags[noteId].indexOf(tagName) === -1) {
            noteTags[noteId].push(tagName);
        }
    }

    var output = JSON.stringify(tags);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected) await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    var tagCount = Object.keys(tags).length;
    console.log("标签云同步完成（" + tagCount + " 个标签，" + (Date.now() - startTime) + "ms）");
    return { count: tagCount, elapsedMs: Date.now() - startTime };
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
            if (!api._syncConfig.rootNoteId) throw new Error("缺少 #rootNoteId");
            if (!api._syncConfig.targetNoteId) throw new Error("缺少 #saveNoteId");
            var r = await sync();
            console.log("✅ 标签云完成: " + r.count + " 个标签");
        } catch (e) {
            console.error("❌ 标签云失败: " + e.message);
        }
    })();
}
