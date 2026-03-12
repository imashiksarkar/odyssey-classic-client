"use client";
/* eslint-disable @next/next/no-img-element */

import { AuthContext } from "@/app/auth-wrapper";
import { Button } from "@/components/ui/button";
import sso from "@/config/sso";
import {
  Organization,
  OrganizationInvite,
  OrganizationUser,
  organizationApi,
} from "@/lib/organization-api";
import useAccessToken from "@/lib/use-access-token";
import { cn } from "@/lib/utils";
import axios from "axios";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useContext, useEffect, useMemo, useRef, useState } from "react";

type TabId = "overview" | "members";

type MemberDraft = {
  roleId: string;
  avatarReadyPlayerMeImg: string;
};

type MemberViewTab = "members" | "pending";

const primaryCardClass =
  "rounded-[28px] border border-white/8 bg-[#0f131d]/90 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur";

const navItems = [{ label: "Organization settings", icon: Settings, href: "/organizations" }];

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getOrganizationAvatar = (organization?: Organization | null) =>
  organization?.logoSmallUrl?.trim() || "";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

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

const formatMemberName = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;

const roleOptions = [
  {
    label: "Admin",
    description: "Full access",
    value: "org_admin",
  },
  {
    label: "Can edit",
    description: "Edit spaces and invite others",
    value: "org_editor",
  },
  {
    label: "Viewer",
    description: "View spaces only",
    value: "org_member",
  },
];

const normalizeRole = (value: string) => value.trim().toLowerCase();

const isOwnerRole = (value: string) => normalizeRole(value).includes("owner");

const getRoleLabel = (value: string) => {
  const normalized = normalizeRole(value);

  if (normalized.includes("owner")) {
    return "Owner";
  }

  const matched = roleOptions.find((option) => {
    const optionValue = normalizeRole(option.value);
    return (
      optionValue === normalized ||
      optionValue.replace(/[\s_-]+/g, "") ===
        normalized.replace(/[\s_-]+/g, "")
    );
  });
  if (matched) {
    return matched.label;
  }

  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export default function OrganizationPage() {
  const { user } = useContext(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedTab, setSelectedTab] = useState<TabId>("overview");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationUser[]>([]);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>(
    {},
  );
  const [recentInvites, setRecentInvites] = useState<OrganizationInvite[]>([]);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [memberViewTab, setMemberViewTab] = useState<MemberViewTab>("members");
  const [memberSearch, setMemberSearch] = useState("");
  const [openMemberMenuId, setOpenMemberMenuId] = useState("");

  const [createName, setCreateName] = useState("");
  const [overviewName, setOverviewName] = useState("");
  const [overviewDomain, setOverviewDomain] = useState("");
  const [overviewLogoUrl, setOverviewLogoUrl] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("org_member");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOrganizationLoading, setIsOrganizationLoading] = useState(false);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [isPendingInvitesLoading, setIsPendingInvitesLoading] = useState(false);
  const [isSavingOverview, setIsSavingOverview] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState("");
  const [inviteActionMode, setInviteActionMode] = useState<
    "accept" | "reject" | ""
  >("");

  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );
console.log("selectedOrgId",organizations, selectedOrganization)
  useEffect(() => {
    const storedOrgId = window.localStorage.getItem("selected-organization-id");
    if (storedOrgId) {
      setSelectedOrgId(storedOrgId);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      window.localStorage.setItem("selected-organization-id", selectedOrgId);
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
        console.log("accessToken",accessToken)
        const nextOrganizations = accessToken
          ? await organizationApi.getOrganizationsForUser(accessToken)
          : [];
        setOrganizations(nextOrganizations);
        setSelectedOrgId((current) => {
          if (current && nextOrganizations.some((item) => item.id === current)) {
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

    loadOrganizations();
  }, [accessToken, isTokenLoading, tokenError]);

  useEffect(() => {
    const loadOrganizationDetails = async () => {
      if (!selectedOrgId) {
        setOrganization(null);
        setMembers([]);
        setRecentInvites([]);
        return;
      }

      setIsOrganizationLoading(true);
      setIsMembersLoading(true);
      setPageError("");

      try {
        const [nextOrganization, nextMembers] = await Promise.all([
          organizationApi.getOrganization(selectedOrgId, accessToken),
          organizationApi.getOrganizationUsers(selectedOrgId, accessToken),
        ]);

        setOrganization(nextOrganization);
        setOverviewName(nextOrganization?.name ?? "");
        setOverviewDomain(nextOrganization?.domain ?? "");
        setOverviewLogoUrl(nextOrganization?.logoSmallUrl ?? "");
        setMembers(nextMembers);
        setSelectedMemberIds([]);
        setMemberDrafts(
          Object.fromEntries(
            nextMembers.map((member) => [
              member.id,
              {
                roleId: member.roleId,
                avatarReadyPlayerMeImg: member.avatarReadyPlayerMeImg ?? "",
              },
            ]),
          ),
        );
      } catch (error) {
        setPageError(
          getErrorMessage(error, "Failed to load organization details."),
        );
      } finally {
        setIsOrganizationLoading(false);
        setIsMembersLoading(false);
      }
    };

    loadOrganizationDetails();
  }, [accessToken, selectedOrgId]);

  useEffect(() => {
    const loadPendingInvites = async () => {
      if (
        memberViewTab !== "pending" ||
        !selectedOrgId ||
        !accessToken
      ) {
        if (!selectedOrgId) {
          setRecentInvites([]);
        }
        return;
      }

      setIsPendingInvitesLoading(true);
      setPageError("");

      try {
        const invites = await organizationApi.getPendingOrganizationInvites(
          selectedOrgId,
          accessToken,
        );
        setRecentInvites(invites);
      } catch (error) {
        setPageError(
          getErrorMessage(error, "Failed to load pending invites."),
        );
      } finally {
        setIsPendingInvitesLoading(false);
      }
    };

    loadPendingInvites();
  }, [accessToken, memberViewTab, selectedOrgId]);

  const refreshOrganizations = async (nextSelectedOrgId?: string) => {
    const nextOrganizations = accessToken
      ? await organizationApi.getOrganizationsForUser(accessToken)
      : [];

    setOrganizations(nextOrganizations);
    if (nextSelectedOrgId) {
      setSelectedOrgId(nextSelectedOrgId);
      return;
    }

    setSelectedOrgId((current) => {
      if (current && nextOrganizations.some((item) => item.id === current)) {
        return current;
      }

      return nextOrganizations[0]?.id ?? "";
    });
  };

  const handleCreateOrganization = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setPageError("Organization name is required.");
      return;
    }

    setIsCreatingOrganization(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const createdOrganization = await organizationApi.createOrganization(
        trimmedName,
        accessToken,
      );

      if (!createdOrganization) {
        throw new Error("Organization was not returned by the API.");
      }

      await refreshOrganizations(createdOrganization.id);
      setIsCreateDialogOpen(false);
      setIsOrgMenuOpen(false);
      setCreateName("");
      setSuccessMessage("Organization created successfully.");
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to create organization."));
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const handleSaveOverview = async () => {
    if (!organization) {
      return;
    }

    setIsSavingOverview(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const updatedOrganization = await organizationApi.updateOrganization(
        organization.id,
        {
          name: overviewName.trim(),
          domain: overviewDomain.trim(),
          logoSmallUrl: overviewLogoUrl.trim(),
        },
        accessToken,
      );

      if (!updatedOrganization) {
        throw new Error("Organization was not returned by the API.");
      }

      setOrganization(updatedOrganization);
      setOverviewLogoUrl(updatedOrganization.logoSmallUrl ?? overviewLogoUrl.trim());
      setOrganizations((current) =>
        current.map((item) =>
          item.id === updatedOrganization.id ? updatedOrganization : item,
        ),
      );
      setSuccessMessage("Organization settings saved.");
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to update organization."));
    } finally {
      setIsSavingOverview(false);
    }
  };

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedLogoFile(file);

    if (!file) {
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setOverviewLogoUrl(localPreview);
  };

  const handleUploadLogoImage = async () => {
    if (!selectedLogoFile) {
      logoInputRef.current?.click();
      return;
    }

    setIsUploadingLogo(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const uploadConfig = await organizationApi.getOrganizationLogoUploadUrl(
        selectedLogoFile.type,
        accessToken,
      );

      if (!uploadConfig?.url || !uploadConfig.method) {
        throw new Error("Failed to get upload URL.");
      }

      const uploadResponse = await fetch(uploadConfig.url, {
        method: uploadConfig.method,
        headers: uploadConfig.headers,
        body: selectedLogoFile,
      });
      console.log("Upload response:", uploadResponse);

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload organization logo.");
      }

      const uploadedLogoUrl = uploadConfig.url.split("?")[0] || "";
      if (!uploadedLogoUrl) {
        throw new Error("Uploaded image URL not found.");
      }

      setOverviewLogoUrl(uploadedLogoUrl);
      setOrganization((current) =>
        current ? { ...current, logoSmallUrl: uploadedLogoUrl } : current,
      );
      setOrganizations((current) =>
        current.map((item) =>
          item.id === selectedOrgId ? { ...item, logoSmallUrl: uploadedLogoUrl } : item,
        ),
      );
      setSelectedLogoFile(null);
      setIsLogoDialogOpen(false);
      setSuccessMessage("Image uploaded successfully. Save to apply changes.");
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to upload organization logo."));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteMember = async (member: OrganizationUser) => {
    setPendingMemberId(member.id);
    setPageError("");
    setSuccessMessage("");

    try {
      await organizationApi.deleteOrganizationUser(member.id, accessToken);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setSuccessMessage(`Removed ${member.email}.`);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to delete member."));
    } finally {
      setPendingMemberId("");
    }
  };

  const handleToggleMemberSelection = (member: OrganizationUser) => {
    if (isOwnerRole(member.roleId)) {
      return;
    }

    setSelectedMemberIds((current) =>
      current.includes(member.id)
        ? current.filter((item) => item !== member.id)
        : [...current, member.id],
    );
  };

  const handleToggleAllMembers = () => {
    const selectableIds = filteredMembers
      .filter((member) => !isOwnerRole(member.roleId))
      .map((member) => member.id);

    setSelectedMemberIds((current) =>
      current.length === selectableIds.length ? [] : selectableIds,
    );
  };

  const handleDeleteSelectedMembers = async () => {
    const selectedMembers = members.filter(
      (member) =>
        selectedMemberIds.includes(member.id) && !isOwnerRole(member.roleId),
    );

    if (selectedMembers.length === 0) {
      return;
    }

    setPageError("");
    setSuccessMessage("");

    try {
      await Promise.all(
        selectedMembers.map((member) =>
          organizationApi.deleteOrganizationUser(member.id, accessToken),
        ),
      );

      const deletedIds = new Set(selectedMembers.map((member) => member.id));
      setMembers((current) =>
        current.filter((member) => !deletedIds.has(member.id)),
      );
      setSelectedMemberIds([]);
      setSuccessMessage(`${selectedMembers.length} members removed.`);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to delete selected members."));
    }
  };

  const handleRoleSelect = async (member: OrganizationUser, roleId: string) => {
    setOpenMemberMenuId("");
    setPendingMemberId(member.id);
    setPageError("");
    setSuccessMessage("");

    try {
      const updatedMember = await organizationApi.updateOrganizationUser(
        member.id,
        {
          roleId,
          avatarReadyPlayerMeImg:
            memberDrafts[member.id]?.avatarReadyPlayerMeImg ??
            member.avatarReadyPlayerMeImg ??
            "",
        },
        accessToken,
      );

      if (!updatedMember) {
        throw new Error("Member was not returned by the API.");
      }

      setMembers((current) =>
        current.map((item) => (item.id === member.id ? updatedMember : item)),
      );
      setMemberDrafts((current) => ({
        ...current,
        [member.id]: {
          roleId: updatedMember.roleId,
          avatarReadyPlayerMeImg: updatedMember.avatarReadyPlayerMeImg ?? "",
        },
      }));
      setSuccessMessage(`Updated ${member.email}.`);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to update member."));
    } finally {
      setPendingMemberId("");
    }
  };

  const handleInviteMember = async () => {
    if (!organization) {
      return;
    }

    const emails = inviteEmail
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setPageError("At least one email is required.");
      return;
    }

    setIsInviting(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const results = await Promise.allSettled(
        emails.map((email) =>
          organizationApi.createOrganizationInvite(
            {
              orgId: organization.id,
              email,
              roleId: inviteRoleId.trim(),
            },
            accessToken,
          ),
        ),
      );

      const invites = results
        .filter(
          (result): result is PromiseFulfilledResult<OrganizationInvite | null> =>
            result.status === "fulfilled" && Boolean(result.value),
        )
        .map((result) => result.value as OrganizationInvite);

      if (invites.length === 0) {
        throw new Error("No invites were created.");
      }

      setRecentInvites((current) => [...invites, ...current]);
      setInviteEmail("");
      setInviteRoleId("org_member");
      setIsInviteDialogOpen(false);
      setSuccessMessage(
        invites.length === 1
          ? `Invite sent to ${invites[0].email}.`
          : `${invites.length} invites sent successfully.`,
      );
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to create invite."));
    } finally {
      setIsInviting(false);
    }
  };

  const handleInviteAction = async (
    mode: "accept" | "reject",
    inviteLinkId: string,
  ) => {
    setInviteActionMode(mode);
    setPageError("");
    setSuccessMessage("");

    try {
      const invite =
        mode === "accept"
          ? await organizationApi.acceptOrganizationInvite(
            inviteLinkId,
            accessToken,
          )
          : await organizationApi.rejectOrganizationInvite(
            inviteLinkId,
            accessToken,
          );

      if (!invite) {
        throw new Error("Invite was not returned by the API.");
      }

      setRecentInvites((current) => {
        const existing = current.find(
          (item) => item.inviteLinkId === invite.inviteLinkId,
        );

        if (existing) {
          return current.map((item) =>
            item.inviteLinkId === invite.inviteLinkId ? invite : item,
          );
        }

        return [invite, ...current];
      });

      if (mode === "accept" && organization?.id === invite.orgId) {
        const nextMembers = await organizationApi.getOrganizationUsers(
          organization.id,
          accessToken,
        );
        setMembers(nextMembers);
      }

      setSuccessMessage(
        mode === "accept"
          ? "Invite accepted successfully."
          : "Invite rejected successfully.",
      );
    } catch (error) {
      setPageError(
        getErrorMessage(
          error,
          mode === "accept"
            ? "Failed to accept invite."
            : "Failed to reject invite.",
        ),
      );
    } finally {
      setInviteActionMode("");
    }
  };

  const userInitial =
    getInitials(
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email ||
      "User",
    ) || "U";

  const pendingInvites = useMemo(
    () => recentInvites.filter((invite) => invite.status === "PENDING"),
    [recentInvites],
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const displayName = formatMemberName(member.email).toLowerCase();
      return (
        member.email.toLowerCase().includes(query) ||
        member.roleId.toLowerCase().includes(query) ||
        displayName.includes(query)
      );
    });
  }, [memberSearch, members]);

  const filteredPendingInvites = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) {
      return pendingInvites;
    }

    return pendingInvites.filter((invite) => {
      const displayName = formatMemberName(invite.email).toLowerCase();
      return (
        invite.email.toLowerCase().includes(query) ||
        invite.roleId.toLowerCase().includes(query) ||
        displayName.includes(query)
      );
    });
  }, [memberSearch, pendingInvites]);

  const selectedInviteRole =
    roleOptions.find((option) => {
      const optionValue = normalizeRole(option.value);
      const currentValue = normalizeRole(inviteRoleId);
      return (
        optionValue === currentValue ||
        optionValue.replace(/[\s_-]+/g, "") ===
          currentValue.replace(/[\s_-]+/g, "")
      );
    }) || roleOptions[2];

  const selectableMemberIds = useMemo(
    () =>
      filteredMembers
        .filter((member) => !isOwnerRole(member.roleId))
        .map((member) => member.id),
    [filteredMembers],
  );

  const selectedDeletableCount = useMemo(
    () =>
      members.filter(
        (member) =>
          selectedMemberIds.includes(member.id) && !isOwnerRole(member.roleId),
      ).length,
    [members, selectedMemberIds],
  );

  const isAllMembersSelected =
    selectableMemberIds.length > 0 &&
    selectableMemberIds.every((id) => selectedMemberIds.includes(id));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(31,87,157,0.16),_transparent_28%),linear-gradient(180deg,#06080f_0%,#090d16_100%)] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="flex items-center justify-between gap-3 px-2">
            <button
              type="button"
              onClick={() => setIsOrgMenuOpen((current) => !current)}
              className="flex flex-1 items-center gap-4 text-left"
            >
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#1795cf]">
                {getOrganizationAvatar(selectedOrganization) ? (
                  <img src={getOrganizationAvatar(selectedOrganization)} alt={selectedOrganization?.name || "Organization"} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold">{getInitials(selectedOrganization?.name || "Org")}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{selectedOrganization?.name || "Organizations"}</p>
                <p className="truncate text-sm text-white/45">{selectedOrganization?.domain || "Choose a workspace"}</p>
              </div>
            </button>
            <button type="button" onClick={() => setIsOrgMenuOpen((current) => !current)} className="rounded-full p-2 text-white/80 transition hover:bg-white/8 hover:text-white">
              <ChevronDown className={cn("h-5 w-5 transition-transform", isOrgMenuOpen && "rotate-180")} />
            </button>
          </div>

          {isOrgMenuOpen ? (
            <div className="rounded-[22px] border border-white/12 bg-[#181c25] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.48)]">
              <div className="space-y-2">
                {organizations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrgId(item.id);
                      setIsOrgMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
                      item.id === selectedOrgId ? "bg-white/10 text-white" : "text-white/72 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold">{getInitials(item.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">{item.name}</p>
                      <p className="truncate text-xs text-white/45">{item.domain}</p>
                    </div>
                    {item.id === selectedOrgId ? <Check className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setIsCreateDialogOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 px-3 py-3 text-left text-white/78 transition hover:bg-white/6 hover:text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Plus className="h-5 w-5" /></div>
                <span className="text-base font-medium">Create organization</span>
              </button>
            </div>
          ) : null}

          <div className={cn(primaryCardClass, "flex min-h-[760px] flex-col p-4")}>
            <nav className="space-y-1">
              {navItems.map(({ label, icon: Icon, href }) => (
                <Link key={label} href={href} className={cn("flex items-center gap-4 rounded-2xl px-4 py-4 text-[15px] font-medium transition", href === "/organizations" ? "bg-white/10 text-white" : "text-white/82 hover:bg-white/5 hover:text-white")}>
                  <Icon className={cn("h-5 w-5", href === "/organizations" ? "text-[#7952ff]" : "text-white")} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex items-center justify-between rounded-2xl px-4 py-3 text-white/58">
              <div>
                <p className="text-xs uppercase tracking-[0.3em]">Powered by</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">odyssey</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="rounded-full p-2 transition hover:bg-white/8 hover:text-white"><Bell className="h-5 w-5" /></button>
                <button type="button" onClick={sso.logout} className="rounded-full p-2 transition hover:bg-white/8 hover:text-white"><LogOut className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </aside>

        <main className={cn(primaryCardClass, "p-5 md:p-7")}>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight md:text-[30px]">Organization settings</h1>
              <p className="mt-2 text-[13px] text-white/50 md:text-sm">Manage your workspace profile, members, and invitation flow.</p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="rounded-full border border-white/10 p-3 text-white transition hover:bg-white/8"><Bell className="h-5 w-5" /></button>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#090d16]">{userInitial}</div>
            </div>
          </div>

          <div className="border-b border-white/12">
            <div className="flex gap-6 text-base font-semibold md:text-[18px]">
              {(["overview", "members"] as TabId[]).map((tab) => (
                <button key={tab} type="button" onClick={() => setSelectedTab(tab)} className={cn("relative pb-5 capitalize text-white/66 transition hover:text-white", selectedTab === tab && "text-white")}>
                  {tab}
                  {selectedTab === tab ? <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-white" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 min-h-[720px]">
            {pageError ? <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{pageError}</div> : null}
            {successMessage ? <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}
            {!accessToken && tokenError ? <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{tokenError}</div> : null}

            {isBootstrapping ? (
              <div className="flex h-[520px] items-center justify-center text-white/70"><LoaderCircle className="mr-3 h-5 w-5 animate-spin" />Loading organizations...</div>
            ) : organizations.length === 0 ? (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <h2 className="text-2xl font-semibold">Create your first organization</h2>
                  <p className="mt-3 max-w-xl text-base leading-7 text-white/55">This workspace becomes the anchor for members, invitations, and future organization settings.</p>
                </div>
                <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
                  <label className="mb-3 block text-lg font-semibold">Organization name</label>
                  <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Test Organizations" className="w-full rounded-[20px] border border-white/10 bg-[#101520] px-5 py-4 text-lg text-white outline-none placeholder:text-white/28 focus:border-white/30" />
                  <Button onClick={handleCreateOrganization} disabled={isCreatingOrganization} className="mt-6 h-14 w-full rounded-full bg-white text-lg font-semibold text-[#090d16] hover:bg-white/90">{isCreatingOrganization ? "Creating..." : "Create organization"}</Button>
                </div>
              </div>
            ) : selectedTab === "overview" ? (
              <div className="grid gap-10 xl:grid-cols-[320px_minmax(0,620px)]">
                <div>
                  <h2 className="text-[38px] font-semibold leading-tight">Information</h2>
                  <p className="mt-3 max-w-[240px] text-[17px] leading-8 text-white/58">Basic information about your organization</p>
                </div>
                <div className="space-y-10">
                  {isOrganizationLoading ? (
                    <div className="flex items-center text-white/70"><LoaderCircle className="mr-3 h-5 w-5 animate-spin" />Loading organization details...</div>
                  ) : organization ? (
                    <>
                      <div>
                        <label className="mb-3 block text-[18px] font-semibold">Name</label>
                        <input value={overviewName} onChange={(event) => setOverviewName(event.target.value)} className="w-full rounded-[20px] border border-white/10 bg-[#101520] px-5 py-4 text-[18px] font-semibold text-white outline-none placeholder:text-white/28 focus:border-white/30" />
                      </div>
                      <div>
                        <label className="mb-2 block text-[18px] font-semibold">Username</label>
                        <p className="mb-3 text-[17px] font-medium text-white/55">This will appear on your team URL</p>
                        <input value={overviewDomain} onChange={(event) => setOverviewDomain(event.target.value)} className="w-full rounded-[20px] border border-white/10 bg-[#101520] px-5 py-4 text-[18px] font-semibold text-white/92 outline-none focus:border-white/30" />
                        <p className="mt-3 text-base font-medium text-[#41eb54]">Valid username</p>
                      </div>
                      <div>
                        <label className="mb-2 block text-[18px] font-semibold">Profile picture</label>
                        <p className="mb-4 text-[17px] font-medium text-white/55">Minimum size 80x80</p>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                        <div className="flex flex-col items-start gap-7 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-6">
                            <div className="relative flex h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
                              {overviewLogoUrl.trim() ? (
                                <img src={overviewLogoUrl} alt={organization.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[#1795cf] text-5xl font-semibold">
                                  {getInitials(organization.name)}
                                </div>
                              )}
                            </div>
                            <Button onClick={handleSaveOverview} disabled={isSavingOverview || isUploadingLogo} className="h-[64px] min-w-[230px] rounded-full bg-white text-[18px] font-semibold text-[#090d16] hover:bg-white/90">{isUploadingLogo ? "Uploading..." : isSavingOverview ? "Saving..." : "Save"}</Button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsLogoDialogOpen(true)}
                            className="flex h-13 w-13 items-center justify-center rounded-full bg-white/8 text-white transition hover:bg-white/12"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : <p className="text-white/60">Select an organization to continue.</p>}
                </div>
              </div>
            ) : (
              <div className="grid gap-8 xl:grid-cols-[170px_minmax(0,1fr)]">
                <div>
                  <h2 className="text-[20px] font-semibold leading-tight md:text-[22px]">Access & invites</h2>
                  <p className="mt-5 max-w-[180px] text-[13px] leading-7 text-white/58 md:text-[15px]">
                    Control access and invite users.
                  </p>
                </div>

                <section className="min-w-0">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-[343px]">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/38" />
                      <input
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        placeholder="Search members"
                        className="h-12 w-full rounded-full border border-white/16 bg-white/[0.04] pl-13 pr-5 text-base text-white outline-none placeholder:text-white/35 focus:border-white/26"
                      />
                    </div>
                    <Button
                      onClick={() => setIsInviteDialogOpen(true)}
                      className="h-12 w-full rounded-full bg-white px-10 text-base font-semibold text-[#090d16] hover:bg-white/90 xl:w-auto"
                    >
                      Invite
                    </Button>
                  </div>

                  {selectedDeletableCount > 0 ? (
                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={handleDeleteSelectedMembers}
                        variant="ghost"
                        className="h-10 rounded-full border border-red-400/30 bg-red-500/10 px-5 text-sm font-semibold text-red-100 hover:bg-red-500/18"
                      >
                        Delete selected ({selectedDeletableCount})
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-8 flex items-center gap-8 border-b border-white/12 pb-5">
                    <button
                      type="button"
                      onClick={() => setMemberViewTab("members")}
                      className={cn("text-base font-semibold md:text-[17px]", memberViewTab === "members" ? "text-white" : "text-white/45")}
                    >
                      Members
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberViewTab("pending")}
                      className={cn("text-base font-semibold md:text-[17px]", memberViewTab === "pending" ? "text-white" : "text-white/45")}
                    >
                      Pending
                    </button>
                  </div>

                  {memberViewTab === "members" ? (
                    <div className="mt-6 min-w-0">
                      <div className="hidden grid-cols-[40px_minmax(220px,1.2fr)_minmax(260px,1fr)_180px] items-center gap-6 px-4 py-4 text-[15px] font-semibold text-white xl:grid">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={handleToggleAllMembers}
                            className="flex h-7 w-7 items-center justify-center rounded-[10px] border-2 border-white/80"
                          >
                            {isAllMembersSelected ? <Check className="h-4 w-4" /> : null}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <div className="flex flex-col text-white/45">
                            <ChevronUp className="h-3 w-3" />
                            <ChevronDown className="-mt-1 h-3 w-3" />
                          </div>
                        </div>
                        <span>Email</span>
                        <span>Role</span>
                      </div>

                      {isMembersLoading ? (
                        <div className="flex h-32 items-center justify-center text-white/70">
                          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
                          Loading members...
                        </div>
                      ) : filteredMembers.length === 0 ? (
                        <div className="px-4 py-8 text-white/55">No members found.</div>
                      ) : (
                        filteredMembers.map((member) => {
                          const draft = memberDrafts[member.id] ?? {
                            roleId: member.roleId,
                            avatarReadyPlayerMeImg: member.avatarReadyPlayerMeImg ?? "",
                          };

                          return (
                            <div key={member.id} className="border-b border-white/6 py-4 last:border-b-0">
                              <div className="hidden grid-cols-[40px_minmax(220px,1.2fr)_minmax(260px,1fr)_180px] items-center gap-6 px-4 xl:grid">
                                <div className="flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMemberSelection(member)}
                                    disabled={isOwnerRole(member.roleId)}
                                    className={cn(
                                      "flex h-7 w-7 items-center justify-center rounded-[10px] border-2",
                                      isOwnerRole(member.roleId)
                                        ? "cursor-not-allowed border-white/20 opacity-40"
                                        : "border-white/80",
                                    )}
                                  >
                                    {selectedMemberIds.includes(member.id) ? (
                                      <Check className="h-4 w-4" />
                                    ) : null}
                                  </button>
                                </div>
                                <div className="flex min-w-0 items-center gap-4">
                                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/12">
                                    {draft.avatarReadyPlayerMeImg.trim() ? (
                                      <img src={draft.avatarReadyPlayerMeImg} alt={member.email} className="h-full w-full object-cover" />
                                    ) : (
                                      <UserRound className="h-5 w-5 text-white/65" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[14px] font-semibold md:text-[15px]">{formatMemberName(member.email)}</p>
                                    <p className="truncate text-[10px] uppercase tracking-[0.25em] text-white/35">
                                      Added {formatRelativeDate(member.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <p className="truncate text-[14px] text-white/92 md:text-[15px]">{member.email}</p>
                                <div className="relative">
                                  {isOwnerRole(draft.roleId) ? (
                                    <p className="text-[14px] font-semibold text-white md:text-[15px]">Owner</p>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenMemberMenuId((current) =>
                                            current === member.id ? "" : member.id,
                                          )
                                        }
                                        className="flex h-11 min-w-[150px] items-center justify-between rounded-[14px] border border-white/10 bg-[#101520] px-4 text-[14px] font-semibold text-white md:text-[15px]"
                                      >
                                        <span>{getRoleLabel(draft.roleId)}</span>
                                        <ChevronDown
                                          className={cn(
                                            "h-4 w-4 transition-transform",
                                            openMemberMenuId === member.id && "rotate-180",
                                          )}
                                        />
                                      </button>

                                      {openMemberMenuId === member.id ? (
                                        <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-[320px] rounded-[14px] bg-[#3b3a3d] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
                                          {roleOptions.map((option) => (
                                            <button
                                              key={option.value}
                                              type="button"
                                              onClick={() => handleRoleSelect(member, option.value)}
                                              className="flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-white/6"
                                            >
                                              <div className="w-6">
                                                {normalizeRole(draft.roleId) === normalizeRole(option.value) ? (
                                                  <Check className="h-5 w-5" />
                                                ) : null}
                                              </div>
                                              <div>
                                                <p className="text-[15px] font-semibold text-white">{option.label}</p>
                                                <p className="text-[13px] text-white/58">{option.description}</p>
                                              </div>
                                            </button>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteMember(member)}
                                            className="mt-3 px-2 py-3 text-left text-[15px] font-semibold text-[#ff5858]"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.02] p-4 xl:hidden">
                                <div className="flex min-w-0 items-center gap-4">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMemberSelection(member)}
                                    disabled={isOwnerRole(member.roleId)}
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border-2",
                                      isOwnerRole(member.roleId)
                                        ? "cursor-not-allowed border-white/20 opacity-40"
                                        : "border-white/80",
                                    )}
                                  >
                                    {selectedMemberIds.includes(member.id) ? (
                                      <Check className="h-4 w-4" />
                                    ) : null}
                                  </button>
                                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/12">
                                    {draft.avatarReadyPlayerMeImg.trim() ? (
                                      <img src={draft.avatarReadyPlayerMeImg} alt={member.email} className="h-full w-full object-cover" />
                                    ) : (
                                      <UserRound className="h-5 w-5 text-white/65" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[14px] font-semibold md:text-[15px]">{formatMemberName(member.email)}</p>
                                    <p className="truncate text-[13px] text-white/55">{member.email}</p>
                                  </div>
                                </div>
                                {isOwnerRole(draft.roleId) ? (
                                  <p className="text-[14px] font-semibold text-white">Owner</p>
                                ) : (
                                  <>
                                    <select
                                      value={draft.roleId}
                                      onChange={(event) => handleRoleSelect(member, event.target.value)}
                                      className="h-11 w-full rounded-2xl border border-white/10 bg-[#101520] px-4 text-[14px] text-white outline-none focus:border-white/30"
                                    >
                                      {roleOptions.map((option) => (
                                        <option key={option.value} value={option.value} className="bg-[#101520]">
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <Button
                                      onClick={() => handleDeleteMember(member)}
                                      disabled={pendingMemberId === member.id}
                                      variant="ghost"
                                      className="h-10 w-full rounded-full border border-red-400/30 bg-red-500/10 px-4 text-sm font-semibold text-red-100 hover:bg-red-500/18"
                                    >
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 min-w-0">
                      <div className="hidden grid-cols-[40px_minmax(180px,1.1fr)_minmax(220px,1fr)_minmax(120px,160px)_auto] items-center gap-4 px-4 py-4 text-[15px] font-semibold text-white xl:grid">
                        <div className="flex items-center justify-center">
                          <span className="h-7 w-7 rounded-[10px] border-2 border-white/80" />
                        </div>
                        <span>Name</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span className="text-right">Actions</span>
                      </div>

                      {isPendingInvitesLoading ? (
                        <div className="flex h-32 items-center justify-center text-white/70">
                          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
                          Loading pending invites...
                        </div>
                      ) : filteredPendingInvites.length === 0 ? (
                        <div className="px-4 py-8 text-white/55">
                          No pending invites found for this organization.
                        </div>
                      ) : (
                        filteredPendingInvites.map((invite) => (
                          <div key={invite.id} className="border-b border-white/6 py-4 last:border-b-0">
                            <div className="hidden grid-cols-[40px_minmax(180px,1.1fr)_minmax(220px,1fr)_minmax(120px,160px)_auto] items-center gap-4 px-4 xl:grid">
                              <div className="flex items-center justify-center">
                                <span className="h-7 w-7 rounded-[10px] border-2 border-white/80" />
                              </div>
                              <div>
                                <p className="text-[14px] font-semibold md:text-[15px]">{formatMemberName(invite.email)}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/35">
                                  Pending
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[14px] md:text-[15px]">{invite.email}</p>
                                <p className="truncate text-[11px] text-white/35">{invite.inviteLinkId}</p>
                              </div>
                              <p className="truncate text-[14px] md:text-[15px]">{getRoleLabel(invite.roleId)}</p>
                              <div className="flex justify-end gap-2">
                                <Button
                                  onClick={() => handleInviteAction("accept", invite.inviteLinkId)}
                                  disabled={inviteActionMode !== ""}
                                  className="h-10 rounded-full bg-[#3cd657] px-4 text-[13px] font-semibold text-[#08110a] hover:bg-[#48dc62]"
                                >
                                  {inviteActionMode === "accept" ? "Accepting..." : "Accept"}
                                </Button>
                                <Button
                                  onClick={() => handleInviteAction("reject", invite.inviteLinkId)}
                                  disabled={inviteActionMode !== ""}
                                  className="h-10 rounded-full bg-white px-4 text-[13px] font-semibold text-[#090d16] hover:bg-white/90"
                                >
                                  {inviteActionMode === "reject" ? "Rejecting..." : "Reject"}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.02] p-4 xl:hidden">
                              <div className="flex items-start gap-4">
                                <span className="mt-1 h-7 w-7 shrink-0 rounded-[10px] border-2 border-white/80" />
                                <div className="min-w-0">
                                  <p className="text-[14px] font-semibold md:text-[15px]">{formatMemberName(invite.email)}</p>
                                  <p className="mt-1 truncate text-[13px] text-white/55">{invite.email}</p>
                                  <p className="mt-2 truncate text-[11px] text-white/35">{invite.inviteLinkId}</p>
                                </div>
                              </div>
                              <p className="text-[13px] text-white/70">{getRoleLabel(invite.roleId)}</p>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleInviteAction("accept", invite.inviteLinkId)}
                                  disabled={inviteActionMode !== ""}
                                  className="h-10 flex-1 rounded-full bg-[#3cd657] px-4 text-[13px] font-semibold text-[#08110a] hover:bg-[#48dc62]"
                                >
                                  {inviteActionMode === "accept" ? "Accepting..." : "Accept"}
                                </Button>
                                <Button
                                  onClick={() => handleInviteAction("reject", invite.inviteLinkId)}
                                  disabled={inviteActionMode !== ""}
                                  className="h-10 flex-1 rounded-full bg-white px-4 text-[13px] font-semibold text-[#090d16] hover:bg-white/90"
                                >
                                  {inviteActionMode === "reject" ? "Rejecting..." : "Reject"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {isInviteDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[830px] rounded-[22px] border border-white/8 bg-[#030811] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between px-6 py-7">
              <h2 className="text-[20px] font-semibold">Invite organization members</h2>
              <button
                type="button"
                onClick={() => setIsInviteDialogOpen(false)}
                className="rounded-full p-2 text-white transition hover:bg-white/8"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-t border-white/12 px-6 py-8">
              <p className="mb-4 text-[18px] font-semibold">Invite by email</p>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <div className="flex rounded-[10px] bg-[#616266]">
                    <input
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="Email, comma separated"
                      className="h-[52px] flex-1 bg-transparent px-5 text-[18px] font-semibold text-white outline-none placeholder:text-white/58"
                    />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRoleMenuOpen((current) => !current)}
                        className="flex h-[52px] min-w-[160px] items-center justify-center gap-3 px-5 text-[18px] font-semibold text-white"
                      >
                        <span>{selectedInviteRole.label}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isRoleMenuOpen && "rotate-180")} />
                      </button>

                      {isRoleMenuOpen ? (
                        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[345px] rounded-[14px] bg-[#3b3a3d] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
                          {roleOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setInviteRoleId(option.value);
                                setIsRoleMenuOpen(false);
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-white/6"
                            >
                              <div className="w-6">
                                {normalizeRole(inviteRoleId).replace(/[\s_-]+/g, "") === normalizeRole(option.value).replace(/[\s_-]+/g, "") ? <Check className="h-5 w-5" /> : null}
                              </div>
                              <div>
                                <p className="text-[18px] font-semibold text-white">{option.label}</p>
                                <p className="text-[16px] text-white/58">{option.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleInviteMember}
                  disabled={isInviting || !organization}
                  className="h-[52px] min-w-[160px] rounded-full bg-white text-[18px] font-semibold text-[#090d16] hover:bg-white/90"
                >
                  {isInviting ? "Inviting..." : "Invite"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isLogoDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-white/10 bg-[#0c1017] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <h2 className="text-[18px] font-semibold">Profile picture</h2>
                <p className="mt-2 text-[13px] text-white/55">Minimum size 80x80</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLogoDialogOpen(false)}
                className="rounded-full p-2 text-white transition hover:bg-white/8"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-t border-white/12 p-6">
              <div className="rounded-[12px] bg-white/[0.04] p-6">
                {selectedLogoFile || overviewLogoUrl.trim() ? (
                  <div className="space-y-6">
                    <div className="overflow-hidden rounded-[12px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="relative mx-auto flex max-w-[460px] items-center justify-center overflow-hidden rounded-[10px] bg-[#165d91]">
                        {overviewLogoUrl.trim() ? (
                          <img
                            src={overviewLogoUrl}
                            alt={organization?.name || "Organization logo"}
                            className="max-h-[240px] w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-[220px] w-full items-center justify-center text-5xl font-semibold text-white">
                            {getInitials(organization?.name || "Org")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      {selectedLogoFile ? (
                        <p className="max-w-full truncate text-sm text-white/60">
                          {selectedLogoFile.name}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        onClick={handleUploadLogoImage}
                        disabled={isUploadingLogo}
                        className="h-14 rounded-full bg-white px-8 text-[16px] font-semibold text-[#090d16] hover:bg-white/90 disabled:opacity-70"
                      >
                        {isUploadingLogo ? "Uploading..." : "Upload image"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="flex h-[340px] w-full flex-col items-center justify-center rounded-[10px] border border-dashed border-white/35 bg-white/[0.03] text-center transition hover:bg-white/[0.05]"
                    >
                      <Plus className="mb-4 h-8 w-8 text-white/85" />
                      <span className="text-[16px] font-semibold">
                        Click or drop file here to upload
                      </span>
                    </button>
                    <p className="text-center text-sm text-white/55">
                      Images should be 150 pixels x 150 pixels in size
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#101520] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Create organization</h2>
                <p className="mt-2 text-sm text-white/52">Add a new organization to your workspace switcher.</p>
              </div>
              <button type="button" onClick={() => setIsCreateDialogOpen(false)} className="rounded-full p-2 text-white/70 transition hover:bg-white/8 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Test Organizations" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0b0f18] px-4 text-base text-white outline-none placeholder:text-white/28 focus:border-white/30" />
            <div className="mt-6 flex justify-end gap-3">
              <Button onClick={() => setIsCreateDialogOpen(false)} variant="ghost" className="h-12 rounded-full border border-white/10 px-5 text-white hover:bg-white/8">Cancel</Button>
              <Button onClick={handleCreateOrganization} disabled={isCreatingOrganization} className="h-12 rounded-full bg-white px-5 text-sm font-semibold text-[#090d16] hover:bg-white/90">{isCreatingOrganization ? "Creating..." : "Create"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
