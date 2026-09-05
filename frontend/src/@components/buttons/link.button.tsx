import { Button, ButtonTypeMap } from "@mui/material";
import { OverrideProps } from "@mui/material/OverridableComponent";
import { useNavigate } from "react-router";

export type ButtonProps<
    RootComponent extends React.ElementType = ButtonTypeMap['defaultComponent'],
    AdditionalProps = {},
> = OverrideProps<ButtonTypeMap<AdditionalProps, RootComponent>, RootComponent> & {
    component?: React.ElementType;
    to: string
}

const LinkButton = (props: ButtonProps) => {
    const navigate = useNavigate();
    return <Button {...props} onClick={() => navigate(`/${props.to}`)}>{props.children}</Button>
}

export default LinkButton;