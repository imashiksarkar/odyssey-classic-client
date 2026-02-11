"use server";

import apiClient from "@/lib/axios";
import sso from "../lib/sso";

export const exchange = async (token: string) => {
  const { isSuccess, data } = await sso.exchangeCode(
    token,
    process.env.CLASSIC_CLIENT_SECRET, // todo: can be omitted once sso is modified
  );

  if (isSuccess) return data!;

  throw new Error("SSO exchange failed");
};

export const getUserProfile = async (accessToken: string) => {
  try {
    const { data } = await apiClient.get("/users/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return {
      data: data.data,
    };
  } catch (error) {
    console.log(error);
    return { data: null };
  }
};
