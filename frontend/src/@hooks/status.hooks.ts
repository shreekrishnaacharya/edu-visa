import { useInvalidate, useResource, useUpdate } from "@refinedev/core";
// import { Status } from "@common/all.enum";
import { IRecord, IResourceRecord, IStatusHook } from "../interfaces";

export function useUpdater(resourceRecord: IResourceRecord): IStatusHook {
    const { mutate, data, isLoading } = useUpdate();
    const { resource } = useResource();

    let res = resourceRecord.resource ? resourceRecord.resource : resource ? resource.name : ""
    // const stateres = res + "/state"
    const returnData = data ? data.data as IRecord : resourceRecord.record
    const update = (values:object) => {
        mutate({
            resource: res,
            values: values,
            id: resourceRecord.record.id,
            invalidates: ["all"]
        });
    }
    return [returnData, update, isLoading]

}