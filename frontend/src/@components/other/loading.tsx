import React from "react";
import { CircularProgress, Box } from "@mui/material";

interface LoadingWrapperProps {
  value: any; // Replace `any` with the specific type of your value
  children: React.ReactNode;
  loadingText?: string; // Optional text to show during loading
}

const LoadingWrapper: React.FC<LoadingWrapperProps> = ({ value, children, loadingText }) => {
  return Boolean(value) ? (
    <>{children}</>
  ) : (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={"50vh"}
      height="100%"
    >
      <CircularProgress />
      {loadingText && <Box mt={2}>{loadingText}</Box>}
    </Box>
  );
};

export default LoadingWrapper;
