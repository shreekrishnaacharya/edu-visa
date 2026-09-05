import { BaseRecord, HttpError } from "@refinedev/core";
import { UseFormProps, UseFormReturnType } from "@refinedev/react-hook-form";
import { FieldValues } from "react-hook-form";
import { useParams } from "react-router";
import { useForm as useFormHook } from "@refinedev/react-hook-form";
export const useRefineForm = <
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TVariables extends FieldValues = FieldValues,
  TContext extends object = {},
  TData extends BaseRecord = TQueryFnData,
  TResponse extends BaseRecord = TData,
  TResponseError extends HttpError = TError
>(
  props: UseFormProps<
    TQueryFnData,
    TError,
    TVariables,
    TContext,
    TData,
    TResponse,
    TResponseError
  > = {}
): UseFormReturnType<
  TQueryFnData,
  TError,
  TVariables,
  TContext,
  TData,
  TResponse,
  TResponseError
> => {
  const { id } = useParams();
  if (
    Boolean(props?.refineCoreProps?.id) === false &&
    props?.refineCoreProps?.action === "edit" &&
    id
  ) {
    props.refineCoreProps.id = id;
  }
  return useFormHook(props);
};
