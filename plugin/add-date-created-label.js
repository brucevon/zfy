/**
 * 一键添加创建时间标签 (Backend Script)
 *
 * 共享模板的 note 对象读不到真实创建时间（dateCreated 为 null），只能靠标签。
 * 本脚本把分享子树内可见笔记的真实 dateCreated 写入 #dateCreated 标签，
 * 模板即显示"创建时间"。已带 #dateCreated 标签的笔记自动跳过（不覆盖手动值）。
 *
 * 标签值格式: YYYY-MM-DD HH:mm:ss（日期+时间，精确到秒，本地时区）
 *
 * 配置:
 *   给本脚本笔记加标签  #rootNoteId = <分享子树根笔记ID>  (必需)
 *
 * 用法:
 *   - 右键笔记 → 执行脚本（或加 #run 标签后用按钮/热键执行）
 *   - 全站已改服务端实时聚合（SSR），/blog-data、/blog-search 快照已废弃，
 *     这是唯一需要后端执行的预处理。
 */

// script/run 按函数体求值，不支持顶层 await，故用 async IIFE 包裹
(async function () {
    var rootNoteId = api.currentNote.getLabelValue("rootNoteId");
    if (!rootNoteId) throw new Error("缺少配置: 请在本脚本笔记上加 #rootNoteId = <分享子树根笔记ID>");

    /** 格式化日期+时间：YYYY-MM-DD HH:mm:ss（本地时区，精确到秒） */
    function fmtDateTime(v) {
        if (!v) return "";
        try {
            var d = new Date(v);
            if (isNaN(d.getTime())) return String(v);
            var p = function (x) { return String(x).padStart(2, "0"); };
            return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
        } catch (e) {
            return String(v);
        }
    }

    // 收集分享子树内可见笔记（含直接子级，递归深度上限 50）
    var rows = [];
    try {
        rows = await api.sql.getRows(
            "WITH RECURSIVE subtree AS (" +
            "  SELECT n.noteId, n.dateCreated, 0 AS depth" +
            "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0 AND b.parentNoteId = ? AND n.isDeleted = 0" +
            "  UNION ALL" +
            "  SELECT n.noteId, n.dateCreated, s.depth + 1" +
            "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  JOIN subtree s ON b.parentNoteId = s.noteId" +
            "  WHERE n.isDeleted = 0 AND s.depth < 50" +
            ") SELECT noteId, dateCreated FROM subtree",
            [rootNoteId],
        );
    } catch (e) {
        console.error("dateCreated 标签查询失败: " + e.message);
    }

    // 排除 #shareHiddenFromTree=true / #category=true（分享树不可见笔记）
    var skip = {};
    var ids = rows.map(function (r) { return r.noteId; });
    var labels = [];
    if (ids.length) {
        try {
            var ph = ids.map(function () { return "?"; }).join(",");
            labels = await api.sql.getRows(
                "SELECT noteId, name, value FROM attributes " +
                "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" + ph + ")",
                ids,
            );
        } catch (e) {
            console.error("标签查询失败: " + e.message);
        }
    }
    for (var i = 0; i < labels.length; i++) {
        if (
            (labels[i].name === "shareHiddenFromTree" && labels[i].value === "true") ||
            (labels[i].name === "category" && labels[i].value === "true")
        ) {
            skip[labels[i].noteId] = true;
        }
    }

    // 写入 #dateCreated 标签（已存在的跳过）
    var stamped = 0;
    for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (skip[row.noteId]) continue;
        if (!row.dateCreated) continue;
        var note;
        try { note = await api.getNote(row.noteId); } catch (e) { continue; }
        if (!note) continue;
        try {
            var cur = note.getOwnedLabelValue ? note.getOwnedLabelValue("dateCreated") : "";
            if (cur) continue; // 已打过标签，跳过
            note.setLabel("dateCreated", fmtDateTime(row.dateCreated));
            await note.save();
            stamped++;
        } catch (e) {
            console.error("写入 dateCreated 标签失败: " + row.noteId + " " + e.message);
        }
    }
    console.log("创建时间标签写入完成（新增 " + stamped + " 条）");
    return { stamped: stamped };
})();
