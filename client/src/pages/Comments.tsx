import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const commentTypes = [
  { value: "final_term", label: "期末评语" },
  { value: "homework", label: "作业评价" },
  { value: "daily", label: "日常表现" },
  { value: "custom", label: "自定义评语" },
] as const;

export default function Comments() {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [term, setTerm] = useState("2026春");
  const [batchTitle, setBatchTitle] = useState("");
  const [commentType, setCommentType] = useState<string>("final_term");
  const [performanceMap, setPerformanceMap] = useState<Record<number, string>>({});
  const [activeTrendStudentId, setActiveTrendStudentId] = useState<number | null>(null);

  const { data: classes, refetch: refetchClasses } = trpc.comments.listClasses.useQuery();
  const { data: students, refetch: refetchStudents, isLoading: studentsLoading } = trpc.comments.listStudentsByClass.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );

  const { data: history, refetch: refetchHistory } = trpc.comments.history.useQuery(
    { classId: selectedClassId!, term },
    { enabled: !!selectedClassId }
  );

  const { data: trendData } = trpc.comments.trend.useQuery(
    { classId: selectedClassId!, studentId: activeTrendStudentId! },
    { enabled: !!selectedClassId && !!activeTrendStudentId }
  );

  const createClassMutation = trpc.comments.createClass.useMutation({
    onSuccess: async () => {
      toast.success("班级创建成功");
      await refetchClasses();
    },
    onError: (error) => toast.error(error.message),
  });

  const createBatchMutation = trpc.comments.createBatch.useMutation({
    onSuccess: async () => {
      toast.success("已开始批量生成评语");
      await Promise.all([refetchHistory(), refetchStudents()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const classOptions = classes ?? [];
  const studentOptions = students ?? [];

  const historyByStudent = useMemo(() => {
    const grouped: Record<number, number> = {};
    (history ?? []).forEach((row) => {
      grouped[row.studentId] = (grouped[row.studentId] ?? 0) + 1;
    });
    return grouped;
  }, [history]);

  const handleCreateClass = () => {
    const name = prompt("请输入班级名称（如：三年级一班）");
    if (!name) return;
    createClassMutation.mutate({ name, stage: "小学", grade: "三年级", term });
  };

  const handleGenerate = () => {
    if (!selectedClassId) return toast.error("请先选择班级");
    const payload = studentOptions
      .map((student) => ({
        studentId: student.id,
        name: student.name,
        performance: performanceMap[student.id]?.trim() || "",
      }))
      .filter((student) => student.performance);

    if (!batchTitle.trim()) return toast.error("请填写批次标题");
    if (payload.length === 0) return toast.error("请至少填写一名学生学情");

    createBatchMutation.mutate({
      classId: selectedClassId,
      term,
      batchTitle,
      commentType: commentType as any,
      students: payload,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-black mb-2">学生评语生成</h1>
          <p className="text-muted-foreground">选择班级后拉取学生，批量生成或更新评语，并按学期回看历史。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1) 选择班级</CardTitle>
            <CardDescription>支持先建班级，再按班级管理学生评语。</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3">
            <Select value={selectedClassId?.toString()} onValueChange={(value) => setSelectedClassId(Number(value))}>
              <SelectTrigger><SelectValue placeholder="请选择班级" /></SelectTrigger>
              <SelectContent>
                {classOptions.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="学期，例如 2026春" />
            <Button variant="outline" onClick={handleCreateClass} disabled={createClassMutation.isPending}>新建班级</Button>
            <Button variant="outline" onClick={() => refetchStudents()} disabled={!selectedClassId}>拉取学生</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) 批量生成/更新评语</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Input value={batchTitle} onChange={(e) => setBatchTitle(e.target.value)} placeholder="批次标题" />
              <Select value={commentType} onValueChange={setCommentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {commentTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerate} disabled={createBatchMutation.isPending || !selectedClassId}>
                {createBatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}批量生成
              </Button>
            </div>

            {studentsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <div className="space-y-3">
                {studentOptions.map((student) => (
                  <div key={student.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{student.name}（历史 {historyByStudent[student.id] ?? 0} 条）</Label>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTrendStudentId(student.id)}>查看学情趋势</Button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="填写该生本学期学情表现"
                      value={performanceMap[student.id] ?? ""}
                      onChange={(e) => setPerformanceMap((prev) => ({ ...prev, [student.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3) 学期历史评语</CardTitle>
            <CardDescription>{term} 学期</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(history ?? []).map((row) => (
              <div key={row.id} className="border rounded-md p-3">
                <div className="font-medium">{row.batchTitle}</div>
                <div className="text-sm text-muted-foreground">学生ID: {row.studentId} · 类型: {row.commentType}</div>
                <p className="text-sm mt-2">{row.comment}</p>
              </div>
            ))}
            {history?.length === 0 && <div className="text-sm text-muted-foreground">当前学期暂无评语记录</div>}
          </CardContent>
        </Card>

        {activeTrendStudentId && (
          <Card>
            <CardHeader>
              <CardTitle>学情趋势（学生ID: {activeTrendStudentId}）</CardTitle>
            </CardHeader>
            <CardContent>
              {(trendData ?? []).map((record) => (
                <div key={record.id} className="text-sm border-b py-2">
                  {record.dimension} / {record.indicator} - {record.teacherNote || "无备注"}
                </div>
              ))}
              {trendData?.length === 0 && <div className="text-sm text-muted-foreground">暂无学情趋势数据</div>}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
