"use client";

import React from "react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { DesktopNavbar } from "./desktop-navbar";
// import { MobileNavbar } from "./mobile-navbar";
import { motion } from "framer-motion";
import { MobileNavbar } from "./mobile-navbar";
import { Background } from "./background";

const navItems = [
    {
        title: "Docs",
        link: "/docs",
    },
];

export default function Placeholder() {
    return (
        <div className="relative overflow-hidden ">
            <motion.nav
                initial={{
                    y: -80,
                }}
                animate={{
                    y: 0,
                }}
                transition={{
                    ease: [0.6, 0.05, 0.1, 0.9],
                    duration: 0.8,
                }}
                className="max-w-7xl  fixed top-4  mx-auto inset-x-0 z-50 w-[95%] lg:w-full"
            >
                <div className="hidden lg:block w-full">
                    <DesktopNavbar navItems={navItems} />
                </div>
                <div className="flex h-full w-full items-center lg:hidden ">
                    <MobileNavbar navItems={navItems} />
                </div>
            </motion.nav>
            <Background></Background>
            <main>

                <div className='flex flex-col items-center justify-center px-4 h-screen'>
                    <div className="h-full w-full rounded-md bg-neutral-950 relative flex flex-col items-center justify-center antialiased">
                        <div className="font-extralight text-base md:text-4xl dark:text-neutral-200 py-4">
                            Launch your startup in minutes, not days!
                        </div>
                        <HoverBorderGradient
                            containerClassName="rounded-full"
                            as="button"
                            className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2"
                        >
                            <span>Get Started</span>
                        </HoverBorderGradient>
                        <BackgroundBeams />
                    </div>
                </div>
            </main>
        </div>
    );
}
