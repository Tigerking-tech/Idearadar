import { Link } from "next-view-transitions";
import Image from "next/image";
import React from "react";

export const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm mr-4  text-black px-2 py-1  relative z-20"
    >
      <div className="hidden lg:block">
        <Image
          width={25}
          height={25}
          alt="Creem White Logo"
          src={"/icon.png"}
        />
      </div>
      <span className="font-medium text-black dark:text-white">
        My Awesome Startup
      </span>
    </Link>
  );
};
