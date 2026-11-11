import { cn } from "@/lib/utils";

import {
  IconArrowsSplit2,
  IconBrandYoutube,
  IconEaseInOut,
  IconHelp,
  IconTerminal2,
  IconZoomIn,
} from "@tabler/icons-react";

export const GridFeatures = () => {
  const features = [
    {
      title: "Landing Page",
      description:
        "Get started with a fully optimized, SEO-friendly landing page, ready to drive traffic from day one. ",
      icon: <IconTerminal2 />,
    },
    {
      title: "Payments",
      description:
        "Integrated payment solutions allow you to start accepting payments within seconds, with no setup hassle.",
      icon: <IconEaseInOut />,
    },
    {
      title: "Email",
      description:
        "Built-in email support right out of the box, ensuring seamless communication with your users. (comming soon)",
      icon: <IconBrandYoutube />,
    },
    {
      title: "Waiting list",
      description: "Capture leads from day one, even before your product is fully launched, with an easy-to-setup waiting list.",
      icon: <IconArrowsSplit2 />,
    },
    {
      title: "Analytics",
      description:
        "Track your growth and make data-driven decisions with integrated analytics, so you're never launching blind. (comming soon)",
      icon: <IconBrandYoutube />,
    },
    {
      title: "SSO (Single Sign-On)",
      description: "Seamless SSO login forms powered by Auth.js, ready to use for secure and easy user authentication.",
      icon: <IconZoomIn />,
    }
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  relative z-10 py-10">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
};

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r  py-10 relative group dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 3 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {index < 3 && (
        <div className="opacity-0 group-hover:opacity-100 transition duration-200 group absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 3 && (
        <div className="opacity-0 group-hover:opacity-100 transition duration-200 group absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10">{icon}</div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-[#ffbe98] transition duration-200" />
        <span className="group-hover:translate-x-2 transition duration-200 inline-block">
          {title}
        </span>
      </div>
      <p className="text-sm max-w-xs mx-auto relative z-10">
        {description}
      </p>
    </div>
  );
};
