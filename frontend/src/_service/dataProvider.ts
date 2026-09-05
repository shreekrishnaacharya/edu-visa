import { AxiosInstance } from "axios";
import { stringify } from "query-string";
import { DataProvider } from "@refinedev/core";
import { generateSort, generateFilter } from "@refinedev/simple-rest";

type MethodTypes = "get" | "delete" | "head" | "options";
type MethodTypesWithBody = "post" | "put" | "patch";

export const dataProvider = (
  apiUrl: string,
  httpClient: AxiosInstance,
): Omit<
  Required<DataProvider>,
  "createMany" | "updateMany" | "deleteMany"
> => ({
  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    const formattedResource = resource.startsWith("/")
      ? resource.slice(1)
      : resource;
    const url = `${apiUrl}/${formattedResource}`;
    let { current = 1, pageSize = 100, mode = "server" } = pagination ?? {};
    const { headers: headersFromMeta, method, customQuery } = meta ?? {};
    const requestMethod = (method as MethodTypes) ?? "get";
    const queryFilters = generateFilter(filters);

    const query: {
      _start?: number;
      _end?: number;
      _sort?: string;
      _order?: string;
    } = {};

    if (mode === "client") {
      query._start = (current - 1) * pageSize;
      query._end = 1000;
    } else {
      query._start = (current - 1) * pageSize;
      query._end = current * pageSize;
    }
    const generatedSort = generateSort(sorters);
    if (generatedSort) {
      const { _sort, _order } = generatedSort;
      query._sort = _sort.join(",");
      query._order = _order.join(",");
    }
    let urlQuery = `${url}`;
    let concat = "?";
    if (query && Object.keys(query).length > 0) {
      urlQuery += concat + stringify(query);
      concat = "&";
    }
    if (queryFilters && Object.keys(queryFilters).length > 0) {
      urlQuery += concat + stringify(queryFilters);
      concat = "&";
    }
    if (customQuery && Object.keys(customQuery).length > 0) {
      urlQuery += concat + stringify(customQuery);
    }
    const { data } = await httpClient[requestMethod](urlQuery, {
      headers: headersFromMeta,
    });
    const dat = {
      data: data.elements ? data.elements : data.data,
      total: data.totalElements ? data.totalElements : data.length,
    };
    return dat;
  },

  getMany: async ({ resource, ids, meta }) => {
    const { headers, method } = meta ?? {};
    const requestMethod = (method as MethodTypes) ?? "get";
    const formattedResource = resource.startsWith("/")
      ? resource.slice(1)
      : resource;
    const url = `${apiUrl}/${formattedResource}`;
    const { data } = await httpClient[requestMethod](
      `${url}?${stringify({ id: ids })}`,
      { headers },
    );
    return {
      data,
    };
  },

  create: async ({ resource, variables, meta }) => {
    const formattedResource = resource.startsWith("/")
      ? resource.slice(1)
      : resource;
    const url = `${apiUrl}/${formattedResource}`;

    const { headers, method } = meta ?? {};
    const requestMethod = (method as MethodTypesWithBody) ?? "post";

    const { data } = await httpClient[requestMethod](url, variables, {
      headers,
    });

    return {
      data,
    };
  },

  update: async ({ resource, id, variables, meta }) => {
    const formattedResource = resource.startsWith("/")
      ? resource.slice(1)
      : resource;
    const url = `${apiUrl}/${formattedResource}/${id}`;

    const { headers, method } = meta ?? {};
    const requestMethod = (method as MethodTypesWithBody) ?? "patch";

    const { data } = await httpClient[requestMethod](url, variables, {
      headers,
    });

    return {
      data,
    };
  },

  getOne: async ({ resource, id, meta }) => {
    const formattedResource = resource.startsWith("/")
      ? resource.slice(1)
      : resource;
    let url = `${apiUrl}/${formattedResource}/${id}`;

    const { headers, method, customQuery } = meta ?? {};
    const requestMethod = (method as MethodTypes) ?? "get";
    if (customQuery && Object.keys(customQuery).length > 0) {
      url += "?" + stringify(customQuery);
    }
    const { data } = await httpClient[requestMethod](url, { headers });

    return {
      data: data,
    };
  },

  deleteOne: async ({ resource, id, variables, meta }) => {
    const formattedResource = resource.startsWith("/")
      ? resource.slice(1)
      : resource;
    const url = `${apiUrl}/${formattedResource}/${id}`;

    const { headers, method } = meta ?? {};
    const requestMethod = (method as MethodTypesWithBody) ?? "delete";

    const { data } = await httpClient[requestMethod](url, {
      data: variables,
      headers,
    });

    return {
      data,
    };
  },

  getApiUrl: () => {
    return apiUrl;
  },

  custom: async ({
    url,
    method,
    filters,
    sorters,
    payload,
    query,
    headers,
    meta,
  }) => {
    let requestUrl = `${url}?`;

    const { customQuery } = meta ?? {};
    if (customQuery && Object.keys(customQuery).length > 0) {
      requestUrl = `${requestUrl}&${stringify(customQuery)}`;
    }
    if (sorters) {
      const generatedSort = generateSort(sorters);
      if (generatedSort) {
        const { _sort, _order } = generatedSort;
        const sortQuery = {
          _sort: _sort.join(","),
          _order: _order.join(","),
        };
        requestUrl = `${requestUrl}&${stringify(sortQuery)}`;
      }
    }

    if (filters) {
      const filterQuery = generateFilter(filters);
      requestUrl = `${requestUrl}&${stringify(filterQuery)}`;
    }

    if (query) {
      requestUrl = `${requestUrl}&${stringify(query)}`;
    }

    let axiosResponse;
    switch (method) {
      case "put":
      case "post":
      case "patch":
        axiosResponse = await httpClient[method](url, payload, {
          headers,
        });
        break;
      case "delete":
        axiosResponse = await httpClient.delete(url, {
          data: payload,
          headers: headers,
        });
        break;
      default:
        axiosResponse = await httpClient.get(requestUrl, {
          headers,
        });
        break;
    }

    const { data } = axiosResponse;

    return Promise.resolve({ data });
  },
});
