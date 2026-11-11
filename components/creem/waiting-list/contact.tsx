"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

import Link from "next/link";
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import axios from "axios";
/** 模板原引用了不存在的 @/app/api/waitlist/route，改为本地请求体类型。 */
interface WaitlistRequest {
  name: string;
  email: string;
  company: string;
  message: string;
}

const formSchema = z.object({
  name: z
    .string({
      required_error: "Please enter your name",
    })
    .min(1, "Please enter email"),
  email: z
    .string({
      required_error: "Please enter email",
    })
    .email("Please enter valid email")
    .min(1, "Please enter email"),
  company: z
    .string({
      required_error: "Please enter your company's name",
    })
    .min(1, "Please enter your company's name"),
  message: z
    .string({
      required_error: "Please enter your message",
    })
    .min(1, "Please enter your message"),
});

export type LoginUser = z.infer<typeof formSchema>;

export function ContactForm() {
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
  const form = useForm<LoginUser>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
    },
  });

  async function onSubmit(values: LoginUser) {
    try {
      setFormSubmitted(true);
      const { data } = await axios.post(`/api/contact`, {
        email: values.email,
        message: values.message,
        company: values.company,
        name: values.name,
      } as WaitlistRequest);

      if (data.success) {
        console.log("submitted form", values);
      }
    } catch (e) {
      console.log("error submitting form", e);
    }
  }

  const socials = [
    {
      title: "twitter",
      href: "https://twitter.com/creem_io",
      icon: <IconBrandX className="h-5 w-5 hover:text-black" />,
    },
    {
      title: "github",
      href: "https://github.com/armitage-labs",
      icon: <IconBrandGithub className="h-5 w-5 hover:text-black" />,
    },
    {
      title: "linkedin",
      href: "https://www.linkedin.com/company/creemio",
      icon: <IconBrandLinkedin className="h-5 w-5 hover:text-black" />,
    },
  ];

  return (
    <Form {...form}>
      <div className="flex relative z-20 items-center w-full justify-center px-4 py-4 lg:py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div>
            <h1 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-black dark:text-white">
              Join the waitlist
            </h1>
            <p className="mt-4 text-muted-dark  text-sm max-w-sm">
              Feel free to leave a message and we will get back to you as soon
              as possible
            </p>
          </div>

          <div className="py-10">
            <div>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium leading-6 text-neutral dark:text-muted-dark"
                      >
                        Full Name
                      </label>
                      <FormControl>
                        <div className="mt-2">
                          <Input
                            id="name"
                            type="name"
                            placeholder="John Doe"
                            className="block w-full px-4 rounded-md py-1.5 bg-white dark:bg-neutral-900 shadow-aceternity placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:text-white"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium leading-6 text-neutral dark:text-muted-dark"
                      >
                        Email address
                      </label>
                      <FormControl>
                        <div className="mt-2">
                          <Input
                            id="email"
                            type="email"
                            placeholder="hello@johndoe.com"
                            className="block w-full px-4 rounded-md py-1.5 bg-white dark:bg-neutral-900 shadow-aceternity text-black placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:text-white"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <label
                        htmlFor="company"
                        className="block text-sm font-medium leading-6 text-neutral dark:text-muted-dark"
                      >
                        Company
                      </label>
                      <FormControl>
                        <div className="mt-2">
                          <Input
                            id="company"
                            type="company"
                            placeholder="Creem IO, Inc"
                            className="block w-full px-4 rounded-md py-1.5 bg-white dark:bg-neutral-900 shadow-aceternity text-black placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:text-white"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <label
                        htmlFor="message"
                        className="block text-sm font-medium leading-6 text-neutral dark:text-muted-dark"
                      >
                        message
                      </label>
                      <FormControl>
                        <div className="mt-2">
                          <Textarea
                            rows={5}
                            id="message"
                            placeholder="Enter your message here"
                            className="block w-full bg-white dark:bg-neutral-900 px-4 rounded-md py-1.5  shadow-aceternity text-black placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:text-white"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Button className="w-full">Submit</Button>
                </div>
              </form>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-4 py-4">
            {socials.map((social) => (
              <Link href={social.href} key={social.title}>
                {social.icon}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Form>
  );
}
