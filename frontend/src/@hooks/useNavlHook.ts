import {
  Action,
  MetaQuery,
  useGetToPath,
  useGo,
  useNavigation,
} from "@refinedev/core";
import { useLocation, useSearchParams } from "react-router-dom";

export const useNav = (url: string = "list", action: Action = "list") => {
  const go = useGo();
  const { pathname, search } = useLocation();
  const { editUrl, createUrl, showUrl } = useNavigation();
  const getToPath = useGetToPath();

  const currentPathWithSearch = search ? `${pathname}${search}` : pathname;

  const edit = (id: string, meta?: MetaQuery) => {
    return go({
      to: `${editUrl(url, id, meta)}`,
      query: {
        to: currentPathWithSearch,
      },
      options: {
        keepQuery: true,
      },
      type: "push",
    });
  };

  const close = () => {
    return go({
      to: getToPath({ action }) ?? "",
      query: {
        to: undefined,
      },
      options: {
        keepQuery: true,
      },
      type: "push",
    });
  };

  const create = () => {
    return go({
      to: `${createUrl(url)}`,
      query: {
        to: currentPathWithSearch,
      },
      options: {
        keepQuery: true,
      },
      type: "push",
    });
  };

  const show = (id: string, meta?: MetaQuery) => {
    return go({
      to: `${showUrl(url, id, meta)}`,
      query: {
        to: currentPathWithSearch,
      },
      options: {
        keepQuery: true,
      },
      type: "push",
    });
  };

  return { edit, close, create, show };
};
