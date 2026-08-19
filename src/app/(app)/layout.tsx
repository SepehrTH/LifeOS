import { redirect } from "next/navigation";
import CommandPalette from "@/components/CommandPalette";
import Navbar from "@/components/Navbar";
import { currentUser, signOut } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <>
      <Navbar user={user} signOutAction={doSignOut} />
      {children}
      <CommandPalette />
    </>
  );
}
