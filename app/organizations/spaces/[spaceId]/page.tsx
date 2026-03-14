"use client";

import { AuthContext } from "@/app/auth-wrapper";
import { OrganizationWorkspaceNav } from "@/components/organizations/OrganizationWorkspaceNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Asset, uploadApi } from "@/lib/asset-test-api";
import {
  type Organization,
  organizationApi,
} from "@/lib/organization-api";
import {
  type Space,
  type SpaceInvite,
  type SpaceSetting,
  type SpaceUser,
  spaceApi,
} from "@/lib/space-api";
import useAccessToken from "@/lib/use-access-token";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  FolderKanban,
  LoaderCircle,
  Save,
  Check,
  ChevronDown,
  Users,
  Globe2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

const shellCardClass =
  "rounded-[40px] border border-white/8 bg-[#0d1220] shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur";
const STORAGE_KEY = "selected-organization-id";

type SpaceTab = "basic" | "plugins" | "modules" | "sharing" | "loading";

type Draft = {
  name: string;
  description: string;
  odysseyMobileControls: "ON" | "OFF" | "JOYSTICK_ONLY";
  afkTimer: number;
  maxSessionLength: number;
  maximumResolution: string;
  isPublic: boolean;
  allowAnonymousUsers: boolean;
  allowEmbed: boolean;
  allowConfigurationToolbarForAllUsers: boolean;
  disableChat: boolean;
  disableComms: boolean;
  enableSharding: boolean;
  notViewerBuddle: boolean;
  avatarType: "STANDARD" | "AEC";
  avatarControlSystem: "EVENT_MODE" | "GAME_MODE" | "FLIGHT_MODE";
  showLoadingBackground: boolean;
  showLoadingBackgroundBlur: boolean;
  showSpaceInformation: boolean;
  showOdysseyEditorMenu: boolean;
  showHelpMenu: boolean;
  showOdysseyLoadingStatus: boolean;
  autoplayStream: boolean;
};

const defaultDraft: Draft = {
  name: "",
  description: "",
  odysseyMobileControls: "ON",
  afkTimer: 600,
  maxSessionLength: 900,
  maximumResolution: "Any",
  isPublic: false,
  allowAnonymousUsers: false,
  allowEmbed: false,
  allowConfigurationToolbarForAllUsers: false,
  disableChat: false,
  disableComms: false,
  enableSharding: false,
  notViewerBuddle: false,
  avatarType: "STANDARD",
  avatarControlSystem: "EVENT_MODE",
  showLoadingBackground: false,
  showLoadingBackgroundBlur: false,
  showSpaceInformation: false,
  showOdysseyEditorMenu: false,
  showHelpMenu: false,
  showOdysseyLoadingStatus: true,
  autoplayStream: false,
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const getInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getProjectName = (asset: Asset | null) =>
  asset?.unrealProjects?.[0]?.displayName ||
  asset?.other3d?.[0]?.displayName ||
  asset?.name ||
  "Unknown project";

const formatRoleLabel = (roleId: string) => {
  if (roleId === "space_owner") return "Owner";
  const option = spaceRoleOptions.find((item) => item.value === roleId);
  if (option) return option.label;
  return roleId.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const tabClass = (active: boolean) =>
  cn(
    "border-b-[3px] pb-4 text-[18px] font-semibold transition",
    active
      ? "border-white text-white"
      : "border-transparent text-white/60 hover:text-white",
  );

const sectionClass =
  "grid gap-8 border-t border-white/10 py-10 xl:grid-cols-[280px_minmax(0,1fr)]";

const selectClass =
  "h-14 rounded-[18px] border border-white/12 bg-transparent px-4 text-white outline-none [&>option]:bg-[#111315] [&>option]:text-white";

const checkboxClass = (checked: boolean) =>
  cn(
    "flex h-8 w-8 items-center justify-center rounded-xl border transition",
    checked
      ? "border-white/10 bg-white/35 text-white"
      : "border-white/20 bg-transparent text-transparent",
  );

const spaceRoleOptions = [
  {
    label: "Can edit",
    description: "Edit space settings and invite others",
    value: "space_editor",
  },
  {
    label: "Can view",
    description: "View spaces only",
    value: "space_member",
  },
];

const formatRelativeDate = (value?: string | null) => {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatInviteName = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;

function Toggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-4 text-[15px] font-semibold text-white/78">
      <button type="button" className={checkboxClass(checked)} onClick={onToggle}>
        <Check className="h-4 w-4" />
      </button>
      <span>{label}</span>
    </label>
  );
}

const roleButtonClass =
  "inline-flex h-12 items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-5 text-[15px] font-semibold text-white transition hover:bg-white/[0.06]";


export default function OrganizationSpaceDetailPage() {
  const router = useRouter();
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [project, setProject] = useState<Asset | null>(null);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [spaceUsers, setSpaceUsers] = useState<SpaceUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SpaceInvite[]>([]);
  const [selectedTab, setSelectedTab] = useState<SpaceTab>("basic");
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isPendingInvitesLoading, setIsPendingInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("space_member");
  const [isInviteRoleMenuOpen, setIsInviteRoleMenuOpen] = useState(false);
  const [openMemberRoleMenuId, setOpenMemberRoleMenuId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const storedOrgId = window.localStorage.getItem(STORAGE_KEY);
    if (storedOrgId) setSelectedOrgId(storedOrgId);
  }, []);

  useEffect(() => {
    if (selectedOrgId) window.localStorage.setItem(STORAGE_KEY, selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    const loadOrganizations = async () => {
      if (isTokenLoading) return;
      try {
        const nextOrganizations = accessToken
          ? await organizationApi.getOrganizationsForUser(accessToken)
          : [];
        setOrganizations(nextOrganizations);
        setSelectedOrgId((current) =>
          current && nextOrganizations.some((org) => org.id === current)
            ? current
            : (nextOrganizations[0]?.id ?? ""),
        );
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
    if (!spaceId || !selectedOrgId) return;

    let isMounted = true;

    const loadSpace = async () => {
      setIsBootstrapping(true);
      setPageError("");
      try {
        const nextSpace = await spaceApi.getSpaceById(
          spaceId,
          selectedOrgId,
          accessToken,
        );
        if (!nextSpace) throw new Error("Space not found.");

        const nextProject = await uploadApi
          .getAsset(nextSpace.projectId)
          .catch(() => null as Asset | null);

        if (!isMounted) return;

        setSpace(nextSpace);
        setProject(nextProject);
        setDraft({
          name: nextSpace.name || "",
          description: nextSpace.description || "",
          odysseyMobileControls: nextSpace.spaceSetting?.odysseyMobileControls || "ON",
          afkTimer: nextSpace.spaceSetting?.afkTimer || 600,
          maxSessionLength: nextSpace.spaceSetting?.maxSessionLength || 900,
          maximumResolution:
            typeof nextSpace.spaceSetting?.maximumResolution === "string"
              ? nextSpace.spaceSetting.maximumResolution
              : "Any",
          isPublic: nextSpace.spaceSetting?.isPublic || false,
          allowAnonymousUsers: nextSpace.spaceSetting?.allowAnonymousUsers || false,
          allowEmbed: nextSpace.spaceSetting?.allowEmbed || false,
          allowConfigurationToolbarForAllUsers:
            nextSpace.spaceSetting?.allowConfigurationToolbarForAllUsers || false,
          disableChat: nextSpace.spaceSetting?.disableChat || false,
          disableComms: nextSpace.spaceSetting?.disableComms || false,
          enableSharding: nextSpace.spaceSetting?.enableSharding || false,
          notViewerBuddle: nextSpace.spaceSetting?.notViewerBuddle || false,
          avatarType: nextSpace.spaceSetting?.avatarType || "STANDARD",
          avatarControlSystem:
            nextSpace.spaceSetting?.avatarControlSystem || "EVENT_MODE",
          showLoadingBackground:
            nextSpace.spaceSetting?.showLoadingBackground || false,
          showLoadingBackgroundBlur:
            nextSpace.spaceSetting?.showLoadingBackgroundBlur || false,
          showSpaceInformation:
            nextSpace.spaceSetting?.showSpaceInformation || false,
          showOdysseyEditorMenu:
            nextSpace.spaceSetting?.showOdysseyEditorMenu || false,
          showHelpMenu: nextSpace.spaceSetting?.showHelpMenu || false,
          showOdysseyLoadingStatus: true,
          autoplayStream: false,
        });
      } catch (error) {
        if (isMounted) {
          setPageError(getErrorMessage(error, "Failed to load space details."));
        }
      } finally {
        if (isMounted) setIsBootstrapping(false);
      }
    };

    void loadSpace();
    return () => {
      isMounted = false;
    };
  }, [accessToken, selectedOrgId, spaceId]);

  useEffect(() => {
    const loadPendingInvites = async () => {
      if (selectedTab !== "sharing" || !spaceId || !accessToken) {
        return;
      }

      setIsPendingInvitesLoading(true);
      try {
        const invites = await spaceApi.getPendingSpaceInvites(spaceId, accessToken);
        setPendingInvites(invites);
      } catch (error) {
        setPageError(getErrorMessage(error, "Failed to load pending invites."));
      } finally {
        setIsPendingInvitesLoading(false);
      }
    };

    void loadPendingInvites();
  }, [accessToken, selectedTab, spaceId]);

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleInviteMember = async () => {
    const email = inviteEmail.trim().toLowerCase();

    if (!spaceId) {
      setPageError("Space id is missing.");
      return;
    }

    if (!accessToken) {
      setPageError(tokenError || "Please sign in before inviting users.");
      return;
    }

    if (!email) {
      setPageError("Email is required.");
      return;
    }

    setIsInviting(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const invite = await spaceApi.createSpaceInvite(
        {
          spaceId,
          email,
          roleId: inviteRoleId,
        },
        accessToken,
      );

      if (!invite) {
        throw new Error("Space invite was not returned by the API.");
      }

      setPendingInvites((current) => [invite, ...current]);
      setInviteEmail("");
      setInviteRoleId("space_member");
      setSuccessMessage("Space invite sent successfully.");
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to send space invite."));
    } finally {
      setIsInviting(false);
    }
  };

  useEffect(() => {
    const loadSpaceUsers = async () => {
      if (selectedTab !== "sharing" || !spaceId || !accessToken) {
        return;
      }

      try {
        const users = await spaceApi.getSpaceUsers(spaceId, accessToken);
        setSpaceUsers(users);
      } catch (error) {
        setPageError(getErrorMessage(error, "Failed to load space users."));
      }
    };

    void loadSpaceUsers();
  }, [accessToken, selectedTab, spaceId]);
  const saveSpace = async () => {
    if (!spaceId) return;

    setIsSaving(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const trimmedName = draft.name.trim();
      const trimmedDescription = draft.description.trim();
      let updatedSpace: Space | null = null;
      let updatedSetting: SpaceSetting | null = null;

      if (selectedTab === "basic") {
        if (!trimmedName) {
          throw new Error("Space name is required.");
        }

        updatedSpace = await spaceApi.updateSpace(
          spaceId,
          {
            name: trimmedName,
            description: trimmedDescription || undefined,
          },
          accessToken,
        );

        updatedSetting = await spaceApi.updateSpaceSetting(
          spaceId,
          {
            odysseyMobileControls: draft.odysseyMobileControls,
            afkTimer: draft.afkTimer,
            maxSessionLength: draft.maxSessionLength,
            maximumResolution:
              draft.maximumResolution === "Any"
                ? undefined
                : draft.maximumResolution,
          },
          accessToken,
        );
      }

      if (selectedTab === "plugins") {
        updatedSetting = await spaceApi.updateSpaceSetting(
          spaceId,
          {
            allowConfigurationToolbarForAllUsers:
              draft.allowConfigurationToolbarForAllUsers,
          },
          accessToken,
        );
      }

      if (selectedTab === "modules") {
        updatedSetting = await spaceApi.updateSpaceSetting(
          spaceId,
          {
            enableSharding: draft.enableSharding,
            disableChat: draft.disableChat,
            disableComms: draft.disableComms,
            notViewerBuddle: draft.notViewerBuddle,
            avatarType: draft.avatarType,
            avatarControlSystem: draft.avatarControlSystem,
          },
          accessToken,
        );
      }

      if (selectedTab === "sharing") {
        updatedSetting = await spaceApi.updateSpaceSetting(
          spaceId,
          {
            isPublic: draft.isPublic,
            allowAnonymousUsers: draft.allowAnonymousUsers,
            allowEmbed: draft.allowEmbed,
          },
          accessToken,
        );
      }

      if (selectedTab === "loading") {
        updatedSetting = await spaceApi.updateSpaceSetting(
          spaceId,
          {
            showLoadingBackground: draft.showLoadingBackground,
            showLoadingBackgroundBlur: draft.showLoadingBackgroundBlur,
            showSpaceInformation: draft.showSpaceInformation,
            showOdysseyEditorMenu: draft.showOdysseyEditorMenu,
            showHelpMenu: draft.showHelpMenu,
          },
          accessToken,
        );
      }

      setSpace((current) =>
        current
          ? {
              ...current,
              ...(updatedSpace || {}),
              name: trimmedName || current.name,
              description: trimmedDescription || current.description || null,
              spaceSetting: {
                ...(current.spaceSetting || {}),
                ...(updatedSetting || {}),
              },
            }
          : current,
      );
      setSuccessMessage("Space updated successfully.");
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to save space settings."));
    } finally {
      setIsSaving(false);
    }
  };
  const projectName = getProjectName(project);

  return (
    <div className="min-h-screen bg-[#111315] px-7 py-7 text-white">
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

        <main className={cn(shellCardClass, "min-h-[920px] flex-1 p-7 md:p-10")}>
          <div className="mb-10 flex justify-end gap-4">
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

          {isBootstrapping ? (
            <div className="flex h-[520px] items-center justify-center text-white/70">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
              Loading space details...
            </div>
          ) : (
            <section className="rounded-[34px] border border-white/7 bg-[#191c26] p-8 md:p-10">
              <button
                type="button"
                onClick={() => router.push("/organizations/spaces")}
                className="flex items-center gap-2 text-[15px] font-medium text-white/58 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                All spaces
              </button>

              <div className="mt-8 flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h1 className="text-[56px] font-semibold leading-none tracking-[-0.04em] text-white">
                    {space?.name || "Space"}
                  </h1>
                  <div className="mt-8 space-y-3 font-mono text-[18px] text-white/86">
                    <p>ID: {space?.id || "Unavailable"}</p>
                    <p>Project: {projectName}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => void saveSpace()}
                    disabled={isSaving}
                    className="h-14 rounded-[22px] border-white/14 bg-transparent px-7 text-[18px] font-semibold text-white hover:bg-white/6"
                  >
                    {isSaving ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save changes
                  </Button>
                  <Button
                    onClick={() => window.open(`/spaces/${spaceId}`, "_blank")}
                    className="h-14 rounded-[22px] bg-[#6f4cff] px-7 text-[18px] font-semibold text-white hover:bg-[#7d58ff]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to space
                  </Button>
                </div>
              </div>

              <div className="mt-12 flex gap-10 border-b border-white/10">
                <button type="button" className={tabClass(selectedTab === "basic")} onClick={() => setSelectedTab("basic")}>Basic info</button>
                <button type="button" className={tabClass(selectedTab === "plugins")} onClick={() => setSelectedTab("plugins")}>Plugins</button>
                <button type="button" className={tabClass(selectedTab === "modules")} onClick={() => setSelectedTab("modules")}>Modules</button>
                <button type="button" className={tabClass(selectedTab === "sharing")} onClick={() => setSelectedTab("sharing")}>Sharing</button>
                <button type="button" className={tabClass(selectedTab === "loading")} onClick={() => setSelectedTab("loading")}>Loading Experience</button>
              </div>

              {selectedTab === "basic" ? (
                <>
                  <div className="mt-8 grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                      <h3 className="text-[22px] font-semibold text-white">Information</h3>
                      <p className="mt-3 max-w-[220px] text-[15px] leading-7 text-white/55">Basic information on the space.</p>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                      <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
                        <div className="flex h-[332px] items-center justify-center rounded-[22px] bg-[#23262b]">
                          <FolderKanban className="h-28 w-28 text-white/70" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className="h-16 rounded-[18px] border-white/12 bg-transparent px-5 text-lg text-white" />
                        <Input value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Description" className="h-16 rounded-[18px] border-white/12 bg-transparent px-5 text-lg text-white placeholder:text-white/28" />
                      </div>
                    </div>
                  </div>
                  <div className={sectionClass}>
                    <div><h3 className="text-[22px] font-semibold text-white">Controller settings</h3></div>
                    <div className="space-y-5">
                      <p className="text-[15px] font-semibold text-white">Mobile controls</p>
                      <div className="inline-flex rounded-full bg-black/30 p-1">
                        {[ ["ON", "On"], ["JOYSTICK_ONLY", "Joystick only"], ["OFF", "Off"] ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => updateDraft("odysseyMobileControls", value as Draft["odysseyMobileControls"])} className={cn("rounded-full px-6 py-3 text-sm font-semibold transition", draft.odysseyMobileControls === value ? "bg-white text-[#111315]" : "text-white/75 hover:text-white")}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={sectionClass}>
                    <div>
                      <h3 className="text-[22px] font-semibold text-white">Session settings</h3>
                      <p className="mt-3 max-w-[220px] text-[15px] leading-7 text-white/55">Fine-tune the experience to meet your needs.</p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <select value={String(draft.maxSessionLength)} onChange={(event) => updateDraft("maxSessionLength", Number(event.target.value))} className={selectClass}><option value="900">15 min</option><option value="1800">30 min</option><option value="3600">60 min</option></select>
                      <select value={String(draft.afkTimer)} onChange={(event) => updateDraft("afkTimer", Number(event.target.value))} className={selectClass}><option value="300">5 min</option><option value="600">10 min</option><option value="900">15 min</option></select>
                      <select value={draft.maximumResolution} onChange={(event) => updateDraft("maximumResolution", event.target.value)} className={`${selectClass} md:col-span-2`}><option value="Any">Any</option><option value="1080p">1080p</option><option value="720p">720p</option></select>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedTab === "plugins" ? (
                <div className={sectionClass}>
                  <div>
                    <h3 className="text-[22px] font-semibold text-white">Configuration toolbar</h3>
                    <p className="mt-3 max-w-[220px] text-[15px] leading-7 text-white/55">Tailor the toolbar to meet your needs.</p>
                  </div>
                  <div>
                    <Toggle label="Enable configurator toolbar access for all users" checked={draft.allowConfigurationToolbarForAllUsers} onToggle={() => updateDraft("allowConfigurationToolbarForAllUsers", !draft.allowConfigurationToolbarForAllUsers)} />
                  </div>
                </div>
              ) : null}

              {selectedTab === "modules" ? (
                <>
                  <div className={sectionClass}>
                    <div>
                      <h3 className="text-[22px] font-semibold text-white">Multiplayer</h3>
                      <p className="mt-3 max-w-[220px] text-[15px] leading-7 text-white/55">Control the experience for multiplayer scenarios.</p>
                    </div>
                    <div className="space-y-6">
                      <Toggle label="Allow sharding" checked={draft.enableSharding} onToggle={() => updateDraft("enableSharding", !draft.enableSharding)} />
                      <Toggle label="Text chat disabled" checked={draft.disableChat} onToggle={() => updateDraft("disableChat", !draft.disableChat)} />
                      <Toggle label="Disable webcam and share screen controls" checked={draft.disableComms} onToggle={() => updateDraft("disableComms", !draft.disableComms)} />
                      <Toggle label="Restrict huddle to only editors" checked={draft.notViewerBuddle} onToggle={() => updateDraft("notViewerBuddle", !draft.notViewerBuddle)} />
                    </div>
                  </div>
                  <div className={sectionClass}>
                    <div><h3 className="text-[22px] font-semibold text-white">Multiplayer Avatars</h3></div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <select value={draft.avatarControlSystem} onChange={(event) => updateDraft("avatarControlSystem", event.target.value as Draft["avatarControlSystem"])} className={selectClass}><option value="EVENT_MODE">Normal</option><option value="GAME_MODE">Game mode</option><option value="FLIGHT_MODE">Flight mode</option></select>
                      <div className="flex items-center"><Toggle label="Translucent avatars (AEC)" checked={draft.avatarType === "AEC"} onToggle={() => updateDraft("avatarType", draft.avatarType === "AEC" ? "STANDARD" : "AEC")} /></div>
                    </div>
                  </div>
                </>
              ) : null}

                            {selectedTab === "sharing" ? (
                <div className={sectionClass}>
                  <div>
                    <h3 className="text-[22px] font-semibold text-white">Access & invites</h3>
                    <p className="mt-3 max-w-[220px] text-[15px] leading-7 text-white/55">Control space access and invite users.</p>
                  </div>
                  <div className="space-y-8">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_160px_122px] xl:items-center">
                      <Input
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="Email, comma separated"
                        className="h-16 w-full rounded-[20px] border-white/10 bg-[#6f7076]/88 px-5 text-[16px] text-white placeholder:text-white/55"
                      />
                      <div className="relative min-w-[140px]">
                        <button
                          type="button"
                          onClick={() => setIsInviteRoleMenuOpen((current) => !current)}
                          className={cn(roleButtonClass, "h-16 w-full justify-between rounded-[20px] border-white/0 bg-[#6f7076]/88 px-6 text-[18px]")}
                        >
                          <span>{spaceRoleOptions.find((option) => option.value === inviteRoleId)?.label || "Can view"}</span>
                          <ChevronDown className={cn("h-4 w-4 transition", isInviteRoleMenuOpen && "rotate-180")} />
                        </button>
                        {isInviteRoleMenuOpen ? (
                          <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-[346px] rounded-[20px] border border-white/8 bg-[#373535] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.38)]">
                            <div className="space-y-6">
                              {spaceRoleOptions.map((option) => {
                                const isSelected = inviteRoleId === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setInviteRoleId(option.value);
                                      setIsInviteRoleMenuOpen(false);
                                    }}
                                    className="flex w-full items-center gap-4 text-left"
                                  >
                                    <span className="flex h-7 w-7 items-center justify-center text-white">
                                      <Check className={cn("h-5 w-5", isSelected ? "opacity-100" : "opacity-0")} />
                                    </span>
                                    <span>
                                      <span className="block text-[18px] font-semibold text-white">{option.label}</span>
                                      <span className="mt-1 block text-[16px] text-white/58">{option.description}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <Button
                        onClick={() => void handleInviteMember()}
                        disabled={isInviting || !space}
                        className="h-16 rounded-[20px] bg-white/12 px-8 text-[18px] font-semibold text-white hover:bg-white/18"
                      >
                        {isInviting ? "Inviting..." : "Invite"}
                      </Button>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-[#1e222d] p-7">
                      <div className="flex items-center gap-3 text-[15px] font-semibold text-white/75">
                        <span className="flex h-8 w-8 items-center justify-center text-white/70"><Users className="h-5 w-5" /></span>
                        Everyone at {selectedOrganization?.name || "this organization"} can access this space.
                      </div>

                      <div className="mt-6 space-y-5 border-t border-white/8 pt-6">
                        {spaceUsers.length === 0 ? (
                          <p className="text-sm text-white/45">No active space users found.</p>
                        ) : (
                          spaceUsers.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-6">
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold text-white/75">
                                  {member.avatarUrl?.trim() ? (
                                    <img src={member.avatarUrl} alt={member.email} className="h-full w-full object-cover" />
                                  ) : (
                                    formatInviteName(member.email).slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-semibold text-white">
                                    {formatInviteName(member.email)}{user?.email === member.email ? " (You)" : ""}
                                  </p>
                                  <p className="truncate text-sm text-white/45">{user?.email === member.email ? "" : member.email}</p>
                                </div>
                              </div>
                              {member.roleId === "space_owner" || user?.email === member.email ? (
                                <p className="shrink-0 text-[15px] font-semibold text-white">
                                  {formatRoleLabel(member.roleId)}
                                </p>
                              ) : (
                                <div className="relative shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenMemberRoleMenuId((current) =>
                                        current === member.id ? null : member.id,
                                      )
                                    }
                                    className={roleButtonClass}
                                  >
                                    <span>{formatRoleLabel(member.roleId)}</span>
                                    <ChevronDown className={cn("h-4 w-4 transition", openMemberRoleMenuId === member.id && "rotate-180")} />
                                  </button>
                                  {openMemberRoleMenuId === member.id ? (
                                    <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-[346px] rounded-[20px] border border-white/8 bg-[#373535] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.38)]">
                                      <div className="space-y-6">
                                        {spaceRoleOptions.map((option) => {
                                          const isSelected = member.roleId === option.value;
                                          return (
                                            <button
                                              key={option.value}
                                              type="button"
                                              onClick={() => setOpenMemberRoleMenuId(null)}
                                              className="flex w-full items-center gap-4 text-left"
                                            >
                                              <span className="flex h-7 w-7 items-center justify-center text-white">
                                                <Check className={cn("h-5 w-5", isSelected ? "opacity-100" : "opacity-0")} />
                                              </span>
                                              <span>
                                                <span className="block text-[18px] font-semibold text-white">{option.label}</span>
                                                <span className="mt-1 block text-[16px] text-white/58">{option.description}</span>
                                              </span>
                                            </button>
                                          );
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => setOpenMemberRoleMenuId(null)}
                                          className="block text-[18px] font-semibold text-[#ff6f6f]"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/8 pt-8">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <span className="mt-1 text-white/70"><Globe2 className="h-6 w-6" /></span>
                          <div>
                            <p className="text-[18px] font-semibold text-white">Publish space</p>
                            <p className="text-[15px] text-white/55">Share this space outside your organization</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateDraft("isPublic", !draft.isPublic)}
                          className={cn(
                            "relative h-11 w-[68px] rounded-full transition",
                            draft.isPublic ? "bg-[#7c4dff]" : "bg-white/28",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-1.5 h-8 w-8 rounded-full bg-white transition",
                              draft.isPublic ? "left-[30px]" : "left-1.5",
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-white/8 pt-8">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-14 rounded-full bg-white/10 px-10 text-[18px] font-semibold text-white hover:bg-white/15"
                      >
                        Copy link
                      </Button>
                    </div>

                    <div className="rounded-[24px] border border-white/6 bg-white/[0.02] p-5">
                      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                        <h4 className="text-lg font-semibold text-white">Pending invites</h4>
                        <span className="text-sm text-white/42">{pendingInvites.length}</span>
                      </div>

                      {isPendingInvitesLoading ? (
                        <div className="flex h-24 items-center justify-center text-white/70">
                          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
                          Loading pending invites...
                        </div>
                      ) : pendingInvites.length === 0 ? (
                        <div className="py-6 text-sm text-white/50">
                          No pending invites for this space.
                        </div>
                      ) : (
                        <div className="space-y-4 pt-4">
                          {pendingInvites.map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between gap-4 rounded-[18px] border border-white/6 bg-white/[0.02] px-4 py-4">
                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-semibold text-white">
                                  {formatInviteName(invite.email)}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-sm text-white/55">
                                  <span className="truncate">{invite.email}</span>
                                  <span className="text-white/32">?</span>
                                  <span className="shrink-0">{formatRelativeDate(invite.createdAt)}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-white/85">
                                  {spaceRoleOptions.find((option) => option.value === invite.roleId)?.label || invite.roleId}
                                </p>
                                <p className="mt-1 font-mono text-[11px] text-white/32">
                                  {invite.inviteLinkId}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedTab === "loading" ? (
                <div className={sectionClass}>
                  <div>
                    <h3 className="text-[22px] font-semibold text-white">Space loading</h3>
                    <p className="mt-3 max-w-[240px] text-[15px] leading-7 text-white/55">Customize the experience when loading into the space.</p>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-8 rounded-[24px] border border-white/6 bg-white/[0.02] p-6">
                      <Toggle label="Show background image" checked={draft.showLoadingBackground} onToggle={() => updateDraft("showLoadingBackground", !draft.showLoadingBackground)} />
                      <Toggle label="Blur loading background" checked={draft.showLoadingBackgroundBlur} onToggle={() => updateDraft("showLoadingBackgroundBlur", !draft.showLoadingBackgroundBlur)} />
                      <Toggle label="Show space information" checked={draft.showSpaceInformation} onToggle={() => updateDraft("showSpaceInformation", !draft.showSpaceInformation)} />
                      <Toggle label="Show Odyssey's editor menu" checked={draft.showOdysseyEditorMenu} onToggle={() => updateDraft("showOdysseyEditorMenu", !draft.showOdysseyEditorMenu)} />
                      <Toggle label="Show help menu" checked={draft.showHelpMenu} onToggle={() => updateDraft("showHelpMenu", !draft.showHelpMenu)} />
                      <Toggle label="Show Odyssey's loading status" checked={draft.showOdysseyLoadingStatus} onToggle={() => updateDraft("showOdysseyLoadingStatus", !draft.showOdysseyLoadingStatus)} />
                      <Toggle label="Autoplay stream" checked={draft.autoplayStream} onToggle={() => updateDraft("autoplayStream", !draft.autoplayStream)} />
                    </div>
                    <p className="text-sm text-white/38">
                      Only the supported loading settings are saved right now. &quot;Show Odyssey&apos;s loading status&quot; and &quot;Autoplay stream&quot; are UI-only until backend support is added.
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}



























