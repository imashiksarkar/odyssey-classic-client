"use client";

import { Organization } from "@/hooks/useOrganizations";

interface OrganizationSelectorProps {
  organizations: Organization[];
  value: string;
  onChange: (orgId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
}

export function OrganizationSelector({
  organizations,
  value,
  onChange,
  disabled,
  loading,
  error,
}: OrganizationSelectorProps) {
  if (loading) {
    return (
      <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400">
        Loading organizations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || organizations.length === 0}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 disabled:opacity-50 focus:outline-none focus:border-gray-400"
    >
      <option value="" disabled>
        {organizations.length === 0
          ? "No organizations found"
          : "Select organization"}
      </option>
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
