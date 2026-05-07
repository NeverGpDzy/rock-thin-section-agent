import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Space, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { loginUser } from "@/api/auth";
import { env } from "@/config/env";
import { useAuthStore } from "@/store/authStore";
import type { LoginPayload } from "@/types/user";

export const LoginPage = () => {
  const [form] = Form.useForm<LoginPayload>();
  const setToken = useAuthStore((state) => state.setToken);
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      setToken(data.access_token);
      message.success("登录成功。");
      navigate("/", { replace: true });
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : "登录失败");
    },
  });

  return (
    <div className="auth-layout">
      <Card className="auth-card" bordered={false}>
        <Typography.Title level={2} className="auth-card__title">
          登录系统
        </Typography.Title>
        <Typography.Text type="secondary" className="auth-card__subtitle">
          岩石薄片智能分析 Agent 演示平台
        </Typography.Text>

        {env.useMock ? (
          <Alert
            type="info"
            showIcon
            message="当前为 Mock 演示模式"
            description="演示账号：demo_user / demo_pass_123"
            style={{ marginBottom: 20 }}
          />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => loginMutation.mutate(values)}
          initialValues={{
            username: env.useMock ? "demo_user" : "",
            password: env.useMock ? "demo_pass_123" : "",
          }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="请输入用户名" size="large" disabled={loginMutation.isPending} />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" size="large" disabled={loginMutation.isPending} />
          </Form.Item>

          <Space direction="vertical" style={{ width: "100%" }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loginMutation.isPending}
            >
              进入系统
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};
