# 智教云 - K12智能教学资源生成平台

AI驱动的教学资源生成平台，帮助K12教师快速创建高质量的教学材料，提升备课效率。

## 功能特性

### AI资源生成
- **课件生成** - 输入主题和要求，自动生成完整的PPT课件内容
- **试卷生成** - 选择题型、难度和知识点范围，智能生成科学合理的试卷
- **教学设计** - 支持普通教学设计和大单元教学设计
- **逐字稿生成** - 为课程内容生成详细的课堂教学逐字稿
- **说课稿生成** - 生成包含教材分析、学情分析、教学方法等完整的说课稿
- **作业设计** - 智能生成分层作业，满足不同学生需求
- **试题设计** - 专业的试题设计与详细解析
- **学生评语** - 批量生成个性化学生评语，支持期末评语、作业评价等

### Canvas可视化编辑器
生成的教学设计等内容支持在Canvas可视化编辑器中进行结构化编辑：
- **块级编辑** - 将Markdown内容解析为可独立编辑的内容块（标题、段落、列表等）
- **拖拽排序** - 通过拖拽调整内容块顺序，重组文档结构
- **实时预览** - 编辑与预览双栏对照，所见即所得
- **新增/删除块** - 灵活增减内容区块
- **一键保存** - 编辑结果自动序列化为Markdown并同步保存

### 知识库管理
- 上传PDF教材和教辅资料作为AI生成的参考素材
- 文件管理（预览、删除）
- 集成AWS S3存储

### 模板库
- 公共模板库浏览
- 用户自定义模板上传与管理
- 模板一键应用到生成流程

### 导出功能
- 导出为Word (.docx) 格式
- 导出为PPT (.pptx) 格式
- 导出为PDF格式

## 技术栈

### 前端
- **React 19** + TypeScript
- **Vite** 构建工具
- **Tailwind CSS** + Radix UI 组件库
- **tRPC** 端到端类型安全API
- **React Query** 数据获取与缓存
- **Wouter** 轻量路由
- **Framer Motion** 动画
- **Streamdown** Markdown渲染

### 后端
- **Node.js** + Express
- **tRPC** 服务端
- **Drizzle ORM** + MySQL
- **S3 兼容对象存储**（AWS S3 / Cloudflare R2 / MinIO）
- **Gemini 2.5 Flash**（支持可配置 Base URL 的 OpenAI-Compatible 接口）

## 项目结构

```
├── client/                # React前端
│   └── src/
│       ├── components/    # 通用组件（UI组件、布局组件、Canvas编辑器）
│       ├── pages/         # 页面组件
│       ├── hooks/         # 自定义Hooks
│       ├── contexts/      # React上下文
│       └── lib/           # 工具函数、tRPC客户端
├── server/                # Node.js后端
│   ├── _core/             # Express中间件、LLM集成、认证
│   ├── routers.ts         # tRPC路由定义
│   └── db.ts              # 数据库操作
├── drizzle/               # 数据库Schema与迁移
├── shared/                # 前后端共享类型与常量
└── package.json
```

## 快速开始

### 环境要求
- Node.js 18+
- pnpm 10+
- MySQL数据库

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

创建 `.env` 文件并配置以下变量：

```env
# 基础
DATABASE_URL=mysql://user:password@localhost:3306/k12_platform
JWT_SECRET=replace-with-a-strong-secret

# LLM
GEMINI_API_KEY=your_gemini_api_key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

# S3 兼容存储
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=auto
S3_ENDPOINT=https://your-s3-endpoint   # MinIO/R2 场景必填
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=

# 认证
AUTH_PROVIDERS=local,github
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com
```

### 数据库迁移

```bash
pnpm db:push
```

### 启动开发服务器

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
pnpm start
```

## 脚本命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务器 |
| `pnpm check` | TypeScript类型检查 |
| `pnpm format` | 代码格式化 |
| `pnpm test` | 运行测试 |
| `pnpm db:push` | 数据库Schema迁移 |

## 许可证

MIT

## Docker 部署（推荐）

```bash
docker compose up -d --build
```

服务说明：
- `app`: 主应用（3000）
- `mysql`: MySQL 数据库（3306）
- `minio`: S3 兼容对象存储（9000，控制台 9001）

首次启动后请执行数据库迁移：

```bash
pnpm db:push
```
