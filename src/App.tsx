import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Inventory from "@/pages/Inventory";
import Fleet from "@/pages/Fleet";
import Timesheets from "@/pages/Timesheets";
import Invoicing from "@/pages/Invoicing";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Campaigns from "@/pages/Campaigns";
import Settings from "@/pages/Settings";
import Onboarding from "@/pages/Onboarding";
import Field from "@/pages/Field";
import PointOfSale from "@/pages/PointOfSale";
import SalesPortal from "@/pages/SalesPortal";
import { Toaster } from "@/components/ui/sonner";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/sales" element={<SalesPortal />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/field" element={<Field />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/timesheets" element={<Timesheets />} />
        <Route path="/pos" element={<PointOfSale />} />
        <Route path="/invoicing" element={<Invoicing />} />
        <Route path="/invoicing/:id" element={<InvoiceDetail />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
