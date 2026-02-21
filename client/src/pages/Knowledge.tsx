import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Trash2, File, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function Knowledge() {
  const { data: files, isLoading, refetch } = trpc.knowledge.list.useQuery();
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.knowledge.upload.useMutation({
    onSuccess: () => {
      toast.success("上传成功，正在解析文件内容...");
      refetch();
      setUploading(false);
      // Poll for processing completion
      const interval = setInterval(async () => {
        const result = await refetch();
        const allDone = result.data?.every(
          (f) => f.processingStatus !== "processing" && f.processingStatus !== "pending"
        );
        if (allDone) clearInterval(interval);
      }, 3000);
      setTimeout(() => clearInterval(interval), 60000);
    },
    onError: (error) => {
      toast.error("上传失败：" + error.message);
      setUploading(false);
    },
  });

  const deleteMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error("删除失败：" + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过10MB");
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const base64Content = base64.split(",")[1];

      uploadMutation.mutate({
        fileName: file.name,
        fileContent: base64Content,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个文件吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black mb-2">知识库</h1>
          <p className="text-muted-foreground font-light">
            上传参考资料，AI将结合知识库内容生成更精准的教学资源
          </p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              上传文件
            </CardTitle>
            <CardDescription>
              支持PDF、Word、TXT等格式，上传后自动解析文本内容用于RAG检索，单个文件最大10MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">选择文件</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Files List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">已上传文件</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !files || files.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground font-light">
                暂无上传文件
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {files.map((file) => (
                <Card key={file.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <File className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.fileName}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span>·</span>
                            <span>{format(new Date(file.createdAt), "PPP", { locale: zhCN })}</span>
                            <span>·</span>
                            {file.processingStatus === "completed" && file.chunkCount > 0 ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                已解析 ({file.chunkCount} 个片段)
                              </span>
                            ) : file.processingStatus === "processing" || file.processingStatus === "pending" ? (
                              <span className="flex items-center gap-1 text-amber-600">
                                <Clock className="w-3 h-3 animate-spin" />
                                解析中...
                              </span>
                            ) : file.processingStatus === "failed" ? (
                              <span className="flex items-center gap-1 text-red-500" title={file.processingError || ""}>
                                <AlertCircle className="w-3 h-3" />
                                解析失败
                              </span>
                            ) : file.processingStatus === "completed" ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <CheckCircle2 className="w-3 h-3" />
                                无文本内容
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(file.fileUrl, "_blank")}
                        >
                          查看
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(file.id)}
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
      </div>
    </DashboardLayout>
  );
}
