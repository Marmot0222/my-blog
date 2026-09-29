import { LoginForm } from "@/components/admin/LoginForm";
import styles from "@/components/admin/admin.module.scss";
export default function LoginPage() {
  return (
    <main className={styles.login}>
      <h1>Ting Lab 管理</h1>
      <p>使用服务器初始化的管理员密码登录。</p>
      <LoginForm />
    </main>
  );
}
