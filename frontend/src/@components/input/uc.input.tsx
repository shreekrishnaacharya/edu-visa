import {
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  InputBase,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Popper,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Box } from "@mui/material";
import { getError, getLabel } from "./functions";
import React, { useEffect, useState } from "react";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { useDebouncedCallback } from "use-debounce";
import SearchIcon from "@mui/icons-material/Search";
import { styled } from "@mui/material/styles";
import {
  UCSDatePicker,
  UCSDateRangePicker,
  UCSDateTimePicker,
  UCSTime,
} from "./dateinput";
import { ClearIcon } from "@mui/x-date-pickers/icons";

type UCSInputSizeProps = "small" | "medium";
interface IUCSInput {
  inputProps?: any;
  inputRef?: any;
  mini?: boolean;
  disabled?: boolean;
  multiline?: number;
  required?: boolean;
  type?: string;
  fullWidth?: boolean;
  onChange: any;
  value: any;
  defaultValue?: any;
  touched?: any;
  placeholder?: any;
  variant?: any;
  rules?: any;
  size?: UCSInputSizeProps;
  label: string;
  error?: any;
  id?: string;
  min?: number;
  max?: number;
  sx?: any;
  width?: number;
  textAlign?: "left" | "center" | "right";
}

interface IUCSLabel {
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  defaultValue?: any;
  placeholder?: any;
  variant?: any;
  size?: UCSInputSizeProps;
  label: string;
  id?: string;
}

interface IUCSHiddenInput {
  control: any;
  defaultValue?: any;
  name: string;
}

interface IUCSSelect extends IUCSInput {
  children?: any;
  multiple?: boolean;
  renderLabel?: any;
  /** Max chips shown before collapsing to "+N more". Only applies when multiple. Does not affect existing uses without this prop. */
  maxVisibleTags?: number;
}

interface IUCSCheckBox extends IUCSInput {
  children?: any;
  checkedValue?: any;
  firstLabel?: string;
  secondLabel?: string;
}

interface IUCSNumber extends IUCSInput {
  min?: number;
  max?: number;
  step?: number;
}

interface IUCSDatePicker extends IUCSInput {
  format?: string;
}

interface IUCSDateRangePicker
  extends Omit<IUCSInput, "defaultValue" | "value"> {
  format?: string;
  fromValue?: Date;
  toValue?: Date;
  saperator?: string;
}

interface IUCSTime extends IUCSInput {
  format?: string;
  ampm?: boolean;
}

interface IUCSAutoComplete extends IUCSInput {
  containerRef?: any;
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
  /** Max chips shown before collapsing to "+N more". Defaults to 3. Only applies when multiple. */
  maxVisibleTags?: number;
}

interface IUCSSoloComplete extends IUCSInput {
  autocompleteProps?: any;
  getOptionLabel?: any;
  renderLabel?: any;
  onInputChange?: any;
}

interface IUCSSearch {
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

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

export const UCSInput = (props: IUCSInput) => {
  const {
    value,
    disabled,
    inputRef,
    mini,
    min,
    inputProps,
    max,
    textAlign = "left",
    multiline,
    type,
    size,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    defaultValue,
    rules,
  } = props;
  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <TextField
          multiline={Boolean(multiline)}
          rows={multiline}
          value={value}
          type={type ?? "text"}
          onChange={onChange}
          disabled={disabled}
          InputLabelProps={{
            shrink: !!value,
            sx: {
              ...(mini ? { padding: "10px 0px", lineHeight: 0 } : {}),
            },
          }}
          variant={variant ?? "outlined"}
          id={id ?? `${label}-id`}
          label={getLabel(label, required)}
          size={size ?? "small"}
          placeholder={placeholder}
          inputRef={inputRef}
          sx={{
            backgroundColor: "#fff",
          }}
          InputProps={{
            inputProps: {
              maxLength: max,
              minLength: min,
              sx: {
                textAlign: textAlign,
                ...(mini ? { padding: "4px 10px" } : {}),
              },
              ...inputProps,
            },
          }}
        />
      </FormControl>
    </Box>
  );
};

export { UCSTime, UCSDatePicker, UCSDateRangePicker, UCSDateTimePicker };

export function UCSSelect(props: IUCSSelect) {
  let {
    label,
    onChange,
    value,
    disabled,
    size = "small",
    fullWidth = false,
    defaultValue,
    children,
    width = 200,
    required,
    multiple,
    renderLabel,
    maxVisibleTags,
  } = props;
  const SELECT_ALL = "__SELECT_ALL__";
  const allValues = multiple
    ? React.Children.toArray(children)
        .filter(React.isValidElement)
        .map((child: any) => child.props.value)
    : [];

  // Build value → display label map from MenuItem children so collapsed chips
  // show the same text the menu item shows, not the raw value.
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
  const allSelected = multiple
    ? allValues.length == (Array.isArray(value) ? value.length : 0)
    : false;
  return (
    <FormControl
      fullWidth={fullWidth}
      sx={{ minWidth: width }}
      size={size}
      disabled={disabled}
      variant="outlined"
    >
      <InputLabel id={`${label}-label`}>{getLabel(label, required)}</InputLabel>
      <Select
        fullWidth={fullWidth}
        labelId={`${label}-label`}
        id={`${label}-id`}
        value={value}
        label={label}
        multiple={multiple}
        renderValue={renderLabel}
        onChange={(event) => {
          if (!multiple) {
            onChange(event);
            return;
          }

          const value = event.target.value as any[];

          if (value.includes(SELECT_ALL)) {
            onChange(allSelected ? [] : allValues);
            return;
          }

          onChange(value);
        }}
        disabled={disabled}
        endAdornment={
          Boolean((value ?? defaultValue) && !disabled) && (
            <InputAdornment
              sx={{ position: "absolute", right: 32 }}
              position="end"
            >
              <IconButton
                size="small"
                onClick={() => {
                  onChange(multiple ? [] : "");
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
    </FormControl>
  );
}

const _SELECT_ALL_ID = "__uc_select_all__";

export const UCSAutoComplete = (props: IUCSAutoComplete) => {
  const {
    containerRef,
    error,
    disabled,
    getOptionDisabled,
    renderLabel,
    multiple,
    groupBy,
    isOptionEqualToValue,
    autocompleteProps,
    getOptionLabel,
    filterOptions,
    selectAll,
    maxVisibleTags = 3,
    size,
    value,
    onChange,
    fullWidth,
    required,
    variant,
    id,
    placeholder,
    label,
    width,
  } = props;

  const allOptions: any[] = autocompleteProps?.options ?? [];
  const selectedArr: any[] = Array.isArray(value) ? value : [];
  const allSelected =
    selectAll &&
    multiple &&
    selectedArr.length === allOptions.length &&
    allOptions.length > 0;
  const someSelected =
    selectAll && multiple && selectedArr.length > 0 && !allSelected;

  const effectiveFilterOptions =
    selectAll && multiple
      ? (options: any[], state: any) => {
          const base = filterOptions ? filterOptions(options, state) : options;
          return [{ id: _SELECT_ALL_ID } as any, ...base];
        }
      : filterOptions;

  const effectiveIsEqual = (opt: any, val: any) => {
    if (opt?.id === _SELECT_ALL_ID || val?.id === _SELECT_ALL_ID)
      return opt?.id === val?.id;
    return (isOptionEqualToValue ?? ((o: any, v: any) => o.id === v.id))(
      opt,
      val,
    );
  };

  const effectiveGetOptionLabel = (option: any) => {
    if (option?.id === _SELECT_ALL_ID) return "Select All";
    return getOptionLabel ? getOptionLabel(option) : option?.name ?? "";
  };

  const handleChange = (_event: any, newValue: any) => {
    if (selectAll && multiple && Array.isArray(newValue)) {
      if (newValue.some((v: any) => v?.id === _SELECT_ALL_ID)) {
        onChange(allSelected ? [] : [...allOptions]);
      } else {
        onChange(newValue);
      }
    } else {
      onChange(newValue);
    }
  };

  const visibleTagCount = multiple ? maxVisibleTags : undefined;

  return (
    <Box pt={0.5}>
      <FormControl
        fullWidth={fullWidth}
        size={size ?? "small"}
        error={!!error}
        sx={{ minWidth: width, ...(width ? { maxWidth: width } : {}) }}
      >
        <Autocomplete
          fullWidth={fullWidth}
          {...autocompleteProps}
          {...(containerRef && {
            PopperComponent: (props) => (
              <Popper {...props} container={containerRef.current} />
            ),
          })}
          multiple={multiple}
          disableCloseOnSelect={autocompleteProps?.disableCloseOnSelect ?? multiple}
          getOptionDisabled={getOptionDisabled}
          onChange={handleChange}
          filterOptions={effectiveFilterOptions}
          groupBy={groupBy}
          value={value || (multiple ? [] : null)}
          getOptionLabel={effectiveGetOptionLabel}
          isOptionEqualToValue={effectiveIsEqual}
          placeholder={placeholder}
          // MUI only collapses chips when !focused, so with disableCloseOnSelect
          // all chips stay visible while the dropdown is open and the count grows.
          // We own the limiting entirely inside renderTags (limitTags=-1 disables
          // MUI's own mechanism) so the collapse always reflects hidden-only count.
          limitTags={-1}
          renderTags={(tagValue, getTagProps) => {
            const total = tagValue.length;
            const maxVisible = visibleTagCount ?? total;
            const hiddenCount = Math.max(0, total - maxVisible);
            return [
              ...tagValue
                .slice(0, maxVisible)
                .map((option: any, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option?.id ?? index}
                    label={effectiveGetOptionLabel(option)}
                    size="small"
                  />
                )),
              ...(hiddenCount > 0
                ? [
                    <Chip
                      key="__more__"
                      label={`+${hiddenCount} more`}
                      size="small"
                      variant="outlined"
                    />,
                  ]
                : []),
            ];
          }}
          renderOption={(props, option: any, { selected }) => {
            if (option?.id === _SELECT_ALL_ID) {
              return (
                <li {...props} key={_SELECT_ALL_ID}>
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
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              disabled={disabled}
              label={getLabel(label, required)}
              size={size ?? "small"}
              variant={variant ?? "outlined"}
            />
          )}
        />
        {getError(error)}
      </FormControl>
    </Box>
  );
};

export const UCSCheckbox = (props: IUCSCheckBox) => {
  const {
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
    rules,
    value,
    onChange,
    checkedValue,
  } = props;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <FormControlLabel
          id={id}
          control={
            <Checkbox
              disabled={disabled}
              value={value}
              checked={value === checkedValue}
              onChange={onChange}
            />
          }
          label={getLabel(label, required)}
        />
      </FormControl>
    </Box>
  );
};

export function UCS2SideSwitch(props: IUCSCheckBox) {
  const {
    disabled,
    size,
    fullWidth,
    id,
    value,
    onChange,
    checkedValue,
    firstLabel,
    secondLabel,
    label,
  } = props;

  const isChecked = value === checkedValue;

  return (
    <Box pt={0.5}>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <FormLabel sx={{ mb: -0.5 }}>{label}</FormLabel>
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
            value={value}
            checked={isChecked}
            onChange={onChange}
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
      </FormControl>
    </Box>
  );
}

export function UCSMultiSelect(props: IUCSSelect) {
  const {
    label,
    onChange,
    value,
    disabled,
    size = "small",
    fullWidth = false,
    children,
    width = 200,
  } = props;
  const handleChange = (event: SelectChangeEvent) => {
    const {
      target: { value },
    } = event;
    onChange(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value,
    );
  };
  return (
    <FormControl
      fullWidth={fullWidth}
      sx={{ minWidth: width }}
      size={size}
      disabled={disabled}
      variant="outlined"
    >
      <InputLabel id={`${label}-label`}>{label}</InputLabel>
      <Select
        fullWidth={fullWidth}
        labelId={`${label}-label`}
        id={`${label}-id`}
        value={value}
        label={label}
        multiple
        onChange={handleChange}
        disabled={disabled}
        input={<OutlinedInput label="Chip" />}
        renderValue={(selected: any) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selected.map((value: any) => (
              <Chip key={value} label={value} />
            ))}
          </Box>
        )}
      >
        {children}
      </Select>
    </FormControl>
  );
}

interface IUCSSearch {
  fullWidth?: boolean;
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export const UCSSearch = (props: IUCSSearch) => {
  const { onChange, value, placeholder, fullWidth } = props;
  const [search, setSearch] = React.useState<string>(value ?? "");
  const handleSearch = useDebouncedCallback((search: string) => {
    props.onChange(search);
  }, 300);
  useEffect(() => {
    handleSearch(search);
  }, [search]);
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
        }}
      >
        <InputBase
          name="search"
          type="search"
          fullWidth={fullWidth}
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
