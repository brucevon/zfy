/**
 * 推荐阅读数据生成 (Backend Script)
 *
 * 查询所有 #recommend=true 且有内容的笔记。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-recommend)
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

async function generateRecommend(api, rootNoteId, targetNoteId) {
    var startTime = Date.now();

    var nodes = [];
    try {
        nodes = await api.sql.getRows(
            "SELECT n.noteId, n.title, n.dateCreated, n.dateModified FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'recommend' AND a.value = 'true' " +
            "WHERE n.isDeleted = 0 " +
            "ORDER BY n.dateCreated DESC",
        );
    } catch (e) {
        console.error("recommend 查询失败: " + e.message);
    }

    var result = [];
    for (var i = 0; i < nodes.length; i++) {
        try {
            var note = await api.getNote(nodes[i].noteId);
            if (note && note.getContent) {
                var content = note.getContent();
                if (content && typeof content === "string" && content.trim().length > 0) {
                    var plain = stripHtml(content);
                    var icon = note.getLabelValue("icon") || note.getLabelValue("iconClass") || "";
                    result.push({
                        noteId: nodes[i].noteId,
                        title: nodes[i].title,
                        noteIcon: icon,
                        dateCreated: nodes[i].dateCreated,
                        dateModified: nodes[i].dateModified,
                        content: truncate(plain, 80),
                    });
                }
            }
        } catch (e) {
            // 跳过内容读取失败的笔记
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

module.exports = generateRecommend;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateRecommend(api, null, targetId);
            console.log("✅ 推荐阅读完成: " + r.count + " 条");
        } catch (e) {
            console.error("❌ 推荐阅读失败: " + e.message);
        }
    })();
}
