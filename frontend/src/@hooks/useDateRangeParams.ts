import { useSearchParams } from "react-router";

interface UseDateRangeParamsOptions {
  /** Default start of range when no `from` URL param is present. */
  defaultDaysAgo?: number;
}

/**
 * Date range state mirrored into `?from=&to=` URL params, so a refresh or a
 * shared link restores the same filter instead of resetting to defaults.
 */
export function useDateRangeParams(options?: UseDateRangeParamsOptions) {
  const { defaultDaysAgo = 6 } = options ?? {};
  const [searchParams, setSearchParams] = useSearchParams();

  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";

  const dateRange = {
    startDate:
      fromParam ||
      new Date(
        new Date().setDate(new Date().getDate() - defaultDaysAgo),
      ).toISOString(),
    endDate: toParam || new Date().toISOString(),
  };

  const setDateRange = (startDate: string, endDate: string) => {
    const params = new URLSearchParams(searchParams);
    if (startDate) params.set("from", startDate);
    else params.delete("from");
    if (endDate) params.set("to", endDate);
    else params.delete("to");
    setSearchParams(params, { replace: true });
  };

  return { dateRange, setDateRange };
}
