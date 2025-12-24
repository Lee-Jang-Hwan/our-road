import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex-1 flex items-center justify-center py-8 px-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-[400px]",
            card: "shadow-none border rounded-xl",
            headerTitle: "text-xl font-bold",
            headerSubtitle: "text-muted-foreground",
            formButtonPrimary:
              "bg-primary hover:bg-primary/90 text-primary-foreground h-11",
            formFieldInput:
              "h-11 border-input focus:ring-2 focus:ring-primary/20",
            footerActionLink: "text-primary hover:text-primary/80",
          },
        }}
      />
    </main>
  );
}
