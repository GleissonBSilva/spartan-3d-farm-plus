import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { SaaSDataProvider } from "@/context/SaaSDataContext";
import { queryClient } from "@/lib/queryClient";

const Index = lazy(() => import('./pages/Index'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const NotFound = lazy(() => import('./pages/NotFound'));
import { RequireRole } from "@/components/auth/RequireRole";
import { OfflineNotice } from "@/components/layout/OfflineNotice";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SaaSDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <OfflineNotice />
            <ErrorBoundary>
              <Suspense fallback={<div className="min-h-screen bg-slate-950 grid place-items-center text-slate-300" role="status">Carregando tela…</div>}>
                <Routes>
              {/* Landing Page */}
              <Route path="/" element={<Index />} />

              {/* Auth */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Admin Views */}
              <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
              <Route path="/admin/clientes" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
              <Route path="/admin/financeiro" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
              <Route path="/admin/cobranca" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
              <Route path="/admin/planos" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
              <Route path="/admin/ia-copilot" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
              <Route path="/admin/webhooks" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />

              {/* Client 3D Printing Views */}
              <Route path="/cliente" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/financeiro" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/calculadora" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/estoque" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/impressoras" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/projetos" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/ia-copilot" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/planos" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/faturas" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />
              <Route path="/cliente/configuracoes" element={<RequireRole roles={["client", "manager"]}><ClientPortal /></RequireRole>} />

              {/* Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        </TooltipProvider>
      </SaaSDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
