"use client";

import { AuthContext } from "@/app/auth-wrapper";
import { OrganizationWorkspaceNav } from "@/components/organizations/OrganizationWorkspaceNav";
import { Button } from "@/components/ui/button";
import {
  type Asset,
  type UnrealProjectVersion,
  uploadApi,
} from "@/lib/asset-test-api";
import {
  type Organization,
  organizationApi,
} from "@/lib/organization-api";
import { type Space, spaceApi } from "@/lib/space-api";
import useAccessToken from "@/lib/use-access-token";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bell,
  Clock3,
  FolderKanban,
  LayoutGrid,
  LoaderCircle,
  MoreVertical,
  Save,
  Settings,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

const shellCardClass =
  "rounded-[28px] border border-white/8 bg-[#0f131d]/90 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur";

const STORAGE_KEY = "selected-organization-id";
const DEFAULT_SPACE_TEMPLATE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_SPACE_TEMPLATE_ID || "c_space_template_id";

type ProjectTab = "basic" | "spaces" | "logs";

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

const tabClass = (active: boolean) =>
  cn(
    "border-b-[3px] pb-4 text-[18px] font-semibold transition",
    active
      ? "border-white text-white"
      : "border-transparent text-white/60 hover:text-white",
  );

export default function OrganizationProjectDetailPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [versions, setVersions] = useState<UnrealProjectVersion[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedTab, setSelectedTab] = useState<ProjectTab>("basic");
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [openSpaceMenuId, setOpenSpaceMenuId] = useState("");

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
          getErrorMessage(error, tokenError || "Failed to load organizations."),
        );
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
    if (!projectId) {
      return;
    }

    let isMounted = true;

    const loadProject = async () => {
      setIsBootstrapping(true);
      setPageError("");

      try {
        const [nextAsset, nextVersions] = await Promise.all([
          uploadApi.getAsset(projectId),
          uploadApi.getVersionsByAsset(projectId),
        ]);

        const nextSpaces = await spaceApi
          .getSpacesByProject(projectId, accessToken)
          .catch(() => [] as Space[]);

        if (!isMounted) {
          return;
        }

        setAsset(nextAsset);
        setVersions(nextVersions);
        setSpaces(nextSpaces);
        setSpaceName(getProjectName(nextAsset));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(getErrorMessage(error, "Failed to load project details."));
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [accessToken, projectId]);

  const latestVersion = versions[0] || null;
  const projectName = asset ? getProjectName(asset) : "Project";

  const handleCreateSpace = async () => {
    if (!selectedOrgId || !asset?.id) {
      setPageError("Project data is missing.");
      return;
    }

    const unrealProjectVersionId =
      asset.unrealProjects?.[0]?.unrealProjectVersion?.trim() || "";

    if (!unrealProjectVersionId) {
      setPageError("Unreal project version id is missing.");
      return;
    }

    setIsCreatingSpace(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const createdSpace = await spaceApi.createSpace(
        {
          orgId: selectedOrgId,
          name: spaceName.trim() || getProjectName(asset),
          spaceTemplateId: DEFAULT_SPACE_TEMPLATE_ID,
          unrealProject: {
            unrealProjectId: asset.id,
            unrealProjectVersionId,
          },
        },
        accessToken,
      );

      if (!createdSpace) {
        throw new Error("Space was not returned by the API.");
      }

      setSpaces((current) => [createdSpace, ...current]);
      setSuccessMessage("Space created successfully.");
      setIsCreateModalOpen(false);
      setSpaceName(getProjectName(asset));
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to create space."));
    } finally {
      setIsCreatingSpace(false);
    }
  };
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

  const infoRows = useMemo(
    () => [
      { label: "ID", value: asset?.id || "Unavailable" },
      {
        label: "Project status",
        value:
          asset?.buildStatus === "COMPLETED"
            ? "Deployed"
            : asset?.buildStatus || "Unknown",
      },
      {
        label: "Latest deployment",
        value:
          asset?.buildStatus === "COMPLETED"
            ? "Deployed"
            : asset?.buildStatus || "Unknown",
      },
      { label: "Uploaded", value: formatRelativeAge(asset?.createdAt) },
    ],
    [asset],
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
                {projectName}
              </h1>
              <p className="mt-2 text-[13px] text-white/50 md:text-sm">
                Project details for {selectedOrganization?.name || "your organization"}.
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
              Loading project details...
            </div>
          ) : (
            <section className="rounded-[28px] border border-white/6 bg-white/[0.03] p-7">
              <button
                type="button"
                onClick={() => router.push("/organizations/projects")}
                className="flex items-center gap-2 text-[15px] font-medium text-white/58 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                All projects
              </button>

              <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-[42px] font-semibold tracking-tight text-white">
                    {projectName}
                  </h2>
                  <div className="mt-5 space-y-2 text-[15px] text-white/80">
                    {infoRows.map((row) => (
                      <p key={row.label}>
                        <span className="font-medium text-white/62">{row.label}: </span>
                        <span>{row.value}</span>
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => router.push("/AssetManager/upload")}
                    className="h-12 rounded-2xl bg-[#6f4cff] px-6 text-base font-semibold text-white hover:bg-[#7d58ff]"
                  >
                    <Upload className="h-4 w-4" />
                    Upload new version
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="h-12 rounded-2xl border-white/14 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/6"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Create new space
                  </Button>
                </div>
              </div>

              <div className="mt-10 flex gap-8 border-b border-white/10">
                <button type="button" className={tabClass(selectedTab === "basic")} onClick={() => setSelectedTab("basic")}>Basic info</button>
                <button type="button" className={tabClass(selectedTab === "spaces")} onClick={() => setSelectedTab("spaces")}>Spaces</button>
                <button type="button" className={tabClass(selectedTab === "logs")} onClick={() => setSelectedTab("logs")}>Logs</button>
              </div>

              {selectedTab === "basic" ? (
                <div className="mt-10 grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div>
                    <h3 className="text-[22px] font-semibold text-white">Information</h3>
                    <p className="mt-3 max-w-[220px] text-[15px] leading-7 text-white/55">
                      Basic information on the project.
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                    <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
                      <div className="flex h-[320px] items-center justify-center rounded-[22px] bg-[#23262b] text-[120px] font-semibold text-white/75">
                        <LayoutGrid className="h-28 w-28 text-white/70" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/35">
                          Project name
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-white">
                          {projectName}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/35">
                          Deployment snapshot
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] bg-black/20 p-4">
                            <p className="text-sm text-white/45">Version</p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {latestVersion?.name || "Unavailable"}
                            </p>
                          </div>
                          <div className="rounded-[18px] bg-black/20 p-4">
                            <p className="text-sm text-white/45">Spaces</p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {spaces.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedTab === "spaces" ? (
                <div className="mt-10 space-y-4">
                  {spaces.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-white/60">
                      No spaces are attached to this project yet.
                    </div>
                  ) : (
                    spaces.map((space) => (
                      <div
                        key={space.id}
                        className="relative flex items-center gap-5 rounded-[24px] border border-white/6 bg-white/[0.04] px-5 py-5 text-left"
                      >
                        <div className="flex h-24 w-24 items-center justify-center rounded-[20px] bg-[#23262b]">
                          <FolderKanban className="h-10 w-10 text-white/70" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[20px] font-semibold text-white">
                            {space.name}
                          </h3>
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
                              setOpenSpaceMenuId((current: string) =>
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
                    ))
                  )}
                </div>
              ) : null}

              {selectedTab === "logs" ? (
                <div className="mt-10 space-y-4">
                  {versions.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-white/60">
                      No project versions found.
                    </div>
                  ) : (
                    versions.map((version) => (
                      <div
                        key={version.id}
                        className="rounded-[24px] border border-white/6 bg-white/[0.03] px-5 py-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-white">{version.name}</p>
                            <p className="mt-1 font-mono text-sm text-white/40">{version.id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white/50">{formatRelativeAge(version.updatedAt)}</p>
                            <p className="mt-1 text-base font-semibold text-emerald-300">
                              {version.state}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </section>
          )}
        </main>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
          <div className="w-full max-w-[740px] rounded-[24px] border border-white/20 bg-[#17191d] shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 px-8 py-6">
              <h2 className="text-[18px] font-semibold text-white">Create space</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full p-2 text-white/70 transition hover:bg-white/8 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-8 py-8">
              <input
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                className="h-16 w-full rounded-[18px] border border-white/12 bg-transparent px-5 text-lg text-white outline-none placeholder:text-white/25"
                placeholder="Space name"
              />
              <div className="mt-10 flex justify-center">
                <Button
                  onClick={() => void handleCreateSpace()}
                  disabled={isCreatingSpace}
                  className="h-14 min-w-[170px] rounded-[14px] bg-[#6f4cff] px-8 text-lg font-semibold text-white hover:bg-[#7d58ff]"
                >
                  {isCreatingSpace ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Create space
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}








