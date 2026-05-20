/**
 * 目录树生成 (Backend Script)
 *
 * 递归查询 #rootNoteId 下所有子笔记，构建嵌套树结构。
 *
 * 标签:
 *   rootNoteId = <根笔记ID>  (必需)
 *   saveNoteId = <目标笔记ID>  (必需，需设置 #shareRaw #shareAlias=blog-tree)
 */

var TREE_MAX_DEPTH = 50;

async function sync() {
    var cfg = api._syncConfig || {};
    var rootNoteId = cfg.rootNoteId;
    var targetNoteId = cfg.targetNoteId;
    if (!rootNoteId) throw new Error("缺少配置: rootNoteId");
    if (!targetNoteId) throw new Error("缺少配置: targetNoteId");

    var startTime = Date.now();

    // 递归查询所有子笔记（含 parentNoteId）
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
            [rootNoteId, TREE_MAX_DEPTH],
        );
    } catch (e) {
        console.error("tree 查询失败: " + e.message);
    }

    if (nodes.length === 0) throw new Error("根笔记下未找到笔记");

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
    var hiddenSet = {};
    var iconMap = {};
    var colorMap = {};
    for (var i = 0; i < labels.length; i++) {
        if (labels[i].name === "category" && labels[i].value === "true") {
            catSet[labels[i].noteId] = true;
        }
        if (labels[i].name === "shareHiddenFromTree" && labels[i].value === "true") {
            hiddenSet[labels[i].noteId] = true;
        }
        if (labels[i].name === "icon") {
            iconMap[labels[i].noteId] = labels[i].value;
        }
        if (labels[i].name === "color") {
            colorMap[labels[i].noteId] = labels[i].value;
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
            if (n.noteId === rootNoteId) continue;
            if (hiddenSet[n.noteId]) continue;
            result.push({
                noteId: n.noteId,
                title: n.title,
                noteIcon: iconMap[n.noteId] || "",
                color: colorMap[n.noteId] || "",
                category: !!catSet[n.noteId],
                children: buildChildren(n.noteId),
            });
        }
        return result;
    }

    var result = buildChildren(rootNoteId);

    var output = JSON.stringify(result, null, 2);

    var targetNote = await api.getNote(targetNoteId);
    if (!targetNote) throw new Error("目标笔记不存在");
    if (targetNote.isProtected)
        await api.protectNote(targetNoteId, false, false);
    await targetNote.setContent(output);

    // 统计叶子节点数量
    function countLeaves(arr) {
        var c = 0;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].children.length === 0) c++;
            else c += countLeaves(arr[i].children);
        }
        return c;
    }

    console.log(
        "目录树同步完成（" +
            countLeaves(result) +
            " 叶子，" +
            nodes.length +
            " 总节点，" +
            (Date.now() - startTime) +
            "ms）",
    );
    return { nodeCount: nodes.length, elapsedMs: Date.now() - startTime };
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
            console.log("✅ 目录树完成: " + r.nodeCount + " 节点");
        } catch (e) {
            console.error("❌ 目录树失败: " + e.message);
        }
    })();
}
