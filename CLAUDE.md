# 日语学习助手 — 开发文档

## 网站
- 文件：`japanese-learning-hub.html`（单一 HTML，React 18 + Tailwind + marked.js，CDN 加载）
- 线上：`https://japaneseclass-8006f.web.app`
- 部署：push 到 `main` → GitHub Actions 自动部署（约1分钟）
- Repo：`huanjue012/japanese-notion-tool`

## 技术栈
- React 18 + Tailwind CSS + marked.js（Markdown 渲染）+ pdf.js
- Firebase Auth（Google 登录）、Firestore（数据）、Storage（图片）
- localStorage 作为 Firestore 本地镜像

## Firestore 数据结构
```
users/{uid}/
  notes/        — 知识库笔记 {title, content, tags, images, createdAt, updatedAt}
  flashcards/   — 闪卡 {front, back, tags, nextReview, createdAt}
  homework/     — 功课 {title, lessonNumber, dueDate, submittedDate, status, teacherFeedback, notes}
  feedback/     — 功能反馈 {title, description, status}
```

## JSON 导入格式（PDF 导入模块用）
```json
{
  "notes": [{"title": "", "content": "", "tags": []}],
  "flashcards": [{"front": "", "back": "", "tags": []}]
}
```

## 模块
- **总览** Dashboard：统计、逾期警示、复习提醒
- **知识库**：笔记，Markdown 渲染（marked.js），支持图片上传，标签/搜索筛选
- **闪卡**：SRS 复习（1/3/7/14 天），标签筛选
- **功课**：4 状态流转（pending→submitted→graded→organized），逾期高亮
- **PDF 导入**：「打开 Claude AI」按钮 → 直接跳转「日语课」project；JSON 导入标签页
- **反馈板**：Kanban（backlog/pending/in-progress/done），支持导出/导入 JSON

## 注意
- 每个模块标题栏有「🗑 全部删除」红色按钮（有数据时显示），需二次确认
- `system-prompt.md` = Claude mobile app「日语课」project 的 system prompt，勿混淆
- 如果反馈板有多条待处理的功能需求，必须同时启动多个 agent 并行处理，不要逐一顺序执行
- 每当只修改知识库或闪卡其中一个模块时，如果该功能可以放进另一个模块，必须问用户要不要同步过去
