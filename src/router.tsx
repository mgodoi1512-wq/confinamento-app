import { AppShell } from "./components/app/app-shell";
import { ProtectedRoute } from "./components/auth/protected-route";
import Animals from "./pages/animals";
import SettingsHome from "./pages/config";
import SettingsDiets from "./pages/config/diets";
import SettingsPens from "./pages/config/pens";
import SettingsUsers from "./pages/config/users";
import Dashboard from "./pages/dashboard";
import Feed from "./pages/feed";
import ReadingRound from "./pages/feed/reading";
import Occurrences from "./pages/health/occurrences";
import Protocols from "./pages/health/protocols";
import Treatments from "./pages/health/treatments";
import Login from "./pages/login";
import Lots from "./pages/lots";
import LotDetail from "./pages/lots/detail";
import NewLot from "./pages/lots/new";
import NotFound from "./pages/NotFound";
import Pens from "./pages/pens";
import Weighings from "./pages/weighings";
import WeighingDetail from "./pages/weighings/detail";
import NewWeighing from "./pages/weighings/new";

export const routers = [
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
