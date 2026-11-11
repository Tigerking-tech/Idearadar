"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ApiPricingTableDto } from "@/types/creem";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import { billingPeriodDisplay, formatMoney } from "@/lib/formatter";
import { useRouter } from "next/navigation";

interface PricingProps {
    table: ApiPricingTableDto;
}

export function Pricing({ table }: PricingProps) {
    const router = useRouter();
    const colStyle = 'xl:grid-cols-' + table.products.length;
    return (
        <div className="relative">
            <div className={cn("mx-auto mt-4 md:mt-20 grid relative z-20 grid-cols-1 gap-4 items-center md:grid-cols-2", colStyle)}>
                {table.products.map((product, tierIdx) => (
                    <div
                        key={product.id}
                        className={cn(
                            product.featured
                                ? "relative bg-[radial-gradient(164.75%_100%_at_50%_0%,#334155_0%,#0F172A_48.73%)]  shadow-2xl"
                                : " bg-white dark:bg-black",
                            "rounded-lg px-6 py-8 sm:mx-8 lg:mx-0  h-full flex flex-col justify-between"
                        )}
                    >
                        <div className="">
                            <h3
                                id={product.id}
                                className={cn(
                                    "text-white text-base font-semibold leading-7"
                                )}
                            >
                                {product.name}
                            </h3>
                            <p className="mt-4">
                                <motion.span
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className={cn(
                                        "text-4xl font-bold tracking-tight  inline-block",
                                        product.featured
                                            ? "text-white"
                                            : "text-neutral-900 dark:text-neutral-200"
                                    )}
                                >
                                    {formatMoney(product.price, product.currency)} / {billingPeriodDisplay(product.billing_period)}
                                </motion.span>
                            </p>
                            <p
                                className={cn(
                                    product.featured
                                        ? "text-neutral-300"
                                        : "text-neutral-600 dark:text-neutral-300",
                                    "mt-6 text-sm leading-7  h-12 md:h-12 xl:h-12"
                                )}
                            >
                                {product.description}
                            </p>
                            <ul
                                role="list"
                                className={cn(
                                    product.featured
                                        ? "text-neutral-300"
                                        : "text-neutral-600 dark:text-neutral-300",
                                    "mt-8 space-y-3 text-sm leading-6 sm:mt-10"
                                )}
                            >


                                {product.features.map((feature) => (
                                    <li key={feature} className="flex gap-x-3">
                                        <IconCircleCheckFilled
                                            className={cn(
                                                product.featured
                                                    ? "text-white"
                                                    : "text-muted dark:text-muted-dark",
                                                "h-6 w-5 flex-none"
                                            )}
                                            aria-hidden="true"
                                        />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <Button
                                onClick={() => { router.push(product.payment_link); }}
                                className={cn(
                                    false
                                        ? "bg-white text-black shadow-sm hover:bg-white/90 focus-visible:outline-white"
                                        : "",
                                    "mt-8 rounded-full py-2.5 px-3.5 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:mt-10 block w-full"
                                )}
                            >
                                Subscribe
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
