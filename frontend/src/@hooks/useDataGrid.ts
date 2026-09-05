import { BaseRecord, CrudFilter, HttpError } from "@refinedev/core";
import {
  useDataGrid,
  UseDataGridProps,
  UseDataGridReturnType,
} from "@refinedev/mui";
import { useEffect, useState } from "react";

export function useRefineDataGrid<
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TSearchVariables = unknown,
  TData extends BaseRecord = TQueryFnData,
>(
  props: UseDataGridProps<TQueryFnData, TError, TSearchVariables, TData> = {},
): UseDataGridReturnType<TData, TError, TSearchVariables> {
  const [localFilter, setLocalFilter] = useState<CrudFilter[]>([]);
  const propsOut = useDataGrid({
    ...props,
    pagination: {
      ...props.pagination,
      pageSize: props.pagination?.pageSize ?? 100,
    },
    // queryOptions: {
    //   staleTime: 30 * 1000,
    //   ...props.queryOptions,
    // },
  });

  // Refine free-tier data provider only applies one filter on the initial request.
  // Re-calling setFilters once after mount forces a second request that carries all filters.
  useEffect(() => {
    const timer = setTimeout(() => {
      propsOut.setFilters(localFilter);
    }, 10);
    // propsOut.setFilters(localFilter);
    return () => clearTimeout(timer);
    console.log(localFilter, "localFilter");
  }, [localFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      propsOut.setFilters(propsOut.filters);
    }, 10);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...propsOut, setFilters: setLocalFilter };
}
