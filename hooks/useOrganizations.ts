"use client";

import { useEffect, useState } from "react";
import { Credentials } from "./useCredentials";

export interface Organization {
  id: string;
  name: string;
}

/**
 * Fetches organizations for the authenticated user.
 */
export const useOrganizations = (credentials: Credentials | null) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials?.accessToken) return;

    const fetchOrganizations = async () => {
      setLoading(true);
      setError(null);

      try {
        const baseUrl = process.env.NEXT_PUBLIC_ORGANIZATION_SERVICE_BASE_URL;
        if (!baseUrl)
          throw new Error(
            "NEXT_PUBLIC_ORGANIZATION_SERVICE_BASE_URL is not set",
          );

        const response = await fetch(`${baseUrl}/organizations/user-org`, {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch organizations: ${response.status}`);
        }

        const data = await response.json();

        // Response shape: { data: [{ organization: { id, name, ... } }] }
        const orgs: Organization[] = Array.isArray(data.data)
          ? data.data.map(
              (item: { organization: { id: string; name: string } }) => ({
                id: item.organization.id,
                name: item.organization.name,
              }),
            )
          : [];

        setOrganizations(orgs);
        console.log(`[useOrganizations] Loaded ${orgs.length} organizations`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load organizations";
        console.error("[useOrganizations]", message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [credentials?.accessToken]);

  return { organizations, loading, error };
};
