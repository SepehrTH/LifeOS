import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import CalendarView from "@/components/CalendarView";

export default async function CalendarPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return <CalendarView email={user.email} />;
}
