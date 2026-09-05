import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  IFiltersState,
  IRemoveFilterProps,
  IUseFiltersResult,
} from "src/components/filters-result/interface";
type Props = {
  defaultFilter?: Record<string, any>;
  queryFields?: string[];
};
export const useFilter = ({
  defaultFilter = {},
  queryFields = [],
}: Props = {}): IUseFiltersResult => {
  const [searchParams] = useSearchParams();
  const initialFilter = () => {
    const result: Record<string, any> = {};
    let i = 0;
    while (searchParams.has(`filters[${i}][field]`)) {
      const field = searchParams.get(`filters[${i}][field]`)!;
      const value = searchParams.get(`filters[${i}][value]`);
      if (field && value !== null) result[field] = value;
      i++;
    }
    return Object.keys(result).length > 0 ? result : defaultFilter ?? {};
  };
  const localDefaultFilter = initialFilter();
  const [lister, setLister] = useState<IFiltersState>({
    isOpen: false,
    search: "",
    labels: {},
    filters: localDefaultFilter,
    isLoading: false,
    totalResults: 0,
  });

  const getLabels = () => {
    return Object.keys(lister.filters).map((key) => {
      if (Array.isArray(lister.filters[key])) {
        return {
          label: lister.labels[key],
          name: key,
          value: lister.filters[key],
        };
      }
      if (typeof lister.filters[key] === "object") {
        return {
          label: lister.labels[key],
          name: key,
          value: lister.filters[key].name,
        };
      }
      return {
        label: lister.labels[key],
        name: key,
        value: lister.filters[key],
      };
    });
  };

  const resetFilter = () => {
    setLister((prev) => ({
      ...prev,
      filters: defaultFilter,
      // search: "",
    }));
  };

  const getDataGridFilter = () => {
    const filter = Object.keys(lister.filters).map((key) => {
      if (Array.isArray(lister.filters[key])) {
        return {
          field: key,
          operator: "eq",
          value: lister.filters[key],
        };
      }
      if (typeof lister.filters[key] === "object") {
        return {
          field: key,
          operator: "eq",
          value: lister.filters[key].value,
        };
      }
      return {
        field: key,
        operator: "eq",
        value: lister.filters[key],
      };
    });
    return filter;
  };

  const clearFilterField = (key: IRemoveFilterProps) => {
    if (key === "all") {
      setLister((prev) => ({
        ...prev,
        filters: {},
        search: "",
      }));
      return;
    }
    if (key === "search") {
      setLister((prev) => ({
        ...prev,
        search: "",
        filters: Object.keys(lister.filters).reduce((acc, filter) => {
          if (!queryFields.includes(filter)) {
            acc[filter] = lister.filters[filter];
          }
          return acc;
        }, {} as Record<string, any>),
      }));
      return;
    }
    const { [key]: _, ...rest } = lister.filters;
    setLister((prev) => ({
      ...prev,
      filters: rest,
    }));
  };

  const setLabels = (labels: Record<string, string>) => {
    setLister((prev) => ({
      ...prev,
      labels: labels,
    }));
  };

  const setFormFields = (fields: Record<string, any>) => {
    const formFields = Object.keys(fields).reduce((acc, key) => {
      const value = fields[key];
      if (value !== "" && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    setLister((prev) => ({
      ...prev,
      filters: formFields,
    }));
  };

  const setSearch = (search: string) => {
    const searchText = search.trim();
    if (searchText.length === 0) {
      const filters = Object.keys(lister.filters).reduce((acc, filter) => {
        if (!queryFields.includes(filter)) {
          acc[filter] = lister.filters[filter];
        }
        return acc;
      }, {} as Record<string, any>);
      setLister((prev) => ({
        ...prev,
        search: "",
        filters: filters,
      }));
      return;
    }
    const searchFilters =
      queryFields.reduce((acc, field) => {
        acc[field] = searchText;
        return acc;
      }, {} as Record<string, any>) ?? {};

    setLister((prev) => ({
      ...prev,
      search: search.trim(),
      filters: {
        ...lister.filters,
        ...searchFilters,
      },
    }));
  };

  return {
    filterTableProps: {
      lister: lister.filters,
      setQuery: (tableQuery: any) => {
        setLister((prev) => ({
          ...prev,
          isLoading: tableQuery.isLoading,
          totalResults: tableQuery.data?.total || 0,
        }));
      },
      getDataGridFilter,
    },
    filterButtonProps: {
      clearFilterField,
      defaultFilter: defaultFilter,
      isOpen: lister.isOpen,
      totalResults: lister.totalResults,
      filters: lister.filters,
      getLabels,
      onClose: () => {
        setLister((prev) => ({
          ...prev,
          isOpen: false,
        }));
      },
      onOpen: () => {
        setLister((prev) => ({
          ...prev,
          isOpen: true,
        }));
      },
      children: null, // Add a default value for children, or pass the appropriate ReactNode as needed
    },
    filterFromProps: {
      resetFilter,
      setLabels,
      filters: lister.filters,
      setFormFields,
      isLoading: lister.isLoading,
      onClose: () => {
        setLister((prev) => ({
          ...prev,
          isOpen: false,
        }));
      },
    },
    search: lister.search,
    setSearch,
  };
};
