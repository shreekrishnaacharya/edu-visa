import {
  Autocomplete,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  MenuItem,
  Rating,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  Grid2 as Grid,
} from "@mui/material";
import { Controller } from "react-hook-form";

import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import { Box } from "@mui/material";
import { MuiColorInput } from "mui-color-input";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import * as React from "react";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import { RadioGroup } from "@mui/material";
import { createFilterOptions } from "@mui/material/Autocomplete";
import { getError, getLabel } from "./functions";
import { InputAdornment } from "@mui/material";
import { ClearIcon } from "@mui/x-date-pickers/icons";
import { YesNoEnum } from "@common/all.enum";
import { Iconify } from "src/components/iconify";
import { useBoolean } from "minimal-shared/hooks";
import { useEffect } from "react";
import { CSDatePicker, CSDateTimePicker } from "./dateinput";
import { styled } from "@mui/material/styles";

const soloFilter = createFilterOptions();

type CSInputSizeProps = "small" | "medium";
interface ICSInput {
  showError?: boolean;
  hasLabel?: boolean;
  slotProps?: any;
  capital?: boolean;
  inputRef?: any;
  disabled?: boolean;
  multiline?: number;
  required?: boolean;
  type?: string;
  fullWidth?: boolean;
  control: any;
  onChange?: any;
  defaultValue?: any;
  renderLabel?: any;
  touched?: any;
  placeholder?: any;
  variant?: any;
  rules?: any;
  name: string;
  size?: CSInputSizeProps;
  label?: string;
  errors?: any;
  error?: any;
  id?: string;
  min?: number;
  max?: number;
  textAlign?: "left" | "center" | "right";
  mini?: boolean;
}

interface ICSLabel {
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  defaultValue?: any;
  placeholder?: any;
  variant?: any;
  size?: CSInputSizeProps;
  label: string;
  id?: string;
}

interface ICSHiddenInput {
  control: any;
  defaultValue?: any;
  name: string;
  label?: string;
  required?: boolean;
  rules?: any;
  errors?: any;
  error?: any;
  showError?: boolean;
}

interface ICSSelect extends ICSInput {
  children?: any;
  multiple?: boolean;
  /** Max chips shown before collapsing to "+N more". Only applies when multiple. */
  maxVisibleTags?: number;
}

interface ICSRadio extends ICSInput {
  children?: any;
  row?: boolean;
}
interface ICSCheckBox extends ICSInput {
  children?: any;
  defaultValue?: any;
  row?: boolean;
  items?: { label: string; value: string }[];
  checkedValue?: any;
  firstLabel?: string;
  secondLabel?: string;
}

interface ICSNumber extends ICSInput {
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
}

interface ICSDatePicker extends ICSInput {
  format?: string;
}

interface ICSDateRangePicker extends Omit<ICSInput, "defaultValue"> {
  format?: string;
  fromValue?: any;
  toValue?: any;
  fromLabel?: string;
  toLabel?: string;
}

interface ICSTime extends ICSInput {
  format?: string;
  ampm?: boolean;
}

interface ICSAutoComplete extends ICSInput {
  autocompleteProps?: any;
  getOptionLabel?: any;
  isOptionEqualToValue?: any;
  multiple?: boolean;
  groupBy?: any;
  renderLabel?: any;
  filterOptions?: any;
  getOptionDisabled?: any;
  /** When true and multiple, prepends a "Select All / Deselect All" option. */
  selectAll?: boolean;
  /** Max chips shown before collapsing to "+N more". Only applies when multiple. */
  maxVisibleTags?: number;
}

interface ICSSoloComplete extends ICSInput {
  autocompleteProps?: any;
  getOptionLabel?: any;
  renderLabel?: any;
  onInputChange?: any;
}

interface ICSSearch {
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export const CSSearch = (props: ICSSearch) => {
  const { onChange, value, placeholder } = props;
  const [search, setSearch] = React.useState<string>(value ?? "");
  useEffect(() => {
    if (value === "") {
      setSearch("");
    }
  }, [value]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange(search);
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          outline: "1px solid #eee",
          borderRadius: 5,
          width: 250,
        }}
      >
        <InputBase
          name="search"
          type="search"
          sx={{ ml: 2, flex: 1 }}
          value={search}
          size="small"
          placeholder={placeholder}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          inputProps={{ "aria-label": "search" }}
        />
        <IconButton type="submit" sx={{ p: "7px" }} aria-label="search">
          <SearchIcon />
        </IconButton>
      </Box>
    </form>
  );
};

export const CSHiddenInput = (props: ICSHiddenInput) => {
  const {
    name,
    control,
    defaultValue,
    label,
    rules,
    required,
    errors,
    error,
    showError = false,
  } = props;
  if (!showError) {
    return (
      <Controller
        control={control}
        name={name}
        rules={{
          ...rules,
          ...(required ? { required: `${label} is required` } : {}),
        }}
        defaultValue={defaultValue}
        render={({ field }) => {
          return (
            <input
              {...field}
              type={"hidden"}
              value={defaultValue}
              id={`${name}-id`}
            />
          );
        }}
      />
    );
  }
  return (
    <FormControl sx={{ mt: -2 }}>
      <Controller
        control={control}
        name={name}
        rules={{
          ...rules,
          ...(required ? { required: `${label} is required` } : {}),
        }}
        defaultValue={defaultValue}
        render={({ field }) => {
          return (
            <input
              {...field}
              type={"hidden"}
              value={defaultValue}
              id={`${name}-id`}
            />
          );
        }}
      />
      {getError(error ?? errors?.[name])}
    </FormControl>
  );
};

export const CSLabel = (props: ICSLabel) => {
  const { size, fullWidth, required, variant, id, label, defaultValue } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <TextField
          disabled={true}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{
            backgroundColor: "#fff",
          }}
          value={defaultValue}
          variant={variant ?? "outlined"}
          id={id}
          label={getLabel(label, required)}
          size={size ?? "small"}
        />
      </FormControl>
    </Box>
  );
};

export const CSInput = (props: ICSInput) => {
  const {
    slotProps,
    control,
    error,
    capital,
    disabled,
    inputRef,
    showError = true,
    hasLabel = true,
    mini,
    min,
    max,
    textAlign = "left",
    multiline,
    type,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  const isNumberType = type === "number";
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required
              ? { required: `${label ?? placeholder} is required` }
              : {}),
          }}
          render={({ field }) => {
            return (
              <TextField
                {...field}
                multiline={Boolean(multiline)}
                rows={multiline}
                type={type ?? "text"}
                onChange={(e) => {
                  capital && (e.target.value = e.target.value.toUpperCase());
                  onChange ? onChange(e, field) : field.onChange(e);
                }}
                disabled={disabled}
                variant={variant ?? "outlined"}
                id={id ?? `${name}-id`}
                label={getLabel(label, required)}
                size={size ?? "small"}
                placeholder={placeholder}
                inputRef={inputRef}
                sx={{
                  backgroundColor: "#fff",
                  ...(!showError && Boolean(error || errors?.[name])
                    ? {
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "red",
                        },
                      }
                    : {}),
                }}
                slotProps={{
                  inputLabel: {
                    shrink: !!field.value,
                    sx: {
                      ...(mini ? { padding: "4px 0px", lineHeight: 0 } : {}),
                    },
                  },
                  input: {
                    maxLength: max,
                    minLength: min,
                    className: "sdncskdjvsdjvnldsj",
                    sx: {
                      textAlign: textAlign,
                    },
                  },
                  ...slotProps,
                  htmlInput: {
                    sx: { ...(mini ? { padding: "4px 10px" } : {}) },
                    autoComplete: "off",
                    ...slotProps?.htmlInput,
                    ...(isNumberType && {
                      inputMode: "decimal",
                      pattern: "[0-9]*\\.?[0-9]*",
                    }),
                  },
                }}
              />
            );
          }}
        />
        {showError && getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSPassword = (props: ICSInput) => {
  const showPassword = useBoolean();
  const {
    control,
    error,
    disabled,
    inputRef,
    mini,
    min,
    max,
    textAlign = "left",
    multiline,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required
              ? { required: `${label ?? placeholder} is required` }
              : {}),
          }}
          render={({ field }) => {
            return (
              <TextField
                {...field}
                multiline={Boolean(multiline)}
                rows={multiline}
                type={showPassword.value ? "text" : "password"}
                onChange={(e) => {
                  onChange ? onChange(e, field) : field.onChange(e);
                }}
                disabled={disabled}
                variant={variant ?? "outlined"}
                id={id ?? `${name}-id`}
                label={getLabel(label, required)}
                size={size ?? "small"}
                placeholder={placeholder}
                inputRef={inputRef}
                sx={{
                  backgroundColor: "#fff",
                }}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                    sx: {
                      ...(mini ? { padding: "10px 0px", lineHeight: 0 } : {}),
                    },
                  },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={showPassword.onToggle} edge="end">
                          <Iconify
                            icon={
                              showPassword.value
                                ? "solar:eye-bold"
                                : "solar:eye-closed-bold"
                            }
                          />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                InputProps={{
                  inputProps: {
                    maxLength: max,
                    minLength: min,
                    sx: {
                      textAlign: textAlign,
                      ...(mini ? { padding: "4px 10px" } : {}),
                    },
                  },
                }}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};
export const CSRating = (props: ICSInput) => {
  const {
    control,
    error,
    disabled,
    type,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            return (
              <Rating
                {...field}
                onChange={onChange ?? field.onChange}
                disabled={disabled}
                size={size ?? "small"}
                id={id ?? `${name}-id`}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSSoloComplete = (props: ICSSoloComplete) => {
  const {
    control,
    disabled,
    onInputChange,
    error,
    renderLabel,
    autocompleteProps,
    getOptionLabel,
    type,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            return (
              <Autocomplete
                {...autocompleteProps}
                {...field}
                freeSolo
                onChange={(event, newValue: any) => {
                  onChange
                    ? onChange(newValue, field)
                    : field.onChange(newValue); // Pass the whole object to the form
                }}
                value={field.value}
                onInputChange={onInputChange}
                getOptionLabel={getOptionLabel}
                placeholder={placeholder}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    {option.inputValue
                      ? option.title
                      : renderLabel?.(option) ?? option.name}
                  </li>
                )}
                filterOptions={(options, params) => {
                  const filtered = soloFilter(options, params);
                  if (params.inputValue !== "") {
                    filtered.push({
                      inputValue: params.inputValue,
                      title: `Add "${params.inputValue}"`,
                    });
                  }
                  return filtered;
                }}
                disabled={disabled}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    // InputLabelProps={{
                    //     shrink: !!field.value
                    // }}
                    disabled={disabled}
                    label={getLabel(label, required)}
                    size={size ?? "small"}
                    variant={variant ?? "outlined"}
                  />
                )}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

const _CS_SELECT_ALL_ID = "__cs_select_all__";

export const CSAutoComplete = (props: ICSAutoComplete) => {
  const {
    control,
    disabled,
    error,
    getOptionDisabled,
    renderLabel,
    multiple,
    groupBy,
    isOptionEqualToValue,
    autocompleteProps,
    getOptionLabel,
    filterOptions,
    selectAll,
    maxVisibleTags,
    type,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;

  const allOptions: any[] = autocompleteProps?.options ?? [];

  const effectiveFilterOptions =
    selectAll && multiple
      ? (options: any[], state: any) => {
          const base = filterOptions ? filterOptions(options, state) : options;
          return [{ id: _CS_SELECT_ALL_ID } as any, ...base];
        }
      : filterOptions;

  const effectiveIsEqual = (opt: any, val: any) => {
    if (opt?.id === _CS_SELECT_ALL_ID || val?.id === _CS_SELECT_ALL_ID)
      return opt?.id === val?.id;
    return (isOptionEqualToValue ?? ((o: any, v: any) => o.id === v.id))(
      opt,
      val,
    );
  };

  const effectiveGetOptionLabel = (option: any) => {
    if (option?.id === _CS_SELECT_ALL_ID) return "Select All";
    return getOptionLabel ? getOptionLabel(option) : option?.name ?? "";
  };

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            const selectedArr: any[] = Array.isArray(field.value)
              ? field.value
              : [];
            const allSelected =
              selectAll &&
              multiple &&
              selectedArr.length === allOptions.length &&
              allOptions.length > 0;
            const someSelected =
              selectAll && multiple && selectedArr.length > 0 && !allSelected;

            const handleChange = (_event: any, newValue: any) => {
              if (selectAll && multiple && Array.isArray(newValue)) {
                if (newValue.some((v: any) => v?.id === _CS_SELECT_ALL_ID)) {
                  const next = allSelected ? [] : [...allOptions];
                  onChange ? onChange(next, field) : field.onChange(next);
                } else {
                  onChange
                    ? onChange(newValue, field)
                    : field.onChange(newValue);
                }
              } else {
                onChange ? onChange(newValue, field) : field.onChange(newValue);
              }
            };

            const visibleTagCount = multiple ? maxVisibleTags : undefined;

            return (
              <Autocomplete
                {...autocompleteProps}
                {...field}
                multiple={multiple}
                disableCloseOnSelect={
                  autocompleteProps?.disableCloseOnSelect ?? multiple
                }
                getOptionDisabled={getOptionDisabled}
                onChange={handleChange}
                filterOptions={effectiveFilterOptions}
                groupBy={groupBy}
                value={field.value || (multiple ? [] : null)}
                getOptionLabel={effectiveGetOptionLabel}
                isOptionEqualToValue={effectiveIsEqual}
                placeholder={placeholder}
                limitTags={multiple && maxVisibleTags != null ? -1 : undefined}
                renderTags={
                  multiple
                    ? (tagValue, getTagProps) => {
                        const maxVisible = visibleTagCount ?? tagValue.length;
                        const hidden = Math.max(
                          0,
                          tagValue.length - maxVisible,
                        );
                        return [
                          ...tagValue
                            .slice(0, maxVisible)
                            .map((option: any, index) => (
                              <Chip
                                {...getTagProps({ index })}
                                key={option?.id ?? index}
                                size="small"
                                label={effectiveGetOptionLabel(option)}
                              />
                            )),
                          ...(hidden > 0
                            ? [
                                <Chip
                                  key="__more__"
                                  label={`+${hidden} more`}
                                  size="small"
                                  variant="outlined"
                                />,
                              ]
                            : []),
                        ];
                      }
                    : undefined
                }
                renderOption={(props, option: any, { selected }) => {
                  if (option?.id === _CS_SELECT_ALL_ID) {
                    return (
                      <li {...props} key={_CS_SELECT_ALL_ID}>
                        <Checkbox
                          size="small"
                          checked={allSelected}
                          indeterminate={someSelected}
                          sx={{ mr: 1, p: 0.5 }}
                        />
                        <strong>Select All</strong>
                      </li>
                    );
                  }
                  return (
                    <li {...props} key={option.id}>
                      {selectAll && (
                        <Checkbox
                          size="small"
                          checked={selected}
                          sx={{ mr: 1, p: 0.5 }}
                        />
                      )}
                      {renderLabel?.(option) ?? option.name}
                    </li>
                  );
                }}
                sx={{
                  backgroundColor: "#fff",
                }}
                disabled={disabled}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    InputLabelProps={{
                      shrink: !!field.value ? true : undefined,
                    }}
                    disabled={disabled}
                    label={getLabel(label, required)}
                    size={size ?? "small"}
                    variant={variant ?? "outlined"}
                  />
                )}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSMultiSelect = (props: ICSSelect) => {
  const {
    control,
    children,
    error,
    disabled,
    type,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            return (
              <>
                <InputLabel id={`multi-label-id-${name}`}>{label}</InputLabel>
                <Select
                  {...field}
                  disabled={disabled}
                  labelId={`multi-label-id-${name}`}
                  multiple
                  variant={variant ?? "outlined"}
                  id={id ?? `${name}-id`}
                  label={getLabel(label, required)}
                  // placeholder={placeholder}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value: any) => (
                        <Chip key={value} label={value} />
                      ))}
                    </Box>
                  )}
                >
                  {children}
                </Select>
              </>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSColor = (props: ICSInput) => {
  const {
    error,
    control,
    disabled,
    size,
    errors,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            return (
              <MuiColorInput
                {...field}
                onChange={onChange ?? field.onChange}
                disabled={disabled}
                // InputLabelProps={{
                //     shrink: !!field.value
                // }}
                variant={variant ?? "outlined"}
                id={id ?? `${name}-id`}
                label={getLabel(label, required)}
                size={size ?? "small"}
                placeholder={placeholder}
                format="hex"
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSNumber = (props: ICSNumber) => {
  const {
    control,
    disabled,
    inputRef,
    mini,
    textAlign = "right",
    showError = true,
    hasLabel = true,
    type,
    error,
    errors,
    size,
    min,
    max,
    step,
    decimals,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  let custRule = {};
  if (required) {
    custRule = {
      ...rules,
      ...(required ? { required: `${label ?? placeholder} is required` } : {}),
    };
  }
  if (min) {
    custRule = {
      ...custRule,
      ...(min
        ? { min: { value: min, message: `The minimum value is ${min}` } }
        : {}),
    };
  }
  if (max) {
    custRule = {
      ...custRule,
      ...(max
        ? { max: { value: max, message: `The maximum value is ${max}` } }
        : {}),
    };
  }
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{ ...rules, ...custRule }}
          render={({ field }) => {
            const effectiveStep =
              step ??
              (decimals !== undefined ? Math.pow(10, -decimals) : undefined);
            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              if (decimals !== undefined) {
                const val = e.target.value;
                const dotIdx = val.indexOf(".");
                if (dotIdx !== -1 && val.length - dotIdx - 1 > decimals) {
                  e.target.value = val.substring(0, dotIdx + decimals + 1);
                }
              }
              (onChange ?? field.onChange)(e);
            };
            return (
              <TextField
                {...field}
                type={"number"}
                onChange={handleChange}
                disabled={disabled}
                inputRef={inputRef}
                InputLabelProps={{
                  shrink:
                    field.value !== undefined ||
                    field.value !== null ||
                    field.value !== "",
                  sx: {
                    ...(mini ? { padding: "10px 0px", lineHeight: 0 } : {}),
                  },
                }}
                variant={variant ?? "outlined"}
                id={id ?? `${name}-id`}
                label={getLabel(label, required)}
                size={size ?? "small"}
                placeholder={placeholder}
                sx={{
                  ...(!showError &&
                    Boolean(error || errors?.[name]) && {
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "red",
                      },
                    }),
                }}
                InputProps={{
                  inputProps: {
                    sx: {
                      backgroundColor: "background.paper",
                      textAlign: textAlign,
                      ...(mini ? { padding: "4px 10px" } : {}),
                    },
                    ...(effectiveStep !== undefined
                      ? { step: effectiveStep }
                      : {}),
                  },
                }}
              />
            );
          }}
        />
        {showError && getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSSelect = (props: ICSSelect) => {
  let {
    control,
    errors,
    error,
    disabled,
    showError = true,
    mini,
    size,
    fullWidth,
    required,
    children,
    variant,
    id,
    hasLabel = true,
    placeholder,
    multiple,
    label,
    name,
    defaultValue,
    renderLabel,
    maxVisibleTags,
    rules,
  } = props;
  const SELECT_ALL = "__SELECT_ALL__";
  const allValues = multiple
    ? React.Children.toArray(children)
        .filter(React.isValidElement)
        .map((child: any) => child.props.value)
    : [];

  const childLabelMap = new Map<any, React.ReactNode>(
    React.Children.toArray(children)
      .filter(React.isValidElement)
      .map((child: any) => [child.props.value, child.props.children]),
  );

  if (multiple && maxVisibleTags != null) {
    renderLabel = (selected: any) => {
      const arr: any[] = Array.isArray(selected) ? selected : [];
      const visible = arr.slice(0, maxVisibleTags);
      const hidden = arr.length - visible.length;
      return (
        <Box
          sx={{
            display: "flex",
            flexWrap: "nowrap",
            gap: 0.5,
            overflow: "hidden",
          }}
        >
          {visible.map((val: any) => (
            <Chip
              key={val}
              label={childLabelMap.get(val) ?? String(val)}
              size="small"
            />
          ))}
          {hidden > 0 && (
            <Chip label={`+${hidden} more`} size="small" variant="outlined" />
          )}
        </Box>
      );
    };
  } else if (!renderLabel && multiple) {
    renderLabel = (selected: any) => (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {selected.map((value: any) => (
          <Chip key={value} label={value} size="small" />
        ))}
      </Box>
    );
  }
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            const allSelected = multiple
              ? allValues.length == field.value.length
              : false;
            return (
              <>
                {hasLabel && (
                  <InputLabel
                    id={`label-id-${name}`}
                    sx={{
                      ...(mini ? { marginTop: "-2px", lineHeight: 0 } : {}),
                    }}
                  >
                    {getLabel(label, required)}
                  </InputLabel>
                )}
                <Select
                  {...field}
                  value={field.value !== undefined ? field.value : ""}
                  disabled={disabled}
                  labelId={`label-id-${name}`}
                  variant={variant ?? "outlined"}
                  id={id ?? `${name}-id`}
                  multiple={multiple}
                  renderValue={renderLabel}
                  label={hasLabel ? getLabel(label, required) : undefined}
                  onChange={(event) => {
                    if (!multiple) {
                      field.onChange(event.target.value);
                      return;
                    }

                    const value = event.target.value as any[];

                    if (value.includes(SELECT_ALL)) {
                      field.onChange(allSelected ? [] : allValues);
                      return;
                    }

                    field.onChange(value);
                  }}
                  inputProps={{
                    sx: {
                      ...(mini ? { padding: "4px 10px" } : {}),
                    },
                  }}
                  sx={{
                    ...(!showError &&
                      Boolean(error || errors?.[name]) && {
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "red",
                        },
                      }),
                  }}
                  endAdornment={
                    Boolean((field.value ?? defaultValue) && !disabled) && (
                      <InputAdornment
                        sx={{ position: "absolute", right: 32 }}
                        position="end"
                      >
                        <IconButton
                          size="small"
                          onClick={() => {
                            field.onChange(multiple ? [] : "");
                          }}
                        >
                          <ClearIcon fontSize="small"></ClearIcon>
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                >
                  {multiple && (
                    <MenuItem value={SELECT_ALL}>
                      <em>{allSelected ? "Unselect All" : "Select All"}</em>
                    </MenuItem>
                  )}
                  {children}
                </Select>
              </>
            );
          }}
        />
        {showError && getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSRadio = (props: ICSRadio) => {
  const {
    control,
    errors,
    error,
    disabled,
    size,
    fullWidth,
    required,
    children,
    row,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            return (
              <>
                <FormLabel id={id ?? `label-id-${name}`}>
                  {getLabel(label, required)}
                </FormLabel>
                <RadioGroup
                  {...field}
                  row={row}
                  aria-disabled={disabled}
                  aria-labelledby="radio-group-label"
                >
                  {children}
                </RadioGroup>
              </>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export function CSSwitch(props: ICSInput) {
  const {
    id,
    onChange,
    control,
    errors,
    error,
    fullWidth,
    size,
    disabled,
    required,
    label,
    name,
    defaultValue,
    rules,
  } = props;

  return (
    <FormControl fullWidth={fullWidth} size={size ?? "small"}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          return (
            <FormControlLabel
              label={label}
              control={
                <Switch
                  {...field}
                  checked={field.value}
                  onChange={onChange ?? field.onChange}
                  disabled={disabled}
                  id={id ?? `${name}-id`}
                  size={size ?? "small"}
                />
              }
            />
          );
        }}
      />
      {getError(error ?? errors?.[name])}
    </FormControl>
  );
}

export const CSCheckboxs = (props: ICSSelect) => {
  const {
    control,
    errors,
    error,
    disabled,
    size,
    fullWidth,
    required,
    children,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue = [],
    rules,
  } = props;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <FormLabel id={id ?? `label-id-${name}`}>
          {getLabel(label, required)}
        </FormLabel>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required
              ? {
                  validate: (value) =>
                    value.length > 0 || `${label} is required`,
                }
              : {}),
          }}
          render={({ field }) => {
            const handleChange = (
              event: React.ChangeEvent<HTMLInputElement>,
            ) => {
              const value = field.value || [];
              const newValue = event.target.checked
                ? [...value, event.target.name]
                : value.filter((item: string) => item !== event.target.name);
              field.onChange(newValue);
            };

            return (
              <FormGroup>
                <Grid container spacing={1}>
                  {children.map((child: { label: string; value: string }) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={child.value}>
                      <FormControlLabel
                        key={child.value}
                        control={
                          <Checkbox
                            disabled={disabled}
                            name={child.value}
                            checked={
                              field.value?.includes(child.value) || false
                            }
                            onChange={handleChange}
                          />
                        }
                        label={child.label}
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSCheckboxList = (props: ICSCheckBox) => {
  const {
    control,
    errors,
    error,
    disabled,
    size,
    fullWidth,
    required,
    children,
    variant,
    id,
    placeholder,
    row,
    items,
    label,
    name,
    defaultValue = [],
    rules,
  } = props;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <FormLabel id={id ?? `label-id-${name}`}>
          {getLabel(label, required)}
        </FormLabel>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required
              ? {
                  validate: (value) =>
                    value.length > 0 || `${label} is required`,
                }
              : {}),
          }}
          render={({ field }) => {
            const { value, onChange } = field;

            const handleCheckboxChange = (val: string) => {
              if (value.includes(val)) {
                onChange(value.filter((item: string) => item !== val));
              } else {
                onChange([...value, val]);
              }
            };

            return (
              <FormGroup row={row}>
                {items?.map((item: { label: string; value: string }) => (
                  <FormControlLabel
                    key={item.value}
                    control={
                      <Checkbox
                        checked={value?.includes(item.value)}
                        onChange={() => handleCheckboxChange(item.value)}
                      />
                    }
                    label={item.label}
                  />
                ))}
              </FormGroup>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSCheckbox = (props: ICSSelect) => {
  const {
    control,
    errors,
    error,
    disabled,
    size,
    fullWidth,
    required,
    children,
    variant,
    id,
    placeholder,
    label,
    name,
    defaultValue = [],
    rules,
  } = props;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          rules={{
            ...rules,
            ...(required
              ? {
                  validate: (value) =>
                    value.length > 0 || `${label} is required`,
                }
              : {}),
          }}
          render={({ field }) => {
            return (
              <FormControlLabel
                id={id}
                control={
                  <Checkbox
                    disabled={disabled}
                    name={name}
                    value={defaultValue}
                    checked={field.value || false}
                    onChange={field.onChange}
                  />
                }
                label={getLabel(label, required)}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

export const CSCheckboxYesNo = (props: ICSCheckBox) => {
  const {
    control,
    errors,
    error,
    disabled,
    size,
    fullWidth,
    required,
    defaultValue,
    onChange,
    variant,
    id,
    placeholder,
    label,
    name,
    rules,
  } = props;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          rules={{
            ...rules,
            ...(required
              ? {
                  validate: (value) =>
                    value?.length > 0 || `${label} is required`,
                }
              : {}),
          }}
          render={({ field }) => {
            return (
              <FormControlLabel
                id={id}
                control={
                  <Checkbox
                    sx={{ ...(size === "small" ? { py: "5px" } : {}) }}
                    disabled={disabled}
                    defaultValue={defaultValue}
                    name={name}
                    checked={field.value === YesNoEnum.Yes}
                    onChange={(e) => {
                      if (onChange) {
                        onChange(
                          e.target.checked ? YesNoEnum.Yes : YesNoEnum.No,
                          field,
                        );
                      } else {
                        field.onChange(
                          e.target.checked ? YesNoEnum.Yes : YesNoEnum.No,
                        );
                      }
                    }}
                  />
                }
                label={getLabel(label, required)}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};

const TwoWaySwitch = styled(Switch)(({ theme }) => ({
  width: 44,
  height: 24,
  padding: 0,
  display: "flex",

  "& .MuiSwitch-switchBase": {
    padding: 2,
    transform: "translateX(0px)",
    color: "#fff",
    transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",

    "&.Mui-checked": {
      transform: "translateX(20px)",
      color: "#fff",

      "& + .MuiSwitch-track": {
        backgroundColor: "#1890ff",
        opacity: 1,
      },
    },

    "&.Mui-disabled": {
      opacity: 0.5,
    },
  },

  "& .MuiSwitch-thumb": {
    width: 20,
    height: 20,
    borderRadius: "50%",
    boxShadow: "0 2px 4px rgb(0 35 11 / 20%)",
    // ✅ Smooth thumb shadow on press
    transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  },

  "& .MuiSwitch-track": {
    borderRadius: 12,
    opacity: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    boxSizing: "border-box",
    // ✅ Smooth track color change
    transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
}));
export function CS2SideSwitch(props: ICSCheckBox) {
  const {
    control,
    name,
    rules,
    required,
    disabled,
    size,
    fullWidth,
    id,
    defaultValue,
    onChange,
    checkedValue,
    firstLabel,
    secondLabel,
    label,
  } = props;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          rules={{
            ...rules,
            ...(required
              ? {
                  validate: (value) =>
                    value.length > 0 || `${label} is required`,
                }
              : {}),
          }}
          render={({ field }) => {
            const isChecked = field.value === checkedValue;
            return (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="body2"
                  sx={{ fontWeight: !isChecked ? 600 : 400 }} // bold active side
                >
                  {firstLabel}
                </Typography>
                <TwoWaySwitch
                  id={id}
                  disabled={disabled}
                  value={field.value}
                  checked={isChecked}
                  onChange={(val) => {
                    onChange ? onChange(val, field) : field.onChange(val);
                  }}
                  slotProps={{
                    input: { "aria-label": label },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: isChecked ? 600 : 400 }} // bold active side
                >
                  {secondLabel}
                </Typography>
              </Stack>
            );
          }}
        />
      </FormControl>
    </Box>
  );
}

export { CSDatePicker, CSDateTimePicker };

export const CSTime = (props: ICSTime) => {
  const {
    control,
    errors,
    error,
    ampm,
    fullWidth,
    size,
    disabled,
    required,
    format,
    label,
    name,
    defaultValue,
    rules,
    onChange,
  } = props;
  return (
    <Box pt={0}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue}
          rules={{
            ...rules,
            ...(required ? { required: `${label} is required` } : {}),
          }}
          render={({ field }) => {
            return (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DemoContainer components={["TimePicker"]}>
                  <TimePicker
                    {...field}
                    disabled={disabled}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(e) => {
                      onChange
                        ? onChange(e, field)
                        : field.onChange({
                            name,
                            target: {
                              value: e ? e.toISOString() : "",
                            },
                          });
                    }}
                    format={format ?? "hh:mm A"}
                    ampm={ampm}
                    label={getLabel(label, required)}
                    slotProps={{
                      textField: {
                        size: size ?? "small", // Use this for smaller input
                        sx: { minWidth: "auto !important", width: "100%" },
                      },
                    }}
                  />
                </DemoContainer>
              </LocalizationProvider>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};
