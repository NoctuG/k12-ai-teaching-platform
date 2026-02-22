import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CanvasEditor from "@/components/CanvasEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquare, Users } from "lucide-react";
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
  const utils = trpc.useUtils();

  const { data: history, isLoading } = trpc.generation.getById.useQuery(
    { id },
    { enabled: !!id }
  );
  const { data: session, refetch: refetchSession } =
    trpc.collaboration.getSession.useQuery(
      { generationId: id },
      { enabled: !!id, refetchInterval: 2500 }
    );

  const [content, setContent] = useState("");
  const [revision, setRevision] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [activeAnchor, setActiveAnchor] = useState("document");

  useEffect(() => {
    if (session) {
      setContent(session.content || "");
      setRevision(session.revision || 1);
    }
  }, [session?.content, session?.revision]);

  const updateMutation = trpc.generation.update.useMutation({
    onSuccess: () => toast.success("保存成功"),
    onError: error => toast.error("保存失败：" + error.message),
  });

  const syncMutation = trpc.collaboration.syncDocument.useMutation({
    onSuccess: next => {
      setContent(next.content);
      setRevision(next.revision);
    },
  });

  const presenceMutation = trpc.collaboration.updatePresence.useMutation();
  const addCommentMutation = trpc.collaboration.addComment.useMutation({
    onSuccess: async () => {
      setCommentText("");
      await utils.collaboration.listComments.invalidate({ generationId: id });
      await refetchSession();
    },
  });
  const commentStatusMutation =
    trpc.collaboration.updateCommentStatus.useMutation({
      onSuccess: async () => {
        await utils.collaboration.listComments.invalidate({ generationId: id });
        await refetchSession();
      },
    });

  const handleSave = (markdown: string) => {
    updateMutation.mutate({ id, content: markdown });
  };

  const unresolved = useMemo(
    () => (session?.comments || []).filter(c => c.status === "open"),
    [session?.comments]
  );

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
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/history")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{history.title}</h1>
          </div>
          <Badge variant="outline">
            {resourceTypeLabels[history.resourceType] || history.resourceType}
          </Badge>
          <Badge variant="secondary">
            权限：
            {session?.permission === "edit"
              ? "可编辑"
              : session?.permission === "comment"
                ? "仅评论"
                : "只读"}
          </Badge>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-0">
          <div className="border rounded-lg overflow-hidden bg-card min-h-0">
            <CanvasEditor
              content={content || history.content || ""}
              onSave={handleSave}
              saving={updateMutation.isPending}
              readOnly={session?.permission === "read"}
              onContentChange={next => {
                setContent(next);
                syncMutation.mutate({
                  generationId: id,
                  content: next,
                  baseRevision: revision,
                });
              }}
              onCursorChange={anchor => {
                setActiveAnchor(anchor);
                presenceMutation.mutate({
                  generationId: id,
                  state: "online",
                  cursorAnchor: anchor,
                });
              }}
              remotePresence={(session?.presence || []).filter(
                p => p.cursorAnchor
              )}
            />
          </div>

          <Card className="p-3 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                评论面板
              </h3>
              <Badge
                variant={unresolved.length > 0 ? "destructive" : "outline"}
              >
                待处理 {unresolved.length}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              在线 {session?.presence?.length || 0} 人
            </div>

            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={`在 ${activeAnchor} 添加批注`}
              />
              <Button
                size="sm"
                disabled={!commentText.trim() || session?.permission === "read"}
                onClick={() =>
                  addCommentMutation.mutate({
                    generationId: id,
                    anchor: activeAnchor,
                    content: commentText,
                  })
                }
              >
                发送
              </Button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1">
              {(session?.comments || []).map(comment => (
                <div key={comment.id} className="border rounded-md p-2 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      #{comment.anchor}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      disabled={session?.permission === "read"}
                      onClick={() =>
                        commentStatusMutation.mutate({
                          commentId: comment.id,
                          status:
                            comment.status === "open" ? "resolved" : "open",
                        })
                      }
                    >
                      {comment.status === "open" ? "标记已解决" : "重新打开"}
                    </Button>
                  </div>
                  <p>{comment.content}</p>
                  <Badge
                    variant={
                      comment.status === "open" ? "secondary" : "outline"
                    }
                    className="mt-1 text-[10px]"
                  >
                    {comment.status === "open" ? "未解决" : "已解决"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
