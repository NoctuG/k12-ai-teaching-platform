import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Trash2, Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const commentTypes = [
  { value: "final_term", label: "期末评语" },
  { value: "homework", label: "作业评价" },
  { value: "daily", label: "日常表现" },
  { value: "custom", label: "自定义评语" },
];

const statusLabels = {
  pending: "待处理",
  generating: "生成中",
  completed: "已完成",
  failed: "失败",
};

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  generating: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
};

interface Student {
  name: string;
  performance: string;
}

export default function Comments() {
  const [batchTitle, setBatchTitle] = useState("");
  const [commentType, setCommentType] = useState<string>("final_term");
  const [students, setStudents] = useState<Student[]>([{ name: "", performance: "" }]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);

  const { data: commentsList, isLoading, refetch } = trpc.comments.list.useQuery();
  const { data: selectedComments } = trpc.comments.getById.useQuery(
    { id: selectedBatch! },
    { enabled: !!selectedBatch }
  );

  const createMutation = trpc.comments.createBatch.useMutation({
    onSuccess: () => {
      toast.success("评语生成任务已创建，正在后台处理...");
      setBatchTitle("");
      setStudents([{ name: "", performance: "" }]);
      refetch();
    },
    onError: (error) => {
      toast.error("创建失败：" + error.message);
    },
  });

  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error("删除失败：" + error.message);
    },
  });

  const handleAddStudent = () => {
    setStudents([...students, { name: "", performance: "" }]);
  };

  const handleRemoveStudent = (index: number) => {
    setStudents(students.filter((_, i) => i !== index));
  };

  const handleStudentChange = (index: number, field: keyof Student, value: string) => {
    const newStudents = [...students];
    newStudents[index][field] = value;
    setStudents(newStudents);
  };

  const handleGenerate = () => {
    if (!batchTitle.trim()) {
      toast.error("请输入批次标题");
      return;
    }

    const validStudents = students.filter(s => s.name.trim() && s.performance.trim());
    if (validStudents.length === 0) {
      toast.error("请至少添加一个学生信息");
      return;
    }

    createMutation.mutate({
      batchTitle,
      commentType: commentType as any,
      students: validStudents,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个评语批次吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleExport = () => {
    if (!selectedComments) return;
    
    const content = (selectedComments.students as any[])
      .map((s: any) => `${s.name}：\n${s.comment}\n`)
      .join("\n");
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedComments.batchTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black mb-2">学生评语生成</h1>
          <p className="text-muted-foreground font-light">
            批量生成个性化学生评语，支持期末评语、作业评价等多种类型
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                批量生成配置
              </CardTitle>
              <CardDescription>填写学生信息并开始生成评语</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchTitle">批次标题</Label>
                  <Input
                    id="batchTitle"
                    placeholder="例如：2024年春季期末评语"
                    value={batchTitle}
                    onChange={(e) => setBatchTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commentType">评语类型</Label>
                  <Select value={commentType} onValueChange={setCommentType}>
                    <SelectTrigger id="commentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>学生信息</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStudent}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    添加学生
                  </Button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {students.map((student, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="学生姓名"
                            value={student.name}
                            onChange={(e) => handleStudentChange(index, "name", e.target.value)}
                            className="flex-1"
                          />
                          {students.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStudent(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <Textarea
                          placeholder="学生表现描述（例如：该生学习认真，成绩优异，积极参与课堂活动...）"
                          value={student.performance}
                          onChange={(e) => handleStudentChange(index, "performance", e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={createMutation.isPending}
                className="w-full"
                size="lg"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    批量生成评语
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* History List */}
          <Card>
            <CardHeader>
              <CardTitle>生成历史</CardTitle>
              <CardDescription>查看所有评语生成记录</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !commentsList || commentsList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground font-light">
                  暂无生成记录
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {commentsList.map((batch) => (
                    <Card key={batch.id} className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm mb-1">{batch.batchTitle}</h4>
                            <p className="text-xs text-muted-foreground">
                              {commentTypes.find(t => t.value === batch.commentType)?.label} · {batch.totalCount}名学生
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(batch.createdAt), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                            </p>
                          </div>
                          <Badge className={statusColors[batch.status as keyof typeof statusColors]}>
                            {statusLabels[batch.status as keyof typeof statusLabels]}
                          </Badge>
                        </div>

                        <div className="flex gap-2 mt-3">
                          {batch.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setSelectedBatch(batch.id)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              查看
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(batch.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>{selectedComments?.batchTitle}</DialogTitle>
                  <DialogDescription>
                    {selectedComments && commentTypes.find(t => t.value === selectedComments.commentType)?.label} · {" "}
                    {selectedComments && format(new Date(selectedComments.createdAt), "yyyy年MM月dd日 HH:mm", { locale: zhCN })}
                  </DialogDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" />
                  导出
                </Button>
              </div>
            </DialogHeader>
            {selectedComments && (
              <div className="space-y-4">
                {(selectedComments.students as any[]).map((student: any, index: number) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <CardDescription className="text-sm">
                        表现描述：{student.performance}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 rounded-md p-4">
                        <p className="text-sm leading-relaxed">{student.comment}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
