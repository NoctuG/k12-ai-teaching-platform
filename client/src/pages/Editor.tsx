import DashboardLayout from "@/components/DashboardLayout";
import CanvasEditor from "@/components/CanvasEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";

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

export default function Editor() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();

  const { data: history, isLoading } = trpc.generation.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const updateMutation = trpc.generation.update.useMutation({
    onSuccess: () => {
      toast.success("保存成功");
    },
    onError: (error) => {
      toast.error("保存失败：" + error.message);
    },
  });

  const handleSave = (content: string) => {
    updateMutation.mutate({ id, content });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!history) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-muted-foreground font-light">记录不存在</p>
          <Button variant="outline" onClick={() => setLocation("/history")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            返回历史记录
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/history")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{history.title}</h1>
          </div>
          <Badge variant="outline">
            {resourceTypeLabels[history.resourceType] || history.resourceType}
          </Badge>
        </div>

        {/* Canvas Editor */}
        <div className="flex-1 border rounded-lg overflow-hidden bg-card">
          <CanvasEditor
            content={history.content || ""}
            onSave={handleSave}
            saving={updateMutation.isPending}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
