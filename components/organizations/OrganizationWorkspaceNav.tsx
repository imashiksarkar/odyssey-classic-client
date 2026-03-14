"use client";

import { cn } from "@/lib/utils";
import {
  Bell,
  Check,
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type WorkspaceOrganization = {
  id: string;
  name: string;
  domain?: string;
  logoSmallUrl?: string | null;
};

type OrganizationWorkspaceNavProps = {
  organizations: WorkspaceOrganization[];
  selectedOrgId: string;
  onSelectOrg: (orgId: string) => void;
  selectedOrganization: WorkspaceOrganization | null;
  isOrgMenuOpen: boolean;
  onToggleOrgMenu: () => void;
};

const navItems = [
  { label: "Projects", icon: LayoutGrid, href: "/organizations/projects" },
  { label: "Spaces", icon: FolderKanban, href: "/organizations/spaces" },
  {
    label: "Organization settings",
    icon: Settings,
    href: "/organizations",
  },
];


const getInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function OrganizationWorkspaceNav({
  organizations,
  selectedOrgId,
  onSelectOrg,
  selectedOrganization,
  isOrgMenuOpen,
  onToggleOrgMenu,
}: OrganizationWorkspaceNavProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full max-w-[320px] shrink-0">
      <div className="space-y-5">
        <div className="relative">
          <button
            type="button"
            onClick={onToggleOrgMenu}
            className="flex w-full items-center gap-3 rounded-[24px] border border-white/10 bg-[#16191d] px-4 py-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-[#6f4cff] to-[#3058ff] text-base font-semibold text-white">
              {getInitials(selectedOrganization?.name || "Org")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-white">
                {selectedOrganization?.name || "Select organization"}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-white/72 transition-transform",
                isOrgMenuOpen && "rotate-180",
              )}
            />
          </button>

          {isOrgMenuOpen ? (
            <div className="absolute inset-x-0 top-[calc(100%+0.75rem)] z-20 rounded-[22px] border border-white/12 bg-[#181c25] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.48)]">
              <div className="space-y-2">
                {organizations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectOrg(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
                      item.id === selectedOrgId
                        ? "bg-white/10 text-white"
                        : "text-white/72 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold">
                      {getInitials(item.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-white/45">
                        {item.domain || ""}
                      </p>
                    </div>
                    {item.id === selectedOrgId ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[#16191d] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.45)]">
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon, href }) => {
              const isActive =
                pathname === href ||
                (href !== "/organizations" && pathname.startsWith(`${href}/`));

              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl px-4 py-4 text-[15px] font-medium transition",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/82 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-[#7952ff]" : "text-white",
                    )}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

         
        </div>
      </div>
    </aside>
  );
}
