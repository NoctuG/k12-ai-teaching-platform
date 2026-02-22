import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Trash2, File, Loader2, CheckCircle2, AlertCircle, Clock, FolderTree, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function Knowledge() {
  const [uploading, setUploading] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<number | undefined>(undefined);
  const [activeTagIds, setActiveTagIds] = useState<number[]>([]);

  const { data: folders = [] } = trpc.organization.listFolders.useQuery();
  const { data: tags = [] } = trpc.organization.listTags.useQuery();
  const { data: files, isLoading, refetch } = trpc.knowledge.list.useQuery({ folderId: activeFolderId, tagIds: activeTagIds });

  const folderTree = useMemo(() => {
    const byParent = new Map<number | null, any[]>();
    for (const folder of folders) {
      const key = folder.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(folder);
    }
    const flatten = (parentId: number | null, depth: number): any[] => {
      const nodes = byParent.get(parentId) || [];
      return nodes.flatMap(node => [{ ...node, depth }, ...flatten(node.id, depth + 1)]);
    };
    return flatten(null, 0);
  }, [folders]);

  const uploadMutation = trpc.knowledge.upload.useMutation({
    onSuccess: () => {
      toast.success("上传成功，正在解析文件内容...");
      refetch();
      setUploading(false);
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
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过10MB");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      uploadMutation.mutate({
        fileName: file.name,
        fileContent: base64.split(",")[1],
        mimeType: file.type,
        folderId: activeFolderId,
        tagIds: activeTagIds,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-4xl font-black">知识库</h1>
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FolderTree className="w-4 h-4" />目录树</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant={activeFolderId === undefined ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => setActiveFolderId(undefined)}>根目录</Button>
              {folderTree.map(folder => (
                <Button key={folder.id} variant={activeFolderId === folder.id ? "default" : "ghost"} size="sm" className="w-full justify-start" style={{ paddingLeft: `${8 + folder.depth * 16}px` }} onClick={() => setActiveFolderId(folder.id)}>
                  {folder.name}
                </Button>
              ))}
              <div className="pt-3 border-t">
                <p className="text-sm mb-2 flex items-center gap-1"><Tag className="w-3 h-3" />标签筛选</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge key={tag.id} variant={activeTagIds.includes(tag.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}>{tag.name}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />上传文件</CardTitle>
                <CardDescription>上传到当前目录并附加当前标签筛选</CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="file">选择文件</Label>
                <Input id="file" type="file" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" />
                {uploading && <div className="flex items-center gap-2 text-sm mt-2"><Loader2 className="w-4 h-4 animate-spin" />上传中...</div>}
              </CardContent>
            </Card>

            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : (
              <div className="grid gap-4">
                {files?.map((file) => (
                  <Card key={file.id}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <File className="w-4 h-4" />
                        <div>
                          <p className="font-medium truncate">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(file.createdAt), "PPP", { locale: zhCN })}</p>
                          {file.processingStatus === "completed" ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : file.processingStatus === "failed" ? <AlertCircle className="w-3 h-3 text-red-500" /> : <Clock className="w-3 h-3 text-amber-600" />}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate({ id: file.id })}><Trash2 className="w-4 h-4" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
