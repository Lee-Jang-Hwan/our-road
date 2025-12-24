import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { LuRoute } from "react-icons/lu";

const Navbar = () => {
  return (
    <header className="flex justify-between items-center px-4 h-16">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <LuRoute className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold">OurRoad</span>
      </Link>
      <div className="flex gap-3 items-center">
        <SignedOut>
          <SignInButton mode="redirect">
            <Button size="sm">로그인</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-9 h-9",
              },
            }}
          />
        </SignedIn>
      </div>
    </header>
  );
};

export default Navbar;
