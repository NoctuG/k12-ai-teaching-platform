import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, Clock, Download, RefreshCcw } from "lucide-react";
import { Streamdown } from "streamdown";

type AdvancedParameters = {
  teachingModel?: "5E" | "BOPPPS";
  bloomLevel?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  difficulty?: "基础" | "中等" | "挑战";
  lessonHours?: string;
  classSize?: string;
};

type MindMapNode = {
  id: string;
  label: string;
  level?: number;
};

type MindMapEdge = {
  source: string;
  target: string;
  relation?: string;
};

type MindMapPayload = {
  type: "mind_map";
  title?: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
};

type InteractiveGamePayload = {
  type: "interactive_game";
  title?: string;
  flow?: string[];
  rules?: string[];
  materials?: string[];
  scoring?: string[];
};

const resourceTypeGroups = [
  {
    label: "教学基础",
    items: [
      { value: "courseware", label: "课件（PPT）" },
      { value: "exam", label: "试卷" },
      { value: "lesson_plan", label: "教学设计" },
      { value: "lesson_plan_unit", label: "大单元教学设计" },
      { value: "transcript", label: "逐字稿" },
      { value: "lecture_script", label: "说课稿" },
      { value: "homework", label: "作业设计" },
      { value: "question_design", label: "试题设计" },
    ],
  },
  {
    label: "教学评估",
    items: [
      { value: "grading_rubric", label: "批改辅助/评分标准" },
      { value: "learning_report", label: "学情分析报告" },
    ],
  },
  {
    label: "课堂互动",
    items: [
      { value: "interactive_game", label: "互动游戏设计" },
      { value: "discussion_chain", label: "讨论话题/问题链" },
      { value: "mind_map", label: "思维导图" },
    ],
  },
  {
    label: "家校沟通",
    items: [
      { value: "parent_letter", label: "家长通知/家长信" },
      { value: "parent_meeting_speech", label: "家长会发言稿" },
    ],
  },
  {
    label: "跨学科/特殊场景",
    items: [
      { value: "pbl_project", label: "项目式学习(PBL)方案" },
      { value: "school_curriculum", label: "校本课程开发" },
      { value: "competition_questions", label: "竞赛培训题库" },
    ],
  },
  {
    label: "教学深度",
    items: [
      { value: "pacing_guide", label: "学期教学进度表" },
      { value: "differentiated_reading", label: "分层阅读材料改写" },
    ],
  },
];

export default function Generate() {
  const [resourceType, setResourceType] = useState<string>("courseware");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [alignCurriculumStandards, setAlignCurriculumStandards] = useState(false);
  const [advancedParameters, setAdvancedParameters] = useState<AdvancedParameters>({
    teachingModel: "5E",
    bloomLevel: "understand",
    difficulty: "中等",
  });

  const { data: knowledgeFiles } = trpc.knowledge.list.useQuery();
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  const [lastHistoryId, setLastHistoryId] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [lastExportPayload, setLastExportPayload] = useState<{ generationHistoryId: number; format: "pptx" | "docx" | "pdf" } | null>(null);

  const exportMutation = trpc.generation.export.useMutation({
    onSuccess: (data) => {
      setExportProgress(100);
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    },
    onError: (error) => {
      toast.error("导出失败：" + error.message);
    },
  });

  const exporting = exportMutation.isPending;
  const exportHint = useMemo(() => {
    if (exportMutation.isError) return "导出失败，可点击重试";
    if (exportMutation.isSuccess) return "导出完成";
    if (exporting) return `导出处理中 ${exportProgress}%`;
    return "选择格式导出（PPTX / DOCX / PDF）";
  }, [exportMutation.isError, exportMutation.isSuccess, exporting, exportProgress]);

  const generateMutation = trpc.generation.generate.useMutation({
    onSuccess: (data) => {
      toast.success("生成成功！");
      setGeneratedContent(data.content);
      setLastHistoryId(data.historyId);
      setExportProgress(0);
    },
    onError: (error) => {
      toast.error("生成失败：" + error.message);
    },
  });

  const supportsAdvancedParameters = useMemo(() => {
    return ["courseware", "lesson_plan", "lesson_plan_unit", "interactive_game", "mind_map", "homework", "question_design"].includes(resourceType);
  }, [resourceType]);

  const parsedMindMap = useMemo(() => {
    if (resourceType !== "mind_map" || !generatedContent) return null;
    try {
      const data = JSON.parse(generatedContent) as MindMapPayload;
      if (data?.type !== "mind_map" || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
      if (data.nodes.length === 0) return null;
      return data;
    } catch {
      return null;
    }
  }, [resourceType, generatedContent]);

  const parsedInteractiveGame = useMemo(() => {
    if (resourceType !== "interactive_game" || !generatedContent) return null;
    try {
      const data = JSON.parse(generatedContent) as InteractiveGamePayload;
      if (data?.type !== "interactive_game") return null;
      return data;
    } catch {
      return null;
    }
  }, [resourceType, generatedContent]);

  const handleGenerate = () => {
    if (!title.trim()) {
      toast.error("请输入标题");
      return;
    }
    if (!prompt.trim()) {
      toast.error("请输入生成要求");
      return;
    }

    const compactAdvancedParameters = Object.fromEntries(
      Object.entries(advancedParameters).filter(([, value]) => value !== undefined && value !== "")
    );

    generateMutation.mutate({
      resourceType: resourceType as any,
      title,
      prompt,
      parameters: {
        ...(alignCurriculumStandards ? { alignCurriculumStandards: true } : {}),
        ...(supportsAdvancedParameters ? compactAdvancedParameters : {}),
      },
      knowledgeFileIds: selectedFiles,
    });
  };

  const startExport = (format: "pptx" | "docx" | "pdf") => {
    if (!lastHistoryId) {
      toast.error("请先生成内容");
      return;
    }
    const payload = { generationHistoryId: lastHistoryId, format };
    setLastExportPayload(payload);
    setExportProgress(8);
    const timer = setInterval(() => {
      setExportProgress((prev) => (prev >= 90 ? prev : prev + 12));
    }, 280);
    exportMutation.mutate(payload, {
      onSettled: () => clearInterval(timer),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black mb-2">AI生成</h1>
          <p className="text-muted-foreground font-light">
            选择资源类型，输入要求，让AI为您生成高质量的教学资源
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                生成配置
              </CardTitle>
              <CardDescription>填写以下信息开始生成</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="resourceType">资源类型</Label>
                <Select value={resourceType} onValueChange={setResourceType}>
                  <SelectTrigger id="resourceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceTypeGroups.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs text-muted-foreground font-semibold">{group.label}</SelectLabel>
                        {group.items.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  placeholder="例如：小学数学三年级 - 分数的认识"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">生成要求</Label>
                <Textarea
                  id="prompt"
                  placeholder="详细描述您的需求，例如：&#10;- 教学目标&#10;- 重点难点&#10;- 适用年级&#10;- 课时安排&#10;- 其他特殊要求"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
              </div>

              {/* Curriculum Standards Alignment Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alignCurriculumStandards}
                    onChange={(e) => setAlignCurriculumStandards(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">对齐课标/核心素养</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  自动标注教学环节培养的核心素养
                </span>
              </div>

              {supportsAdvancedParameters && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="font-semibold">高级参数</h3>
                    <p className="text-xs text-muted-foreground">这些参数会结构化写入 parameters，并在后端提示词中显式注入。</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>教学法模型</Label>
                      <Select
                        value={advancedParameters.teachingModel}
                        onValueChange={(value: "5E" | "BOPPPS") => setAdvancedParameters((prev) => ({ ...prev, teachingModel: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5E">5E</SelectItem>
                          <SelectItem value="BOPPPS">BOPPPS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>布鲁姆层级</Label>
                      <Select
                        value={advancedParameters.bloomLevel}
                        onValueChange={(value) => setAdvancedParameters((prev) => ({ ...prev, bloomLevel: value as AdvancedParameters["bloomLevel"] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="remember">记忆</SelectItem>
                          <SelectItem value="understand">理解</SelectItem>
                          <SelectItem value="apply">应用</SelectItem>
                          <SelectItem value="analyze">分析</SelectItem>
                          <SelectItem value="evaluate">评价</SelectItem>
                          <SelectItem value="create">创造</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>难度</Label>
                      <Select
                        value={advancedParameters.difficulty}
                        onValueChange={(value) => setAdvancedParameters((prev) => ({ ...prev, difficulty: value as AdvancedParameters["difficulty"] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="基础">基础</SelectItem>
                          <SelectItem value="中等">中等</SelectItem>
                          <SelectItem value="挑战">挑战</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>课时</Label>
                      <Input
                        placeholder="如 2"
                        value={advancedParameters.lessonHours ?? ""}
                        onChange={(e) => setAdvancedParameters((prev) => ({ ...prev, lessonHours: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>班级规模</Label>
                      <Input
                        placeholder="如 40"
                        value={advancedParameters.classSize ?? ""}
                        onChange={(e) => setAdvancedParameters((prev) => ({ ...prev, classSize: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {knowledgeFiles && knowledgeFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>参考资料（可选）</Label>
                  <p className="text-xs text-muted-foreground">选中的文件内容将通过RAG检索参与生成</p>
                  <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                    {knowledgeFiles.map((file) => (
                      <label
                        key={file.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFiles([...selectedFiles, file.id]);
                            } else {
                              setSelectedFiles(selectedFiles.filter((id) => id !== file.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm truncate flex-1">{file.fileName}</span>
                        {file.processingStatus === "completed" && file.chunkCount > 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        ) : file.processingStatus === "processing" || file.processingStatus === "pending" ? (
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-spin" />
                        ) : null}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full"
                size="lg"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    开始生成
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Content */}
          <Card>
            <CardHeader>
              <CardTitle>生成结果</CardTitle>
              <CardDescription>{exportHint}</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => startExport("pptx")}>
                  <Download className="w-4 h-4 mr-1" />PPTX
                </Button>
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => startExport("docx")}>
                  <Download className="w-4 h-4 mr-1" />DOCX
                </Button>
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => startExport("pdf")}>
                  <Download className="w-4 h-4 mr-1" />PDF
                </Button>
                {exportMutation.isError && lastExportPayload && (
                  <Button variant="ghost" size="sm" onClick={() => startExport(lastExportPayload.format)}>
                    <RefreshCcw className="w-4 h-4 mr-1" />重试
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {exporting && (
                <div className="mb-4 text-xs text-muted-foreground">导出进度：{exportProgress}%</div>
              )}
              {generateMutation.isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : generatedContent ? (
                <div className="prose prose-sm max-w-none">
                  {resourceType === "mind_map" && parsedMindMap ? (
                    <div className="space-y-4 not-prose">
                      <div className="text-sm font-semibold">思维导图可视化（结构化 JSON）</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {parsedMindMap.nodes.map((node) => (
                          <div key={node.id} className="border rounded-lg p-3 bg-muted/30">
                            <div className="text-xs text-muted-foreground">节点 {node.id}</div>
                            <div className="font-medium">{node.label}</div>
                            {typeof node.level === "number" && <div className="text-xs mt-1">层级：{node.level}</div>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-2">关系连线</div>
                        <ul className="space-y-1 text-sm">
                          {parsedMindMap.edges.map((edge, index) => (
                            <li key={`${edge.source}-${edge.target}-${index}`}>
                              {edge.source} → {edge.target}{edge.relation ? `（${edge.relation}）` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : resourceType === "interactive_game" && parsedInteractiveGame ? (
                    <div className="not-prose space-y-4">
                      <div className="text-sm font-semibold">互动游戏结构化卡片</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-2">流程</h4>
                          <ul className="list-disc pl-5 text-sm space-y-1">{(parsedInteractiveGame.flow || []).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-2">规则</h4>
                          <ul className="list-disc pl-5 text-sm space-y-1">{(parsedInteractiveGame.rules || []).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-2">材料</h4>
                          <ul className="list-disc pl-5 text-sm space-y-1">{(parsedInteractiveGame.materials || []).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-2">评分</h4>
                          <ul className="list-disc pl-5 text-sm space-y-1">{(parsedInteractiveGame.scoring || []).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Streamdown>{generatedContent}</Streamdown>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground font-light">
                  填写左侧表单并点击"开始生成"按钮
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
