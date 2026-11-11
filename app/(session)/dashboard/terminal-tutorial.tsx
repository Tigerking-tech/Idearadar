"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";

interface Step {
  id: number;
  content: React.ReactNode;
  waitForConfirmation: boolean;
}

const envContent = `DATABASE_URL="file:./dev.db"

CREEM_API_KEY="creem_test_my-secret-api-key"

BETTER_AUTH_SECRET="my-random-auth-secret"

SUCCESS_URL=http://localhost:3000/account #Base URL of your app appended by /account

BETTER_AUTH_URL=http://localhost:3000 #Base URL of your app`;

const steps: Step[] = [
  {
    id: 1,
    content: (
      <>
        <p>Welcome to the Creem Template setup! 🚀</p>
        <p>
          First, you&apos;ll need to grab your API key from the Creem dashboard.
          For this template, we&apos;ll use test-mode.
        </p>
        <p>
          After getting your test mode API key, add it to your{" "}
          <span className="text-emerald-400">.env</span> file:
        </p>
        <div className="my-4 bg-neutral-900/50 p-4 font-mono text-sm rounded">
          <pre className="whitespace-pre-wrap">{envContent}</pre>
        </div>
        <p className="text-emerald-400">
          Press Y to confirm you&apos;ve added your API key.
        </p>
      </>
    ),
    waitForConfirmation: true,
  },
  {
    id: 2,
    content: (
      <>
        <p>Great! Now let&apos;s set up your test products.</p>
        <p>Head to your test-mode dashboard and create two products:</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>One subscription-based product</li>
          <li>One one-time payment product</li>
        </ul>
        <p className="text-emerald-400">
          Press Y once you&apos;ve created both products.
        </p>
      </>
    ),
    waitForConfirmation: true,
  },
  {
    id: 3,
    content: (
      <>
        <p>
          Now, we need to make your local app accessible from the internet for
          webhooks.
        </p>
        <p>
          We recommend using ngrok, but you can use any reverse proxy tool. This
          is crucial for:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Receiving webhook notifications from Creem</li>
          <li>Testing your integration end-to-end</li>
        </ul>
        <p>To set up ngrok, follow their quickstart guide at:</p>
        <a
          href="https://ngrok.com/docs/getting-started/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:underline"
        >
          https://ngrok.com/docs/getting-started/
        </a>
        <p className="text-emerald-400">
          Press Y if you have a reverse proxy set up and running.
        </p>
      </>
    ),
    waitForConfirmation: true,
  },
  {
    id: 4,
    content: (
      <>
        <p>Final step! Let&apos;s set up your webhook.</p>
        <p>In your Creem test-mode dashboard:</p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
          <li>Navigate to the Developers tab</li>
          <li>Click on Webhooks</li>
          <li>Add a new webhook</li>
          <li>Use your public URL (not localhost!)</li>
          <li>Append /api/webhook to your URL</li>
        </ol>
        <p>
          This webhook will notify your app of successful purchases and
          subscription renewals. It should look something like this:
        </p>
        <div className="my-4 bg-neutral-900/50 p-4 font-mono text-sm rounded">
          <pre className="whitespace-pre-wrap">
            {"https://sheep-happy-deer.ngrok-free.app/api/webhook"}
          </pre>
        </div>
        <p className="text-emerald-400">
          Press Y once you&apos;ve added the webhook.
        </p>
      </>
    ),
    waitForConfirmation: true,
  },
  {
    id: 5,
    content: (
      <>
        <p>Perfect! Everything is set up. Loading your products...</p>
        <div className="flex w-full mt-4">
          <div className="flex gap-0.5 min-w-full">
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                className="flex-1 h-4 bg-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.05,
                  delay: (i * 5) / 50,
                }}
              />
            ))}
          </div>
        </div>
      </>
    ),
    waitForConfirmation: false,
  },
];

interface Props {
  onComplete: () => void;
}

export function TerminalTutorial({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [_displayedContent, setDisplayedContent] = useState("");
  const [_isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUserNameLoaded, setIsUserNameLoaded] = useState(false);

  async function handleGetSession() {
    const { data, error } = await authClient.getSession();
    if (error) {
      console.error("Error fetching session:", error);
      return;
    }
    const userName = data?.user?.name.split("@")[0] || "User";
    setUserName(userName);
    setIsUserNameLoaded(true);
  }

  useEffect(() => {
    handleGetSession();
  }, []);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (!isUserNameLoaded) return;

    if (currentStep >= steps.length) {
      onComplete();
      return;
    }

    const content = steps[currentStep].content as any;
    const textContent = content.props.children
      .map((child: any) => {
        if (typeof child === "string") return child;
        if (child?.props?.children) {
          if (Array.isArray(child.props.children)) {
            return child.props.children.join("");
          }
          return child.props.children;
        }
        return "";
      })
      .join("\n");

    let currentIndex = 0;
    setDisplayedContent("");
    setIsTyping(true);

    const typingInterval = setInterval(() => {
      if (currentIndex < textContent.length) {
        setDisplayedContent((prev) => prev + textContent[currentIndex]);
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);

        if (currentStep === steps.length - 1) {
          setIsLoading(true);
          setTimeout(() => {
            setIsLoading(false);
            onComplete();
          }, 5000);
        }
      }
    }, 10);

    return () => clearInterval(typingInterval);
  }, [currentStep, onComplete, isUserNameLoaded]);

  useEffect(() => {
    if (!isUserNameLoaded) return;
    if (!steps[currentStep]?.waitForConfirmation) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "y") {
        setCurrentStep((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentStep, isUserNameLoaded]);

  return (
    <div className="font-mono text-sm leading-6">
      {isUserNameLoaded ? (
        <>
          <div className="flex items-center text-neutral-400 mb-2">
            <span className="text-emerald-400">{userName}</span>
            <span className="mx-1">at</span>
            <span className="text-orange-400">{userName}-MBP</span>
            <span className="mx-1">in</span>
            <span className="text-green-400">~/creem-template</span>
            <span className="mx-1">(main)</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1"
            >
              <div className="whitespace-pre-wrap">
                {steps[currentStep]?.content}
              </div>
              {showCursor && !isLoading && (
                <span className="inline-block w-2 h-4 bg-white/70 ml-1 align-middle animate-blink" />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        <div className="flex items-center">
          <span className="inline-block w-2 h-4 bg-white/70 animate-blink" />
        </div>
      )}
    </div>
  );
}
