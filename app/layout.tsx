import "./globals.css";

export const metadata = {
  title: "曼荼羅目標管理テンプレート",
  description: "人生の目標を曼荼羅で整理し、日々の Todo まで繋げる Notion テンプレート",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
