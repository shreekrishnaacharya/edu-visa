import "src/global.css";

import { Refine } from "@refinedev/core";
import {
  RefineSnackbarProvider,
  useNotificationProvider,
} from "@refinedev/mui";
import routerBindings, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { useTranslation } from "react-i18next";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";

import { themeConfig, ThemeProvider } from "./theme";
import { defaultSettings, SettingsProvider } from "./components/settings";
import { dataProvider } from "./_service/dataProvider";
import { axiosInstance } from "./_service/axious";
import { BASE_URL } from "@common/options";
import { authProvider } from "./authProvider";
import { accessControlProvider } from "./accessControlProvider";
import { resources } from "./resources";
import { CONFIG } from "./global-config";

type AppProps = { children: React.ReactNode };

function App({ children }: AppProps) {
  const { t, i18n } = useTranslation();

  const i18nProvider = {
    translate: (key: string, params: object) => t(key, params) as string,
    changeLocale: (lang: string) => i18n.changeLanguage(lang),
    getLocale: () => i18n.language,
  };

  return (
    <SettingsProvider defaultSettings={defaultSettings}>
      <ThemeProvider
        modeStorageKey={themeConfig.modeStorageKey}
        defaultMode={themeConfig.defaultMode}
      >
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
        <RefineSnackbarProvider>
          <Refine
            i18nProvider={i18nProvider}
            dataProvider={dataProvider(BASE_URL, axiosInstance)}
            notificationProvider={useNotificationProvider}
            accessControlProvider={accessControlProvider}
            routerProvider={routerBindings}
            authProvider={authProvider}
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              useNewQueryKeys: true,
              disableTelemetry: true,
            }}
          >
            {children}
            <UnsavedChangesNotifier />
            <DocumentTitleHandler
              handler={({ resource, action }) => {
                const base = CONFIG.appName;
                if (resource && action) {
                  return `${resource.meta?.label ?? resource.name} · ${action} | ${base}`;
                }
                return base;
              }}
            />
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
