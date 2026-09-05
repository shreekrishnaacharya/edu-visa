import React from 'react';
import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

function NoDataLabel({ message = "No data", height = 50 }) {
    return (
        <Box
            sx={{
                gap: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyItems: 'center',
                justifyContent: 'center',
                height,
                backgroundColor: '#f9f9f9', // Optional subtle background
                border: '1px dashed #ccc', // Dashed border for visual separation
                p: 2, // Padding
            }}
        >
            {/* Icon */}
            <InboxIcon sx={{ fontSize: 20, color: '#aaa' }} />
            {/* Message */}
            <Typography sx={{ fontSize: 14, color: '#555', textAlign: 'center' }}>
                {message}
            </Typography>
        </Box>
    );
}

export default NoDataLabel;
