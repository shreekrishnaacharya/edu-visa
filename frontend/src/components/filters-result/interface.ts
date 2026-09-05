import { FiltersResultProps } from "./filters-result";

export interface IFilterFormProps {
  resetFilter: () => void;
  filters: Record<string, any>;
  isLoading: boolean;
  onClose: () => void;
  setLabels: (labels: Record<string, string>) => void;
  setFormFields?: (fields: Record<string, IFilterFormFields>) => void;
}
export interface IFilterFormFields {
  label: string;
  value: any;
}

export interface IFiltersState {
  isOpen: boolean;
  search: string;
  labels: Record<string, string>;
  filters: Record<string, any>;
  isLoading: boolean;
  totalResults: number;
}

export type IRemoveFilterProps = string | "all";

export type IFilterButtonProps = {
  isOpen: boolean;
  getLabels: () => { label: string; value: any; name: string }[];
  filters: Record<string, any>;
  defaultFilter: Record<string, any>;
  clearFilterField: (key: IRemoveFilterProps) => void;
  totalResults: number;
  onOpen: () => void;
  onClose: () => void;
  children?: React.ReactElement | undefined | null;
};

export interface IFilterTableProps {
  lister: Record<string, any>;
  setQuery: (tableQuery: any) => void;
  getDataGridFilter: () => { field: string; operator: string; value: any }[];
}

export interface IUseFiltersResult {
  filterTableProps: IFilterTableProps;
  filterButtonProps: IFilterButtonProps;
  filterFromProps: IFilterFormProps;
  search: string;
  setSearch: (search: string) => void;
}
