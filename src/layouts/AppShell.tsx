import {
  BookOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Typography } from "antd";
import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const { Header, Content, Sider } = Layout;

export const AppShell = () => {
  const location = useLocation();

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/knowledge")) {
      return "/knowledge";
    }
    if (location.pathname.startsWith("/history")) {
      return "/history";
    }
    return "/agent";
  }, [location.pathname]);

  const menuItems = useMemo(
    () => [
      {
        key: "/agent",
        icon: <ExperimentOutlined />,
        label: <Link to="/agent">Agent 分析</Link>,
      },
      {
        key: "/knowledge",
        icon: <BookOutlined />,
        label: <Link to="/knowledge">知识库</Link>,
      },
      {
        key: "/history",
        icon: <ClockCircleOutlined />,
        label: <Link to="/history">分析历史</Link>,
      },
    ],
    [],
  );

  return (
    <Layout className="app-shell">
      <Sider
        breakpoint="lg"
        collapsedWidth="72"
        theme="light"
        width={220}
        className="app-shell__sider"
      >
        <div className="app-shell__brand">
          <div className="app-shell__brand-mark">岩</div>
          <div>
            <Typography.Title level={4} className="app-shell__brand-title">
              岩石薄片智能分析
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Agent 演示平台
            </Typography.Text>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          className="app-shell__menu"
          items={menuItems}
        />
      </Sider>

      <Layout style={{ minHeight: 0, height: "100vh", overflow: "hidden" }}>
        <Header className="app-shell__header">
          <div className="app-shell__header-inner">
            <div>
              <Typography.Title level={3} className="app-shell__header-title" style={{ margin: 0 }}>
                Agent 分析助手
              </Typography.Title>
            </div>
          </div>
        </Header>

        <Content className="app-shell__content">
          <div className="app-shell__content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
