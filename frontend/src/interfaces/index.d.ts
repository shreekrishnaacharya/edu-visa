import type { Dayjs } from "dayjs";
import { Gender } from "../common/all.enum";
import { SaveButtonProps } from "@refinedev/mui";
import { StatusEnum, YesNoEnum } from "@common/all.enum";
import { IStaff } from "@employee/interface";

export interface IUser {
  id: string;
  name: string;
  address: string;
  image?: IFileResponse;
  email: string;
  phone: string;
  staff?: any;
  status: StatusEnum;
  account_type: string;
  password?: string;
  roles: any[];
}

export interface IOrganization {
  name: string;
  code: string;
  about: string;
  address: string;
  locations: { lat: string; lng: string };
  email1: string;
  email2: string;
  phone1: string;
  phone2: string;
  web_link: string;
  fb_link: string;
  yt_link: string;
  x_link: string;
  ins_link: string;
  linkedin_link: string;
  app_features?: string[];
  image: IFileResponse;
  cimage: IFileResponse;
}
export interface IRecord {
  id: string;
  status: StatusEnum;
  read?: YesNo;
  [key: string]: string | number | any;
}

type INakedFunction = (values: object) => void;

type IStatusHook = [IRecord, INakedFunction, boolean];

export type ATFormProps = {
  id?: BaseKey;
  open?: boolean;
  action: "create" | "edit";
  onClose?: any;
  setActionProps?: (props: SaveButtonProps) => void;
  onMutationSuccess?: any;
  defaultValues?: any;
};

export type DialogSaveButtonProps = SaveButtonProps & {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export type TableListProp = {
  search?: string;
  lister?: IFiltersState;
  getDataGridFilter?: () => CrudFilter[];
  setQuery?: (query: { isLoading: boolean; data: any }) => void;
};

export interface IResourceRecord {
  resource?: string;
  record: IRecord;
}

export interface ISwitcher {
  resource?: string;
  record: IRecord;
}

interface ITextEditor {
  value?: string;
  onChange?: Function;
  plugins?: string;
  menubar?: string;
  toolbar?: string;
  options?: {};
}

export interface IUploadImage {
  reset?: boolean;
  title: string;
  validation?: string;
  avatar?: UploadFile;
  accept?: string;
  onRemove?: FunctionWithIFileArgument;
  onChange?: FunctionWithIFileArgument;
  fileList?: IFile;
}

export interface ICoordinate {
  lat: string;
  lng: string;
}

export interface IExtraAddress {
  name: string;
  placeId: string;
  coordinates?: ICoordinate;
  city?: string;
  country?: string;
  state?: string;
}

export interface IFileResponse {
  id?: string;
  uid: string;
  name: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
}

export interface IFile {
  lastModified?: number;
  name: string;
  percent?: number;
  size: number;
  status?: "error" | "success" | "done" | "uploading" | "removed";
  type: string;
  uid?: string;
  url: string;
}

export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type ExcelJsonType = Record<string, string>[];

export interface IAcademicYear {
  name: string;
}

export interface IDataActivityReportDto {
  name: string;
  categories: string[];
  data: {
    name: string;
    data: number[];
  }[];
}

export class IPieReportDto {
  name: string;
  data: {
    label: string;
    value: number;
  }[];
}

export interface ILanguageFlags {
  code: string;
  name: string;
  flag: string;
}

export type IDatePickerControl = Dayjs | null;

export type IDateValue = string | number | null;

export type ImportColumnAttributes = {
  required: string[] | boolean;
  type: string;
  width?: number;
  format?: string;
  length?: number;
  options?: string[];
  raw?: boolean;
  transform?: (
    value: any,
    column: string,
    attribute: ImportColumnAttributes,
  ) => any;
};

export type ImportColumnType = {
  [key: string]: ImportColumnAttributes;
};

export interface IOrgDetails {
  name: string;
  code: string;
  address: string;
  regid: string;
  email1: string;
  email2?: string;
  phone1: string;
  phone2?: string;
  image?: IFileResponse;
}
