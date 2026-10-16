import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { AppShell } from "./AppShell";
import { StoreProvider, useStore } from "./data/store";
import { PEOPLE } from "./data/seed";
import { NewRequest, NotFound, RequestDetail, RequestsList } from "./screens/requests";
import { ApprovalDetail, ApprovalsInbox } from "./screens/approvals";
import { AddSupplier, AuditLog, SupplierProfile, SuppliersList } from "./screens/suppliers";
import { DesignSystem, ScreenIndex } from "./screens/meta";

function Home() {
  const { state } = useStore();
  const can = PEOPLE[state.user].can;
  if (can.includes("approve") || can.includes("second-approve")) return <Navigate to="/approvals" replace />;
  if (can.includes("onboard")) return <Navigate to="/suppliers" replace />;
  return <Navigate to="/requests" replace />;
}

// HashRouter: works on GitHub Pages and the hosted preview without server rewrites.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="requests" element={<RequestsList />} />
            <Route path="requests/new" element={<NewRequest />} />
            <Route path="requests/:id" element={<RequestDetail />} />
            <Route path="approvals" element={<ApprovalsInbox />} />
            <Route path="approvals/:id" element={<ApprovalDetail />} />
            <Route path="suppliers" element={<SuppliersList />} />
            <Route path="suppliers/new" element={<AddSupplier />} />
            <Route path="suppliers/:id" element={<SupplierProfile />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="screens" element={<ScreenIndex />} />
            <Route path="design-system" element={<DesignSystem />} />
            <Route path="*" element={<NotFound what="page" back="/" />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
