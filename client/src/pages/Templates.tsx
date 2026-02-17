import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, ClipboardList, BookText, Mic, MessageSquare, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Streamdown } from "streamdown";

const resourceTypeIcons = {
  courseware: <FileText className="w-5 h-5" />,
  exam: <ClipboardList className="w-5 h-5" />,
  lesson_plan: <BookText className="w-5 h-5" />,
  transcript: <Mic className="w-5 h-5" />,
  lecture_script: <MessageSquare className="w-5 h-5" />,
};

const resourceTypeLabels = {
  courseware: "课件",
  exam: "试卷",
  lesson_plan: "教学设计",
  transcript: "逐字稿",
  lecture_script: "说课稿",
};

export default function Templates() {
  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const { data: selectedTemplateData } = trpc.templates.getById.useQuery(
    { id: selectedTemplate! },
    { enabled: !!selectedTemplate }
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black mb-2">模板库</h1>
          <p className="text-muted-foreground font-light">
            浏览和使用预置的教学资源模板
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground font-light">
              暂无模板，敬请期待
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                    {resourceTypeIcons[template.resourceType as keyof typeof resourceTypeIcons]}
                  </div>
                  <CardTitle className="text-lg">{template.title}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    <Badge variant="outline">
                      {resourceTypeLabels[template.resourceType as keyof typeof resourceTypeLabels]}
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
                      使用次数: {template.usageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      查看
                    </Button>
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
