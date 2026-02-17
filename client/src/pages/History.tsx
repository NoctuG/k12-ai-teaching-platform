import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, ClipboardList, BookText, Mic, MessageSquare, Trash2, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const resourceTypeIcons = {
  courseware: <FileText className="w-5 h-5" />,
  exam: <ClipboardList className="w-5 h-5" />,
  lesson_plan: <BookText className="w-5 h-5" />,
  lesson_plan_unit: <BookText className="w-5 h-5" />,
  transcript: <Mic className="w-5 h-5" />,
  lecture_script: <MessageSquare className="w-5 h-5" />,
  homework: <ClipboardList className="w-5 h-5" />,
  question_design: <FileText className="w-5 h-5" />,
};

const resourceTypeLabels = {
  courseware: "课件",
  exam: "试卷",
  lesson_plan: "教学设计",
  lesson_plan_unit: "大单元教学设计",
  transcript: "逐字稿",
  lecture_script: "说课稿",
  homework: "作业设计",
  question_design: "试题设计",
};

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

export default function History() {
  const { data: history, isLoading, refetch } = trpc.generation.list.useQuery();
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const { data: selectedHistory } = trpc.generation.getById.useQuery(
    { id: selectedItem! },
    { enabled: !!selectedItem }
  );

  const deleteMutation = trpc.generation.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error("删除失败：" + error.message);
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这条记录吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black mb-2">生成历史</h1>
          <p className="text-muted-foreground font-light">
            查看和管理您的所有生成记录
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !history || history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground font-light">
              暂无生成记录
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {history.map((item) => (
              <Card key={item.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {resourceTypeIcons[item.resourceType as keyof typeof resourceTypeIcons]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-2">{item.title}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            {resourceTypeLabels[item.resourceType as keyof typeof resourceTypeLabels]}
                          </Badge>
                          <Badge className={statusColors[item.status as keyof typeof statusColors]}>
                            {statusLabels[item.status as keyof typeof statusLabels]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.createdAt), "PPP", { locale: zhCN })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedItem(item.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          查看
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-2 font-light">
                    {item.prompt}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedHistory?.title}</DialogTitle>
            <DialogDescription>
              {selectedHistory && format(new Date(selectedHistory.createdAt), "PPP", { locale: zhCN })}
            </DialogDescription>
          </DialogHeader>
          {selectedHistory && (
            <div className="prose prose-sm max-w-none">
              <Streamdown>{selectedHistory.content}</Streamdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
