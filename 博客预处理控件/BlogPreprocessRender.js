import { showMessage } from "trilium:api";

var MODULES = [
    { label: "聚合数据", url: "/blog-data",   icon: "📦" },
    { label: "搜索索引", url: "/blog-search", icon: "🔍" },
];

export default function () {
    var runAll = async function () {
        try {
            var noteId = api.currentNote.noteId;
            await api.runAsyncOnBackendWithManualTransactionHandling(
                async function (pid) {
                    var parent = await api.getNote(pid);
                    var children = await parent.getChildNotes();
                    var targetNote = null;
                    for (var ci = 0; ci < children.length; ci++) {
                        var t = children[ci].title.replace(/\.js$/, "");
                        if (t === "data") {
                            targetNote = children[ci];
                            break;
                        }
                    }
                    if (!targetNote)
                        throw new Error(
                            "未找到子笔记「data」" +
                            (children.length
                                ? "，现有: " + children.map(function (c) { return c.title; }).join(", ")
                                : "（无子笔记）")
                        );

                    var code = await targetNote.getContent();

                    var rootId = targetNote.getLabelValue("rootNoteId");
                    var dataSaveId = targetNote.getLabelValue("dataSaveNoteId");
                    var searchSaveId = targetNote.getLabelValue("searchSaveNoteId");

                    var dataLen = targetNote.getLabelValue("dataLen");
                    if (dataLen) dataLen = parseInt(dataLen, 10);
                    if (!dataLen || isNaN(dataLen)) dataLen = null;
                    var searchLen = targetNote.getLabelValue("searchLen");
                    if (searchLen) searchLen = parseInt(searchLen, 10);
                    if (!searchLen || isNaN(searchLen)) searchLen = null;

                    api._syncConfig = {
                        rootNoteId: rootId,
                        dataSaveNoteId: dataSaveId,
                        searchSaveNoteId: searchSaveId,
                        dataLen: dataLen,
                        searchLen: searchLen,
                    };

                    var _module = { exports: null };
                    var fn = new Function("module", "exports", "api", code);
                    fn(_module, _module.exports || {}, api);

                    if (_module.exports && typeof _module.exports.syncData === "function") {
                        await _module.exports.syncData();
                    }
                    if (_module.exports && typeof _module.exports.syncSearch === "function") {
                        await _module.exports.syncSearch();
                    }
                    if (_module.exports && typeof _module.exports.stampDates === "function") {
                        await _module.exports.stampDates();
                    }
                },
                [noteId],
            );
            showMessage("同步完成 🎉");
        } catch (e) {
            console.error("同步失败:", e);
            showMessage("同步失败: " + e.message);
        }
    };

    var allBtnStyle = {
        width: "100%",
        padding: "12px 16px",
        fontSize: "15px",
        fontWeight: 700,
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        textAlign: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff",
        marginBottom: "16px",
    };
    var itemStyle = {
        width: "100%",
        padding: "10px 16px",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        borderRadius: "8px",
        textAlign: "left",
        background: "#f0f0f0",
        color: "#999",
        cursor: "default",
    };

    return (
        <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: "420px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", fontWeight: 700 }}>
                博客预处理
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#888" }}>
                点击按钮同步聚合数据与搜索索引
            </p>

            <button style={allBtnStyle} onClick={runAll}>
                一键同步全部
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MODULES.map(function (m) {
                    return (
                        <div key={m.url} style={itemStyle}>
                            <span style={{ marginRight: 8 }}>{m.icon}</span>
                            {m.label}
                            <span style={{ float: "right", fontSize: 11, color: "#bbb", lineHeight: "20px" }}>
                                {m.url}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
