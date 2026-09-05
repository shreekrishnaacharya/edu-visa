import { useTranslation } from "react-i18next";

export const useTranslate = (module?: string, section?: string) => {
  const { t: translate } = useTranslation(module ?? "common");

  const t = (
    path: string,
    options?: { ns?: string } & Record<string, any> // allows passing both `ns` and interpolation values
  ): any => {
    if (path[0] === "@") {
      return translate(path.slice(1), {
        ns: "common",
        ...options,
      });
    }

    const nsOption = options?.ns ?? module;
    const pathWithSection = !options?.ns && section ? `${section}.${path}` : path;

    return translate(pathWithSection, {
      ns: nsOption,
      ...options,
    });
  };

  return t;
};
