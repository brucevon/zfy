/**
 * 顶部胶囊关于目录树生成 (Backend Script)
 *
 * 递归查询 #rootNoteId 下标题为「关于」的子笔记的所有子笔记。
 *
 * 标签:
 *   rootNoteId = <根笔记ID>  (必需)
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-about-tree)
 */

var TREE_MAX_DEPTH = 50;

async function generateAboutTree(api, rootNoteId, targetNoteId) {
    var startTime = Date.now();

    // 查找标题为「关于」的子笔记
    var aboutNote = null;
    try {
        aboutNote = await api.sql.getRow(
            "SELECT n.noteId FROM notes n " +
            "INNER JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0 " +
            "WHERE b.parentNoteId = ? AND n.isDeleted = 0 AND n.title = '关于'",
            [rootNoteId],
        );
    } catch (e) {
        console.error("about-tree 查询失败: " + e.message);
    }
    if (!aboutNote) throw new Error("未找到标题为「关于」的子笔记");

    // 递归查询「关于」下的所有子笔记
    var nodes = [];
    try {
        nodes = await api.sql.getRows(
            "WITH RECURSIVE subtree AS (" +
            "  SELECT n.noteId, n.title, b.parentNoteId, 0 AS depth" +
            "  FROM notes n" +
            "  INNER JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  WHERE b.parentNoteId = ? AND n.isDeleted = 0" +
            "  UNION ALL" +
            "  SELECT n.noteId, n.title, b.parentNoteId, s.depth + 1" +
            "  FROM notes n" +
            "  INNER JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0" +
            "  INNER JOIN subtree s ON b.parentNoteId = s.noteId" +
            "  WHERE n.isDeleted = 0 AND s.depth < ?" +
            ") SELECT DISTINCT noteId, title, parentNoteId FROM subtree",
            [aboutNote.noteId, TREE_MAX_DEPTH],
        );
    } catch (e) {
        console.error("about-tree 子笔记查询失败: " + e.message);
    }

    if (nodes.length === 0) throw new Error("「关于」下未找到任何笔记");

    // 批量查询标签（category、icon）
    var noteIds = nodes.map(function (n) {
        return n.noteId;
    });
    var labels = [];
    if (noteIds.length > 0) {
        var ph = noteIds
            .map(function () {
                return "?";
            })
            .join(",");
        labels = await api.sql.getRows(
            "SELECT noteId, name, value FROM attributes " +
                "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" +
                ph +
                ")",
            noteIds,
        );
    }

    var catSet = {};
    var iconMap = {};
    for (var i = 0; i < labels.length; i++) {
        if (labels[i].name === "category" && labels[i].value === "true") {
            catSet[labels[i].noteId] = true;
        }
        if (labels[i].name === "icon") {
            iconMap[labels[i].noteId] = labels[i].value;
        }
    }
    // 补充查询 iconClass（仅当 icon 未设置时作为 fallback，与 _noteIcon 逻辑一致）
    for (var i = 0; i < labels.length; i++) {
        if (labels[i].name === "iconClass" && !iconMap[labels[i].noteId]) {
            iconMap[labels[i].noteId] = labels[i].value;
        }
    }

    // 按 parentNoteId 分组
    var childrenMap = {};
    for (var i = 0; i < nodes.length; i++) {
        var pid = nodes[i].parentNoteId;
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(nodes[i]);
    }

    // 递归构建树
    function buildChildren(parentId) {
        var children = childrenMap[parentId] || [];
        var result = [];
        for (var i = 0; i < children.length; i++) {
            var n = children[i];
            result.push({
                noteId: n.noteId,
                title: n.title,
                noteIcon: iconMap[n.noteId] || "",
                category: !!catSet[n.noteId],
                children: buildChildren(n.noteId),
            });
        }
        return result;
    }

    var result = buildChildren(aboutNote.noteId);

    var output = JSON.stringify(result, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    console.log(
        "关于目录树同步完成（" +
            nodes.length +
            " 节点，" +
            (Date.now() - startTime) +
            "ms）",
    );
    return { nodeCount: nodes.length, elapsedMs: Date.now() - startTime };
}

module.exports = generateAboutTree;

if (typeof api !== "undefined") {
    (async function () {
        try {
            var rootId = api.currentNote.getLabelValue("rootNoteId");
            var targetId = api.currentNote.getLabelValue("saveNoteId");
            if (!rootId) throw new Error("缺少 #rootNoteId");
            if (!targetId) throw new Error("缺少 #saveNoteId");
            var r = await generateAboutTree(api, rootId, targetId);
            console.log("✅ 关于目录树完成: " + r.nodeCount + " 节点");
        } catch (e) {
            console.error("❌ 关于目录树失败: " + e.message);
        }
    })();
}
