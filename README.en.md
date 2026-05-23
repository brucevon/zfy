# zfy — TriliumNext Blog Theme

<p align="center">
  <a href="README.md">🇨🇳 中文</a> &nbsp;|&nbsp; <a href="README.en.md">🇺🇸 English</a>
</p>

> ℹ️ This document is AI-generated as an English reference. The [Chinese version](README.md) is the authoritative documentation.

## 🎯 Preface

If you use TriliumNext for knowledge management, you've probably considered turning it into a blog — but the default shared pages are too basic, and you don't want the hassle of maintaining two separate systems (Hexo/WordPress).

**zfy** was built for exactly this: a TriliumNext blog theme based on a **server-side preprocessing + EJS output** architecture. **All content is pre-generated as JSON data on the server; `home.ejs` only reads static data**, making page loads instantaneous.

🖼️ Example blog → [brucevon.space](https://brucevon.space)

---

## 📑 Table of Contents

- [✨ Design Highlights](#-design-highlights)
- [🖼️ Preview](#-preview)
- [🗺️ Architecture Overview](#-architecture-overview)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Preprocessing Scripts](#%EF%B8%8F-preprocessing-scripts)
- [🌐 nginx Configuration](#-nginx-configuration)
- [❓ FAQ](#-faq)
- [📋 PromotedAttributes Reference](#-promotedattributes-reference)
- [🏷️ Tag Quick Reference](#-tag-quick-reference)
- [📁 File Structure](#-file-structure)
- [💭 Closing Thoughts](#-closing-thoughts)

---

## ✨ Design Highlights

| | |
|---|---|
| 🧩 **Bento Layout** | Grid-based card layout — 4 small + 1 wide in 2 rows, ditching the traditional long list |
| 🏷️ **Tag-Driven** | 20+ tags covering theme, comments, footer, cover, and more — zero hardcoded values |
| 🌓 **Dark/Light Themes** | CSS variables + `data-theme` toggle, one-click switch |
| 📱 **Responsive** | 768px breakpoint adapts to mobile with single-column layout |
| 💬 **Twikoo Comments** | CDN-loaded, purely tag-configured, theme auto-follows |
| 🔍 **Full-Text Search** | Server-side pre-built index, real-time client-side search with keyword highlighting |
| 🔥 **Heatmap** | Yearly article heat distribution map |
| 🖼️ **Lightbox** | Click-to-enlarge images, adaptive prev/next button visibility |
| ⚡ **High Performance** | Fully static output + SQL batch preprocessing, `home.ejs` does near-zero computation |

---

## 🖼️ Preview

> Live demo: [brucevon.space](https://brucevon.space)

---

## 🗺️ Architecture Overview

### Configuration Flow

```text
Root Note (note with #isHome=true)
  │
  │  home.ejs reads labels → _cfg object
  │
  ├─→ Server-side: theme, cover, category root, About lookup
  │
  └─→ window.__BLOG_CONFIG__ injected into page
       │
       └─→ blog.js reads: HOME_ID, default theme
```

### Preprocessing Flow

```text
BlogPreprocessRender.js (Orchestrator)
  ├─ tree.js          ─→ Category tree JSON
  ├─ about-tree.js    ─→ About menu tree JSON
  ├─ stats.js         ─→ Statistics JSON
  ├─ recentUpdate.js  ─→ Recent updates JSON
  ├─ recommend.js     ─→ Recommended articles JSON (with content truncation)
  ├─ article.js       ─→ Latest articles JSON (with content truncation)
  ├─ announcement.js  ─→ Announcements JSON (with content truncation)
  ├─ search.js        ─→ Search index JSON (all notes)
  └─ heatmap.js       ─→ Heatmap calendar JSON
        │
        └─→ Written to intermediate notes (#shareRaw + #shareAlias=blog-*)
               │
               └─→ Read by home.ejs / frontend JS
```

> 💡 Understanding this overall flow before diving into the steps will give you better context.

---

## 🚀 Quick Start

> 💡 **Prerequisite**: In Trilium, "enabling sharing" means right-click the note → **Share** → the note URL becomes publicly accessible. All notes marked "enable sharing" in the steps below require this action.

### 1️⃣ Download Resource Files

Download the following 3 files from the `share/` directory of this repo:

```text
share/home.ejs        # Blog template (main entry)
share/css/blog.css    # All blog styles
share/js/blog.js      # Client-side interaction script
```

> Twikoo is loaded via CDN — **no need to upload `twikoo.min.js`**.

### 2️⃣ Import into Trilium (Templates & Styles)

First, ensure you have a `分享` (Shared) parent note in Trilium (created automatically when you first share a note, or you can create it manually). Create 3 **file notes** under or alongside it, each **enabled for sharing**:

| File | Required Labels |
|------|----------------|
| `home.ejs` | `~shareTemplate(inheritable)=home.ejs` (This is a **Relation** — must be linked via Relation Map on the root note) |
| `blog.css` | `#shareAlias=blog.css` `#shareRaw` |
| `blog.js` | `#shareAlias=blog.js` `#shareRaw` |

> Static assets are served at `/blog.css`, `/blog.js`, assuming nginx hides the `/share/` prefix. Adjust if not hidden (see nginx config below).

### 3️⃣ Create Image Assets

The blog needs 5 images. Create **image notes** (Upload file) in Trilium, each **enabled for sharing**:

| Image | Description |
|-------|-------------|
| `favicon.ico` | Browser tab icon |
| `logo.icon` | Top bar avatar |
| `bg-pc.png` | Desktop blog background |
| `bg-mobile.png` | Mobile blog background |
| `beian.png` | Footer ICP icon (optional) |

> Shared image URLs are at `/share/[noteId]`. With nginx prefix-hiding, they become `/favicon.ico` etc. You can also customize paths via root note labels.

### 4️⃣ Create Shared Data Notes

The preprocessing scripts write data to dedicated JSON notes, which need to be created in advance. Create a note (e.g., `home-data`) under the `分享` parent, **enable sharing**. Below it, create 9 `json`-type child notes with the following label configuration:

| Child Note | Required Labels |
|------------|-----------------|
| `blog-tree` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-tree` |
| `blog-about-tree` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-about-tree` |
| `blog-recommend` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-recommend` |
| `blog-article` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-article` |
| `blog-recentUpdate` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-recentUpdate` |
| `blog-announcement` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-announcement` |
| `blog-stats` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-stats` |
| `blog-heatmap` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-heatmap` |
| `blog-search` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-search` |
| `blog-tag` | `#shareHiddenFromTree` `#shareRaw` `#shareAlias=blog-tag` |

> 💡 Each note's noteId (right-click → Copy ID) will be used when configuring script labels. Collect them in advance and add to each script's `#saveNoteId` label.

### 5️⃣ Configure Root Note

Create a **root note** (e.g., `我的博客`), **enable sharing**. Add PromotedAttributes (see below) to the root note, ensuring these key labels are set:

- `#isHome=true` — Declares this note as the blog homepage
- `#homeId=<currentNoteId>` — The root note's own noteId (right-click → Copy ID)
- `#blogTitle=xxx`, `#blogDescription=xxx` — Blog title and subtitle
- `~shareTemplate(inheritable)=home.ejs` — **Relation**: search for the `home.ejs` note in Relation Map and link it
- `~shareFavicon(inheritable)=favicon.ico` — Link to favicon image note
- `~shareLogo(inheritable)=logo.icon` — Link to logo image note

> ⚠️ Labels starting with `~` are **Relations**, not regular labels. You must manually search and link to the target note in the root note's **Relation Map** — simply pasting text won't establish the connection.

### 6️⃣ Create the "About" Note

If using the "About" menu (generated by about-tree.js), create a note titled **「关于」** (or "About") under the root note, can contain child notes with the `#category=true` label. about-tree.js searches for this note under the root note to build the menu tree.

> 💡 If you don't need the About menu yet, create an empty note titled "关于" to prevent errors from about-tree.js.

### 7️⃣ Publish Articles

Create child notes under the root note as needed. Add labels to control display placement:

| Label | Display Location |
|-------|-----------------|
| `#recommend=true` | "Recommended" module on homepage |
| `#article=true` | "Latest Posts" sorting |
| `#category=true` | Category tree node |
| `#recentUpdate=true` | "Updates" module on homepage |
| `#announcement=true` | Announcement area on homepage |

### 8️⃣ Import Preprocessing Scripts (Recommended)

Import script files from the `博客预处理控件/` directory:

- **`BlogPreprocessRender.js`** → Import as **JS Frontend** note (rendering panel)
- Remaining 9 scripts (`tree.js`, `about-tree.js`, etc.) → Import as **Backend Script** notes

After importing, configure the orchestrator as described in [⚙️ Preprocessing Scripts](#%EF%B8%8F-preprocessing-scripts). After running once, homepage data is pre-generated.

> Note: The 10 scripts have **different types** — don't import them all as the same type. `BlogPreprocessRender.js` must be **JS Frontend** to render the panel properly. **`~renderNote` is also a Relation** — must be linked via Relation Map.

---

## ⚙️ Preprocessing Scripts (Core Architecture)

Homepage data isn't queried in real-time by EJS — instead, **backend preprocessing scripts** generate JSON data at runtime, writing it to dedicated shared notes. `home.ejs` and the frontend JS only read static data.

### Data Flow

```
Preprocessing Scripts (batch SQL + SUBSTR truncation)
    ↓ api.note.setContent()
Dedicated Shared JSON Notes (#shareRaw + #shareAlias)
    ↓
home.ejs / Frontend JS (static fetch)
```

### Orchestrator Setup

1. Import `BlogPreprocessRender.js` as a **JS Frontend** note
2. Open this note in Trilium, set its **Render Note** Relation to the root note
3. Add labels to `BlogPreprocessRender.js`:

| Label | Purpose |
|-------|---------|
| `~renderNote(inheritable)=<rootNoteId>` | Relation → link to root note |
| `~renderAggregator(inheritable)=<noteId>` | Relation → link to this script note itself (triggers sub-scripts) |

4. Add labels to each child script note (tree.js, stats.js, etc.):

| Label | Purpose |
|-------|---------|
| `#rootNoteId=<id>` | Root note ID (for category tree, article search, etc.) |
| `#saveNoteId=<id>` | Target JSON note ID (where this script writes its output) |
| `#contentLen=<number>` | _(Optional)_ Max content length. Default: 150 (cards), 500 (search) |

> 💡 You collected noteIds in Step 4 — use them now for `#saveNoteId`.

### Script List

| Script | Type | Produces | Content Truncation |
|--------|------|----------|-------------------|
| tree.js | Backend | Category tree JSON | — |
| about-tree.js | Backend | About menu tree JSON | — |
| stats.js | Backend | Statistics JSON | — |
| recentUpdate.js | Backend | Recent updates JSON | — |
| recommend.js | Backend | Recommended articles JSON | ✅ `#contentLen` |
| article.js | Backend | Latest articles JSON | ✅ `#contentLen` |
| announcement.js | Backend | Announcements JSON | ✅ `#contentLen` |
| search.js | Backend | Search index JSON | ✅ `#contentLen` |
| heatmap.js | Backend | Heatmap JSON | — |
| tags.js | Backend | Tag cloud JSON (tag→article mapping) | — |

> 💡 For first-time setup, run scripts **one by one** in Trilium's script editor to verify each works before configuring the orchestrator to run them all.

### Running Scripts Standalone (without Orchestrator)

If you don't want to use the orchestrator, run each backend script directly in Trilium's script editor. The scripts will auto-detect standalone mode and read labels from the note they're attached to.

---

## 🌐 nginx Configuration

<details>
<summary>Click to expand production nginx config</summary>

```nginx
upstream trilium {
    server 127.0.0.1:8080;
    keepalive 64;
}

proxy_cache_path /var/cache/nginx/trilium levels=1:2 keys_zone=trilium_cache:10m max_size=1g inactive=60m use_temp_path=off;

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;
    gzip_min_length 256;
    gzip_comp_level 5;
    gzip_vary on;
    gzip_proxied any;

    # Block backend access
    location ~* /(login|setup|admin|ws|custom|inside) {
        return 404;
    }

    # Proxy /share/assets/ → backend (preserved)
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

    # 🔙 Core reverse proxy: hide /share/ prefix
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

        # Optimized all-memory buffers for preprocessing large JSON
        proxy_buffer_size          512k;
        proxy_buffers            4 512k;
        proxy_busy_buffers_size   1024k;
        proxy_max_temp_file_size      0;
    }
}
```

> Key strategy: `location /` → `proxy_pass http://trilium/share/` automatically hides the `/share/` prefix. All static resources, JSON data, and pages share the same route — no need for individual regex matches. Security blocks only target backend paths like `/login|setup|admin|ws|custom|inside`, without interfering with `/api/attachments/` and similar image resources.

</details>

---

## ❓ FAQ

### Blank page or errors

- Check if the root note has **sharing enabled** (right-click → Share)
- Verify the `~shareTemplate` Relation for `home.ejs` is correctly linked
- Verify all resource notes (css/js/images) have **sharing enabled**

### Category tree / About menu not showing

- Confirm `#rootNoteId` points to the correct blog root note ID
- Confirm a note titled **「关于」** exists under the root note (for about-tree.js)
- Confirm `#category=true` is added to notes that should appear in the category tree

### Search returns no results

- Ensure search.js has run successfully and written to the blog-search note
- Check `#rootNoteId` points to the correct root note containing all articles

### Broken styles

- Clear browser cache (hard refresh with `Ctrl+F5`)
- Confirm `blog.css` and `blog.js` sharing status is correct
- Check nginx static resource path mapping

### Script error "content.trim is not a function"

- If using an older version, update to the latest scripts. This was fixed in commit `39afe5f` (blob content Buffer→String conversion).

---

## 📋 PromotedAttributes Reference

Define the blog's label system on the **root note** in Trilium's PromotedAttributes. The complete definitions are listed in 4 categories below.

> ⚠️ **Note**: `~relation` types require **manually creating relation links** — copying text won't establish the connection. Search and link to target notes in the root note's Relation Map.
>
> All `#label:` + label values **must be on a single line, space-separated** — broken into categories below for readability, but merge them into one line when pasting.

### 1. Relations

```text
~shareTemplate(inheritable)=home.ejs  ~shareFavicon(inheritable)=favicon.ico  ~shareLogo(inheritable)=logo.icon
```

### 2. Root Note Labels (non-inheritable)

```text
#label:isHome="promoted,alias=Blog Homepage,single,boolean"            #isHome=true
#label:homeId="promoted,alias=Homepage ID,single,text"                 #homeId="noteId"
#label:blogTitle="promoted,alias=Blog Title,single,text"               #blogTitle="My Blog"
#label:blogDescription="promoted,alias=Blog Subtitle,single,text"      #blogDescription="Sharing thoughts"
#label:appearanceDefaultTheme="promoted,alias=Default Theme,single,text"  #appearanceDefaultTheme="dark"
#label:coverDefaultImage="promoted,alias=Desktop BG URL,single,text"   #coverDefaultImage="/bg-pc.png"
#label:coverMobileImage="promoted,alias=Mobile BG URL,single,text"     #coverMobileImage="/bg-mobile.png"
#label:twikooEnabled="promoted,alias=Comments,single,boolean"          #twikooEnabled=true
#label:twikooEnvId="promoted,alias=Twikoo Env ID,single,text"         #twikooEnvId="your-env-id"
#label:twikooVersion="promoted,alias=Twikoo Version,single,text"      #twikooVersion="1.6.41"
#label:footerCopyright="promoted,alias=Footer Copyright,single,text"   #footerCopyright="© 2026 YourName"
#label:footerIcp="promoted,alias=ICP备案号,single,text"                #footerIcp="your-icp-number"
#label:footerPolice="promoted,alias=Police备案号,single,text"          #footerPolice="your-police-number"
#label:footerPoliceUrl="promoted,alias=Police备案URL,single,text"      #footerPoliceUrl="your-police-url"
#label:footerBeianIcon="promoted,alias=备案图标URL,single,text"        #footerBeianIcon="/beian.png"
#label:siteStartDate="promoted,alias=Site Start Date,single,text"      #siteStartDate="2026-04-10"
```

#### Root Note System Labels

```text
#readOnly  #shareDescription="My Blog Description"  #iconClass="bx bxs-yin-yang"
```

### 3. Child Note Labels (inheritable · optional)

Define these on the **root note** with `(inheritable)` so they're visible to child notes:

```text
#label:recommend(inheritable)="promoted,alias=Recommended,single,boolean"
#label:article(inheritable)="promoted,alias=Article,single,boolean"
#label:recentUpdate(inheritable)="promoted,alias=Updates,single,boolean"
#label:announcement(inheritable)="promoted,alias=Announcement,single,boolean"
#label:enableTwikoo(inheritable)="promoted,alias=Comments,single,boolean"
#label:category(inheritable)="promoted,alias=Category,single,boolean"
#label:shareHiddenFromTree(inheritable)="promoted,alias=Hidden from Tree,single,boolean"
#label:iconClass(inheritable)="promoted,alias=Icon,single,text"
#label:dateNote(inheritable)="promoted,alias=Date Override,single,text"
#label:shareAlias(inheritable)="promoted,alias=Alias,single,text"
```

> Child note labels only need the `#label:` meta definition — no default values on the root note. Children use them by adding and assigning values, e.g., `#recommend=true`.

### 4. One-Click Copy (all of the above)

> 💡 **Usage**: Split into 5 groups below for readability. **Merge all 5 groups into 1 line (space-separated)** when pasting into the root note's label field.

```text
#label:isHome="promoted,alias=Blog Homepage,single,boolean" #isHome=true #label:homeId="promoted,alias=Homepage ID,single,text" #homeId="noteId" #label:blogTitle="promoted,alias=Blog Title,single,text" #blogTitle="My Blog" #label:blogDescription="promoted,alias=Blog Subtitle,single,text" #blogDescription="Sharing thoughts"

#label:appearanceDefaultTheme="promoted,alias=Default Theme,single,text" #appearanceDefaultTheme="dark" #label:coverDefaultImage="promoted,alias=Desktop BG URL,single,text" #coverDefaultImage="/bg-pc.png" #label:coverMobileImage="promoted,alias=Mobile BG URL,single,text" #coverMobileImage="/bg-mobile.png"

#label:twikooEnabled="promoted,alias=Comments,single,boolean" #twikooEnabled=true #label:twikooEnvId="promoted,alias=Twikoo Env ID,single,text" #twikooEnvId="your-env-id" #label:twikooVersion="promoted,alias=Twikoo Version,single,text" #twikooVersion="1.6.41"

#label:footerCopyright="promoted,alias=Footer Copyright,single,text" #footerCopyright="© 2026 YourName" #label:footerIcp="promoted,alias=ICP Number,single,text" #footerIcp="your-icp-number" #label:footerPolice="promoted,alias=Police Number,single,text" #footerPolice="your-police-number" #label:footerPoliceUrl="promoted,alias=Police URL,single,text" #footerPoliceUrl="your-police-url" #label:footerBeianIcon="promoted,alias=备案图标URL,single,text" #footerBeianIcon="/beian.png" #label:siteStartDate="promoted,alias=Site Start Date,single,text" #siteStartDate="2026-04-10"

#label:recommend(inheritable)="promoted,alias=Recommended,single,boolean" #label:article(inheritable)="promoted,alias=Article,single,boolean" #label:recentUpdate(inheritable)="promoted,alias=Updates,single,boolean" #label:announcement(inheritable)="promoted,alias=Announcement,single,boolean" #label:enableTwikoo(inheritable)="promoted,alias=Comments,single,boolean" #label:category(inheritable)="promoted,alias=Category,single,boolean" #label:shareHiddenFromTree(inheritable)="promoted,alias=Hidden from Tree,single,boolean" #label:iconClass(inheritable)="promoted,alias=Icon,single,text" #label:dateNote(inheritable)="promoted,alias=Date Override,single,text" #label:shareAlias(inheritable)="promoted,alias=Alias,single,text"
```

---

## 🏷️ Tag Quick Reference

Everyday reference (without `#label:` PromotedAttributes syntax).

### Root Note Tags

| Tag | Description | Default |
|-----|-------------|---------|
| `#isHome=true` | Mark as blog homepage | `true` |
| `#homeId=xxx` | Blog homepage note ID | — |
| `#blogTitle=xxx` | Blog title | — |
| `#blogDescription=xxx` | Blog subtitle | — |
| `#appearanceDefaultTheme=xxx` | Default theme `dark`/`light` | `dark` |
| `#coverDefaultImage=url` | Desktop background | `/bg-pc.png` |
| `#coverMobileImage=url` | Mobile background | `/bg-mobile.png` |
| `#twikooEnabled=true` | Enable Twikoo comments | `true` |
| `#twikooEnvId=xxx` | Twikoo environment ID | — |
| `#twikooVersion=x.y.z` | Twikoo CDN version | `1.6.41` |
| `#footerCopyright=xxx` | Footer copyright text | — |
| `#footerIcp=xxx` | ICP filing number | — |
| `#footerPolice=xxx` | Police filing number | — |
| `#footerPoliceUrl=url` | Police filing URL | — |
| `#footerBeianIcon=url` | ICP icon path | `/beian.png` |
| `#siteStartDate=YYYY-MM-DD` | Site start date (footer "Running X days") | — |

### Child Note Tags

| Tag | Description |
|-----|-------------|
| `#recommend=true` | Mark as recommended, appears in "Recommended" module |
| `#article=true` | Mark as article, participates in "Latest Posts" sorting |
| `#recentUpdate=true` | Mark as recent update, appears in "Updates" module |
| `#announcement=true` | Mark as announcement, appears in announcement area |
| `#enableTwikoo=true` | Enable comments on this note |
| `#category=true` | Mark as category node, appears in category tree |
| `#shareHiddenFromTree=true` | Hide from category tree |
| `#iconClass` | Icon CSS class (e.g., `bx bx-code`) |
| `#shareExternalLink` | External link — note redirects to this label's value as URL |
| `#dateNote=YYYY-MM-DD` | Override sort date |
| `#blogDescription` | Override page subtitle for this note (falls back to root note's) |
| `#color` | Note title color; also used by category menu recent update titles |
| `#shareAlias` | Note URL alias |

---

## 🏗️ Architecture

> See [Architecture Overview](#-architecture-overview) for configuration flow and preprocessing flow diagrams.

### Homepage Detection

At render time, the template traverses the parent chain (max 50 levels) from the current note to find the first note with `#isHome=true`. **No hardcoded noteIds.**

### Category Tree

Built with the root note as root. `#category=true` marks category nodes, `#shareHiddenFromTree=true` controls visibility.

---

## 📁 File Structure

```text
share/
├── home.ejs          # Trilium EJS template — blog entry point
├── css/blog.css      # All blog styles
└── js/blog.js        # Client-side interaction script

博客预处理控件/          # Backend preprocessing scripts (10 total)
├── BlogPreprocessRender.js  # Orchestrator entry
├── tree.js                  # Category tree
├── about-tree.js            # About menu tree
├── stats.js                 # Statistics
├── recentUpdate.js          # Recent updates
├── recommend.js             # Recommended articles
├── article.js               # Latest articles
├── announcement.js          # Announcements
├── search.js                # Search index
├── tags.js                  # Tag cloud data
└── heatmap.js               # Heatmap calendar
```

---

## 💭 Closing Thoughts

zfy is a personal project, evolving through use. If you're on TriliumNext, feel free to adapt it.

- Example blog: [brucevon.space](https://brucevon.space)
- GitHub: [zfy](https://github.com/brucevon/zfy)

Feedback and discussion:

- 💬 Blog comments: [brucevon.space/lIQxHnOklH2m](https://brucevon.space/lIQxHnOklH2m)
- 🐙 GitHub Issues: [github.com/brucevon/zfy/issues](https://github.com/brucevon/zfy/issues)

⭐ Stars are always appreciated.

---

> 📝 This English documentation is AI-generated, translated from the [Chinese version](README.md). The Chinese version is the authoritative reference.
