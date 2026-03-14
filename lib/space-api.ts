import axios, { AxiosError, type AxiosRequestConfig } from "axios";

export type Space = {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  description?: string | null;
  thumb?: string | null;
  currentParticipantSum?: number;
  updatedAt?: string;
  unrealProject?: {
    unrealProjectId?: string;
    unrealProjectVersionId?: string;
  } | null;
  spaceSetting?: SpaceSetting | null;
};

export type SpaceSetting = {
  isPublic?: boolean;
  afkTimer?: number;
  maxSessionLength?: number;
  allowAnonymousUsers?: boolean;
  allowEmbed?: boolean;
  allowConfigurationToolbarForAllUsers?: boolean;
  disableChat?: boolean;
  disableComms?: boolean;
  enableSharding?: boolean;
  isLiveStreamActive?: boolean;
  showHelpMenu?: boolean;
  showLoadingBackground?: boolean;
  showLoadingBackgroundBlur?: boolean;
  showOdysseyEditorMenu?: boolean;
  showSpaceInformation?: boolean;
  notViewerBuddle?: boolean;
  maximumResolution?: unknown;
  odysseyMobileControls?: "ON" | "OFF" | "JOYSTICK_ONLY";
  avatarType?: "STANDARD" | "AEC";
  avatarControlSystem?: "EVENT_MODE" | "GAME_MODE" | "FLIGHT_MODE";
};

export type SpaceInvite = {
  id: string;
  spaceId: string;
  email: string;
  roleId: string;
  inviteLinkId: string;
  actionAt?: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRES";
  type: "EMAIL" | "LINK";
  createdAt?: string;
  updatedAt?: string;
  space?: Space;
};

export type SpaceUser = {
  id: string;
  spaceId: string;
  email: string;
  roleId: string;
  isPending: boolean;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSpaceInput = {
  orgId: string;
  name: string;
  spaceTemplateId: string;
  unrealProject: {
    unrealProjectId: string;
    unrealProjectVersionId: string;
  };
};

export type UpdateSpaceInput = {
  name?: string;
  description?: string | null;
  thumb?: string | null;
};

export type UpdateSpaceSettingInput = SpaceSetting;

type ApiRecord = Record<string, unknown>;

const SPACE_API_BASE =
  process.env.NEXT_PUBLIC_ORGANIZATION_SERVICE_BASE_URL?.replace(/\/$/, "") || "";

const spaceHttp = axios.create({
  baseURL: SPACE_API_BASE,
});

const asRecord = (value: unknown): ApiRecord | null =>
  value && typeof value === "object" ? (value as ApiRecord) : null;

const unwrapData = (value: unknown): unknown => {
  const record = asRecord(value);
  if (!record || !("data" in record)) {
    return value;
  }

  return record.data;
};

const compactObject = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;

const getRequestConfig = (
  accessToken?: string,
  config?: AxiosRequestConfig,
): AxiosRequestConfig => ({
  baseURL: SPACE_API_BASE,
  ...config,
  headers: {
    ...(accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : {}),
    ...(config?.headers ?? {}),
  },
});

const request = async <T>(
  config: AxiosRequestConfig,
  accessToken?: string,
): Promise<T> => {
  if (!SPACE_API_BASE) {
    throw new Error("NEXT_PUBLIC_ORGANIZATION_SERVICE_BASE_URL is not configured.");
  }

  try {
    const response = await spaceHttp.request<T>(
      getRequestConfig(accessToken, config) as AxiosRequestConfig<T>,
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const message =
        (error.response?.data as { message?: string } | undefined)?.message ||
        error.message;
      throw new Error(message);
    }

    throw error;
  }
};

const normalizeSpaces = (payload: unknown): Space[] => {
  const result = unwrapData(payload);
  return Array.isArray(result) ? (result as Space[]) : [];
};

const normalizeSpaceInvite = (payload: unknown): SpaceInvite | null => {
  const result = unwrapData(payload);
  const record = asRecord(result);
  return record ? (record as SpaceInvite) : null;
};

const normalizeSpaceInvites = (payload: unknown): SpaceInvite[] => {
  const result = unwrapData(payload);
  return Array.isArray(result) ? (result as SpaceInvite[]) : [];
};

const normalizeSpaceUsers = (payload: unknown): SpaceUser[] => {
  const result = unwrapData(payload);
  return Array.isArray(result) ? (result as SpaceUser[]) : [];
};

export const spaceApi = {
  async createSpace(data: CreateSpaceInput, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "POST",
        url: "/space",
        data,
      },
      accessToken,
    );

    const result = unwrapData(payload);
    return asRecord(result) as unknown as Space | null;
  },

  async getSpacesByOrganization(orgId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/space/space-by-org/${orgId}`,
      },
      accessToken,
    );

    return normalizeSpaces(payload);
  },

  async getSpacesByProject(projectId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/space/space-by-project/${projectId}`,
      },
      accessToken,
    );

    return normalizeSpaces(payload);
  },

  async getSpaceById(
    spaceId: string,
    orgId: string,
    accessToken?: string,
  ) {
    const spaces = await this.getSpacesByOrganization(orgId, accessToken);
    return spaces.find((space) => space.id === spaceId) ?? null;
  },

  async updateSpace(
    spaceId: string,
    data: UpdateSpaceInput,
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "PATCH",
        url: `/space/${spaceId}`,
        data: compactObject(data),
      },
      accessToken,
    );

    const result = unwrapData(payload);
    return asRecord(result) as unknown as Space | null;
  },

  async updateSpaceSetting(
    spaceId: string,
    data: UpdateSpaceSettingInput,
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "PATCH",
        url: `/space/setting/${spaceId}`,
        data: compactObject(data),
      },
      accessToken,
    );

    const result = unwrapData(payload);
    return asRecord(result) as unknown as SpaceSetting | null;
  },

  async deleteSpace(spaceId: string, accessToken?: string) {
    await request<unknown>(
      {
        method: "DELETE",
        url: `/space/${spaceId}`,
      },
      accessToken,
    );
  },

  async createSpaceInvite(
    data: { spaceId: string; email: string; roleId: string },
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "POST",
        url: "/space-invite",
        data,
      },
      accessToken,
    );

    return normalizeSpaceInvite(payload);
  },

  async getPendingSpaceInvites(spaceId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/space-invite/pending-user/${spaceId}`,
      },
      accessToken,
    );

    return normalizeSpaceInvites(payload);
  },

  async getPendingSpaceInviteByInviteId(
    inviteId: string,
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/space-invite/pending-user-by-invite/${inviteId}`,
      },
      accessToken,
    );

    return normalizeSpaceInvite(payload);
  },

  async acceptSpaceInvite(inviteLinkId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "PUT",
        url: `/space-invite/accept-invite/${inviteLinkId}`,
      },
      accessToken,
    );

    return normalizeSpaceInvite(payload);
  },

  async rejectSpaceInvite(inviteLinkId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "PUT",
        url: `/space-invite/reject-invite/${inviteLinkId}`,
      },
      accessToken,
    );

    return normalizeSpaceInvite(payload);
  },

  async getSpaceUsers(spaceId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/space/space-user/${spaceId}`,
      },
      accessToken,
    );

    return normalizeSpaceUsers(payload);
  },
};

