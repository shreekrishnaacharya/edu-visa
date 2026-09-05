import { Avatar, Chip } from "@mui/material"
import { IFileResponse } from "src/interfaces"
import FolderIcon from "@mui/icons-material/Folder";

interface UserChipProps {
    name: string
    image: IFileResponse
}
export const UserChip = ({ name, image }: UserChipProps) => {
    return <Chip
        avatar={<Avatar alt={name} src={image?.url} />}
        label={name}
        variant="outlined"
    />
}

export const FolderChip = ({ name }: { name: string }) => {
    return <Chip
        avatar={<FolderIcon />}
        label={name}
        variant="outlined"
    />
}