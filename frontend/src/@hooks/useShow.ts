import {
  BaseRecord,
  HttpError,
  UseShowProps,
  UseShowReturnType,
} from "@refinedev/core";
import { useShow as useRefineCoreShow } from "@refinedev/core";
import { useParams } from "react-router";

export const useRefineShow = <
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TData extends BaseRecord = TQueryFnData
>(
  props: UseShowProps<TQueryFnData, TError, TData> = {}
): UseShowReturnType<TData, TError> => {
  const { id } = useParams();
  if (Boolean(props?.id) === false && id) {
    props["id"] = id;
  }
  return useRefineCoreShow(props);
};
