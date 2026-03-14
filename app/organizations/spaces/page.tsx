"use client";

import { AuthContext } from "@/app/auth-wrapper";
import { OrganizationWorkspaceNav } from "@/components/organizations/OrganizationWorkspaceNav";
import { Button } from "@/components/ui/button";
import { type Asset, uploadApi } from "@/lib/asset-test-api";
import {
  type Organization,
  organizationApi,
} from "@/lib/organization-api";
import { type Space, spaceApi } from "@/lib/space-api";
import { cn } from "@/lib/utils";
import {
  Bell,
  Clock3,
  FolderKanban,
  LoaderCircle,
  MoreVertical,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import useAccessToken from "@/lib/use-access-token";

const shellCardClass =
  "rounded-[28px] border border-white/8 bg-[#0f131d]/90 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur";

const STORAGE_KEY = "selected-organization-id";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const getProjectName = (asset: Asset | undefined) =>
  asset?.unrealProjects?.[0]?.displayName ||
  asset?.other3d?.[0]?.displayName ||
  asset?.name ||
  "";

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

export default function OrganizationSpacesPage() {
  const router = useRouter();
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [openSpaceMenuId, setOpenSpaceMenuId] = useState("");
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
      setSpaces([]);
      setAssets([]);
      return;
    }

    let isMounted = true;

    const loadSpaces = async () => {
      setPageError("");
      try {
        const [nextSpaces, nextAssets] = await Promise.all([
          spaceApi.getSpacesByOrganization(selectedOrgId, accessToken),
          uploadApi.getAllAssets(),
        ]);

        if (!isMounted) {
          return;
        }

        setSpaces(nextSpaces);
        setAssets(nextAssets.filter((asset) => asset.orgId === selectedOrgId));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(getErrorMessage(error, "Failed to load spaces."));
      }
    };

    void loadSpaces();

    return () => {
      isMounted = false;
    };
  }, [accessToken, selectedOrgId]);

  const assetsById = useMemo(
    () =>
      assets.reduce<Record<string, Asset>>((acc, asset) => {
        acc[asset.id] = asset;
        return acc;
      }, {}),
    [assets],
  );

  const groupedSpaces = useMemo(() => {
    const groups = spaces.reduce<Record<string, Space[]>>((acc, space) => {
      if (!acc[space.projectId]) {
        acc[space.projectId] = [];
      }

      acc[space.projectId].push(space);
      return acc;
    }, {});

    return Object.entries(groups).sort((left, right) => {
      const leftName = getProjectName(assetsById[left[0]]).toLowerCase();
      const rightName = getProjectName(assetsById[right[0]]).toLowerCase();
      return leftName.localeCompare(rightName);
    });
  }, [assetsById, spaces]);

  const handleDeleteSpace = async (spaceId: string) => {
    setPageError("");
    setSuccessMessage("");

    try {
      await spaceApi.deleteSpace(spaceId, accessToken);
      setSpaces((current) => current.filter((space) => space.id !== spaceId));
      setOpenSpaceMenuId("");
      setSuccessMessage("Space deleted successfully.");
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to delete space."));
    }
  };

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

        <main className={cn(shellCardClass, "min-h-[860px] flex-1 p-6 md:p-8") }>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight md:text-[30px]">
                Spaces
              </h1>
              <p className="mt-2 text-[13px] text-white/50 md:text-sm">
                Browse spaces in {selectedOrganization?.name || "your organization"}.
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
          {successMessage ? (
            <div className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
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
              Loading spaces...
            </div>
          ) : (
            <section className="rounded-[28px] border border-white/6 bg-white/[0.03] p-7">
              <h2 className="text-[40px] font-semibold tracking-tight text-white">
                Spaces
              </h2>

              {groupedSpaces.length === 0 ? (
                <div className="mt-8 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                  <p className="text-lg font-medium text-white/70">
                    No spaces found for this organization.
                  </p>
                </div>
              ) : (
                <div className="mt-8 space-y-10">
                  {groupedSpaces.map(([projectId, projectSpaces]) => (
                    <div key={projectId}>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <h3 className="text-[28px] font-semibold text-white">
                            {getProjectName(assetsById[projectId])}
                          </h3>
                          <button
                            type="button"
                            onClick={() => router.push(`/organizations/projects/${projectId}`)}
                            className="text-lg font-semibold text-white/55 transition hover:text-white"
                          >
                            See project
                          </button>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => router.push(`/organizations/projects/${projectId}`)}
                          className="h-11 rounded-full border-white/16 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/6"
                        >
                          + add space
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {projectSpaces.map((space) => (
                          <div
                            key={space.id}
                            className="relative flex items-center gap-5 rounded-[24px] border border-white/6 bg-white/[0.04] px-5 py-5"
                          >
                            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[20px] bg-[#2a2c30] text-4xl font-semibold text-white/75">
                              <FolderKanban className="h-10 w-10 text-white/70" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="truncate text-[20px] font-semibold text-white">
                                  {space.name}
                                </h4>
                                {space.spaceSetting?.isPublic ? (
                                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                                    Published
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-8 text-[15px] text-white/68">
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                <Clock3 className="h-4 w-4 text-white/45" />
                                edited {formatRelativeAge(space.updatedAt)}
                              </span>
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                <UserRound className="h-4 w-4 text-white/45" />
                                {space.currentParticipantSum || 0} users
                              </span>
                            </div>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSpaceMenuId((current) =>
                                    current === space.id ? "" : space.id,
                                  )
                                }
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/20 text-white/75 transition hover:bg-black/30 hover:text-white"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </button>

                              {openSpaceMenuId === space.id ? (
                                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-10 min-w-[220px] rounded-[20px] border border-white/10 bg-[#17191d] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/organizations/spaces/${space.id}`)}
                                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold text-white transition hover:bg-white/6"
                                  >
                                    <Settings className="h-5 w-5 text-white/80" />
                                    Space settings
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteSpace(space.id)}
                                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold text-red-300 transition hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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

