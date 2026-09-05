import {
  BaseRecord,
  GetOneResponse,
  HttpError,
  UseLoadingOvertimeReturnType,
  UseOneProps,
} from "@refinedev/core";
import { useOne as useRefineCoreOne } from "@refinedev/core";
import { useParams } from "react-router";
import { type QueryObserverResult } from "@tanstack/react-query";
export const useRefineOne = <
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TData extends BaseRecord = TQueryFnData
>(
  props: UseOneProps<TQueryFnData, TError, TData>
): QueryObserverResult<GetOneResponse<TData>, TError> &
  UseLoadingOvertimeReturnType => {
  const { id } = useParams();
  if (Boolean(props?.id) === false && id) {
    props.id = id;
  }
  return useRefineCoreOne(props);
};
