import { showMessage } from "trilium:api";

// 全站已改为服务端实时聚合（SSR），/blog-data、/blog-search 快照已废弃。
// 唯一需要后端执行的预处理是写 #dateCreated 创建时间标签（对分享子树内可见笔记）。
var MODULES = [
    { label: "创建时间标签", url: "#dateCreated", icon: "🕐" },
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

                    api._syncConfig = {
                        rootNoteId: rootId,
                    };

                    var _module = { exports: null };
                    var fn = new Function("module", "exports", "api", code);
                    fn(_module, _module.exports || {}, api);

                    if (_module.exports && typeof _module.exports.stampDates === "function") {
                        await _module.exports.stampDates();
                    }
                },
                [noteId],
            );
            showMessage("创建时间标签写入完成 🎉");
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
                页面已由模板服务端实时聚合，此按钮仅写入 #dateCreated 创建时间标签
            </p>

            <button style={allBtnStyle} onClick={runAll}>
                写入创建时间标签
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
