"use client";

import { useEffect, useState } from "react";

type Mode = "WEEK" | "MONTH" | "AGENDA";

export default function CalendarView({ email }: { email: string }) {
  const [mode, setMode] = useState<Mode>("WEEK");
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    const saved = localStorage.getItem("os.calendar.mode") as Mode | null;
    if (saved) setMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("os.calendar.mode", mode);
  }, [mode]);

  const params = new URLSearchParams({
    src: email,
    ctz: tz,
    mode,
    wkst: "2",
    bgcolor: "#ffffff",
    showTitle: "0",
    showPrint: "0",
    showCalendars: "0",
    showTz: "0",
    showNav: "1",
    showDate: "1",
    showTabs: "0",
  });
  const src = `https://calendar.google.com/calendar/embed?${params.toString()}`;

  return (
    <main className="page">
      <div className="bar">
        <h1>Calendar</h1>
        <span className="bar-sub">{email}</span>
        <div className="bar-actions">
          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            aria-label="Calendar view"
          >
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
            <option value="AGENDA">Agenda</option>
          </select>
          <a
            className="btn btn-ghost"
            href="https://calendar.google.com/calendar/u/0/r"
            target="_blank"
            rel="noreferrer"
          >
            Open in Google
          </a>
        </div>
      </div>

      <div className="cal-frame">
        <iframe key={`${mode}-${tz}`} src={src} title="Google Calendar" />
      </div>
    </main>
  );
}
