import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PrintableWrapperProps {
  children: React.ReactNode;
  title?: string;
}

export const PrintableWrapper: React.FC<PrintableWrapperProps> = ({
  children,
  title = 'Report',
}) => {
  const handlePrint = async () => {
    const printElement = document.getElementById(title);
    if (!printElement) {
      console.warn(`Print element with ID "${title}" not found`);
      return;
    }

    try {
      // Hide print buttons temporarily
      const printButtons = printElement.querySelectorAll('.print-hidden, button, .MuiIconButton-root');
      printButtons.forEach(btn => {
        (btn as HTMLElement).style.display = 'none';
      });

      // Add temporary styles to improve html2canvas rendering
      const style = document.createElement('style');
      style.innerHTML = `
        .MuiChip-label {
          font-weight: 500 !important;
          font-size: 12px !important;
          line-height: 1.2 !important;
        }
        .MuiChip-root {
          font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif !important;
        }
      `;
      document.head.appendChild(style);

      // Wait a bit for any animations or dynamic content to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Capture the component as canvas with high quality
      const canvas = await html2canvas(printElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: printElement.scrollWidth,
        height: printElement.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        logging: false,
        foreignObjectRendering: false,
      });

      // Remove temporary styles
      document.head.removeChild(style);

      // Restore print buttons
      printButtons.forEach(btn => {
        (btn as HTMLElement).style.display = '';
      });

      // Calculate PDF dimensions
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // A4 size in points (72 DPI)
      const pdfWidth = 595.28; // A4 width in points
      const pdfHeight = 841.89; // A4 height in points
      
      // Calculate scaling to fit content with proper margins
      const leftMargin = 40;
      const rightMargin = 40;
      const topMargin = 50;
      const bottomMargin = 40;
      
      const availableWidth = pdfWidth - leftMargin - rightMargin;
      const availableHeight = pdfHeight - topMargin - bottomMargin;
      
      const widthRatio = availableWidth / imgWidth;
      const heightRatio = availableHeight / imgHeight;
      const ratio = Math.min(widthRatio, heightRatio);
      
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      
      // Position content at top-left with margins
      const offsetX = leftMargin;
      const offsetY = topMargin;

      // Create PDF
      const pdf = new jsPDF('p', 'pt', 'a4');
      
      // Add title
      pdf.setFontSize(16);
      pdf.text(title, 40, 30);
      
      // Add the image starting from top
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', offsetX, offsetY, scaledWidth, scaledHeight);
      
      // Add timestamp
      pdf.setFontSize(8);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, 40, pdfHeight - 20);

      // Download or print the PDF
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open PDF in new window for printing
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        // Fallback: download the PDF
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        link.click();
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Fallback to original print method
      window.print();
    }
  };

  return (
    <Box 
      sx={{ position: 'relative' }}
      data-printable-id={title}  // Add this line
    >
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 1,
        }}
        className="print-hidden"
      >
        <Tooltip title={title}>
          <IconButton
            onClick={handlePrint}
            size="small"
            sx={{
              backgroundColor: 'background.paper',
              boxShadow: 1,
              width: 28,
              height: 28,
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
              },
            }}
          >
            <PrintIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box id={title}>
        {children}
      </Box>
    </Box>
  );
};