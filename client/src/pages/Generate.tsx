import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { Streamdown } from "streamdown";

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

  const { data: knowledgeFiles } = trpc.knowledge.list.useQuery();
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  const generateMutation = trpc.generation.generate.useMutation({
    onSuccess: (data) => {
      toast.success("生成成功！");
      setGeneratedContent(data.content);
    },
    onError: (error) => {
      toast.error("生成失败：" + error.message);
    },
  });

  const handleGenerate = () => {
    if (!title.trim()) {
      toast.error("请输入标题");
      return;
    }
    if (!prompt.trim()) {
      toast.error("请输入生成要求");
      return;
    }

    generateMutation.mutate({
      resourceType: resourceType as any,
      title,
      prompt,
      parameters: alignCurriculumStandards ? { alignCurriculumStandards: true } : undefined,
      knowledgeFileIds: selectedFiles,
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
              <CardDescription>AI生成的内容将显示在这里</CardDescription>
            </CardHeader>
            <CardContent>
              {generateMutation.isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : generatedContent ? (
                <div className="prose prose-sm max-w-none">
                  <Streamdown>{generatedContent}</Streamdown>
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
