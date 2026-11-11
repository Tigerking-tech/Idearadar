import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

interface DashboardProps {
  children: React.ReactNode;
}

export function CreeemTemplateDashboard({ children }: DashboardProps) {
  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <div className="h-[100dvh] p-4 md:p-6">
        <div className={`${jetbrainsMono.className} h-full`}>
          <div className="flex flex-col h-full rounded-lg border border-neutral-800 bg-black/95 backdrop-blur-sm shadow-lg shadow-neutral-900/20">
            <div className="flex items-center gap-2 p-2 border-b border-neutral-800 flex-none">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center text-sm text-neutral-500">
                Creem Template Dashboard v1.0.0
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 