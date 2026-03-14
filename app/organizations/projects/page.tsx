"use client";

import { AuthContext } from "@/app/auth-wrapper";
import { OrganizationWorkspaceNav } from "@/components/organizations/OrganizationWorkspaceNav";
import { Button } from "@/components/ui/button";
import { type Asset, uploadApi } from "@/lib/asset-test-api";
import {
  type Organization,
  organizationApi,
} from "@/lib/organization-api";
import { spaceApi } from "@/lib/space-api";
import useAccessToken from "@/lib/use-access-token";
import { cn } from "@/lib/utils";
import {
  Bell,
  Clock3,
  HardDriveUpload,
  LayoutGrid,
  LoaderCircle,
  MoreVertical,
  PlayCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

const shellCardClass =
  "rounded-[28px] border border-white/8 bg-[#0f131d]/90 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur";

const STORAGE_KEY = "selected-organization-id";

const getProjectName = (asset: Asset) =>
  asset.unrealProjects?.[0]?.displayName ||
  asset.other3d?.[0]?.displayName ||
  asset.name;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const formatRelativeAge = (value?: string) => {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function OrganizationProjectsPage() {
  const router = useRouter();
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projectSpaceCounts, setProjectSpaceCounts] = useState<
    Record<string, number>
  >({});
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    const storedOrgId = window.localStorage.getItem(STORAGE_KEY);
    if (storedOrgId) {
      setSelectedOrgId(storedOrgId);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      window.localStorage.setItem(STORAGE_KEY, selectedOrgId);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    const loadOrganizations = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsBootstrapping(true);
      setPageError("");

      try {
        const nextOrganizations = accessToken
          ? await organizationApi.getOrganizationsForUser(accessToken)
          : [];
        setOrganizations(nextOrganizations);
        setSelectedOrgId((current) => {
          if (
            current &&
            nextOrganizations.some((organization) => organization.id === current)
          ) {
            return current;
          }

          return nextOrganizations[0]?.id ?? "";
        });
      } catch (error) {
        setPageError(
          getErrorMessage(
            error,
            tokenError || "Failed to load organizations.",
          ),
        );
      } finally {
        setIsBootstrapping(false);
      }
    };

    void loadOrganizations();
  }, [accessToken, isTokenLoading, tokenError]);

  useEffect(() => {
    setSelectedOrganization(
      organizations.find((item) => item.id === selectedOrgId) || null,
    );
  }, [organizations, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) {
      setAssets([]);
      setProjectSpaceCounts({});
      return;
    }

    let isMounted = true;

    const loadProjects = async () => {
      setPageError("");
      try {
        const [allAssets, spaces] = await Promise.all([
          uploadApi.getAllAssets(),
          spaceApi.getSpacesByOrganization(selectedOrgId, accessToken),
        ]);

        if (!isMounted) {
          return;
        }

        const filteredAssets = allAssets.slice(0,10);
        const counts = spaces.reduce<Record<string, number>>((acc, space) => {
          acc[space.projectId] = (acc[space.projectId] || 0) + 1;
          return acc;
        }, {});

        setAssets(filteredAssets);
        setProjectSpaceCounts(counts);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(getErrorMessage(error, "Failed to load projects."));
      }
    };

    void loadProjects();

    // return () => {
    //   isMounted = false;
    // };
  }, [accessToken, selectedOrgId]);

  const sortedAssets = useMemo(
    () =>
      [...assets].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [assets],
  );

  return (
    <div className="min-h-screen bg-[#111315] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1880px] gap-6">
        <OrganizationWorkspaceNav
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          selectedOrganization={selectedOrganization}
          isOrgMenuOpen={isOrgMenuOpen}
          onToggleOrgMenu={() => setIsOrgMenuOpen((current) => !current)}
          onSelectOrg={(orgId) => {
            setSelectedOrgId(orgId);
            setIsOrgMenuOpen(false);
          }}
        />

        <main className={cn(shellCardClass, "min-h-[860px] flex-1 p-6 md:p-8")}>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight md:text-[30px]">
                My projects
              </h1>
              <p className="mt-2 text-[13px] text-white/50 md:text-sm">
                Browse every project in {selectedOrganization?.name || "your organization"}.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-white/10 p-3 text-white transition hover:bg-white/8"
              >
                <Bell className="h-5 w-5" />
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#090d16]">
                {getInitials(user?.firstName || user?.email || "U")}
              </div>
            </div>
          </div>

          {pageError ? (
            <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {pageError}
            </div>
          ) : null}
          {!accessToken && tokenError ? (
            <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {tokenError}
            </div>
          ) : null}

          {isBootstrapping ? (
            <div className="flex h-[520px] items-center justify-center text-white/70">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
              Loading projects...
            </div>
          ) : (
            <section className="rounded-[28px] border border-white/6 bg-white/[0.03] p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-[40px] font-semibold tracking-tight text-white">
                    My projects
                  </h2>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <Button
                    onClick={() => router.push("/AssetManager/upload")}
                    className="h-12 rounded-2xl bg-[#6f4cff] px-6 text-base font-semibold text-white hover:bg-[#7d58ff]"
                  >
                    + New Project
                  </Button>
                  <p className="text-sm text-white/45">Sort by Created</p>
                </div>
              </div>

              {sortedAssets.length === 0 ? (
                <div className="mt-8 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                  <p className="text-lg font-medium text-white/70">
                    No projects found for this organization.
                  </p>
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {sortedAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => router.push(`/organizations/projects/${asset.id}`)}
                      className="flex w-full items-center gap-5 rounded-[24px] border border-white/6 bg-white/[0.04] px-5 py-5 text-left transition hover:border-white/14 hover:bg-white/[0.06]"
                    >
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[22px] border border-white/8 bg-[#2a2c30] text-4xl font-semibold text-white/75">
                        <LayoutGrid className="h-12 w-12 text-white/70" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="truncate text-[20px] font-semibold text-white">
                            {getProjectName(asset)}
                          </h3>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-x-7 gap-y-3 text-[15px] text-white/72">
                          <span className="flex items-center gap-2">
                            <HardDriveUpload className="h-4 w-4 text-white/50" />
                            1gb
                          </span>
                          <span className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-white/50" />
                            {formatRelativeAge(asset.updatedAt)}
                          </span>
                          <span className={asset.buildStatus === "COMPLETED" ? "text-emerald-300" : "text-red-300"}>
                            [{asset.buildStatus === "COMPLETED" ? "deployed" : asset.buildStatus}]
                          </span>
                          <span className="flex items-center gap-2">
                            <PlayCircle className="h-4 w-4 text-white/50" />
                            {projectSpaceCounts[asset.id] || 0} spaces
                          </span>
                        </div>
                      </div>

                      <MoreVertical className="h-5 w-5 text-white/65" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
