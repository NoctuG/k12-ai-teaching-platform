# K12 智能教学资源平台：关键能力缺口分析与改造建议

本文基于当前代码实现，聚焦以下五个能力缺口：RAG 真实性、上传稳定性、长任务可靠性、多模态闭环、可视化编辑闭环。

## 1) 知识库并未真正参与 RAG

### 现状
- 生成接口仅根据 `knowledgeFileIds` 读取数据库中的文件记录，并把 `fileName` 拼接到 prompt：`参考资料: xxx.pdf`。
- 没有任何文本提取、切分、向量化、检索步骤。

### 风险
- 大模型无法读取教材正文，导致“看起来接入了知识库，实则未生效”。
- 教师上传同名或名称相近文件时，提示词区分度低。

### 建议
- 新增 ingestion pipeline：
  1. 文件落盘/S3 后触发解析（PDF/Word/TXT）
  2. 文本清洗与 chunking（如 500~1000 tokens）
  3. Embedding 入库（pgvector / Milvus / Weaviate）
- 在 `generation.generate` 中引入 top-k 检索，将命中片段（含出处）拼入 user/system prompt。
- 为每次生成保留检索快照（chunk id + score + snippet）便于可追溯。

## 2) 上传路径存在内存放大风险

### 现状
- 前端 `FileReader.readAsDataURL` 把文件读成 base64 字符串后上送。
- 后端 `Buffer.from(input.fileContent, 'base64')` 再解码为 Buffer，最终上传对象存储。

### 风险
- base64 天然膨胀（约 33%），且前后端都持有大对象，容易触发 V8 heap 压力。
- 随并发上升，GC 抖动与 OOM 风险显著。

### 建议
- 改为两段式上传：
  1. 后端签发预签名 URL（限制 content-type/size/key）
  2. 前端直传 S3/MinIO（multipart + progress）
- 上传完成后仅提交 `fileKey + metadata` 给后端落库。
- 为服务端增加文件大小硬限制与 MIME 白名单兜底。

## 3) 长耗时任务缺少队列与恢复能力

### 现状
- 批量评语在请求内创建后，使用自执行异步闭包后台处理。
- 导出功能使用 `execSync` 调用 Python/LibreOffice，同步阻塞 Node 主线程。

### 风险
- 进程重启即丢任务，无法重试、无法可观测。
- CPU 密集导出会阻塞事件循环，影响全站 RT。

### 建议
- 引入 BullMQ（Redis）：
  - Queue: `comment-generation`, `document-export`
  - Worker 独立进程消费，支持重试/退避/死信队列
  - Job 状态回写 DB（queued/running/completed/failed）
- 导出改为异步：提交任务 -> 轮询/订阅状态 -> 完成后返回下载链接。

## 4) 多模态接口存在但前端入口缺失

### 现状
- 后端已注册 `imageGen.generate` 与 `voice.transcribe` 路由。
- 生成页仅有文本输入和知识库选择，无图片生成、语音转写交互。

### 风险
- 能力“后端可用、前端不可达”，无法转化为教学场景价值。

### 建议
- 在 `Generate` 页增加：
  - “生成配图”抽屉：输入图像提示词，回填 Markdown 图片链接
  - “语音输入”按钮：录音后调用转写，自动填入 prompt
- 针对资源类型提供模板化触发（如互动游戏默认插图需求）。

## 5) 生成与 Canvas 编辑链路尚未闭环

### 现状
- 生成页右侧结果仅 `Streamdown` 渲染，缺少“立即进入编辑器”的主入口。
- 虽然历史页已有进入编辑器能力，但生成完成后的即时编辑路径不顺。

### 风险
- 用户从“生成->调整->导出”的工作流需要跨页面跳转，摩擦成本高。

### 建议
- 在生成成功回调中保留 `historyId`，提供“一键进入 Canvas 编辑器”。
- 增加“保存为草稿块”动作，把 Markdown 解析为块结构后直接打开编辑器。
- 编辑器内提供“回溯原始生成稿”和“重新生成局部块”。

## 建议的分期落地

### Phase 1（1~2 周）
- 预签名直传 + 上传元数据落库
- BullMQ 基础设施搭建，先迁移“批量评语”任务
- 生成页增加“进入 Canvas 编辑器”按钮

### Phase 2（2~4 周）
- 文档解析与 chunking 服务
- 向量检索与生成接口集成（RAG MVP）
- 导出链路迁移至队列 Worker

### Phase 3（持续）
- 多模态前端闭环（配图、语音输入）
- 检索质量评估、提示词/重排策略优化
- 任务监控看板与告警（失败率、耗时、重试次数）
