# zfy — TriliumNext 博客主题

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a>
</p>

> zfy 是一个 TriliumNext 博客主题，采用**服务端实时聚合（SSR）**方案：模板在每次渲染时实时遍历笔记树生成首页、分类树、关于菜单、标签云、热力图与标题搜索索引，**改文即见，无需手动重建快照**。
>
> 文档由 AI 辅助编写并人工校对，如有出入以代码为准。
> 示例：<https://brucevon.space>

---

## 目录

- [特性](#特性)
- [架构](#架构)
- [快速开始](#快速开始)
- [压缩部署](#压缩部署)
- [nginx 参考](#nginx-参考)
- [标签与配置清单](#标签与配置清单)
- [文件结构](#文件结构)
- [FAQ](#faq)

---

## 特性

| 特性 | 说明 |
|---|---|
| 双栏布局 | 左侧公告/动态/热力，右侧最新文章；PC 双栏，移动端单列 |
| 全站实时聚合 | 模板渲染时实时遍历笔记树，改文即见，无需重建 json 快照 |
| 标签驱动 | 首页/分类/标签云/评论/页脚/封面全部标签化，无硬编码 |
| 双主题 | CSS 变量 + `data-theme`，一键切换深/浅色 |
| 标题搜索 | 服务端实时收集标题索引，客户端即时检索 + 关键词高亮 |
| 面包屑 | 首页卡片 / 内容页均显示分类路径，可点击定位分类树 |
| 文章分页 | 首页最新文章每页 5 篇分页浏览 |
| 标签云 | 标签聚合 + 标签下文章列表（PC 双列、移动端单列） |
| 图片灯箱 | 点击放大，大号左右切换按钮，支持方向键 |
| shareAlias | 别名 URL 自动反查真实 noteId |
| 单文件部署 | 构建脚本把 CSS/JS 内联压缩为单个 EJS |
| 零后端依赖 | 全站数据由模板服务端实时聚合，无需任何后端脚本 |

---

## 架构

### 数据流（服务端实时聚合 SSR）

```text
根笔记 (#isHome=true)
  └─ blog.ejs 渲染时实时遍历分享子树
       ├─ #article    → 最新文章列表
       ├─ #announcement → 公告卡片
       ├─ #recentUpdate → 动态模块 + 菜单「最近动态」
       ├─ #recommend  → 推荐计数
       ├─ #category   → 分类树 + 内容页面包屑路径
       ├─ #noteTag    → 标签云 / 模块标签 / 文章标签
       └─ 全部可见笔记 → 标题搜索索引（window.__SSR_SEARCH__）
            └─ 结果直接生成 HTML，并注入 window.__SSR_*__ 供客户端交互
```

- **服务端渲染**：首页四模块、分类树、关于菜单、导航统计、面包屑、热力图全部在模板端生成 HTML（SEO 友好、改文即见）。
- **客户端交互**：`blog.js` 基于模板注入的 `window.__SSR_HOME__ / __SSR_ARTICLES__ / __SSR_TAGDATA__ / __SSR_HUB__ / __SSR_SEARCH__ / __BLOG_CONFIG__` 完成展开折叠、定位、搜索、分页、灯箱、主题等，**不再请求 `/blog-data`、`/blog-search`**。
- **零后端依赖**：全部数据由模板实时聚合生成，部署仅需一个 `blog.min.ejs`；唯一的可选后端脚本是 `plugin/add-date-created-label.js`（一键写入 `#dateCreated` 创建时间标签）。

---

## 快速开始

> 说明：Trilium 中"开启分享"= 右键笔记 → Share，使 URL 公开可访问。

### 1. 下载资源

```text
share/blog.min.ejs      # ★ 单文件产物（部署推荐，由 build-min.js 生成）
share/blog.ejs          # 模板源码（日常修改用）
share/css/blog.css      # 样式源码
share/js/blog.js        # 脚本源码
```

Twikoo 走 CDN，无需上传 `twikoo.min.js`。

### 2. 导入模板（单文件）

Trilium 下建 `分享` 主笔记，再建一个模板笔记并开启分享，粘贴 `blog.min.ejs` 内容：

| 模板笔记 | 标签 |
|---|---|
| `blog.min.ejs` | `~shareTemplate(inheritable)=blog.min.ejs`（Relation） |

> `~` 开头是 Relation，需在 Relation Map 中手动链接，粘贴文本不会生效。
> `~shareTemplate` 是**必填**，否则分享页不套用本主题。

### 3. 图片资源（可选）

| 图片 | 用途 |
|---|---|
| `logo.icon` | 顶部头像 |
| `bg-pc.png` | PC 背景 |
| `bg-mobile.png` | 移动背景 |
| `beian.png` | 页脚备案图标（可选） |

可通过根笔记 `#coverDefaultImage` / `#coverMobileImage` / `#footerBeianIcon` 覆盖背景与备案图标 URL。

### 4. 根笔记

建根笔记，开启分享，设置关键标签（完整清单见 [标签与配置清单](#标签与配置清单)）：

- `#isHome=true`
- `#blogTitle` / `#blogDescription`
- `~shareTemplate(inheritable)=blog.min.ejs`

### 5. 「关于」笔记

模板会从根笔记下找一个标题为「关于」的笔记渲染"关于"下拉菜单。建议建一个「关于」笔记（可空），其子笔记按 `#category` / 图标 / 颜色配置即成为菜单项。

### 6. 发文章 / 建分类

给子笔记加标签（均定义在根笔记 `inheritable`，子笔记直接打勾即可）：

| 标签 | 作用 | 位置 |
|---|---|---|
| `#article=true` | 文章，进首页「最新文章」 | 文章笔记 |
| `#recentUpdate=true` | 动态，进首页「动态」+ 菜单「最近动态」 | 动态笔记 |
| `#announcement=true` | 公告，首页「公告」（取第一个） | 公告笔记 |
| `#recommend=true` | 推荐，计入「推荐」计数 | 文章笔记 |
| `#category=true` | 分类节点，构成分类树与面包屑 | 分类笔记 |
| `#noteTag=xxx` | 标签，进标签云 / 模块/文章标签 | 任意已分享笔记 |
| `#shareAlias=xxx` | 别名 URL（可选，更友好） | 任意笔记 |
| `#shareExternalLink=...` | 外链（分类/文章跳转外部） | 分类或文章 |
| `#articleCover=https://...` | 封面图（首页/标签云文章卡片） | 文章 |
| `#color=#hex` | 标题/图标着色 | 任意笔记 |
| `#iconClass=bx bxs-xxx` | 图标 | 任意笔记 |
| `#shareHiddenFromTree=true` | 从分类树/搜索/打标中排除 | 内部笔记 |

> 分类树按 `#category` 的父子层级自动生成；内容页面包屑即当前笔记到根的分类路径。

### 7. 标签云（可选）

建一个笔记并加 `#tagCloud`（或作为根笔记的子笔记带上该标签），该笔记成为标签云页面。首页「查看全部 →」与导航「文章/动态/推荐/公告」计数会跳到它。可用 `#tagCloudIconClass` 自定义标签图标。

### 8. 创建时间（可选）

共享模板默认读不到笔记的真实创建时间，只能靠标签。推荐在 Trilium 中运行 `plugin/add-date-created-label.js`（后端脚本）：给脚本笔记加 `#rootNoteId = <分享子树根笔记ID>` 后右键执行，即可把子树内可见笔记的真实创建时间一键批量写入 `#dateCreated` 标签（格式 `YYYY-MM-DD HH:mm:ss`，已带标签的自动跳过）。也可手动给文章加 `#dateCreated` 标签（见 [标签与配置清单](#标签与配置清单)）。

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

详细见 [deployment.md](deployment.md)。

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

`location /` → `proxy_pass http://trilium/share/` 隐藏 `/share/` 前缀，静态/页面共用路由；安全拦截只针对后台路径，不误伤 `/api/attachments/`。

---

## 标签与配置清单

> `~relation` 需在 Relation Map 手动链接；所有 `#label:` 写在一行空格分隔（下面按类别展示，粘贴时合并）。

### 关系 Relations

```text
~shareTemplate(inheritable)=blog.min.ejs
```

模板笔记带 `~shareTemplate` 后，分享页即套用本主题（**必填**）。用源码调试时可换成 `blog.ejs`。

### 根笔记标签（全局配置）

| 标签 | 说明 | 默认 |
|---|---|---|
| `#isHome=true` | 标记博客根笔记 | — |
| `#homeId=<id>` | 博客主页ID（可选，自带检测） | — |
| `#blogTitle=` | 博客标题 | — |
| `#blogDescription=` | 博客副标题 / 描述 | — |
| `#appearanceDefaultTheme=` | 默认主题 `dark`/`light` | `dark` |
| `#coverDefaultImage=` | PC 背景 URL | `/bg-pc.png` |
| `#coverMobileImage=` | 移动背景 URL | `/bg-mobile.png` |
| `#twikooEnabled=true` | 启用评论系统 | — |
| `#twikooEnvId=` | Twikoo 环境 ID | — |
| `#twikooVersion=` | Twikoo 版本 | `1.6.41` |
| `#footerCopyright=` | 页脚版权文本 | — |
| `#footerIcp=` | 工信部备案号 | — |
| `#footerPolice=` | 公安备案号 | — |
| `#footerPoliceUrl=` | 公安备案链接 | — |
| `#footerBeianIcon=` | 备案图标 URL | `/beian.png` |
| `#siteStartDate=` | 建站日期，用于"已运行 N 天" | — |
| `#tagCloudIconClass=` | 标签图标 class | `bx bx-purchase-tag-alt` |
| `#statTagRecommend=` | 「推荐」统计跳转用标签名 | `推荐阅读` |
| `#statTagArticle=` | 「文章」统计跳转用标签名 | `文章` |
| `#statTagUpdate=` | 「动态」统计跳转用标签名 | `动态` |
| `#statTagAnnounce=` | 「公告」统计跳转用标签名 | `公告` |
| `#readOnly` | 系统：只读 | — |
| `#shareDescription=` | 系统：分享描述 | — |
| `#iconClass=` | 根笔记图标 | — |

### 子笔记标签（继承，定义在根笔记）

已在所有子笔记中以 `(inheritable)` 暴露。直接打在子笔记上即生效：

| 标签 | 说明 |
|---|---|
| `#article=true` | 文章 |
| `#recentUpdate=true` | 动态 |
| `#announcement=true` | 公告 |
| `#recommend=true` | 推荐（推荐计数仅认笔记自身拥有） |
| `#category=true` | 分类节点 |
| `#noteTag=<值>` | 标签（可多个，进标签云/模块/文章标签） |
| `#shareAlias=<别名>` | 别名 URL |
| `#shareExternalLink=<url>` | 外链跳转 |
| `#shareHiddenFromTree=true` | 从分类树/搜索/打标排除 |
| `#articleCover=<图片url>` | 文章封面 |
| `#dateCreated=` | 创建时间（可选，格式 `YYYY-MM-DD HH:mm:ss`，可用 `plugin/add-date-created-label.js` 一键批量写入） |
| `#color=<hex>` | 标题/图标颜色 |
| `#iconClass=<图标class>` | 图标 |
| `#enableTwikoo=true` | 单篇开启评论 |

> 说明：`#recommend` 只统计"笔记自身拥有"的该标签，避免继承导致全部计数。

### 标签云笔记

| 标签 | 说明 |
|---|---|
| `#tagCloud` | 标记该笔记为标签云页 |
| `#tagCloudIconClass=` | 覆盖标签图标 class |

### 一键复制（根笔记标签）

```text
#label:isHome="promoted,alias=博客主页,single,boolean" #isHome=true #label:blogTitle="promoted,alias=博客标题,single,text" #blogTitle="我的博客" #label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="子非鱼，安知鱼之乐"
```

```text
#label:appearanceDefaultTheme="promoted,alias=默认主题,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=PC背景,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=移动背景,single,text" #coverMobileImage="/bg-mobile.png" #label:siteStartDate="promoted,alias=建站日期,single,text" #siteStartDate="2026-04-10"
```

```text
#label:twikooEnabled="promoted,alias=评论系统,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text" #twikooEnvId="你的EnvId" #label:twikooVersion="promoted,alias=Twikoo版本,single,text" #twikooVersion="1.6.41"
```

```text
#label:footerCopyright="promoted,alias=页脚版权,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=工信部备案号,single,text" #footerIcp="你的ICP" #label:footerPolice="promoted,alias=公安备案号,single,text" #footerPolice="你的公安备案号" #label:footerPoliceUrl="promoted,alias=公安备案链接,single,text" #footerPoliceUrl="你的链接" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png"
```

```text
#label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean" #label:article(inheritable)="promoted,alias=文章,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean" #label:announcement(inheritable)="promoted,alias=公告,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean" #label:category(inheritable)="promoted,alias=类别,single,boolean" #label:noteTag(inheritable)="promoted,alias=标签,text" #label:shareAlias(inheritable)="promoted,alias=别名,single,text" #label:shareExternalLink(inheritable)="promoted,alias=外链,single,text" #label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean" #label:articleCover(inheritable)="promoted,alias=封面,single,text" #label:color(inheritable)="promoted,alias=颜色,single,text" #label:iconClass(inheritable)="promoted,alias=图标,single,text"
```

---

## 文件结构

```text
share/
├── blog.ejs          # 模板（源码）
├── blog.min.ejs      # ★ 单文件产物（部署用）
├── css/blog.css      # 样式（源码）
└── js/blog.js        # 脚本（源码）

build-min.js          # 构建脚本（生成 blog.min.ejs）
deployment.md         # 压缩部署文档
plugin/
└── add-date-created-label.js   # 可选后端脚本：一键写入 #dateCreated 创建时间标签
```

---

## FAQ

- **页面空白**：确认根笔记及资源已开启分享；`~shareTemplate` Relation 是否链接。
- **分类树 / 关于菜单不显示**：确认「关于」笔记存在于根下；分类节点已加 `#category=true`。
- **文章不出现在首页**：确认文章笔记加 `#article=true`。
- **内容页不显示"创建时间"**：共享模板读不到真实创建时间，可在 Trilium 中运行 `plugin/add-date-created-label.js` 一键批量写入，或手动给文章加 `#dateCreated=YYYY-MM-DD HH:mm:ss` 标签。
- **标签云不显示**：确认标签云笔记已加 `#tagCloud` 并开启分享；笔记打了 `#noteTag`。
- **样式错乱**：硬刷新（Ctrl+F5）；确认只用 `blog.min.ejs` 一个分享笔记。
- **搜索找不到**：搜索仅匹配标题；确认笔记未加 `#shareHiddenFromTree` 或 `#category`。

---

## 写在最后

个人项目，边用边改。

- 示例：<https://brucevon.space>
- GitHub：<https://github.com/brucevon/zfy>
- 评论：<https://brucevon.space/lIQxHnOklH2m>
- Issues：<https://github.com/brucevon/zfy/issues>