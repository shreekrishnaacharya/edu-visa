import packageJson from "../package.json";

// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  serverUrl: string;
  assetsDir: string;
  mapboxApiKey: string;
  defaultUser: string;
};

// ----------------------------------------------------------------------

export const CONFIG: ConfigValue = {
  appName: "Edu-Visa",
  appVersion: packageJson.version,
  serverUrl: import.meta.env.VITE_SERVER_URL ?? "",
  assetsDir: import.meta.env.VITE_ASSETS_DIR ?? "",
  defaultUser: `/assets/icons/apps/ic-app-manager.png`,
  /**
   * Mapbox
   */
  mapboxApiKey: import.meta.env.VITE_MAPBOX_API_KEY ?? "",
};
