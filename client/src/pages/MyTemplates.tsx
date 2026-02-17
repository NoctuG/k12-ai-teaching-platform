import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Trash2, Eye, Loader2, Plus, FileText, ClipboardList, BookText, Mic, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const resourceTypes = [
  { value: "courseware", label: "课件（PPT）" },
  { value: "exam", label: "试卷" },
  { value: "lesson_plan", label: "教学设计" },
  { value: "lesson_plan_unit", label: "大单元教学设计" },
  { value: "transcript", label: "逐字稿" },
  { value: "lecture_script", label: "说课稿" },
  { value: "homework", label: "作业设计" },
  { value: "question_design", label: "试题设计" },
];

const resourceTypeIcons: Record<string, React.ReactNode> = {
  courseware: <FileText className="w-5 h-5" />,
  exam: <ClipboardList className="w-5 h-5" />,
  lesson_plan: <BookText className="w-5 h-5" />,
  lesson_plan_unit: <BookText className="w-5 h-5" />,
  transcript: <Mic className="w-5 h-5" />,
  lecture_script: <MessageSquare className="w-5 h-5" />,
  homework: <ClipboardList className="w-5 h-5" />,
  question_design: <FileText className="w-5 h-5" />,
};

const resourceTypeLabels: Record<string, string> = {
  courseware: "课件",
  exam: "试卷",
  lesson_plan: "教学设计",
  lesson_plan_unit: "大单元教学设计",
  transcript: "逐字稿",
  lecture_script: "说课稿",
  homework: "作业设计",
  question_design: "试题设计",
};

export default function MyTemplates() {
  const { data: templates, isLoading, refetch } = trpc.templates.myTemplates.useQuery();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const { data: selectedTemplateData } = trpc.templates.getById.useQuery(
    { id: selectedTemplate! },
    { enabled: !!selectedTemplate }
  );

  // Upload form state
  const [resourceType, setResourceType] = useState<string>("courseware");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  const uploadMutation = trpc.templates.upload.useMutation({
    onSuccess: () => {
      toast.success("上传成功");
      refetch();
      setUploadDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("上传失败：" + error.message);
    },
  });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error("删除失败：" + error.message);
    },
  });

  const resetForm = () => {
    setResourceType("courseware");
    setTitle("");
    setDescription("");
    setContent("");
    setSubject("");
    setGrade("");
  };

  const handleUpload = () => {
    if (!title.trim()) {
      toast.error("请输入模板标题");
      return;
    }
    if (!content.trim()) {
      toast.error("请输入模板内容");
      return;
    }

    uploadMutation.mutate({
      resourceType: resourceType as any,
      title,
      description,
      content,
      subject,
      grade,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个模板吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black mb-2">我的模板</h1>
            <p className="text-muted-foreground font-light">
              上传和管理您的教学资源模板
            </p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="w-4 h-4 mr-2" />
                上传模板
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>上传模板</DialogTitle>
                <DialogDescription>
                  填写模板信息并上传内容
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
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
                  <Label htmlFor="title">模板标题</Label>
                  <Input
                    id="title"
                    placeholder="例如：小学数学三年级分数教学设计"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">模板描述</Label>
                  <Textarea
                    id="description"
                    placeholder="简要描述这个模板的特点和适用场景"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">学科</Label>
                    <Input
                      id="subject"
                      placeholder="例如：数学"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grade">年级</Label>
                    <Input
                      id="grade"
                      placeholder="例如：三年级"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">模板内容</Label>
                  <Textarea
                    id="content"
                    placeholder="粘贴或输入完整的模板内容，支持Markdown格式"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    className="resize-none font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      确认上传
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground font-light">
              暂无上传的模板，点击右上角"上传模板"按钮开始
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                    {resourceTypeIcons[template.resourceType]}
                  </div>
                  <CardTitle className="text-lg">{template.title}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    <Badge variant="outline">
                      {resourceTypeLabels[template.resourceType]}
                    </Badge>
                    {template.subject && (
                      <Badge variant="secondary">{template.subject}</Badge>
                    )}
                    {template.grade && (
                      <Badge variant="secondary">{template.grade}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="line-clamp-3 font-light">
                    {template.description || "暂无描述"}
                  </CardDescription>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(template.createdAt), "PPP", { locale: zhCN })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplateData?.title}</DialogTitle>
            <DialogDescription>
              {selectedTemplateData?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplateData && (
            <div className="prose prose-sm max-w-none">
              <Streamdown>{selectedTemplateData.content}</Streamdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
