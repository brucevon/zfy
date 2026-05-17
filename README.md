# zfy — TriliumNext 博客主题

## 🎯 前言

如果你在用 TriliumNext 做知识管理，大概率也想过把它变成博客——但默认共享页面太素了，又不想折腾 Hexo/WordPress 两套系统。

**zfy** 就是为这个做的：一个基于 `home.ejs` 模板的 TriliumNext 博客主题，风格参考 bento 布局，**所有配置通过笔记标签驱动，不写一行后端代码**。

🖼️ 示例博客 → [brucevon.space](https://brucevon.space)

---

## ✨ 设计亮点

| | |
|---|---|
| 🧩 **Bento 布局** | 栅格式卡片排版，4 小 1 宽两行排列，告别传统长列表 |
| 🏷️ **全标签驱动** | 18 个标签覆盖主题、评论、页脚、封面等全部配置，零硬编码 |
| 🌓 **深色/浅色双主题** | CSS 变量 + `data-theme` 切换，一键切换 |
| 📱 **响应式** | 768px 断点适配移动端，移动端单列布局 |
| 💬 **Twikoo 评论** | CDN 加载，纯标签配置，主题自动跟随 |
| 🔍 **SEO 友好** | 分类树 + About 菜单 + 站内搜索 + 文章目录 |
| 🔥 **热度地图** | 按年展示文章热力分布 |
| ⚡ **高性能** | 全静态输出，无运行时框架，~1KB blog.js gzip |

---

## 🚀 快速上手

### 1️⃣ 下载资源文件

从本仓库的 `share/` 目录下载以下 3 个文件：

```text
share/home.ejs        # 博客模板（主入口）
share/css/blog.css    # 全部博客样式
share/js/blog.js      # 客户端交互脚本
```

> Twikoo 使用 CDN，**无需上传 `twikoo.min.js`**。

### 2️⃣ 导入 Trilium

在 Trilium 中为这 3 个文件分别创建**文件笔记**：

| 文件 | 必配标签 |
|------|----------|
| `home.ejs` | `~shareTemplate(inheritable)=home.ejs`（关联到根笔记） |
| `blog.css` | `#shareAlias=blog.css` `#shareRaw` + 开启分享 |
| `blog.js` | `#shareAlias=blog.js` `#shareRaw` + 开启分享 |

> 静态资源路径为 `/blog.css`、`/blog.js`，假设 nginx 已隐藏 `/share/` 前缀。若未隐藏需相应调整。

### 3️⃣ 配置根笔记

在博客根笔记上添加 PromotedAttributes（见下文），一键粘贴配置标签。

### 4️⃣ 发布文章

子笔记按需添加 `#recommend=true`、`#article=true` 等标签控制展示位置。

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

把下面 5 行拼成 **1 行**后粘贴到根笔记：

```text
#label:isHome="promoted,alias=博客主页,single,boolean" #isHome=true #label:homeId="promoted,alias=博客主页ID,single,text" #homeId="笔记ID" #label:blogTitle="promoted,alias=博客标题,single,text" #blogTitle="我的博客" #label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="子非鱼，安知鱼之乐" #label:appearanceDefaultTheme="promoted,alias=博客默认主题,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=PC端背景URL,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=移动端背景URL,single,text" #coverMobileImage="/bg-mobile.png" #label:twikooEnabled="promoted,alias=评论系统,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text" #twikooEnvId="你的EnvId" #label:twikooVersion="promoted,alias=Twikoo版本,single,text" #twikooVersion="1.6.41" #label:footerCopyright="promoted,alias=页脚版权,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=工信部备案号,single,text" #footerIcp="你的ICP备案号" #label:footerPolice="promoted,alias=公安备案号,single,text" #footerPolice="你的公安备案号" #label:footerPoliceUrl="promoted,alias=公安备案链接,single,text" #footerPoliceUrl="你的公安备案链接" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png" #label:siteStartDate="promoted,alias=建站日期,single,text" #siteStartDate="2026-04-10" #label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean" #label:article(inheritable)="promoted,alias=文章,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean" #label:announcement(inheritable)="promoted,alias=公告,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean" #label:category(inheritable)="promoted,alias=类别,single,boolean" #label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean" #label:iconClass(inheritable)="promoted,alias=图标,single,text" #label:dateNote(inheritable)="promoted,alias=日期覆盖,single,text" #label:shareAlias(inheritable)="promoted,alias=别名,single,text"
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

### 主页检测

模板渲染时从当前笔记沿父链向上遍历（最多 50 层），找到第一个带 `#isHome=true` 的笔记作为主页。**不再硬编码任何 noteId**。

### 分类树

以主页为根构建，`#category=true` 标签标注分类节点，`#shareHiddenFromTree=true` 控制显隐。

---

## 📁 文件结构

```text
share/
├── home.ejs          # Trilium EJS 模板——博客入口
├── css/blog.css      # 全部博客样式（1831 行）
└── js/blog.js        # 客户端交互脚本（735 行）
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
