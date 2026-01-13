import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <header className="flex justify-between items-center px-4 h-16">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/RUrogo.png"
          alt="RootUs logo"
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg"
        />
        <span className="text-xl font-bold">RootUs</span>
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
