import React, { useEffect, useState } from "react";
import { Tabs, Tab, Box, Typography } from "@mui/material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
};

interface TabbedPaneProps {
  active?: number;
  tabs: { label: string; content: React.ReactNode, disabled?: boolean, icon?: React.ReactElement, iconPosition?: "start" | "end" }[];
}

export const TabbedPane: React.FC<TabbedPaneProps> = ({ tabs, active = 0 }) => {
  const [value, setValue] = useState(active);
  useEffect(() => {
    setValue(active)
  }, [active])
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange} aria-label="tabbed pane">
          {tabs.map((tab, index) => (
            <Tab key={index} icon={tab.icon} iconPosition={tab.iconPosition} disabled={tab.disabled} label={tab.label} id={`simple-tab-${index}`} aria-controls={`simple-tabpanel-${index}`} />
          ))}
        </Tabs>
      </Box>
      {tabs.map((tab, index) => (
        <TabPanel key={index} value={value} index={index}>
          {tab.content}
        </TabPanel>
      ))}
    </Box>
  );
};
