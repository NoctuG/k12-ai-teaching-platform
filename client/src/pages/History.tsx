import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, ClipboardList, BookText, Mic, MessageSquare, Trash2, Eye, Loader2, Download, PenLine, Star, Share2, Search, Filter, Gamepad2, GitBranch, Brain, Mail, Users, Lightbulb, GraduationCap, Trophy, CalendarRange, BookOpen } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const resourceTypeIcons: Record<string, React.ReactNode> = {
  courseware: <FileText className="w-5 h-5" />,
  exam: <ClipboardList className="w-5 h-5" />,
  lesson_plan: <BookText className="w-5 h-5" />,
  lesson_plan_unit: <BookText className="w-5 h-5" />,
  transcript: <Mic className="w-5 h-5" />,
  lecture_script: <MessageSquare className="w-5 h-5" />,
  homework: <ClipboardList className="w-5 h-5" />,
  question_design: <FileText className="w-5 h-5" />,
  grading_rubric: <GraduationCap className="w-5 h-5" />,
  learning_report: <Users className="w-5 h-5" />,
  interactive_game: <Gamepad2 className="w-5 h-5" />,
  discussion_chain: <GitBranch className="w-5 h-5" />,
  mind_map: <Brain className="w-5 h-5" />,
  parent_letter: <Mail className="w-5 h-5" />,
  parent_meeting_speech: <Users className="w-5 h-5" />,
  pbl_project: <Lightbulb className="w-5 h-5" />,
  school_curriculum: <BookOpen className="w-5 h-5" />,
  competition_questions: <Trophy className="w-5 h-5" />,
  pacing_guide: <CalendarRange className="w-5 h-5" />,
  differentiated_reading: <BookText className="w-5 h-5" />,
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

const statusLabels: Record<string, string> = {
  pending: "待处理",
  generating: "生成中",
  completed: "已完成",
  failed: "失败",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  generating: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { data: history, isLoading, refetch } = trpc.generation.search.useQuery({
    search: searchQuery || undefined,
    resourceType: filterType !== "all" ? filterType : undefined,
    favoritesOnly: favoritesOnly || undefined,
  });

  const [, setLocation] = useLocation();
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const { data: selectedHistory } = trpc.generation.getById.useQuery(
    { id: selectedItem! },
    { enabled: !!selectedItem }
  );

  const exportMutation = trpc.generation.export.useMutation({
    onSuccess: (data) => {
      // Download file
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
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

  const deleteMutation = trpc.generation.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error("删除失败：" + error.message);
    },
  });

  const favoriteMutation = trpc.generation.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.isFavorite ? "已收藏" : "已取消收藏");
      refetch();
    },
  });

  const shareMutation = trpc.generation.toggleShare.useMutation({
    onSuccess: (data) => {
      toast.success(data.isShared ? "已开启共享" : "已关闭共享");
      refetch();
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

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索标题或内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="筛选类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {Object.entries(resourceTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className="shrink-0"
          >
            <Star className={`w-4 h-4 mr-1 ${favoritesOnly ? "fill-current" : ""}`} />
            收藏
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !history || history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground font-light">
              {searchQuery || filterType !== "all" || favoritesOnly ? "未找到匹配的记录" : "暂无生成记录"}
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
                        {resourceTypeIcons[item.resourceType] || <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-2">{item.title}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            {resourceTypeLabels[item.resourceType] || item.resourceType}
                          </Badge>
                          <Badge className={statusColors[item.status] || ""}>
                            {statusLabels[item.status] || item.status}
                          </Badge>
                          {(item as any).isFavorite === 1 && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              <Star className="w-3 h-3 mr-1 fill-current" />
                              收藏
                            </Badge>
                          )}
                          {(item as any).isShared === 1 && (
                            <Badge variant="outline" className="text-blue-600 border-blue-300">
                              <Share2 className="w-3 h-3 mr-1" />
                              共享
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.createdAt), "PPP", { locale: zhCN })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.status === "completed" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => favoriteMutation.mutate({ id: item.id })}
                            title={(item as any).isFavorite === 1 ? "取消收藏" : "收藏"}
                          >
                            <Star className={`w-4 h-4 ${(item as any).isFavorite === 1 ? "fill-yellow-500 text-yellow-500" : ""}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => shareMutation.mutate({ id: item.id })}
                            title={(item as any).isShared === 1 ? "取消共享" : "共享"}
                          >
                            <Share2 className={`w-4 h-4 ${(item as any).isShared === 1 ? "text-blue-500" : ""}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedItem(item.id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            查看
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/editor/${item.id}`)}
                          >
                            <PenLine className="w-4 h-4 mr-1" />
                            Canvas编辑
                          </Button>
                        </>
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
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>{selectedHistory?.title}</DialogTitle>
                <DialogDescription>
                  {selectedHistory && format(new Date(selectedHistory.createdAt), "PPP", { locale: zhCN })}
                </DialogDescription>
              </div>
              {selectedHistory && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(null);
                      setLocation(`/editor/${selectedHistory.id}`);
                    }}
                  >
                    <PenLine className="w-4 h-4 mr-1" />
                    Canvas编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportMutation.mutate({ id: selectedHistory.id, format: "word" })}
                    disabled={exportMutation.isPending}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Word
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportMutation.mutate({ id: selectedHistory.id, format: "ppt" })}
                    disabled={exportMutation.isPending}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PPT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportMutation.mutate({ id: selectedHistory.id, format: "pdf" })}
                    disabled={exportMutation.isPending}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              )}
            </div>
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
