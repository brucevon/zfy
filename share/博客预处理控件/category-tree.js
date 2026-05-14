/**
 * 目录树生成 (Backend Script)
 *
 * 标签:
 *   treeRootId = <根笔记ID>     (必需)
 *   treeTargetId = <目标笔记ID>  (必需)
 */

var MAX_DEPTH = 50;

async function generateTree(api, rootNoteId, targetNoteId) {
  var startTime = Date.now();
  var nodes = await api.sql.getRows([
    "WITH RECURSIVE subtree AS (",
    "  SELECT n.noteId, n.title, n.type, n.mime,",
    "         CAST(b.parentNoteId AS TEXT) AS parentNoteId, 0 AS depth",
    "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0",
    "  WHERE n.noteId = ? AND n.isDeleted = 0",
    "  UNION ALL",
    "  SELECT n.noteId, n.title, n.type, n.mime,",
    "         CAST(b.parentNoteId AS TEXT), s.depth + 1",
    "  FROM notes n JOIN branches b ON n.noteId = b.noteId AND b.isDeleted = 0",
    "  JOIN subtree s ON b.parentNoteId = s.noteId",
    "  WHERE n.isDeleted = 0 AND s.depth < ?",
    ")",
    "SELECT DISTINCT noteId, title, type, mime, parentNoteId, depth",
    "FROM subtree ORDER BY depth"
  ].join(' '), [rootNoteId, MAX_DEPTH]);

  if (nodes.length === 0) throw new Error('根笔记下未找到任何笔记');

  var noteIds = nodes.map(function (n) { return n.noteId; });
  var labels = [];
  if (noteIds.length > 0) {
    var ph = noteIds.map(function () { return '?'; }).join(',');
    labels = await api.sql.getRows(
      "SELECT noteId, name, value FROM attributes " +
      "WHERE type = 'label' AND isDeleted = 0 AND noteId IN (" + ph + ")",
      noteIds
    );
  }

  var labelsByNote = {};
  for (var i = 0; i < labels.length; i++) {
    var l = labels[i];
    if (!labelsByNote[l.noteId]) labelsByNote[l.noteId] = [];
    labelsByNote[l.noteId].push({ name: l.name, value: l.value });
  }

  var nodeMap = {};
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    nodeMap[n.noteId] = {
      noteId: n.noteId, title: n.title, type: n.type,
      labels: labelsByNote[n.noteId] || [], children: []
    };
    if (n.mime) nodeMap[n.noteId].mime = n.mime;
  }

  var roots = [];
  for (var i = 0; i < nodes.length; i++) {
    var row = nodes[i];
    var node = nodeMap[row.noteId];
    if (!node) continue;
    var pid = row.parentNoteId;
    if (pid && pid !== row.noteId && nodeMap[pid]) {
      nodeMap[pid].children.push(node);
    } else if (row.noteId === rootNoteId) {
      roots.push(node);
    }
  }

  var tree = roots[0] || null;
  var elapsedMs = Date.now() - startTime;
  var nodeCount = Object.keys(nodeMap).length;

var output = JSON.stringify({
    updatedAt: new Date().toISOString(), rootNoteId: rootNoteId,
    nodeCount: nodeCount, elapsedMs: elapsedMs, tree: tree,
    categories: nodes.filter(function (n) {
      return (labelsByNote[n.noteId] || []).some(function (l) { return l.name === 'category'; });
    }).map(function (n) {
      return {
        noteId: n.noteId, title: n.title, type: n.type,
        parentNoteId: n.parentNoteId,
        labels: labelsByNote[n.noteId] || [],
        mime: n.mime || null
      };
    })
  }, null, 2);

  var targetNote = await api.getNote(targetNoteId);
  if (!targetNote) throw new Error('目标笔记不存在');
  if (targetNote.isProtected) await api.protectNote(targetNoteId, false, false);
  await targetNote.setContent(output);

  console.log('目录树同步完成（' + nodeCount + ' 节点，' + elapsedMs + 'ms）');
  return { nodeCount: nodeCount, elapsedMs: elapsedMs };
}

module.exports = generateTree;

if (typeof api !== 'undefined') {
  (async function () {
    try {
      var rootId = api.currentNote.getLabelValue('treeRootId');
      var targetId = api.currentNote.getLabelValue('treeTargetId');
      if (!rootId) throw new Error('缺少 #treeRootId');
      if (!targetId) throw new Error('缺少 #treeTargetId');
      var r = await generateTree(api, rootId, targetId);
      console.log('✅ 目录树完成: ' + r.nodeCount + ' 节点');
    } catch (e) {
      console.error('❌ 目录树失败: ' + e.message);
    }
  })();
}
