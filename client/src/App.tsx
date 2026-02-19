import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Generate from "./pages/Generate";
import History from "./pages/History";
import Knowledge from "./pages/Knowledge";
import Templates from "./pages/Templates";
import MyTemplates from "./pages/MyTemplates";
import Profile from "./pages/Profile";
import Comments from "./pages/Comments";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/generate"} component={Generate} />
      <Route path={"/history"} component={History} />
      <Route path={"/knowledge"} component={Knowledge} />
      <Route path={"/templates"} component={Templates} />
      <Route path={"/my-templates"} component={MyTemplates} />
      <Route path={"/comments"} component={Comments} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
