"use server";

import apiClient from "@/lib/axios";

export const exchange = async (token: string) => {
  try {
    const { data } = await apiClient.post("/sso/exchange", {
      token,
      clientSecret: process.env.CLASSIC_CLIENT_SECRET,
    });

    return {
      data: data.data.tokens,
    };
  } catch (error) {
    console.log(error);
    return { data: null };
  }
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
