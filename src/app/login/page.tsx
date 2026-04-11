import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#113238]">
      <form
        action={async () => {
          "use server";
          await signIn("microsoft-entra-id");
        }}
        className="flex flex-col items-center gap-6"
      >
        <h1 className="text-4xl font-semibold text-[#BFE3D3]">Concilio</h1>
        <button
          type="submit"
          className="rounded-lg bg-[#FF8C42] px-6 py-3 text-base font-medium text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
