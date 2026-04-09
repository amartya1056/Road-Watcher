import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { CurrencyProvider } from "@/context/currency";
import { ThemeProvider, useTheme } from "@/context/theme";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Potholes from "@/pages/potholes";
import AI from "@/pages/ai";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/analytics" component={Dashboard} />
        <Route path="/potholes" component={Potholes} />
        <Route path="/ai" component={AI} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <div className={theme === "dark" ? "dark" : ""} style={{ minHeight: "100vh" }}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <ThemedApp />
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
