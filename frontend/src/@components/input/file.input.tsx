import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  styled,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { Controller } from "react-hook-form";
import { getError, getLabel } from "./functions";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { useImageUploads } from "@utils/use-image-upload";
import DeleteIcon from "@mui/icons-material/Delete";
import { CSHiddenInput } from "./input";
import { formatBytes } from "@utils/format-filesize";

export type ICSFile = {
  id?: string;
  placeholder?: string;
  accept?: string;
  label: string;
  onChange: any;
  name: string;
  control?: any;
  errors?: any;
  error?: any;
  value?: any[];
  disabled?: boolean;
  required?: boolean;
  height?: number;
  width?: number;
  rules?: any;
  stackProps?: any;
  size?: "small" | "medium";
  multiple?: boolean;
};

export const CSFile = React.memo((props: ICSFile) => {
  const {
    errors,
    label,
    name,
    onChange,
    control,
    value,
    rules,
    accept,
    height = 90,
    width = 90,
    required,
    error,
    size = "medium",
    multiple,
  } = props;

  const [fileList, setFileList] = useState<any[]>([]);
  const imageUploadOnChangeHandler = async (
    field: any,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const target = event.target;
    const files: File[] = [...(target.files as FileList)];

    const images = await useImageUploads({
      files,
    });

    if (!images) {
      return;
    }
    setFileList(images);
    onChange(images);
  };

  const handleDelete = (index: number) => {
    const newFileList = [...fileList];
    newFileList.splice(index, 1);
    setFileList(newFileList);
    onChange(newFileList);
  };

  return (
    <>
      <Controller
        control={control}
        name={name}
        defaultValue={value}
        rules={{
          ...rules,
          ...(required ? { required: `${label} is required` } : {}),
        }}
        render={({ field }) => {
          return (
            <>
              <CSHiddenInput
                control={control}
                defaultValue={fileList}
                name="files"
              />
              <Paper elevation={2} sx={{ p: size === "small" ? 1 : 2 }}>
                <Button component="label" variant="text" sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      gap: 1,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      width: "100%",
                      backgroundColor: "#f9f9f9", // Optional subtle background
                      border: "1px dashed #ccc", // Dashed border for visual separation
                      p: 1, // Padding
                    }}
                  >
                    {/* Icon */}
                    <AddPhotoAlternateIcon
                      sx={{ fontSize: 20, color: "#aaa" }}
                    />
                    {/* Message */}
                    <Typography
                      sx={{
                        fontSize: size === "small" ? 10 : 14,
                        color: "#555",
                        textAlign: "center",
                      }}
                    >
                      {getLabel(label, required)}
                    </Typography>
                  </Box>
                  <VisuallyHiddenInput
                    type="file"
                    accept={accept ?? "image/jpg,image/jpeg,image/png"}
                    multiple={multiple}
                    onChange={(e) => {
                      imageUploadOnChangeHandler(field, e);
                    }}
                  />
                </Button>
              </Paper>
              {fileList && fileList.length > 0 && (
                <FileList
                  size={size}
                  height={height}
                  width={width}
                  value={fileList}
                  handleDelete={handleDelete}
                />
              )}
            </>
          );
        }}
      />
      {getError(error ?? errors?.[name])}
    </>
  );
});

const FileList = ({
  value,
  handleDelete,
  height,
  width,
  size = "medium",
}: {
  size: "small" | "medium";
  height: number;
  width: number;
  value: any[];
  handleDelete: (index: number) => void;
}) => {
  return (
    <List sx={{ mt: 1, width: "100%", bgcolor: "background.paper" }}>
      {value.map((e) => {
        return (
          <div key={e.uid}>
            <ListItem
              sx={{ padding: 0, margin: 0 }}
              secondaryAction={
                <IconButton
                  size={size}
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDelete(value.indexOf(e))}
                >
                  <DeleteIcon fontSize={size} />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar
                  alt={e.name}
                  src={e.url}
                  variant="rounded"
                  imgProps={{ loading: "lazy" }}
                  sx={{ height, width }}
                />
              </ListItemAvatar>
              <ListItemText
                primary={e.name}
                primaryTypographyProps={{
                  fontSize: size === "small" ? 12 : 14,
                }}
                secondaryTypographyProps={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: size === "small" ? 12 : 14,
                }}
                secondary={`size: ${formatBytes(e.size, 2)} | Type : ${e.type}`}
              />
            </ListItem>
            <Divider />
          </div>
        );
      })}
    </List>
  );
};

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "100%",
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: "100%",
});
CSFile.displayName = "CSFile";
