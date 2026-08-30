# zfy — TriliumNext 博客主题

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a>
</p>

> zfy 是一个 TriliumNext 博客主题。后端预处理把内容预生成为 JSON，模板只读静态数据，页面零等待。
>
> 文档由 AI 辅助编写并人工校对，如有出入以代码为准。
> 示例：<https://brucevon.space>

---

## 目录

- [特性](#特性)
- [架构](#架构)
- [快速开始](#快速开始)
- [预处理脚本](#预处理脚本)
- [压缩部署](#压缩部署)
- [nginx 参考](#nginx-参考)
- [PromotedAttributes](#promotedattributes)
- [文件结构](#文件结构)
- [FAQ](#faq)

---

## 特性

| 特性 | 说明 |
|---|---|
| 双栏布局 | 左侧公告/动态/热力，右侧最新文章；PC 双栏，移动端单列 |
| 标签驱动 | 20+ 标签覆盖主题/评论/页脚/封面，零硬编码 |
| 双主题 | CSS 变量 + `data-theme`，一键切换深/浅色 |
| 全文搜索 | 服务端预索引，客户端实时检索 + 关键词高亮 |
| 面包屑 | 首页卡片 / 内容页 / 搜索结果均显示分类路径，可点击定位分类树 |
| 文章分页 | 首页最新文章每页 5 篇分页浏览 |
| 标签云双列 | 标签下文章列表 PC 双列、移动端单列 |
| 图片灯箱 | 点击放大，大号左右切换按钮，支持方向键 |
| shareAlias | 别名 URL 自动反查真实 noteId |
| 单文件部署 | 构建脚本把 CSS/JS 内联压缩为单个 EJS |
| 高性能 | SQL 批量预处理，一次聚合请求返回全站数据 |

---

## 架构

### 配置流

```text
根笔记 (#isHome=true)
  └─ blog.ejs 读取标签 → _cfg
       └─ server: 主题/封面/分类根/About
       └─ window.__BLOG_CONFIG__ → blog.js
```

### 预处理流

```text
BlogPreprocessRender.js (编排器)
  ├─ data.js   → 聚合数据 (tree/aboutTree/tags/article/recentUpdate/
  │              announcement/recommend/stats/heatmap) 写入 blog-data
  └─ search.js → 搜索索引 (全量笔记) 写入 blog-search
        └─ 前端 fetch /blog-data (聚合) + /blog-search (搜索)
```

---

## 快速开始

> 说明：Trilium 中"开启分享"= 右键笔记 → Share，使 URL 公开可访问。

### 1. 下载资源

```text
share/blog.ejs          # 模板
share/css/blog.css      # 样式
share/js/blog.js        # 脚本
share/blog.min.ejs      # ★ 单文件产物（部署推荐，由 build-min.js 生成）
```

Twikoo 走 CDN，无需上传 `twikoo.min.js`。

### 2. 导入模板与样式

Trilium 下建 `分享` 主笔记。二选一：

**A. 单文件产物（推荐，1 个分享笔记）**

| 文件 | 标签 |
|---|---|
| `blog.min.ejs` | `~shareTemplate(inheritable)=blog.min.ejs`（Relation） |

**B. 三件套**

| 文件 | 标签 |
|---|---|
| `blog.ejs` | `~shareTemplate(inheritable)=blog.ejs`（Relation） |
| `blog.css` | `#shareAlias=blog.css` `#shareRaw` |
| `blog.js` | `#shareAlias=blog.js` `#shareRaw` |

### 3. 图片资源

| 图片 | 用途 |
|---|---|
| `favicon.ico` | 标签页图标 |
| `logo.icon` | 顶部头像 |
| `bg-pc.png` | PC 背景 |
| `bg-mobile.png` | 移动背景 |
| `beian.png` | 页脚备案图标（可选） |

### 4. 共享数据笔记

在 `分享` 下建 `home-data`，开启分享。其下建 2 个 json 子笔记：

| 子笔记 | 标签 |
|---|---|
| `blog-data` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-data` |
| `blog-search` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-search` |

聚合接口 `/blog-data` 一次返回分类树/关于树/标签云/文章/动态/公告/推荐/统计/热力；`/blog-search` 单独承载搜索索引。记录各 noteId，供脚本 `#saveNoteId` 使用。

### 5. 根笔记

建根笔记，开启分享，设置关键标签（完整见 [PromotedAttributes](#promotedattributes)）：

- `#isHome=true`
- `#homeId=<noteId>`
- `#blogTitle` / `#blogDescription`
- `~shareTemplate(inheritable)=blog.ejs`（或 `blog.min.ejs`）
- `~shareFavicon` / `~shareLogo`

> `~` 开头是 Relation，需在根笔记 Relation Map 中手动链接，粘贴文本不会生效。

### 6. 「关于」笔记

data.js 从根笔记下的「关于」笔记构建 About 菜单。建议至少建一个空「关于」笔记。

### 7. 发文章

按需给子笔记加标签：

| 标签 | 位置 |
|---|---|
| `#recommend=true` | 推荐阅读 |
| `#article=true` | 最新发布 |
| `#category=true` | 分类树节点 |
| `#recentUpdate=true` | 动态 |
| `#announcement=true` | 公告 |

### 8. 导入预处理脚本

- `BlogPreprocessRender.js` → 导入为 **JSX** 笔记，建 `渲染笔记` 关联
- `data.js` / `search.js` → 导入为 **Backend Script**，作为 JSX 子笔记

配置后运行一次，首页数据即预生成。

---

## 预处理脚本

首页数据由后端脚本一次性生成 JSON 写入共享笔记，模板/前端只读。

### 脚本列表

| 脚本 | 功能 | 必需标签 |
|---|---|---|
| `BlogPreprocessRender.js` | 编排入口，JSX 渲染同步面板 | 经 `~renderNote` 关联 |
| `data.js` | 聚合数据（分类/标签/文章/动态/公告/推荐/统计/热力） | `#rootNoteId` `#saveNoteId` `#contentLen(可选)` |
| `search.js` | 搜索索引 | `#rootNoteId` `#saveNoteId` `#contentLen(可选)` |

### 性能

- 脚本用 `JOIN blobs + SUBSTR` 在 SQL 层截取内容，避免 N 次 `api.getNote()`
- `data.js` 全模块合并为 2~3 条 SQL，标签在 SQL 内 JSON 聚合
- 统计用 `COUNT(DISTINCT CASE WHEN ...)` 一次查询
- 前端仅 2 个请求（`/blog-data` + `/blog-search`），内容默认截断 ~150 字

### 设置编排器

1. 确认 `blog-data`、`blog-search` 笔记带 `#shareHiddenFromTree` `#shareRaw` `#shareAlias`
2. 建 `博客预处理面板` 渲染笔记关联 `BlogPreprocessRender.js`
3. `BlogPreprocessRender.js` 为父，`data.js`/`search.js` 为子（标题须一致）
4. 子脚本加标签：

   | 子脚本 | 必需标签 |
   |---|---|
   | `data.js` | `#saveNoteId=blog-data笔记ID` `#rootNoteId=博客根笔记ID` `#contentLen=150(可选)` |
   | `search.js` | `#saveNoteId=blog-search笔记ID` `#rootNoteId=博客根笔记ID` `#contentLen=500(可选)` |

5. 打开渲染笔记一键同步或逐个运行

支持 `#run` 自动执行（见 [Trilium 后端脚本事件](https://docs.triliumnotes.org/user-guide/scripts/backend-basics/events)）。

### 独立运行

脚本右键 → Execute script 可独立运行，standalone 块自动读自身标签。

---

## 压缩部署

源码可读，产物单文件：

```text
源码: share/blog.ejs + share/css/blog.css + share/js/blog.js
产物: share/blog.min.ejs（esbuild 压缩 css/js 内联，含版本头）
```

```bash
node build-min.js   # Node ≥ 16，首次自动拉取 esbuild
```

详细见 [压缩部署说明.md](压缩部署说明.md)。

---

## nginx 参考

生产级反代，隐藏 `/share/` 前缀：

```nginx
upstream trilium { server 127.0.0.1:8080; keepalive 2; }

server {
    listen 80; server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2; server_name yourdomain.com;
    ssl_certificate /etc/nginx/ssl/yourdomain.com/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.com/key.pem;
    ssl_session_cache shared:SSL:10m; ssl_session_timeout 10m;
    ssl_protocols TLSv1.2 TLSv1.3; ssl_prefer_server_ciphers on;

    gzip on; gzip_min_length 1k; gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss;
    gzip_vary on;

    location ~* /(login|setup|admin|ws|custom|inside) { return 404; }

    location /share/assets/ {
        proxy_pass http://trilium;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1; proxy_set_header Connection "";
        proxy_read_timeout 90;
    }
    location / {
        proxy_pass http://trilium/share/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path /share/ /;
        proxy_http_version 1.1; proxy_set_header Connection "";
        proxy_read_timeout 90;
        proxy_buffer_size 512k; proxy_buffers 4 512k;
        proxy_busy_buffers_size 1024k; proxy_max_temp_file_size 0;
    }
}
```

`location /` → `proxy_pass http://trilium/share/` 隐藏 `/share/` 前缀，静态/JSON/页面共用路由；安全拦截只针对后台路径，不误伤 `/api/attachments/`。

---

## PromotedAttributes

在根笔记上用 PromotedAttributes 声明标签体系。`~relation` 需手动在 Relation Map 链接；所有 `#label:` 标签写在一行空格分隔（下面按类别展示，粘贴时合并）。

### 关系 Relations

```text
~shareTemplate(inheritable)=blog.ejs  ~shareFavicon(inheritable)=favicon.ico  ~shareLogo(inheritable)=logo.icon
```

用单文件部署时把 `blog.ejs` 换成 `blog.min.ejs`。

### 根笔记标签

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

系统标签：

```text
#readOnly  #shareDescription="我的博客描述"  #iconClass="bx bxs-yin-yang"
```

### 子笔记标签（继承）

定义在根笔记，`(inheritable)` 对子可见：

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

### 一键复制

5 段拼接为 1 行（空格分隔）后粘贴到根笔记标签框：

```text
#label:isHome="promoted,alias=博客主页,single,boolean" #isHome=true #label:homeId="promoted,alias=博客主页ID,single,text" #homeId="笔记ID" #label:blogTitle="promoted,alias=博客标题,single,text" #blogTitle="我的博客" #label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="子非鱼，安知鱼之乐"

#label:appearanceDefaultTheme="promoted,alias=博客默认主题,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=PC端背景URL,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=移动端背景URL,single,text" #coverMobileImage="/bg-mobile.png"

#label:twikooEnabled="promoted,alias=评论系统,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text" #twikooEnvId="你的EnvId" #label:twikooVersion="promoted,alias=Twikoo版本,single,text" #twikooVersion="1.6.41"

#label:footerCopyright="promoted,alias=页脚版权,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=工信部备案号,single,text" #footerIcp="你的ICP备案号" #label:footerPolice="promoted,alias=公安备案号,single,text" #footerPolice="你的公安备案号" #label:footerPoliceUrl="promoted,alias=公安备案链接,single,text" #footerPoliceUrl="你的公安备案链接" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png" #label:siteStartDate="promoted,alias=建站日期,single,text" #siteStartDate="2026-04-10"

#label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean" #label:article(inheritable)="promoted,alias=文章,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean" #label:announcement(inheritable)="promoted,alias=公告,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean" #label:category(inheritable)="promoted,alias=类别,single,boolean" #label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean" #label:iconClass(inheritable)="promoted,alias=图标,single,text" #label:dateNote(inheritable)="promoted,alias=日期覆盖,single,text" #label:shareAlias(inheritable)="promoted,alias=别名,single,text"
```

---

## 文件结构

```text
share/
├── blog.ejs          # 模板（源码）
├── blog.min.ejs      # ★ 单文件产物（部署用）
├── css/blog.css      # 样式（源码）
└── js/blog.js        # 脚本（源码）

博客预处理控件/
├── BlogPreprocessRender.js  # 编排入口（JSX 面板）
├── data.js                  # 聚合数据脚本
└── search.js                # 搜索索引脚本

build-min.js          # 构建脚本（生成 blog.min.ejs）
压缩部署说明.md        # 压缩部署文档
```

---

## FAQ

- **页面空白**：检查根笔记及资源已开启分享；`~shareTemplate` Relation 是否链接。
- **分类树/关于菜单不显示**：确认 `#rootNoteId` 指向正确根笔记；存在「关于」笔记；`#category=true` 已加。
- **搜索无结果**：确认 search.js 已写入 blog-search；`#rootNoteId` 正确。
- **样式错乱**：硬刷新（Ctrl+F5）；三件套部署时确认 blog.css/blog.js 分享状态；检查 nginx 路径。
- **`content.trim is not a function`**：更新旧脚本至最新（commit `39afe5f` 已修复 blob Buffer→String）。

---

## 写在最后

个人项目，边用边改。

- 示例：<https://brucevon.space>
- GitHub：<https://github.com/brucevon/zfy>
- 评论：<https://brucevon.space/lIQxHnOklH2m>
- Issues：<https://github.com/brucevon/zfy/issues>