import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Loader2, Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const resourceTypeLabels: Record<string, string> = {
  courseware: "课件",
  exam: "试卷",
  lesson_plan: "教学设计",
  lesson_plan_unit: "大单元教学设计",
  transcript: "逐字稿",
  lecture_script: "说课稿",
  homework: "作业设计",
  question_design: "试题设计",
  grading_rubric: "评分标准",
  learning_report: "学情分析报告",
  interactive_game: "互动游戏",
  discussion_chain: "讨论话题/问题链",
  mind_map: "思维导图",
  parent_letter: "家长通知",
  parent_meeting_speech: "家长会发言稿",
  pbl_project: "PBL方案",
  school_curriculum: "校本课程",
  competition_questions: "竞赛题库",
  pacing_guide: "教学进度表",
  differentiated_reading: "分层阅读",
};

export default function SharedResources() {
  const { data: shared, isLoading } = trpc.generation.shared.useQuery();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const { data: selectedResource } = trpc.generation.getSharedByToken.useQuery(
    { token: selectedToken! },
    { enabled: !!selectedToken }
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black mb-2">共享资源</h1>
          <p className="text-muted-foreground font-light">
            浏览其他教师共享的教学资源
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !shared || shared.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground font-light">
              暂无共享资源
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shared.map((item) => (
              <Card key={item.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1 line-clamp-1">{item.title}</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">
                          {resourceTypeLabels[item.resourceType] || item.resourceType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), "PPP", { locale: zhCN })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-2 font-light mb-3">
                    {item.prompt}
                  </CardDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedToken(item.shareToken)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    查看详情
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!selectedToken} onOpenChange={(open) => !open && setSelectedToken(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedResource?.title}</DialogTitle>
            <DialogDescription>
              {selectedResource && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {resourceTypeLabels[selectedResource.resourceType] || selectedResource.resourceType}
                  </Badge>
                  <span>{format(new Date(selectedResource.createdAt), "PPP", { locale: zhCN })}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedResource && (
            <div className="prose prose-sm max-w-none">
              <Streamdown>{selectedResource.content}</Streamdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
