"use client";

import { SignInButton } from "@clerk/nextjs";

export function SignInModalButton() {
  return (
    <SignInButton mode="modal">
      <button className="group flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg glass-button h-14 px-5 shadow-lg">
        <span className="text-white text-base font-bold tracking-wide">
          여행가서 길 잃어버리지 말고 당장 시작하기
        </span>
      </button>
    </SignInButton>
  );
}
