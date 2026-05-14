import { Button } from "trilium:preact";
import { showMessage } from "trilium:api";

export default function() {
    const runScript = async (name) => {
        try {
            const noteId = api.currentNote.noteId;
            await api.runAsyncOnBackendWithManualTransactionHandling(async (pid, childName) => {
                const parent = await api.getNote(pid);
                const children = await parent.getChildNotes();
                // 兼容 Trilium 导入时保留 .js 后缀的情况
                const normalize = n => n.replace(/\.js$/, '');
                let targetNote = null;
                for (const c of children) {
                    if (normalize(c.title) === childName) {
                        targetNote = c;
                        break;
                    }
                }
                if (!targetNote) throw new Error('未找到子笔记「' + childName + '」' +
                    (children.length ? '，现有: ' + children.map(function(c) { return c.title; }).join(', ') : '（无子笔记）'));

                const code = await targetNote.getContent();
                const rootId = targetNote.getLabelValue('treeRootId');
                const targetId = targetNote.getLabelValue('treeTargetId');
                if (!rootId) throw new Error(childName + ' 缺少 #treeRootId');
                if (!targetId) throw new Error(childName + ' 缺少 #treeTargetId');

                // 使用 new Function 注入 module/exports/api 作用域，兼容 module.exports 模式
                var _module = { exports: null };
                try {
                    var fn = new Function('module', 'exports', 'api', code);
                    fn(_module, _module.exports || {}, api);
                } catch (e) { /* 自执行块可能因 api.currentNote 不对而报错，忽略 */ }
                if (typeof _module.exports === 'function') {
                    await _module.exports(api, rootId, targetId);
                } else {
                    throw new Error(childName + ' 未导出可执行函数 (typeof=' + typeof _module.exports + ')');
                }
            }, [noteId, name]);
            showMessage(name + " 完成");
        } catch (e) {
            console.error(name + " 失败:", e);
            showMessage(name + " 失败: " + e.message);
        }
    };

    return (
        <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>博客预处理</h1>
            <p style={{ margin: "0 0 24px", color: "#888" }}>选择要同步的数据项目</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Button
                    text="同步目录树"
                    onClick={() => runScript("category-tree")}
                />
            </div>
        </div>
    );
}
