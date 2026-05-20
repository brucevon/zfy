# zfy — TriliumNext 博客主题

<p align="center">
  <a href="README.md">🇨🇳 中文</a> &nbsp;|&nbsp; <a href="README.en.md">🇺🇸 English</a>
</p>

> 🖊️ 本文档部分内容由 AI 辅助生成，已人工校对。

## 🎯 前言

如果你在用 TriliumNext 做知识管理，大概率也想过把它变成博客——但默认共享页面太素了，又不想折腾 Hexo/WordPress 两套系统。

**zfy** 就是为这个做的：一个 TriliumNext 博客主题，基于 **后端预处理 + EJS 输出** 架构，**所有内容在服务端预先生成 JSON 数据，home.ejs 只需读取静态数据**，打开页面零等待。

🖼️ 示例博客 → [brucevon.space](https://brucevon.space)

---

## 📑 目录

- [✨ 设计亮点](#-设计亮点)
- [🖼️ 效果预览](#-效果预览)
- [🗺️ 架构速览](#-架构速览)
- [🚀 快速上手](#-快速上手)
- [⚙️ 预处理脚本](#️-预处理脚本)
- [🌐 nginx 配置参考](#-nginx-配置参考)
- [❓ 常见问题](#-常见问题)
- [📋 PromotedAttributes 完整配置](#-promotedattributes-完整配置)
- [🏷️ 标签速查](#-标签速查)
- [📁 文件结构](#-文件结构)
- [💭 写在最后](#-写在最后)

---

## ✨ 设计亮点

| | |
|---|---|
| 🧩 **Bento 布局** | 栅格式卡片排版，4 小 1 宽两行排列，告别传统长列表 |
| 🏷️ **全标签驱动** | 20+ 个标签覆盖主题、评论、页脚、封面等全部配置，零硬编码 |
| 🌓 **深色/浅色双主题** | CSS 变量 + `data-theme` 切换，一键切换 |
| 📱 **响应式** | 768px 断点适配移动端，移动端单列布局 |
| 💬 **Twikoo 评论** | CDN 加载，纯标签配置，主题自动跟随 |
| 🔍 **全文搜索** | 服务端预生成索引，客户端实时全文检索，支持关键词高亮标记 |
| 🔥 **热度地图** | 按年展示文章热力分布 |
| 🖼️ **图片灯箱** | 点击放大，首/末张自适应隐藏按钮 |
| ⚡ **高性能** | 全静态输出 + SQL 批量化预处理，home.ejs 几乎零计算 |

---

## 🖼️ 效果预览

> 示例博客：[brucevon.space](https://brucevon.space)

---

## 🗺️ 架构速览

### 配置流

```text
根笔记（#isHome=true 的笔记）
  │
  │  home.ejs 读取标签 → _cfg 对象
  │
  ├─→ 服务端使用：主题、封面、分类树根、About 查找
  │
  └─→ window.__BLOG_CONFIG__ 注入到页面
       │
       └─→ blog.js 读取：HOME_ID、默认主题
```

### 预处理流程

```text
BlogPreprocessRender.js (编排器)
  ├─ tree.js          ─→ 分类树 JSON
  ├─ about-tree.js    ─→ 关于菜单树 JSON
  ├─ stats.js         ─→ 统计数据 JSON
  ├─ recentUpdate.js  ─→ 最近更新 JSON
  ├─ recommend.js     ─→ 推荐文章 JSON（含内容截取）
  ├─ article.js       ─→ 最新文章 JSON（含内容截取）
  ├─ announcement.js  ─→ 公告 JSON（含内容截取）
  ├─ search.js        ─→ 搜索索引 JSON（全量笔记）
  └─ heatmap.js       ─→ 热度年历 JSON
        │
        └─→ 写入中间笔记（#shareRaw + #shareAlias=blog-*）
               │
               └─→ home.ejs / 前端 JS 读取渲染
```

> 💡 理解这个整体流程后再按下方步骤操作，会更有方向感。

---

## 🚀 快速上手

> 💡 **前置说明**：Trilium 中"开启分享"指右键笔记 → **Share** → 笔记 URL 变为可公开访问。以下步骤中所有带"开启分享"的笔记都需做此操作。

### 1️⃣ 下载资源文件

从本仓库的 `share/` 目录下载以下 3 个文件：

```text
share/home.ejs        # 博客模板（主入口）
share/css/blog.css    # 全部博客样式
share/js/blog.js      # 客户端交互脚本
```

> Twikoo 使用 CDN，**无需上传 `twikoo.min.js`**。

### 2️⃣ 导入 Trilium（模板与样式）

首先 Trilium 中需要有一个 `分享` 主笔记（首次开启分享时自动创建，也可手动创建）。在其下或平级位置创建 3 个**文件笔记**，每个**右键 → 开启分享**：

| 文件 | 必配标签 |
|------|----------|
| `home.ejs` | `~shareTemplate(inheritable)=home.ejs`（这是 **关系 Relation**，需在根笔记上通过 Relation Map 链接到此笔记） |
| `blog.css` | `#shareAlias=blog.css` `#shareRaw` |
| `blog.js` | `#shareAlias=blog.js` `#shareRaw` |

> 静态资源路径为 `/blog.css`、`/blog.js`，假设 nginx 已隐藏 `/share/` 前缀。若未隐藏需相应调整（见下文 nginx 示例）。

### 3️⃣ 创建图片资源

博客需要以下 5 张图片，在 Trilium 中新建**图片笔记**（Upload file），每个**开启分享**：

| 图片 | 说明 |
|------|------|
| `favicon.ico` | 浏览器标签页图标 |
| `logo.icon` | 顶部栏左侧头像 |
| `bg-pc.png` | PC 端博客背景图 |
| `bg-mobile.png` | 移动端博客背景图 |
| `beian.png` | 页脚备案图标（无备案可省略） |

> 图片分享后的 URL 为 `/share/[noteId]`，nginx 隐藏前缀后变为 `/favicon.ico` 等。也可在根笔记标签中自定义路径。

### 4️⃣ 创建共享数据笔记

预处理脚本会把数据写入专用的 JSON 笔记，需要提前建好。在 `分享` 笔记下新建一个笔记（如 `home-data`），**单独开启分享**。在其下创建 9 个 `json` 类型子笔记，按以下标签配置：

| 子笔记 | 必需标签 |
|--------|----------|
| `blog-tree` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-tree` |
| `blog-about-tree` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-about-tree` |
| `blog-recommend` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-recommend` |
| `blog-article` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-article` |
| `blog-recentUpdate` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-recentUpdate` |
| `blog-announcement` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-announcement` |
| `blog-stats` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-stats` |
| `blog-heatmap` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-heatmap` |
| `blog-search` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-search` |

> 💡 每条笔记的 noteId（右键 → 复制 ID）在后面配置脚本标签时会用到，可以先统一记下来，后续加到对应脚本的 `#saveNoteId` 标签上。

### 5️⃣ 配置根笔记

新建**根笔记**（如 `我的博客`），**右键 → 开启分享**。在根笔记上添加 PromotedAttributes（见下文），确保设置以下关键标签：

- `#isHome=true` — 声明此笔记为博客主页
- `#homeId=当前笔记ID` — 填入根笔记自身的 noteId（右键 → 复制 ID）
- `#blogTitle=xxx`、`#blogDescription=xxx` — 博客标题与副标题
- `~shareTemplate(inheritable)=home.ejs` — **关系 Relation**，在 Relation Map 中搜索 `home.ejs` 笔记并链接
- `~shareFavicon(inheritable)=favicon.ico` — 关联 favicon 图片笔记
- `~shareLogo(inheritable)=logo.icon` — 关联 logo 图片笔记

> ⚠️ `~` 开头的标签是**关系（Relation）**，不是普通标签。需要在根笔记的 **Relation Map** 中手动搜索并链接到目标笔记，直接粘贴文本不会自动建立连接。

### 6️⃣ 创建「关于」笔记

如果使用"关于"菜单（about-tree.js 生成），需在根笔记下创建一个标题为 **「关于」** 的笔记，可包含子笔记并添加 `#category=true` 标签。about-tree.js 会在根笔记下查找此笔记来构建菜单树。

> 💡 如果暂时不需要"关于"菜单，建议至少创建一个空白的"关于"笔记，否则 about-tree.js 会报错。

### 7️⃣ 发布文章

在根笔记下按需创建子笔记，添加以下标签控制展示位置：

| 标签 | 展示位置 |
|------|----------|
| `#recommend=true` | 首页"推荐阅读"模块 |
| `#article=true` | 首页"最新发布"排序 |
| `#category=true` | 分类树节点 |
| `#recentUpdate=true` | 首页"动态"模块 |
| `#announcement=true` | 首页公告区 |

### 8️⃣ 导入预处理脚本（可选但强推荐）

从 `博客预处理控件/` 目录分别导入脚本文件：

- **`BlogPreprocessRender.js`** → 导入为 **JSX 笔记**（代码类型选 `JSX`），新建一个笔记，类型选择 **渲染笔记** ，点击渲染笔记选择 `JSX` 笔记，然后打开渲染笔记就可以看见渲染面板
- 其余 9 个脚本（`tree.js`、`about-tree.js` 等）→ 导入为 **JS 后端脚本**（Backend Script），建议导入为 `JSX` 笔记的子笔记，方便管理。

导入后参照下文 [⚙️ 预处理脚本](#%EF%B8%8F-预处理脚本核心架构) 配置编排器。运行一次后，首页数据即预生成完毕。

> 注意：10 个脚本**类型不同**，不能全部选同一类型导入。`BlogPreprocessRender.js` 必须是 **JSX** 才能正常渲染面板。**`~renderNote` 也是 Relation**，需在 Relation Map 中链接。

---

## ⚙️ 预处理脚本（核心架构）

首页的数据并非由 EJS 实时查询——而是通过 **后端预处理脚本** 在运行时一次性生成 JSON，写入独立的共享笔记，`home.ejs` / 前端 JS 只做静态读取。

### 数据流

```
预处理脚本（批量 SQL + SUBSTR 截取）
    ↓ api.note.setContent()
独立共享 JSON 笔记（#shareRaw + #shareAlias=blog-xxx）
    ↓ 浏览器通过自定义路由获取
前端 JS（fetch('/blog-tree') → 渲染分类树等）
```

### 导入脚本

从 `博客预处理控件/` 目录下载全部文件，在各笔记中粘贴为 **JS 后端脚本**（Backend Script）。每个脚本通过 `#saveNoteId` 标签指向对应的 json 目标笔记：

| 脚本 | 功能 | 必需标签 |
|------|------|----------|
| `BlogPreprocessRender.js` | **编排入口**，JSX 渲染笔记，显示一键同步按钮面板 | 需通过 `~renderNote` 关联（见下文） |
| `tree.js` | 生成分类树（目录 + 笔记数） | `#rootNoteId` `#saveNoteId` |
| `about-tree.js` | 生成关于菜单树 | `#rootNoteId` `#saveNoteId` |
| `stats.js` | 统计文章/推荐/动态/公告数量 | `#saveNoteId` |
| `recentUpdate.js` | 最近更新列表（含图标） | `#rootNoteId` `#saveNoteId` |
| `recommend.js` | 推荐阅读卡片（内容截取） | `#saveNoteId` `#contentLen(可选)` |
| `article.js` | 最新文章（单篇） | `#saveNoteId` `#contentLen(可选)` |
| `announcement.js` | 公告（单篇） | `#saveNoteId` `#contentLen(可选)` |
| `search.js` | 搜索索引（全量笔记） | `#rootNoteId` `#saveNoteId` `#contentLen(可选)` |
| `heatmap.js` | 热度年历数据 | `#rootNoteId` `#saveNoteId` |

> 每个脚本通过 `#saveNoteId` 标签指向之前创建的对应 json 笔记的 ID。编排器会从每个子脚本标签中读取此 ID，写入对应笔记。

### ⚡ 性能优化说明

- **SQL 批量化**：脚本使用 `JOIN blobs + SUBSTR` 在 SQLite 层面截取内容，避免 N 次 `api.getNote()` 循环拉取完整大 blob
- **单次条件聚合**：`stats.js` 将 4 次独立 COUNT 合并为 1 次查询
- **批量查图标**：`recentUpdate.js` 用 `SELECT ... IN (...)` 一次查出全部图标标签
- **传输量控制**：每篇笔记默认只读 ~650 字节（内容截断 + HTML 标签余量），百篇笔记总传输仍控制在 ~65KB

### 设置编排器

1. 确认已按 **快速上手 → 第 4 步** 创建好 9 个共享数据笔记（`blog-tree` ~ `blog-search`），每个均已正确添加 `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-xxx` 标签
2. 新建一个笔记（如 `博客预处理面板`），关联 `BlogPreprocessRender.js` 作为渲染笔记：
   - 将 `BlogPreprocessRender.js` 导入为 **JS 前端笔记**（代码类型选 `JS Frontend`）
   - 在新笔记上添加关系 `~renderNote=BlogPreprocessRender.js`（在 Relation Map 中搜索并链接）
   - 打开此渲染笔记即可看到一键同步按钮面板
3. 将 `BlogPreprocessRender.js` 设为父笔记，其他 9 个脚本作为其子笔记（子脚本笔记的标题须与上表"脚本"列一致，例如 `tree.js`）
4. 在每个**子脚本笔记**上添加标签：

   | 子脚本 | 必需标签 |
   |--------|----------|
   | `tree.js` | `#saveNoteId=blog-tree笔记ID` `#rootNoteId=博客根笔记ID` |
   | `about-tree.js` | `#saveNoteId=blog-about-tree笔记ID` `#rootNoteId=博客根笔记ID` |
   | `stats.js` | `#saveNoteId=blog-stats笔记ID` |
   | `recentUpdate.js` | `#saveNoteId=blog-recentUpdate笔记ID` `#rootNoteId=博客根笔记ID` |
   | `recommend.js` | `#saveNoteId=blog-recommend笔记ID` `#contentLen=200(可选)` |
   | `article.js` | `#saveNoteId=blog-article笔记ID` `#contentLen=200(可选)` |
   | `announcement.js` | `#saveNoteId=blog-announcement笔记ID` `#contentLen=200(可选)` |
   | `search.js` | `#saveNoteId=blog-search笔记ID` `#rootNoteId=博客根笔记ID` `#contentLen=500(可选)` |
   | `heatmap.js` | `#saveNoteId=blog-heatmap笔记ID` `#rootNoteId=博客根笔记ID` |

   > 编排器读取子脚本笔记上的 `#saveNoteId` 标签确定写入目标。`#rootNoteId` 只给需要递归查询的脚本用（tree / about-tree / recentUpdate / search / heatmap）。`#contentLen` 覆盖默认截取长度。

5. 打开渲染笔记，点击一键同步或逐个运行，检查各脚本控制台输出是否通过

> 💡 首次运行时建议**逐个执行**，观察控制台输出排查问题。成功后可使用一键同步批量生成全部数据。

### 自动执行

编排器及子脚本支持通过 `#run` 标签实现自动执行，具体参考 [Trilium 后端脚本事件文档](https://docs.triliumnotes.org/user-guide/scripts/backend-basics/events)。例如 `#run=sync` 可在同步后自动触发预处理。

### 🔧 独立运行脚本（不使用编排器）

如果不使用编排面板，每个脚本也可以独立运行：

1. 将脚本导入为 **JS 后端脚本**，在脚本笔记上添加必要标签（`#rootNoteId`、`#saveNoteId`、`#contentLen` 等）
2. 在 Trilium 中右键脚本笔记 → **Execute script**，脚本会读取自身标签运行

> 脚本的 standalone 块会自动检测 `api._syncConfig` 是否已由编排器设置，如果未设置则从自身标签读取，无需额外配置。

---

## 🌐 nginx 配置参考（生产环境）

以下是一个生产级 nginx 反代配置（Trilium 运行在 `http://127.0.0.1:8080`，域名 `brucevon.space`）：

```nginx
# ==========================================
# 1. 定义上游服务器
# ==========================================
upstream trilium {
    zone trilium 64k;
    server 127.0.0.1:8080;
    keepalive 2;
}

# ==========================================
# 2. HTTP → HTTPS 强制跳转
# ==========================================
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

# ==========================================
# 3. HTTPS 核心只读安全站点
# ==========================================
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/yourdomain.com/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.com/key.pem;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    proxy_intercept_errors on;

    # Gzip 极限压缩
    gzip on;
    gzip_min_length 1k;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_vary on;
    gzip_proxied any;

    # 404/50x 错误页面导向
    error_page 404 502 503 504 /404.html;
    location = /404.html {
        root /opt/apps/nginx/error_pages;
        internal;
    }

    # 🔥 安全拦截：只精准拦截登录和明细后台操作
    location ~* /(login|setup|admin|ws|custom|inside) {
        return 404;
    }

    # 代理 /share/assets/ → 后端原路径（保留）
    location /share/assets/ {
        proxy_pass http://trilium;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 90;
    }

    # 🔙 核心反代：隐藏 /share/ 前缀
    location / {
        proxy_pass http://trilium/share/;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path /share/ /;

        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 90;

        # 专为预处理大 JSON 优化的全内存缓冲区
        proxy_buffer_size          512k;
        proxy_buffers            4 512k;
        proxy_busy_buffers_size   1024k;
        proxy_max_temp_file_size      0;
    }
}
```

> 关键策略：`location /` → `proxy_pass http://trilium/share/` 自动隐藏 `/share/` 前缀，所有静态资源、JSON 数据和页面共用同一路由，无需 regex 分别匹配。安全拦截只针对 `/login|setup|admin|ws|custom|inside` 等后台路径，不会误伤 `/api/attachments/` 等图片资源。

---

## ❓ 常见问题

### 页面空白或报错

- 检查根笔记是否已**开启分享**（右键 → Share）
- 检查 `home.ejs` 的 `~shareTemplate` 关系是否正确链接
- 检查所有资源笔记（css/js/图片）是否已**开启分享**

### 分类树/关于菜单不显示

- 确认 `#rootNoteId` 标签指向正确的博客根笔记 ID
- 确认根笔记下存在标题为 **「关于」** 的笔记（for about-tree.js）
- 确认 `#category=true` 已添加到需要展示的分类笔记上

### 搜索无结果

- 确保 search.js 已成功运行并写入 blog-search 笔记
- 检查 `#rootNoteId` 是否指向包含所有文章的正确根笔记

### 样式错乱

- 清除浏览器缓存（`Ctrl+F5` 硬刷新）
- 确认 `blog.css` 和 `blog.js` 的分享状态正常
- 检查 nginx 配置中静态资源路径是否映射正确

### 脚本报错 "content.trim is not a function"

- 如果使用旧版脚本，请更新至最新版本。该问题已在 `39afe5f` 修复（blob 内容 Buffer→String 转换）。

---

## 📋 PromotedAttributes 完整配置

在 Trilium **根笔记**上使用 PromotedAttributes 声明博客标签体系。以下分 4 类列出完整定义。

> ⚠️ **注意**：`~relation` 类型需**手动创建关系链接**，复制文本不会自动建立连接。请在根笔记的 Relation Map 中搜索并链接到目标笔记。
>
> 所有 `#label:` + 标签值**全部写在一行，空格分隔**——下面按类别拆开展示是为了阅读方便，实际粘贴时请合为一行。

### 一、关系 Relations

```text
~shareTemplate(inheritable)=home.ejs  ~shareFavicon(inheritable)=favicon.ico  ~shareLogo(inheritable)=logo.icon
```

### 二、根笔记专属标签（不继承）

```text
#label:isHome="promoted,alias=博客主页,single,boolean"        #isHome=true
#label:homeId="promoted,alias=博客主页ID,single,text"         #homeId="笔记ID"
#label:blogTitle="promoted,alias=博客标题,single,text"        #blogTitle="我的博客"
#label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="子非鱼，安知鱼之乐"
#label:appearanceDefaultTheme="promoted,alias=博客默认主题,single,text"  #appearanceDefaultTheme="dark"
#label:coverDefaultImage="promoted,alias=PC端背景URL,single,text"        #coverDefaultImage="/bg-pc.png"
#label:coverMobileImage="promoted,alias=移动端背景URL,single,text"       #coverMobileImage="/bg-mobile.png"
#label:twikooEnabled="promoted,alias=评论系统,single,boolean"   #twikooEnabled=true
#label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text"   #twikooEnvId="你的EnvId"
#label:twikooVersion="promoted,alias=Twikoo版本,single,text"   #twikooVersion="1.6.41"
#label:footerCopyright="promoted,alias=页脚版权,single,text"   #footerCopyright="© 2026 YourName"
#label:footerIcp="promoted,alias=工信部备案号,single,text"     #footerIcp="你的ICP备案号"
#label:footerPolice="promoted,alias=公安备案号,single,text"    #footerPolice="你的公安备案号"
#label:footerPoliceUrl="promoted,alias=公安备案链接,single,text"  #footerPoliceUrl="你的公安备案链接"
#label:footerBeianIcon="promoted,alias=备案图标URL,single,text"  #footerBeianIcon="/beian.png"
#label:siteStartDate="promoted,alias=建站日期,single,text"    #siteStartDate="2026-04-10"
```

#### 根笔记系统标签

```text
#readOnly  #shareDescription="我的博客描述"  #iconClass="bx bxs-yin-yang"
```

### 三、子笔记标签（继承 · 可选）

以下定义在**根笔记**上，`(inheritable)` 使其对子笔记可见：

```text
#label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean"
#label:article(inheritable)="promoted,alias=文章,single,boolean"
#label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean"
#label:announcement(inheritable)="promoted,alias=公告,single,boolean"
#label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean"
#label:category(inheritable)="promoted,alias=类别,single,boolean"
#label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean"
#label:iconClass(inheritable)="promoted,alias=图标,single,text"
#label:dateNote(inheritable)="promoted,alias=日期覆盖,single,text"
#label:shareAlias(inheritable)="promoted,alias=别名,single,text"
```

> 子笔记标签只需定义 `#label:` 元信息，无需在根笔记上设默认值。子笔记使用时自行添加并赋值，如 `#recommend=true`。

### 四、一键复制（含以上全部）

> 💡 **使用方式**：下面按功能拆为 5 段方便阅读。实际使用时，**将 5 段文本拼接成 1 行（空格分隔）** 后粘贴到根笔记的标签框即可。

```text
#label:isHome="promoted,alias=博客主页,single,boolean" #isHome=true #label:homeId="promoted,alias=博客主页ID,single,text" #homeId="笔记ID" #label:blogTitle="promoted,alias=博客标题,single,text" #blogTitle="我的博客" #label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="子非鱼，安知鱼之乐"

#label:appearanceDefaultTheme="promoted,alias=博客默认主题,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=PC端背景URL,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=移动端背景URL,single,text" #coverMobileImage="/bg-mobile.png"

#label:twikooEnabled="promoted,alias=评论系统,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text" #twikooEnvId="你的EnvId" #label:twikooVersion="promoted,alias=Twikoo版本,single,text" #twikooVersion="1.6.41"

#label:footerCopyright="promoted,alias=页脚版权,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=工信部备案号,single,text" #footerIcp="你的ICP备案号" #label:footerPolice="promoted,alias=公安备案号,single,text" #footerPolice="你的公安备案号" #label:footerPoliceUrl="promoted,alias=公安备案链接,single,text" #footerPoliceUrl="你的公安备案链接" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png" #label:siteStartDate="promoted,alias=建站日期,single,text" #siteStartDate="2026-04-10"

#label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean" #label:article(inheritable)="promoted,alias=文章,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean" #label:announcement(inheritable)="promoted,alias=公告,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean" #label:category(inheritable)="promoted,alias=类别,single,boolean" #label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean" #label:iconClass(inheritable)="promoted,alias=图标,single,text" #label:dateNote(inheritable)="promoted,alias=日期覆盖,single,text" #label:shareAlias(inheritable)="promoted,alias=别名,single,text"
```

---

## 🏷️ 标签速查

日常使用参考（不含 `#label:` 属性提升语法）。

### 根笔记标签

| 标签 | 说明 | 默认值 |
|------|------|--------|
| `#isHome=true` | 标记为博客主页 | `true` |
| `#homeId=xxx` | 博客主页笔记 ID | — |
| `#blogTitle=xxx` | 博客标题 | — |
| `#blogDescription=xxx` | 博客副标题 | — |
| `#appearanceDefaultTheme=xxx` | 默认主题 `dark`/`light` | `dark` |
| `#coverDefaultImage=url` | PC 端背景图 | `/bg-pc.png` |
| `#coverMobileImage=url` | 移动端背景图 | `/bg-mobile.png` |
| `#twikooEnabled=true` | 启用 Twikoo 评论 | `true` |
| `#twikooEnvId=xxx` | Twikoo 环境 ID | — |
| `#twikooVersion=x.y.z` | Twikoo CDN 版本 | `1.6.41` |
| `#footerCopyright=xxx` | 页脚版权文字 | — |
| `#footerIcp=xxx` | 工信部备案号 | — |
| `#footerPolice=xxx` | 公安备案号 | — |
| `#footerPoliceUrl=url` | 公安备案链接 | — |
| `#footerBeianIcon=url` | 备案图标路径 | `/beian.png` |
| `#siteStartDate=YYYY-MM-DD` | 建站日期（页脚"已运行 X 天"） | — |

### 子笔记标签

| 标签 | 说明 |
|------|------|
| `#recommend=true` | 标记为推荐文章，出现在"推荐阅读"模块 |
| `#article=true` | 标记为文章，参与"最新发布"排序 |
| `#recentUpdate=true` | 标记为最近更新，出现在"动态"模块 |
| `#announcement=true` | 标记为公告，出现在首页公告区 |
| `#enableTwikoo=true` | 开启此笔记的评论 |
| `#category=true` | 标记为分类节点，出现在分类树 |
| `#shareHiddenFromTree=true` | 从分类树隐藏此节点 |
| `#iconClass` | 图标 CSS class（如 `bx bx-code`）|
| `#dateNote=YYYY-MM-DD` | 覆盖排序日期 |
| `#shareAlias` | 笔记 URL 别名 |

---

## 🏗️ 架构

> 配置流、预处理流程参见上文 [架构速览](#-架构速览)。

### 主页检测

模板渲染时从当前笔记沿父链向上遍历（最多 50 层），找到第一个带 `#isHome=true` 的笔记作为主页。**不再硬编码任何 noteId**。

### 分类树

以主页为根构建，`#category=true` 标签标注分类节点，`#shareHiddenFromTree=true` 控制显隐。

---

## 📁 文件结构

```text
share/
├── home.ejs          # Trilium EJS 模板——博客入口
├── css/blog.css      # 全部博客样式
└── js/blog.js        # 客户端交互脚本

博客预处理控件/          # 后端预处理脚本（共 10 个）
├── BlogPreprocessRender.js  # 编排入口
├── tree.js                  # 分类树
├── about-tree.js            # 关于菜单树
├── stats.js                 # 统计
├── recentUpdate.js          # 最近更新
├── recommend.js             # 推荐阅读
├── article.js               # 最新文章
├── announcement.js          # 公告
├── search.js                # 搜索索引
└── heatmap.js               # 热度地图
```

---

## 💭 写在最后

zfy 是个人项目，边用边改。如果你也用 TriliumNext，欢迎拿去改造。

- 示例博客：[brucevon.space](https://brucevon.space)
- GitHub：[zfy](https://github.com/brucevon/zfy)

可以在以下地方留言交流：

- 💬 博客评论区：[brucevon.space/lIQxHnOklH2m](https://brucevon.space/lIQxHnOklH2m)
- 🐙 GitHub Issues：[github.com/brucevon/zfy/issues](https://github.com/brucevon/zfy/issues)

⭐ Star 也是鼓励。
