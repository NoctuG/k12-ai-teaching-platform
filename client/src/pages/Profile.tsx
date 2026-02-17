import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { useState, useEffect } from "react";

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setSchool(user.school || "");
      setSubject(user.subject || "");
      setGrade(user.grade || "");
      setBio(user.bio || "");
    }
  }, [user]);

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("保存成功");
      window.location.reload();
    },
    onError: (error) => {
      toast.error("保存失败：" + error.message);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      name,
      school,
      subject,
      grade,
      bio,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-4xl font-black mb-2">个人资料</h1>
          <p className="text-muted-foreground font-light">
            管理您的个人信息和教学背景
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              基本信息
            </CardTitle>
            <CardDescription>更新您的个人资料</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                placeholder="请输入您的姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">邮箱地址无法修改</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">学校</Label>
              <Input
                id="school"
                placeholder="请输入您所在的学校"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject">任教学科</Label>
                <Input
                  id="subject"
                  placeholder="例如：数学"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">任教年级</Label>
                <Input
                  id="grade"
                  placeholder="例如：三年级"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">个人简介</Label>
              <Textarea
                id="bio"
                placeholder="介绍一下您的教学经验和专长"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full md:w-auto"
              size="lg"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存更改"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
