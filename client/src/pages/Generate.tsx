import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";

const resourceTypes = [
  { value: "courseware", label: "课件（PPT）" },
  { value: "exam", label: "试卷" },
  { value: "lesson_plan", label: "教学设计" },
  { value: "transcript", label: "逐字稿" },
  { value: "lecture_script", label: "说课稿" },
];

export default function Generate() {
  const [resourceType, setResourceType] = useState<string>("courseware");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");

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
                    {resourceTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
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

              {knowledgeFiles && knowledgeFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>参考资料（可选）</Label>
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
                        <span className="text-sm truncate">{file.fileName}</span>
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
