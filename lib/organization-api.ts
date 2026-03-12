import axios, { AxiosRequestConfig } from "axios";

export type Organization = {
  id: string;
  name: string;
  domain: string;
  logoSmallUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganizationUser = {
  id: string;
  orgId: string;
  email: string;
  roleId: string;
  avatarReadyPlayerMeImg?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganizationInvite = {
  id: string;
  orgId: string;
  email: string;
  roleId: string;
  inviteLinkId: string;
  avatarReadyPlayerMeImg?: string | null;
  actionAt?: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRES";
  type: "EMAIL" | "LINK";
  createdAt?: string;
  updatedAt?: string;
  organization?: Organization;
};

export type PresignedUploadResponse = {
  url: string;
  method: string;
  headers?: Record<string, string>;
};

type ApiRecord = Record<string, unknown>;

const ORGANIZATION_API_BASE =
  process.env.NEXT_PUBLIC_ORGANIZATION_SERVICE_BASE_URL?.replace(/\/$/, "") || "";

const organizationHttp = axios.create({
  baseURL: ORGANIZATION_API_BASE,
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

const getRequestConfig = (
  accessToken?: string,
  config?: AxiosRequestConfig,
): AxiosRequestConfig => ({
  baseURL: ORGANIZATION_API_BASE,
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
  if (!ORGANIZATION_API_BASE) {
    throw new Error("NEXT_PUBLIC_ORGANIZATION_SERVICE_BASE_URL is not configured.");
  }

  const response = await organizationHttp.request<T>(
    getRequestConfig(accessToken, config) as AxiosRequestConfig<T>,
  );

  return response.data;
};

const normalizeOrganizationsFromUser = (payload: unknown): Organization[] => {
  const result = unwrapData(payload);

  if (!Array.isArray(result)) {
    return [];
  }

  return result
    .map((item) => {
      const record = asRecord(item);
      const organization = asRecord(record?.organization);

      return organization as Organization | null;
    })
    .filter((item): item is Organization => Boolean(item?.id));
};

const normalizeOrganizationsFromList = (
  payload: unknown,
): {
  data: Organization[];
  total: number;
} => {
  const result = unwrapData(payload);
  const record = asRecord(result);
  const data = Array.isArray(record?.data) ? (record.data as Organization[]) : [];
  const meta = asRecord(record?.meta);
  const total = typeof meta?.total === "number" ? meta.total : data.length;

  return { data, total };
};

const normalizeOrganization = (payload: unknown): Organization | null => {
  const result = unwrapData(payload);
  const record = asRecord(result);

  if (!record?.id) {
    return null;
  }

  return record as Organization;
};

const normalizeOrganizationUsers = (payload: unknown): OrganizationUser[] => {
  const result = unwrapData(payload);
  return Array.isArray(result) ? (result as OrganizationUser[]) : [];
};

const normalizeOrganizationInvite = (payload: unknown): OrganizationInvite | null => {
  const result = unwrapData(payload);
  const record = asRecord(result);

  if (!record?.id) {
    return null;
  }

  return record as OrganizationInvite;
};

const normalizeOrganizationInvites = (payload: unknown): OrganizationInvite[] => {
  const result = unwrapData(payload);
  return Array.isArray(result) ? (result as OrganizationInvite[]) : [];
};

const normalizePresignedUpload = (
  payload: unknown,
): PresignedUploadResponse | null => {
  const result = unwrapData(payload);
  const record = asRecord(result);

  if (!record?.url || !record?.method) {
    return null;
  }

  return {
    url: String(record.url),
    method: String(record.method),
    headers: asRecord(record.headers) as Record<string, string> | undefined,
  };
};

export const organizationApi = {
  async getOrganizationsForUser(accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: "/organizations/user-org",
      },
      accessToken,
    );

    console.log({payload})

    return normalizeOrganizationsFromUser(payload);
  },

  async getOrganizations(accessToken?: string, page = 1, limit = 50) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: "/organizations",
        params: { page, limit },
      },
      accessToken,
    );

    return normalizeOrganizationsFromList(payload);
  },

  async getOrganization(id: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/organizations/${id}`,
      },
      accessToken,
    );

    return normalizeOrganization(payload);
  },

  async createOrganization(name: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "POST",
        url: "/organizations",
        data: { name },
      },
      accessToken,
    );

    return normalizeOrganization(payload);
  },

  async updateOrganization(
    id: string,
    data: { name?: string; domain?: string; logoSmallUrl?: string },
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "PATCH",
        url: `/organizations/${id}`,
        data,
      },
      accessToken,
    );

    return normalizeOrganization(payload);
  },

  async getOrganizationUsers(orgId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/organizations/org-user/${orgId}`,
      },
      accessToken,
    );

    return normalizeOrganizationUsers(payload);
  },

  async updateOrganizationUser(
    id: string,
    data: { roleId?: string; avatarReadyPlayerMeImg?: string },
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "PATCH",
        url: `/organizations/org-user/${id}`,
        data,
      },
      accessToken,
    );

    const result = unwrapData(payload);
    return asRecord(result) as OrganizationUser | null;
  },

  async deleteOrganizationUser(id: string, accessToken?: string) {
    await request<unknown>(
      {
        method: "DELETE",
        url: `/organizations/org-user/${id}`,
      },
      accessToken,
    );
  },

  async createOrganizationInvite(
    data: { orgId: string; email: string; roleId: string },
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "POST",
        url: "/organizations-invite",
        data,
      },
      accessToken,
    );

    return normalizeOrganizationInvite(payload);
  },

  async getPendingOrganizationInvites(orgId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/organizations-invite/pending-user/${orgId}`,
      },
      accessToken,
    );

    return normalizeOrganizationInvites(payload);
  },

  async getPendingOrganizationInviteByInviteId(
    inviteId: string,
    accessToken?: string,
  ) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: `/organizations-invite/pending-user-by-invite/${inviteId}`,
      },
      accessToken,
    );

    return normalizeOrganizationInvite(payload);
  },

  async getOrganizationLogoUploadUrl(fileType: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "GET",
        url: "/upload/url",
        params: { fileType },
      },
      accessToken,
    );

    return normalizePresignedUpload(payload);
  },

  async acceptOrganizationInvite(inviteLinkId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "PUT",
        url: `/organizations-invite/accept-invite/${inviteLinkId}`,
      },
      accessToken,
    );

    return normalizeOrganizationInvite(payload);
  },

  async rejectOrganizationInvite(inviteLinkId: string, accessToken?: string) {
    const payload = await request<unknown>(
      {
        method: "PUT",
        url: `/organizations-invite/reject-invite/${inviteLinkId}`,
      },
      accessToken,
    );

    return normalizeOrganizationInvite(payload);
  },
};
