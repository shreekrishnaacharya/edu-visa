import { useEffect } from "react";
import Chip from "@mui/material/Chip";
import {
  chipProps,
  FiltersBlock,
  FiltersResult,
} from "src/components/filters-result";
import { BasicModal } from "@components/modal/basic.modal";
import { Badge, Box, Button, Divider } from "@mui/material";
import { CiFilter } from "react-icons/ci";
import { useTranslate } from "@hooks/useTranslate";
import { IFilterButtonProps } from "src/components/filters-result/interface";

export function FilterButton({
  getLabels,
  children,
  isOpen,
  onOpen,
  onClose,
  defaultFilter,
  filters,
  clearFilterField,
  totalResults,
}: IFilterButtonProps) {
  const t = useTranslate();

  useEffect(() => {
    if (Object.keys(filters).length === 0) {
      clearFilterField("all");
    }
  }, []);
  const fcount =
    Object.keys(filters).length - Object.keys(defaultFilter).length;
  const filterCount = fcount > 0 ? fcount : 0;
  return (
    <Box>
      <Badge
        badgeContent={filterCount}
        color="primary"
        invisible={!filterCount || filterCount === 0}
      >
        <Button
          startIcon={<CiFilter />}
          color="info"
          variant="outlined"
          onClick={onOpen}
        >
          {t("@buttons.filter")}
        </Button>
      </Badge>
      <BasicModal
        title={t("@buttons.filter")}
        onClose={onClose}
        open={isOpen}
        keepMounted
      >
        <FiltersResult
          hasFilters={Boolean(Object.keys(filters).length)}
          totalResults={totalResults}
          onReset={() => clearFilterField("all")}
        >
          {getLabels().map((label) => {
            return (
              <FiltersBlock label={label.label} isShow={true} key={label.name}>
                <Chip
                  key={label.name}
                  {...chipProps}
                  label={
                    Array.isArray(label.value)
                      ? label.value.join(", ")
                      : label.value
                  }
                  onDelete={() => clearFilterField(label.name)}
                />
              </FiltersBlock>
            );
          })}
        </FiltersResult>
        <Divider sx={{ my: 2 }} />
        {/* Form content can be added here */}
        {children}
      </BasicModal>
    </Box>
  );
}
