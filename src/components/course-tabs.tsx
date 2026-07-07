"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CourseTabs({ courseId }: { courseId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/courses/${courseId}`, match: `/courses/${courseId}`, label: "Upload Materials", exact: true },
    { href: `/courses/${courseId}/chat`, match: `/courses/${courseId}/chat`, label: "Chat", exact: false },
    { href: `/courses/${courseId}/sessions/new`, match: `/courses/${courseId}/sessions`, label: "Practice sessions", exact: false },
  ];

  return (
    <nav className="flex gap-4 border-b border-sista-border text-sm" aria-label="Course sections">
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.match
          : pathname.startsWith(tab.match);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "border-b-2 border-sista-plum px-1 pb-2 font-semibold text-sista-plum"
                : "border-b-2 border-transparent px-1 pb-2 text-sista-muted hover:border-sista-border hover:text-sista-plum"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
