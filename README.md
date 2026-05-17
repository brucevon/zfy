# zfy — TriliumNext 博客主题

基于 TriliumNext 的博客系统，使用 `home.ejs` 模板渲染，风格参考 bento 布局。

## 快速开始

### 1. 下载资源文件

从本仓库 `share/` 目录下载以下文件：

```
share/home.ejs          # 博客模板（主入口）
share/css/blog.css       # 博客样式
share/js/blog.js         # 客户端交互脚本
share/js/twikoo.min.js   # Twikoo 评论库（可选，也可用 CDN）
```

### 2. 导入 Trilium

在 Trilium 中逐一手动创建如下文件笔记：

| 文件 | 在 Trilium 中 | 必配标签 |
|------|---------------|----------|
| `home.ejs` | 创建为 EJS 文件笔记，粘贴内容 | `~shareTemplate(inheritable)=home.ejs`（关联到根笔记） |
| `blog.css` | 创建为 CSS 文件笔记，粘贴内容 | `#shareAlias=blog.css` `#shareRaw` 并开启分享 |
| `blog.js` | 创建为 JS 文件笔记，粘贴内容 | `#shareAlias=blog.js` `#shareRaw` 并开启分享 |
| `twikoo.min.js` | 创建为 JS 文件笔记，粘贴内容 | `#shareAlias=twikoo.min.js` `#shareRaw` 并开启分享 |

> **注意**：模板引用静态资源的路径为 `/blog.css`、`/blog.js`，假设 nginx 已隐藏 `/share/` 前缀。如果未隐藏，需要相应调整路径。Twikoo 默认使用 CDN（`cdn.jsdelivr.net`），可以免去上传 `twikoo.min.js`。

### 3. 配置根笔记

在博客根笔记上添加 PromotedAttributes（见下文）和对应标签值，配置主题、评论、页脚等选项。

### 4. 添加文章

子笔记（文章）按需添加标签控制推荐、分类等行为。

## PromotedAttributes 配置

在 Trilium 的**根笔记**上使用 PromotedAttributes 声明博客标签体系。通过 `#label:` 定义标签的元信息（类型、别名、是否继承），然后为标签赋值。以下分三类列出完整定义。

> **一键复制**（不含 Relation，Relation 需手动链接）：
> ```
> #label:isHome="promoted,alias=博客主页,single,boolean" #isHome=true #label:homeId="promoted,alias=博客主页ID,single,text" #homeId="笔记ID" #label:blogTitle="promoted,alias=博客标题,single,text" #blogTitle="你的博客标题" #label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="你的博客副标题" #label:appearanceDefaultTheme="promoted,alias=博客默认主题,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=PC端背景URL,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=移动端背景URL,single,text" #coverMobileImage="/bg-mobile.png" #label:twikooEnabled="promoted,alias=评论系统,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text" #twikooEnvId="你的EnvId" #label:twikooVersion="promoted,alias=Twikoo版本,single,text" #twikooVersion="1.6.41" #label:footerCopyright="promoted,alias=页脚版权,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=工信部备案号,single,text" #footerIcp="黔ICP备2026006103号-1" #label:footerPolice="promoted,alias=公安备案号,single,text" #footerPolice="贵公网安备52230102000497号" #label:footerPoliceUrl="promoted,alias=公安备案链接,single,text" #footerPoliceUrl="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=52230102000497" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png" #label:siteStartDate="promoted,alias=建站日期,single,text" #siteStartDate="2026-04-10" #label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean" #label:article(inheritable)="promoted,alias=文章,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean" #label:announcement(inheritable)="promoted,alias=公告,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean" #label:category(inheritable)="promoted,alias=类别,single,boolean" #label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean" #label:iconClass(inheritable)="promoted,alias=图标,single,text" #label:dateNote(inheritable)="promoted,alias=日期覆盖,single,text" #label:shareAlias(inheritable)="promoted,alias=别名,single,text" #label:viewType(inheritable)="promoted,alias=视图类型,single,text"
> ```

### 一、关系（Relations）

> **注意**：`~relation` 类型需要**手动创建关系链接**，复制文本不会自动建立连接。在根笔记的 Relation Map 中搜索并链接到目标笔记。

```
~shareTemplate(inheritable)=home.ejs ~shareFavicon(inheritable)=favicon.ico ~shareLogo(inheritable)=logo.icon
```

### 二、根笔记专属标签（必配 · 不继承）

以下标签**只贴在根笔记上**，子笔记不继承。`#label:` 定义 PromotedAttribute 元信息，后接标签值，**全部写在一行，空格分隔**，**不加** `(inheritable)`。

```
#label:isHome="promoted,alias=博客主页,single,boolean" #isHome=true #label:homeId="promoted,alias=博客主页ID,single,text" #homeId="笔记ID" #label:blogTitle="promoted,alias=博客标题,single,text" #blogTitle="你的博客标题" #label:blogDescription="promoted,alias=博客副标题,single,text" #blogDescription="你的博客副标题" #label:appearanceDefaultTheme="promoted,alias=博客默认主题,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=PC端背景URL,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=移动端背景URL,single,text" #coverMobileImage="/bg-mobile.png" #label:twikooEnabled="promoted,alias=评论系统,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo环境ID,single,text" #twikooEnvId="你的EnvId" #label:twikooVersion="promoted,alias=Twikoo版本,single,text" #twikooVersion="1.6.41" #label:footerCopyright="promoted,alias=页脚版权,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=工信部备案号,single,text" #footerIcp="黔ICP备2026006103号-1" #label:footerPolice="promoted,alias=公安备案号,single,text" #footerPolice="贵公网安备52230102000497号" #label:footerPoliceUrl="promoted,alias=公安备案链接,single,text" #footerPoliceUrl="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=52230102000497" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png" #label:siteStartDate="promoted,alias=建站日期,single,text" #siteStartDate="2026-04-10"
```

#### 根笔记其他系统标签

```
#readOnly #shareDescription="子非鱼（https://brucevon.space/）" #iconClass="bx bxs-yin-yang"
```

### 三、子笔记标签（继承 · 可选）

以下标签定义在**根笔记**上，**加上** `(inheritable)` 使子笔记可见。全部写在一行，空格分隔。

```
#label:recommend(inheritable)="promoted,alias=推荐阅读,single,boolean" #label:article(inheritable)="promoted,alias=文章,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=动态,single,boolean" #label:announcement(inheritable)="promoted,alias=公告,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=评论,single,boolean" #label:category(inheritable)="promoted,alias=类别,single,boolean" #label:shareHiddenFromTree(inheritable)="promoted,alias=隐藏,single,boolean" #label:iconClass(inheritable)="promoted,alias=图标,single,text" #label:dateNote(inheritable)="promoted,alias=日期覆盖,single,text" #label:shareAlias(inheritable)="promoted,alias=别名,single,text" #label:viewType(inheritable)="promoted,alias=视图类型,single,text"
```

> 子笔记标签只需定义 `#label:` 元信息，无需在根笔记上设默认值。子笔记使用时自行添加标签并赋值，如 `#recommend=true`。

## 标签速查

日常使用参考，**不包含** `#label:` 属性提升语法。

### 根笔记标签

| 标签 | 说明 | 默认值 |
|------|------|--------|
| `#isHome=true` | 标记为博客主页 | `true` |
| `#homeId=xxx` | 博客主页笔记 ID | — |
| `#blogTitle=xxx` | 博客标题 | — |
| `#blogDescription=xxx` | 博客副标题 | — |
| `#appearanceDefaultTheme=xxx` | 默认主题 `dark` / `light` | `dark` |
| `#coverDefaultImage=url` | PC 端背景图 URL | `/bg-pc.png` |
| `#coverMobileImage=url` | 移动端背景图 URL | `/bg-mobile.png` |
| `#twikooEnabled=true` | 启用 Twikoo 评论 | `true` |
| `#twikooEnvId=xxx` | Twikoo 环境 ID | — |
| `#twikooVersion=x.y.z` | Twikoo CDN 版本号 | `1.6.41` |
| `#footerCopyright=xxx` | 页脚版权文字 | — |
| `#footerIcp=xxx` | 工信部备案号 | — |
| `#footerPolice=xxx` | 公安备案号 | — |
| `#footerPoliceUrl=url` | 公安备案链接 | — |
| `#footerBeianIcon=url` | 备案图标 URL | `/beian.png` |
| `#siteStartDate=YYYY-MM-DD` | 建站日期（用于计算页脚"已运行 X 天"） | — |

### 子笔记标签

| 标签 | 说明 |
|------|------|
| `#recommend=true` | 标记为推荐文章，出现在首页"推荐阅读"模块 |
| `#article=true` | 标记为文章，参与"最新发布"精选排序。首页收集所有带此标签的子笔记按创建时间排序，最新一篇展示在"推荐阅读"模块顶部 |
| `#recentUpdate=true` | 标记为最近更新，出现在"最近更新"模块 |
| `#announcement=true` | 标记为公告，出现在首页"公告"模块 |
| `#enableTwikoo=true` | 开启此笔记的评论（需根笔记 `#twikooEnabled=true`） |
| `#category=true` | 标记为分类节点，出现在分类树中 |
| `#shareHiddenFromTree=true` | 从分类树隐藏此节点（仅显式 `=true` 生效） |
| `#iconClass` | 图标 CSS class（如 `bx bx-code`） |
| `#dateNote=YYYY-MM-DD` | 覆盖排序日期。设此值后"最近更新"模块按此日期排序，而非笔记的修改时间。适合控制老文章的手动更新展示 |
| `#shareAlias` | 笔记别名/URL 别名 |
| `#viewType` | 视图类型 |

## 架构

### 配置流

```
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

### 主页检测逻辑

```
home.ejs 渲染时，从当前笔记沿父链向上遍历（最多 50 层），
找到第一个带有 #isHome=true 标签的笔记作为"主页"。
  - isHome = (当前笔记 ID === 主页笔记 ID)
  - HOME_ID = 主页笔记 ID（注入到客户端）
```

### 分类树根

分类树以主页为根构建（不再硬编码 `rNdtx5Rm6dHE`）。

### 文件结构

```
share/
├── home.ejs               # Trilium 模板——博客入口
├── css/blog.css            # 全部博客样式
├── js/blog.js              # 客户端交互逻辑
└── js/twikoo.min.js        # Twikoo 评论库（可选，也可用 CDN）
```

> 所有 CSS/JS 资源文件导入 Trilium 后需要用 `#shareAlias` + `#shareRaw` + 开启分享来提供访问。nginx 隐藏 `/share/` 后路径为 `/blog.css`、`/blog.js` 等根路径，无需前缀。
