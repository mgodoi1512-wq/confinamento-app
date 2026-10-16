import { lazy } from "react";
import { AppShell } from "./components/app/app-shell";
import { ProtectedRoute } from "./components/auth/protected-route";
const Finance = lazy(() => import("./pages/management/finance"));
const Adaptation = lazy(() => import("./pages/feed/adaptation"));
const Administration = lazy(() => import("./pages/admin"));
const Animals = lazy(() => import("./pages/animals"));
const SettingsHome = lazy(() => import("./pages/config"));
const SettingsDiets = lazy(() => import("./pages/config/diets"));
const SettingsPens = lazy(() => import("./pages/config/pens"));
const SettingsUsers = lazy(() => import("./pages/config/users"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const Feed = lazy(() => import("./pages/feed"));
const ReadingRound = lazy(() => import("./pages/feed/reading"));
const Occurrences = lazy(() => import("./pages/health/occurrences"));
const Protocols = lazy(() => import("./pages/health/protocols"));
const Treatments = lazy(() => import("./pages/health/treatments"));
const PasswordRecovery = lazy(() => import("./pages/password-recovery"));
const ResetPassword = lazy(() => import("./pages/password-recovery/reset"));
const Login = lazy(() => import("./pages/login"));
const Lots = lazy(() => import("./pages/lots"));
const LotDetail = lazy(() => import("./pages/lots/detail"));
const NewLot = lazy(() => import("./pages/lots/new"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pens = lazy(() => import("./pages/pens"));
const Weighings = lazy(() => import("./pages/weighings"));
const WeighingDetail = lazy(() => import("./pages/weighings/detail"));
const NewWeighing = lazy(() => import("./pages/weighings/new"));

export const routers = [
  { path: "/recuperar-senha", name: "passwordRecovery", element: <PasswordRecovery /> },
  { path: "/redefinir-senha", name: "resetPassword", element: <ResetPassword /> },
  {
    path: "/login",
    name: "login",
    element: <Login />,
  },
  {
    path: "/",
    name: "protected",
    element: <ProtectedRoute />,
    children: [
      { path: "admin", name: "administration", element: <Administration /> },
      {
        path: "",
        name: "app",
        element: <AppShell />,
        children: [
          { path: "", name: "dashboard", element: <Dashboard /> },
          { path: "currais", name: "pens", element: <Pens /> },
          { path: "lotes", name: "lots", element: <Lots /> },
          { path: "lotes/novo", name: "lotNew", element: <NewLot /> },
          { path: "lotes/:id", name: "lotDetail", element: <LotDetail /> },
          { path: "animais", name: "animals", element: <Animals /> },
          { path: "pesagens", name: "weighings", element: <Weighings /> },
          { path: "pesagens/nova", name: "weighingNew", element: <NewWeighing /> },
          { path: "pesagens/:id", name: "weighingDetail", element: <WeighingDetail /> },
          { path: "trato", name: "feed", element: <Feed /> },
          { path: "gestao/financeiro", name: "finance", element: <Finance /> },
          { path: "nutricao/adaptacao", name: "adaptation", element: <Adaptation /> },
          { path: "trato/leitura", name: "feedReading", element: <ReadingRound /> },
          { path: "sanidade/protocolos", name: "protocols", element: <Protocols /> },
          { path: "sanidade/tratamentos", name: "treatments", element: <Treatments /> },
          { path: "sanidade/ocorrencias", name: "occurrences", element: <Occurrences /> },
          { path: "config", name: "settings", element: <SettingsHome /> },
          { path: "config/usuarios", name: "settingsUsers", element: <SettingsUsers /> },
          { path: "config/currais", name: "settingsPens", element: <SettingsPens /> },
          { path: "config/dietas", name: "settingsDiets", element: <SettingsDiets /> },
        ],
      },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
