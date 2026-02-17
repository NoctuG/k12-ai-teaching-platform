import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Sparkles, FileText, ClipboardList, BookText, Mic, MessageSquare, ArrowRight } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    window.location.href = "/generate";
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Geometric accent background */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-gradient-to-tr from-secondary/10 to-primary/10 blur-3xl" />
        
        <div className="container relative z-10 py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-foreground">
              智教云
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
              AI驱动的教学资源生成平台，帮助K12教师快速创建高质量的教学材料，提升备课效率
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = getLoginUrl()}>
                开始使用
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 bg-card/50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black mb-4">AI生成功能</h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto">
              五大核心功能，满足教师日常教学资源准备的全部需求
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<FileText className="w-8 h-8" />}
              title="课件生成"
              description="输入主题和要求，自动生成完整的PPT课件内容，包括教学目标、重点难点和详细讲解"
            />
            <FeatureCard
              icon={<ClipboardList className="w-8 h-8" />}
              title="试卷生成"
              description="选择题型、难度和知识点范围，智能生成科学合理的试卷及参考答案"
            />
            <FeatureCard
              icon={<BookText className="w-8 h-8" />}
              title="教学设计"
              description="根据课程主题生成完整的教学设计，包括教学目标、教学过程和板书设计"
            />
            <FeatureCard
              icon={<Mic className="w-8 h-8" />}
              title="逐字稿生成"
              description="为课程内容生成详细的教学逐字稿，包括讲解内容和互动对话"
            />
            <FeatureCard
              icon={<MessageSquare className="w-8 h-8" />}
              title="说课稿生成"
              description="生成包含教材分析、学情分析、教学方法等完整的说课稿"
            />
            <FeatureCard
              icon={<Sparkles className="w-8 h-8" />}
              title="知识库支持"
              description="上传参考资料，AI将结合知识库内容生成更精准的教学资源"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-8 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-3xl blur-2xl" />
            <div className="relative bg-card border border-border rounded-2xl p-12">
              <h2 className="text-3xl lg:text-4xl font-black mb-4">
                开始使用智教云
              </h2>
              <p className="text-lg text-muted-foreground font-light mb-8">
                立即体验AI驱动的教学资源生成，让备课更高效
              </p>
              <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = getLoginUrl()}>
                免费注册
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="text-center text-sm text-muted-foreground font-light">
            <p>© 2026 智教云. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
          {icon}
        </div>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base font-light leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
