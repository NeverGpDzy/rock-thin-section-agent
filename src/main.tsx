import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import App from "@/App";
import "@/styles/theme.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#17594a",
          colorInfo: "#17594a",
          borderRadius: 14,
          colorTextBase: "#163332",
          colorBgLayout: "#f4f5ef",
          fontFamily:
            "'Source Han Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
