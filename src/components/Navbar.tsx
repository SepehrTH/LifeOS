"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const TABS = [
  { href: "/home", label: "Home" },
  { href: "/todo", label: "Todo" },
  { href: "/projects", label: "Projects" },
  { href: "/calendar", label: "Calendar" },
  { href: "/focus", label: "Focus" },
  { href: "/checkin", label: "Check-in" },
];

export default function Navbar({
  user,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <Link href="/home" className="nav-brand">
        OS
      </Link>

      <div className="nav-tabs">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="nav-tab"
            data-active={pathname === tab.href || pathname.startsWith(tab.href + "/")}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="nav-right">
        <ThemeToggle />
        <div className="nav-user">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="nav-avatar" src={user.image} alt="" />
          ) : (
            <div className="nav-avatar" />
          )}
          <span>{user.name ?? user.email}</span>
        </div>
        <form action={signOutAction}>
          <button className="nav-signout" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
