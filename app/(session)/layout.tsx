// import Providers from "../providers/providers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CreeemTemplateDashboard } from "@/components/dashboard";
import { TmuxNav } from "./components/tmux-nav";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CreeemTemplateDashboard>
      <TmuxNav />
      <div className="p-6">{children}</div>
    </CreeemTemplateDashboard>
  );
}
