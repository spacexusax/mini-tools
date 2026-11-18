import { createFileRoute } from "@tanstack/react-router";
import { QrStudio } from "@/components/qr-studio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "二维码生成器" },
      {
        name: "description",
        content: "输入网址或文字，实时预览二维码。可调节前景色、背景色、尺寸和纠错等级，并下载 PNG。",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return <QrStudio />;
}
