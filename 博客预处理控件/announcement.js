/**
 * 首页公告数据生成 (Backend Script)
 *
 * 查询 #announcement=true 且创建时间最新且有内容的笔记。
 *
 * 标签:
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-announcement)
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

async function generateAnnouncement(api, rootNoteId, targetNoteId) {
    var startTime = Date.now();

    var result = null;
    try {
        var nodes = await api.sql.getRows(
            "SELECT n.noteId, n.title, n.dateCreated FROM notes n " +
            "INNER JOIN attributes a ON n.noteId = a.noteId AND a.name = 'announcement' AND a.value = 'true' " +
            "WHERE n.isDeleted = 0 " +
            "ORDER BY n.dateCreated DESC",
        );

        for (var i = 0; i < nodes.length; i++) {
            try {
                var note = await api.getNote(nodes[i].noteId);
                if (note && note.getContent) {
                    var content = note.getContent();
                    if (content && typeof content === "string" && content.trim().length > 0) {
                        var icon = note.getLabelValue("icon") || note.getLabelValue("iconClass") || "";
                        result = {
                            noteId: nodes[i].noteId,
                            title: nodes[i].title,
                            noteIcon: icon,
                            content: truncate(stripHtml(content), 80),
                            dateCreated: nodes[i].dateCreated,
                        };
                        break;
                    }
                }
            } catch (e) {
                // 跳过
            }
        }
    } catch (e) {
        console.error("announcement 查询失败: " + e.message);
    }

    var output = JSON.stringify(result, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    console.log(
        "公告同步完成（" + (Date.now() - startTime) + "ms）",
    );
    return { found: !!result, elapsedMs: Date.now() - startTime };
}

module.exports = generateAnnouncement;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateAnnouncement(api, null, targetId);
            console.log("✅ 公告完成" + (r.found ? "" : "（未找到匹配笔记）"));
        } catch (e) {
            console.error("❌ 公告失败: " + e.message);
        }
    })();
}
