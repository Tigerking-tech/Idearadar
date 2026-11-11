import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/creem/landing/container";
import { IconTerminal } from "@tabler/icons-react";

export function MainNav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container>
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <IconTerminal className="w-5 h-5 text-[#ffbe98]" />
              <span className="font-mono text-lg text-[#ffbe98]">~/creem</span>
            </Link>
            <div className="hidden md:flex gap-6">
              <Link
                href="https://www.creem.io"
                className="font-mono text-sm text-muted-foreground transition-colors hover:text-accent"
              >
                ./features
              </Link>
              <Link
                href="https://www.creem.io/pricing"
                className="font-mono text-sm text-muted-foreground transition-colors hover:text-accent"
              >
                ./pricing
              </Link>
              <Link
                href="https://docs.creem.io/"
                className="font-mono text-sm text-muted-foreground transition-colors hover:text-accent"
              >
                ./docs
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="font-mono">
              <Link href="/signin">login</Link>
            </Button>
            <Button variant="terminal" asChild className="font-mono">
              <Link href="/signup">register</Link>
            </Button>
          </div>
        </div>
      </Container>
    </nav>
  );
}

