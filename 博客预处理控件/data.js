/**
 * 博客预处理：创建时间标签 (Backend Script)
 *
 * 全站已改为服务端实时聚合（SSR）：模板在渲染时实时遍历笔记树生成
 * 首页列表 / 公告 / 动态 / 热力图 / 分类树 / 关于菜单 / 标签云 / 搜索索引，
 * 已不再需要预生成 JSON 快照，因此 syncData（/blog-data）、syncSearch（/blog-search）已废弃。
 *
 * 唯一仍需后端预处理的是给分享子树内可见笔记写入 #dateCreated 标签：
 * 共享模板的 note 对象不暴露真实创建时间（utcDateCreated / dateCreated 均为 null），
 * 只能通过标签把真实 dateCreated 固化到笔记上，模板读取该标签显示"创建时间"。
 *
 * 标签:
 *   rootNoteId  = <根笔记ID>  (必需，分享子树根)
 *
 * 由 BlogPreprocessRender（JSX 面板）经 api.runAsyncOnBackendWithManualTransactionHandling 编排调用。
 */

/** 批量查询标签（labels），返回原始行数组 */
async function queryLabels(noteIds) {
    if (!noteIds || noteIds.length === 0) return [];
    var ph = noteIds.map(function () { return "?"; }).join(",");
    try {
        return await api.sql.getRows(
            "SELECT noteId, name, value FROM attributes " +
            "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" + ph + ")",
            noteIds,
        );
    } catch (e) {
        console.error("标签查询失败: " + e.message);
        return [];
    }
}

/**
 * 创建时间标签：给分享子树内可见笔记写 #dateCreated（读真实 dateCreated，仅新增，不改已有）。
 * 已带 #dateCreated 的跳过；排除 #shareHiddenFromTree / #category。
 */
async function stampDates() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    if (!rootNoteId) throw new Error("缺少配置: rootNoteId");

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

    // 排除 #shareHiddenFromTree / #category
    var labels = [];
    var ids = rows.map(function (r) { return r.noteId; });
    if (ids.length) labels = await queryLabels(ids);
    var skip = {};
    for (var i = 0; i < labels.length; i++) {
        if (
            (labels[i].name === "shareHiddenFromTree" && labels[i].value === "true") ||
            (labels[i].name === "category" && labels[i].value === "true")
        ) {
            skip[labels[i].noteId] = true;
        }
    }

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
            if (cur) { continue; } /* 已打过标签，跳过 */
            note.setLabel("dateCreated", row.dateCreated);
            await note.save();
            stamped++;
        } catch (e) {
            console.error("写入 dateCreated 标签失败: " + row.noteId + " " + e.message);
        }
    }
    console.log("创建时间标签写入完成（新增 " + stamped + " 条）");
    return { stamped: stamped };
}

// ── 导出 ──

module.exports = { stampDates: stampDates };