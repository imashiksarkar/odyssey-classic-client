"use client";

import { AuthContext } from "@/app/auth-wrapper";
import { Button } from "@/components/ui/button";
import { type SpaceInvite, spaceApi } from "@/lib/space-api";
import useAccessToken from "@/lib/use-access-token";
import { cn } from "@/lib/utils";
import { ArrowLeft, LoaderCircle, LogOut, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const getInitials = (value: string) =>
  value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export default function SpaceInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();

  const inviteId = searchParams.get("id")?.trim() || "";
  const [invite, setInvite] = useState<SpaceInvite | null>(null);
  const [isInviteLoading, setIsInviteLoading] = useState(true);
  const [actionMode, setActionMode] = useState<"accept" | "reject" | "">("");
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");


  useEffect(() => {
    const loadInvite = async () => {
      if (!inviteId) {
        setInvite(null);
        setIsInviteLoading(false);
        setPageError("Invitation id is missing.");
        return;
      }

      setIsInviteLoading(true);
      setPageError("");

      try {
        const nextInvite = await spaceApi.getPendingSpaceInviteByInviteId(inviteId);
        if (!nextInvite) {
          throw new Error("Invitation not found.");
        }
        setInvite(nextInvite);
      } catch (error) {
        setInvite(null);
        setPageError(getErrorMessage(error, "Failed to load invitation."));
      } finally {
        setIsInviteLoading(false);
      }
    };

    void loadInvite();
  }, [inviteId]);

  const userName = useMemo(() => {
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return fullName || user?.email || "User";
  }, [user]);

  const handleInvitationAction = async (mode: "accept" | "reject") => {
    if (!inviteId) {
      setPageError("Invitation id is missing.");
      return;
    }

    if (!accessToken) {
      setPageError(tokenError || "Please sign in before responding to the invitation.");
      return;
    }

    setActionMode(mode);
    setPageError("");
    setSuccessMessage("");

    try {
      const nextInvite = mode === "accept"
        ? await spaceApi.acceptSpaceInvite(inviteId, accessToken)
        : await spaceApi.rejectSpaceInvite(inviteId, accessToken);

      if (nextInvite) {
        setInvite(nextInvite);
      }

      setSuccessMessage(
        mode === "accept"
          ? "Invitation accepted. Redirecting to spaces..."
          : "Invitation rejected. Redirecting to spaces...",
      );

      window.setTimeout(() => {
        router.replace("/organizations/spaces");
      }, 900);
    } catch (error) {
      setPageError(
        getErrorMessage(
          error,
          mode === "accept"
            ? "Failed to accept invitation."
            : "Failed to reject invitation.",
        ),
      );
    } finally {
      setActionMode("");
    }
  };

  const isAuthReady = Boolean(user && accessToken);
  const isPageLoading = isInviteLoading || isTokenLoading;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(33,96,178,0.18),_transparent_30%),linear-gradient(180deg,#05070d_0%,#090d16_100%)] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>

          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#090d16]">
              {getInitials(userName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-white/50">{user?.email || "Not signed in"}</p>
            </div>
            {user ? (
              <button type="button" className="rounded-full p-2 text-white/70 transition hover:bg-white/8 hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[560px] rounded-[32px] border border-white/10 bg-[#0d1119]/90 p-8 shadow-[0_28px_100px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(180deg,#1f7ed0_0%,#0d4b84_100%)] text-3xl font-semibold">S</div>

            <div className="mt-8 text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-white/40">Space Invite</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">{invite?.space?.name || "Respond to invitation"}</h1>
              <p className="mt-3 text-sm leading-7 text-white/55">Review the invitation linked to your account and choose whether to join or decline.</p>
            </div>

            <div className="mt-8 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-white/40">Invited email</p>
              <p className="mt-3 truncate rounded-full bg-white/8 px-4 py-3 text-center text-lg font-semibold">{invite?.email || "Unavailable"}</p>
              {user?.email ? <p className="mt-4 text-center text-xs text-white/45">Signed in as {user.email}</p> : null}
              <p className="mt-4 break-all text-center text-xs text-white/35">Invite ID: {inviteId || "Missing"}</p>
            </div>

            {pageError ? <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{pageError}</div> : null}
            {successMessage ? <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}

            {isPageLoading ? (
              <div className="mt-8 flex items-center justify-center text-white/70"><LoaderCircle className="mr-3 h-5 w-5 animate-spin" />Loading invitation...</div>
            ) : !inviteId ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-white/65"><X className="h-4 w-4" /><span>Missing invitation id.</span></div>
            ) : !invite ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-white/65"><X className="h-4 w-4" /><span>Invitation unavailable.</span></div>
            ) : isAuthReady ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button onClick={() => handleInvitationAction("accept")} disabled={actionMode !== ""} className={cn("h-14 rounded-full text-base font-semibold", "bg-white text-[#090d16] hover:bg-white/90")}>{actionMode === "accept" ? "Accepting..." : "Accept invitation"}</Button>
                <Button onClick={() => handleInvitationAction("reject")} disabled={actionMode !== ""} variant="outline" className="h-14 rounded-full border-white/14 bg-transparent text-base font-semibold text-white hover:bg-white/8">{actionMode === "reject" ? "Rejecting..." : "Reject invitation"}</Button>
              </div>
            ) : (
              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-center"><p className="text-sm leading-7 text-white/60">Sign in to respond to this invitation.</p></div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
