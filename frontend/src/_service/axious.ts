import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import { BASE_URL, REFRESH_KEY, TOKEN_KEY } from "@common/options";
import { HttpError } from "@refinedev/core";

export const axiosInstance: AxiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem(TOKEN_KEY);
    if (accessToken && config?.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  async (response: AxiosResponse) => {
    convertAxiosToFetchResponse(response);

    const data = response?.data;
    const errors = data?.errors;
    const originalRequest = response.config as AxiosRequestConfig & {
      _retry: boolean;
    };

    if (errors) {
      if (shouldRefreshToken(response) && !originalRequest?._retry) {
        try {
          const newTokens = await performTokenRefresh();
          if (newTokens) {
            originalRequest._retry = true;
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            }
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          handleAuthFailure();
          throw errors;
        }
        
        handleAuthFailure();
        throw errors;
      }

      SetResponseOk(response, false);
      throw errors;
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry: boolean;
    };

    // Handle 401 unauthorized responses only
    if (error.response?.status === 401 && !originalRequest?._retry) {
      const hasRefreshToken = localStorage.getItem(REFRESH_KEY);
      
      if (hasRefreshToken) {
        try {
          const newTokens = await performTokenRefresh();
          if (newTokens) {
            originalRequest._retry = true;
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            }
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          handleAuthFailure();
        }
      } else {
        handleAuthFailure();
      }
    }

    const responseData = error.response?.data as Record<string, unknown> | undefined;
    const customError: HttpError = {
      message: (responseData?.message as string) ?? error.message ?? "An error occurred",
      statusCode: error.response?.status ?? 500,
      errors: responseData?.errors as HttpError["errors"],
    };
    SetResponseOk(error as unknown as AxiosResponse, false);
    return Promise.reject(customError);
  }
);

const convertAxiosToFetchResponse = (response: AxiosResponse) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  response.headers["forEach"] = function (callback: (value: string, header: string, obj: object) => void) {
    for (const header in this) {
      if (this.hasOwnProperty(header)) {
        callback(this[header], header, this);
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  response["text"] = async function () {
    return JSON.stringify(this.data);
  };
  SetResponseOk(response, true);
};

const SetResponseOk = (response: AxiosResponse, ok: boolean) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  response["ok"] = ok;
};

const shouldRefreshToken = (response: AxiosResponse) => {
  const errors = response?.data?.errors;
  if (!errors) return false;

  const currentRefreshToken = localStorage.getItem(REFRESH_KEY);
  if (!currentRefreshToken) return false;

  const hasAuthenticationError = errors.some((error: { extensions?: { code?: string } }) => {
    return error.extensions?.code === "UNAUTHENTICATED";
  });
  if (!hasAuthenticationError) return false;

  return true;
};

const performTokenRefresh = async () => {
  const currentRefreshToken = localStorage.getItem(REFRESH_KEY);
  const currentAccessToken = localStorage.getItem(TOKEN_KEY);
  
  if (!currentRefreshToken) {
    throw new Error('No refresh token available');
  }

  void currentAccessToken;
  try {
    // NestJS: POST /auth/token { refresh_token } -> { access_token, refresh_token }
    const response = await fetch(BASE_URL + "/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: currentRefreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const tokenData = await response.json();

    localStorage.setItem(TOKEN_KEY, tokenData.access_token);
    localStorage.setItem(REFRESH_KEY, tokenData.refresh_token);

    return { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token };
  } catch (error) {
    clearStoredTokens();
    throw error;
  }
};

const handleAuthFailure = () => {
  clearStoredTokens();
  
  // Check if already on login page to avoid unnecessary redirect
  const currentPath = window.location.pathname;
  if (currentPath !== '/guest/signin' && !currentPath.includes('/guest/signin')) {
    navigateToLoginPage();
  }
};

const clearStoredTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

const navigateToLoginPage = () => {
  // For client-side routing (React Router)
  window.location.href = '/guest/signin';
  
  // Alternative: if you have access to navigate function from useNavigate()
  // navigate('/login', { replace: true });
};
