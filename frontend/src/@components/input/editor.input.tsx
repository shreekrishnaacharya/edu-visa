import { Grid2 as Grid } from '@mui/material';
import { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type EditorEditProps = {
    editable: string
    height?: number | string
    width: number | string
    setEditable: (value: string) => void
    quillRef?: React.RefObject<ReactQuill>
}
export const QuillInput = ({ editable, width, height = '400px', setEditable, quillRef }: EditorEditProps) => {
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const modules = {
        toolbar: [
            [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['bold', 'italic', 'underline'],
            ['link', 'image'],
            ['fullscreen'],
        ],
    };

    // Custom fullscreen button handler for toolbar
    const fullscreenButton = (quill: any) => {
        const fullscreenButton = document.createElement('button');
        fullscreenButton.innerText = '⛶'; // You can use any icon for fullscreen
        fullscreenButton.classList.add('ql-fullscreen');

        fullscreenButton.addEventListener('click', () => {
            toggleFullscreen(); // Toggle fullscreen on button click
        });

        return fullscreenButton;
    };
    return (
        <>
            <Grid size={12}>
                <div
                    style={{
                        width: isFullscreen ? '100vw' : width,
                        height: isFullscreen ? '100vh' : height,
                        transition: 'all 0.3s ease',
                        position: isFullscreen ? 'fixed' : 'relative',
                        top: isFullscreen ? 0 : 'auto',
                        left: isFullscreen ? 0 : 'auto',
                        zIndex: isFullscreen ? 999 : 'auto',
                    }}
                >
                    <ReactQuill
                        ref={quillRef}
                        theme="snow"
                        value={editable}
                        style={{ width: width, height: isFullscreen ? '100vh' : `${(parseInt(height.toString()) - 50)}px` }}
                        modules={modules}
                        onChange={setEditable}
                    />
                </div>
            </Grid>
        </>
    );
};