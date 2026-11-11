"use client";

import Balancer from "react-wrap-balancer";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Code2, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

import { Badge } from "@/components/ui/badge";
import { TerminalButton } from "@/components/ui/terminal-button";

const fadeInUpVariant = {
  hidden: { y: 40, opacity: 0 },
  visible: (delay = 0) => ({
    y: 0,
    opacity: 1,
    transition: {
      ease: "easeOut",
      duration: 0.5,
      delay,
    },
  }),
};

const FeatureCard = ({ icon: Icon, title, description }: { 
  icon: typeof Code2;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center p-6 rounded-xl bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800">
    <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-4">
      <Icon className="w-6 h-6 text-neutral-600 dark:text-neutral-300" />
    </div>
    <h3 className="font-medium text-lg mb-2 text-neutral-900 dark:text-white">{title}</h3>
    <p className="text-sm text-neutral-600 dark:text-neutral-300 text-center">{description}</p>
  </div>
);

export const Hero = () => {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setIsLoggedIn(!!data?.user);
    });
  }, []);

  return (
    <>
      {/* Base Layer: Primary gradient background creating depth */}
      <div className="fixed inset-0 w-screen h-screen bg-gradient-to-b from-black via-neutral-950 to-neutral-900 dark:from-black dark:via-neutral-950 dark:to-neutral-900 -z-50" />
      
      {/* Texture Layer: Subtle noise overlay for visual richness */}
      <div className="fixed inset-0 w-screen h-screen opacity-[0.15] dark:opacity-[0.05] -z-40 [background-image:url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjA1Ii8+PC9zdmc+')]" />

      {/* Pattern Layer: Dot matrix with radial fade for depth */}
      <div className="fixed inset-0 w-screen h-screen bg-[radial-gradient(#333333_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 dark:opacity-20 -z-30" />

      {/* Ambient Layer: Gradient orbs for dynamic lighting effects */}
      <div className="fixed inset-0 w-screen h-screen overflow-hidden -z-20">
        {/* Top-right ambient light source */}
        <div className="absolute -right-[40%] -top-[40%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-neutral-800/40 via-transparent to-transparent dark:from-neutral-800/20 blur-3xl" />
        {/* Bottom-left ambient light source */}
        <div className="absolute -left-[40%] -bottom-[40%] w-[80%] h-[80%] rounded-full bg-gradient-to-tr from-neutral-800/40 via-transparent to-transparent dark:from-neutral-800/20 blur-3xl" />
      </div>

      {/* Grid Layer: Structural visual element */}
      <div className="fixed inset-0 w-screen h-screen bg-[linear-gradient(rgba(51,51,51,0.05)_1px,transparent_1px),linear-gradient(to_right,rgba(51,51,51,0.05)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_40%,transparent_100%)] -z-10" />

      {/* Main content */}
      <section className="relative min-h-screen w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-32 pb-24">
          <motion.div
            className="flex justify-center"
            initial="hidden"
            animate="visible"
            variants={fadeInUpVariant}
          >
            <Badge variant="secondary" className="rounded-full px-4 py-1 bg-white/80 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 backdrop-blur-sm border-0 shadow-sm">
              <span className="text-sm">Powered by Creem SDK</span>
            </Badge>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-5xl lg:text-7xl font-bold max-w-4xl mx-auto text-center mt-6 text-neutral-900 dark:text-white"
            initial="hidden"
            animate="visible"
            variants={fadeInUpVariant}
          >
            <Balancer>
              Next.js Template for Creem Integration
            </Balancer>
          </motion.h1>

          <motion.p
            className="text-center mt-6 text-lg text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={fadeInUpVariant}
            custom={0.2}
          >
            <Balancer>
              A production-ready template demonstrating seamless integration with Creem&apos;s payment infrastructure. Built with Next.js 14, TypeScript, and Tailwind CSS.
            </Balancer>
          </motion.p>

          <motion.div
            className="flex items-center gap-4 justify-center mt-8"
            initial="hidden"
            animate="visible"
            variants={fadeInUpVariant}
            custom={0.4}
          >
            <TerminalButton
              onClick={() => router.push(isLoggedIn ? "/dashboard" : "/signup")}
              prompt="$"
              command="cd"
              path="/demo-store"
            />
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16"
            initial="hidden"
            animate="visible"
            variants={fadeInUpVariant}
            custom={0.6}
          >
            <FeatureCard
              icon={Code2}
              title="Simple Integration"
              description="Start accepting payments in minutes with our straightforward API and SDK"
            />
            <FeatureCard
              icon={Zap}
              title="Webhook Ready"
              description="Real-time payment notifications and automated order fulfillment"
            />
            <FeatureCard
              icon={Wallet}
              title="Test Mode"
              description="Development environment with simulated transactions for testing"
            />
          </motion.div>
        </div>
      </section>
    </>
  );
};
