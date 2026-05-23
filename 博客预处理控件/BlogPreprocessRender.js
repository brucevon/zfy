import { Button } from "trilium:preact";
import { showMessage } from "trilium:api";

var MODULES = [
    { name: "tree",          label: "同步目录树",       url: "/blog-tree",          icon: "📂", needsRoot: true  },
    { name: "about-tree",    label: "同步关于目录树",   url: "/blog-about-tree",    icon: "🧭", needsRoot: true  },
    { name: "recommend",     label: "同步推荐阅读",     url: "/blog-recommend",     icon: "⭐", needsRoot: false },
    { name: "article",       label: "同步最近发布",     url: "/blog-article",       icon: "📰", needsRoot: false },
    { name: "recentUpdate",  label: "同步最近动态",     url: "/blog-recentUpdate",  icon: "⚡", needsRoot: false },
    { name: "announcement",  label: "同步公告",         url: "/blog-announcement",  icon: "📣", needsRoot: false },
    { name: "stats",         label: "同步统计摘要",     url: "/blog-stats",         icon: "📊", needsRoot: false },
    { name: "heatmap",       label: "同步热度地图",     url: "/blog-heatmap",       icon: "🔥", needsRoot: false },
    { name: "search",        label: "同步搜索索引",     url: "/blog-search",        icon: "🔍", needsRoot: true  },
    { name: "tags",          label: "同步标签云",       url: "/blog-tag",           icon: "🏷️", needsRoot: true  },
];

export default function () {
    var runScript = async function (name) {
        try {
            var needsRoot = false;
            for (var mi = 0; mi < MODULES.length; mi++) {
                if (MODULES[mi].name === name) {
                    needsRoot = !!MODULES[mi].needsRoot;
                    break;
                }
            }
            var noteId = api.currentNote.noteId;
            await api.runAsyncOnBackendWithManualTransactionHandling(
                async function (pid, childName, nr) {
                    var parent = await api.getNote(pid);
                    var children = await parent.getChildNotes();
                    var normalize = function (n) {
                        return n.replace(/\.js$/, "");
                    };
                    var targetNote = null;
                    for (var ci = 0; ci < children.length; ci++) {
                        if (normalize(children[ci].title) === childName) {
                            targetNote = children[ci];
                            break;
                        }
                    }
                    if (!targetNote)
                        throw new Error(
                            "未找到子笔记「" +
                                childName +
                                "」" +
                                (children.length
                                    ? "，现有: " +
                                      children
                                          .map(function (c) {
                                              return c.title;
                                          })
                                          .join(", ")
                                    : "（无子笔记）"),
                        );

                    var code = await targetNote.getContent();

                    // 读取脚本笔记上的配置标签
                    var targetId = targetNote.getLabelValue("saveNoteId");
                    if (!targetId)
                        throw new Error(childName + " 缺少 #saveNoteId");

                    var rootId = null;
                    if (nr) {
                        rootId = targetNote.getLabelValue("rootNoteId");
                        if (!rootId)
                            throw new Error(childName + " 缺少 #rootNoteId");
                    }

                    var contentLen = targetNote.getLabelValue("contentLen");
                    if (contentLen) contentLen = parseInt(contentLen, 10);
                    if (!contentLen || isNaN(contentLen)) contentLen = null;

                    // 通过 api._syncConfig 向脚本传递配置，sync() 无参数读取
                    api._syncConfig = {
                        rootNoteId: rootId,
                        targetNoteId: targetId,
                        contentLen: contentLen,
                    };

                    var _module = { exports: null };
                    try {
                        var fn = new Function("module", "exports", "api", code);
                        fn(_module, _module.exports || {}, api);
                    } catch (e) {
                        /* 自执行块可能因 api.currentNote 不对而报错，忽略 */
                    }
                    var syncFn = _module.exports && _module.exports.sync;
                    if (typeof syncFn === "function") {
                        await syncFn();
                    } else {
                        throw new Error(
                            childName +
                                " 未导出 sync 函数 (typeof=" +
                                typeof _module.exports +
                                ")",
                        );
                    }
                },
                [noteId, name, needsRoot],
            );
            showMessage(name + " 完成");
        } catch (e) {
            console.error(name + " 失败:", e);
            showMessage(name + " 失败: " + e.message);
        }
    };

    var runAll = async function () {
        for (var mi = 0; mi < MODULES.length; mi++) {
            await runScript(MODULES[mi].name);
        }
        showMessage("全部同步完成 🎉");
    };

    var buttonStyle = {
        width: "100%",
        padding: "10px 16px",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        textAlign: "left" },
    allBtnStyle = {
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

    return (
        <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: "420px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", fontWeight: 700 }}>
                博客预处理
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#888" }}>
                点击按钮同步数据到对应路由
            </p>

            <button style={allBtnStyle} onClick={runAll}>
                一键同步全部
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MODULES.map(function (m) {
                    return (
                        <button
                            key={m.name}
                            style={Object.assign({}, buttonStyle, {
                                background: "#f0f0f0",
                                color: "#333",
                            })}
                            onClick={function () {
                                runScript(m.name);
                            }}
                        >
                            <span style={{ marginRight: 8 }}>{m.icon}</span>
                            {m.label}
                            <span style={{ float: "right", fontSize: 11, color: "#999", lineHeight: "20px" }}>
                                {m.url}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
