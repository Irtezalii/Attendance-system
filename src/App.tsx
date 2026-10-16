import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import type { Role } from "../shared/api";
import { Layout } from "./components/Layout";
import { LoadingState } from "./components/ui";
import { useAuth } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { EditSession } from "./pages/faculty/EditSession";
import { FacultyDashboard } from "./pages/faculty/FacultyDashboard";
import { NewSession } from "./pages/faculty/NewSession";
import { OfferingDetail } from "./pages/faculty/OfferingDetail";
import { StudentAttendance } from "./pages/faculty/StudentAttendance";
import { StudentCourseDetail } from "./pages/student/StudentCourseDetail";
import { StudentDashboard } from "./pages/student/StudentDashboard";

/**
 * Client-side guard for navigation only. The Worker enforces every permission
 * itself; this just keeps users on pages that match their role.
 */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me.user.role !== role) return <Navigate to={me.user.role === "student" ? "/student" : "/faculty"} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { me, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!me) return <Navigate to="/login" replace />;
  return <Navigate to={me.user.role === "student" ? "/student" : "/faculty"} replace />;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <Link to="/" className="text-indigo-600 hover:underline">
        Go to your dashboard
      </Link>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <LoadingState />;

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/student"
        element={
          <RequireRole role="student">
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="courses/:offeringId" element={<StudentCourseDetail />} />
      </Route>
      <Route
        path="/faculty"
        element={
          <RequireRole role="faculty">
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<FacultyDashboard />} />
        <Route path="offerings/:offeringId" element={<OfferingDetail />} />
        <Route path="offerings/:offeringId/sessions/new" element={<NewSession />} />
        <Route path="offerings/:offeringId/students/:enrollmentId" element={<StudentAttendance />} />
        <Route path="sessions/:sessionId" element={<EditSession />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
