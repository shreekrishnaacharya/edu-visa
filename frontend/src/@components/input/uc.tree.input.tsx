import * as React from "react";
import Box from "@mui/material/Box";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { BasicModal } from "@components/modal/basic.modal";
import {
  Button,
  DialogProps,
  Divider,
  FormControl,
  InputLabel,
  Stack,
  Typography,
} from "@mui/material";
import { Controller } from "react-hook-form";
import { useTranslate } from "@hooks/useTranslate";

export type IUCTreeInput = {
  id?: string;
  fullWidth?: boolean;
  placeholder?: string;
  parentIndex: string;
  labelIndex: string;
  label: string;
  value: any;
  renderLabel: (value: any) => React.ReactNode;
  multiple?: boolean;
  checkboxSelection?: boolean;
  treeData: any[];
  onChange: any;
  error?: any;
  disabled?: boolean;
  required?: boolean;
  height?: number;
  width?: number;
  rules?: any;
  stackProps?: any;
  modalSize?: DialogProps["maxWidth"];
  modalTitle?: string;
  size?: "small" | "medium";
};

export const UCTreeInput = (props: IUCTreeInput) => {
  const [open, setOpen] = React.useState(false);
  const [selectedItems, setSelectedItems] = React.useState<any[]>(
    props.value?.map((v: any) => v.id) || [],
  );
  const t = useTranslate();
  const handleClose = () => setOpen(false);
  const treeItem = buildTree(props.treeData, props.parentIndex);

  const getAllDescendantIds = (node: any): string[] => {
    let ids: string[] = [];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        ids.push(String(child.data.id));
        ids = [...ids, ...getAllDescendantIds(child)];
      });
    }
    return ids;
  };

  const findNodeById = (nodes: any[], id: string): any | null => {
    for (const node of nodes) {
      if (String(node.data.id) === id) {
        return node;
      }
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const handleSelectedItemsChange = (
    event: React.SyntheticEvent,
    newSelectedIds: string | string[] | null,
  ) => {
    const newIds = Array.isArray(newSelectedIds)
      ? newSelectedIds
      : [newSelectedIds];

    const changedId =
      newIds.find((id) => !selectedItems.includes(id)) ||
      selectedItems.find((id) => !newIds.includes(id));

    if (!changedId) {
      setSelectedItems(newIds);
      return;
    }

    const node = findNodeById(treeItem, changedId);
    if (!node) {
      setSelectedItems(newIds);
      return;
    }

    const descendantIds = getAllDescendantIds(node);
    const isSelecting = newIds.includes(changedId);

    let finalIds: (string | null)[];
    if (isSelecting) {
      finalIds = [...new Set([...newIds, changedId, ...descendantIds])];
    } else {
      const idsToRemove = [changedId, ...descendantIds];
      finalIds = newIds.filter((id) => !idsToRemove.includes(id));
    }

    setSelectedItems(finalIds);
  };

  const renderTreeItems = (nodes: any[], level: number): React.ReactNode => {
    return nodes.map((node) => (
      <TreeItem
        key={node.data.id}
        itemId={String(node.data.id)}
        label={node.data[props.labelIndex]}
        onClick={(event) => {
          event.stopPropagation();
          const itemId = String(node.data.id);
          const descendantIds = getAllDescendantIds(node);
          let newSelectedItems: string[];

          if (props.multiple) {
            const isSelected = selectedItems.includes(itemId);
            if (isSelected) {
              newSelectedItems = selectedItems.filter(
                (id) => ![itemId, ...descendantIds].includes(id),
              );
            } else {
              newSelectedItems = [
                ...new Set([...selectedItems, itemId, ...descendantIds]),
              ];
            }
          } else {
            newSelectedItems = selectedItems.includes(itemId) ? [] : [itemId];
          }

          setSelectedItems(newSelectedItems);
        }}
        sx={{
          "& .MuiTreeItem-content": {
            paddingLeft: `${level * 25 + 8}px`,
          },
        }}
      >
        {node.children &&
          node.children.length > 0 &&
          renderTreeItems(node.children, level + 1)}
      </TreeItem>
    ));
  };

  const expanded = props.treeData.map((d) => String(d.id));

  return (
    <Box pt={0.5}>
      <Box>
        <Box
          onClick={() => !props.disabled && setOpen(true)}
          sx={{
            backgroundColor: props.disabled ? "grey.200" : "transparent",
            border: "1px solid",
            borderColor: "grey.400",
            borderRadius: 1,
            p: 1,
            cursor: "pointer",
          }}
        >
          <InputLabel id={`multi-label-id-${props.label}`}>
            {props.label}
          </InputLabel>
          <Stack
            direction={"row"}
            justifyContent="flex-start"
            gap={1}
            alignItems="center"
            mb={1}
            flexWrap="wrap"
            {...props.stackProps}
          >
            {props.value?.map((val: any) => props.renderLabel(val))}
          </Stack>
          {props.error && (
            <Typography variant="caption" color="error">
              {props.error?.message}
            </Typography>
          )}
        </Box>
        <BasicModal
          open={open}
          onClose={handleClose}
          title={props.modalTitle ?? props.label}
          size={props.modalSize ?? "md"}
          footer={
            <>
              <Button onClick={handleClose}>{t("@buttons.cancel")}</Button>
              <Button
                variant="contained"
                onClick={() => {
                  const items = props.treeData.filter((d) =>
                    selectedItems.includes(String(d.id)),
                  );
                  props.onChange(items);
                  handleClose();
                }}
              >
                {t("@buttons.save")}
              </Button>
            </>
          }
        >
          <Box sx={{ minHeight: 352, minWidth: 290 }}>
            <SimpleTreeView
              multiSelect={props.multiple}
              checkboxSelection={props.checkboxSelection}
              selectedItems={selectedItems}
              expandedItems={expanded}
              onSelectedItemsChange={handleSelectedItemsChange}
            >
              {renderTreeItems(treeItem, 0)}
            </SimpleTreeView>
          </Box>
        </BasicModal>
      </Box>
    </Box>
  );
};

export function buildTree(data: any[], parentIndex: string): any[] {
  const nodeMap: Record<string, any> = {};
  const roots: any[] = [];

  data.forEach((item) => {
    nodeMap[item.id] = { data: item, children: [] };
  });

  data.forEach((item) => {
    if (item[parentIndex] && nodeMap[item[parentIndex]]) {
      nodeMap[item[parentIndex]].children.push(nodeMap[item.id]);
    } else {
      roots.push(nodeMap[item.id]);
    }
  });

  const sortChildren = (nodes: any[]): any[] => {
    return nodes
      .sort((a, b) => (a.data.sort || 0) - (b.data.sort || 0))
      .map((n) => ({ ...n, children: sortChildren(n.children) }));
  };

  return sortChildren(roots);
}
