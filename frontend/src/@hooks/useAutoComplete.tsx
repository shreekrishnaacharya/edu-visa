import { BaseRecord, HttpError } from "@refinedev/core";
import {
  UseAutocompleteProps,
  useAutocomplete,
  UseAutocompleteReturnType,
} from "@refinedev/mui";

export const useAutoCompleteRefine = <
  TQueryFnData extends BaseRecord = any,
  TError extends HttpError = HttpError,
  TData extends BaseRecord = TQueryFnData,
>(
  props: UseAutocompleteProps<TQueryFnData, TError, TData>,
): UseAutocompleteReturnType<TData> => {
  return useAutocomplete<TQueryFnData, TError, TData>({
    ...props,
    pagination: {
      ...props.pagination,
      pageSize: props.pagination?.pageSize || 25,
    },
    queryOptions: {
      staleTime: 3 * 60 * 1000,
      ...props.queryOptions,
    },
  });
};
