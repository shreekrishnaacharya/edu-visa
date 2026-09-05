import { Avatar, Box, Button, Stack, styled, Typography } from "@mui/material";
import React, { useState } from "react";
import { Controller } from "react-hook-form";
import { getError, getLabel } from "./functions";
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useImageUpload } from "@utils/use-image-upload";
import { useTranslate } from "@hooks/useTranslate";

export type ICSImage = {
    id?: string;
    placeholder?: string;
    accept?: string;
    label: string;
    onChange?: any;
    name: string;
    control?: any
    errors?: any;
    error?: any
    value?: any;
    disabled?: boolean;
    required?: boolean
    height?: number;
    width?: number;
    rules?: any
    stackProps?: any
    direction?: 'row' | 'column'
};


export const CSImage = React.memo((props: ICSImage) => {
    const {
        id,
        errors,
        placeholder,
        label,
        name,
        onChange,
        control,
        value,
        disabled,
        rules,
        accept,
        height = 90,
        width = 90,
        required,
        stackProps,
        error,
        direction = 'column'
    } = props;
    const t = useTranslate()
    const imageUploadOnChangeHandler = async (
        field: any,
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const target = event.target;
        const file: File = (target.files as FileList)[0];

        const [image] = await useImageUpload({
            file,
        });

        if (!image.type) {
            return
        }
        onChange?.(image)
        field.onChange?.(image);
    };

    return (
        <>
            <Controller
                control={control}
                name={name}
                defaultValue={value}
                rules={{ ...rules, ...(required ? { required: `${label} is required` } : {}) }}
                render={({ field }) => {
                    return (
                        <>
                            <Stack direction={direction} gap={2} alignItems={'center'} {...stackProps}>
                                <Avatar
                                    alt={field.value?.name ?? label}
                                    src={field.value?.url}
                                    variant="rounded"
                                    imgProps={{ loading: 'lazy' }} // Lazy load the image
                                    sx={{ height, width }}
                                />
                                {!disabled && (
                                    <Stack direction={'column'} alignItems={direction == 'column' ? 'center' : 'flex-start'}>
                                        <Button
                                            component="label"
                                            variant="outlined"
                                            size="small"
                                            color="primary"
                                            sx={{ width }}
                                            startIcon={<AddPhotoAlternateIcon />}
                                        >
                                            {getLabel(label, required)}
                                            <VisuallyHiddenInput type="file"
                                                accept={accept ?? 'image/jpg,image/jpeg,image/png'}
                                                onChange={(e) => {
                                                    imageUploadOnChangeHandler(field, e)
                                                }}
                                            />
                                        </Button>
                                        <Typography variant="caption" gutterBottom>
                                            {placeholder ?? t("validation.maxFileSize")}
                                        </Typography>
                                    </Stack>
                                )}
                            </Stack>
                        </>
                    );
                }}
            />
            {getError(error ?? errors?.[name])}
        </>
    );
});

const VisuallyHiddenInput = styled("input")({
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    bottom: 0,
    left: 0,
    whiteSpace: "nowrap",
    width: 1,
});
CSImage.displayName = 'CSImage';



