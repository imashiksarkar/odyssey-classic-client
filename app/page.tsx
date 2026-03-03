"use client";

import { Button } from "@/components/ui/button";
import sso from "@/config/sso";
import { CheckCircle2, LogOut } from "lucide-react";
import { use, useEffect, useState } from "react";
import { AuthContext } from "./auth-wrapper";

const Home = () => {
  const [focus, setFocus] = useState(0);

  const { user } = use(AuthContext);

  useEffect(() => {
    const focusHandler = () => setFocus(Math.random());
    window.addEventListener("focus", focusHandler);

    return () => window.removeEventListener("focus", focusHandler);
  }, []);

  useEffect(() => {
    sso.fetchProfile();
  }, [focus]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded flex items-center justify-center">
              <span className="text-accent-foreground font-semibold text-sm">
                O
              </span>
            </div>
            <span className="font-semibold text-foreground hidden sm:inline">
              Odyssey
            </span>
          </div>

          {user ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2 cursor-pointer"
              onClick={sso.logout}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          ) : (
            <Button
              onClick={() => sso.login(window.location.origin)}
              size="sm"
              className="cursor-pointer"
            >
              Signin
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
        {user ? (
          <div className="space-y-12">
            {/* Profile Section */}
            <div className="flex flex-col lg:flex-row gap-12 items-start">
              {/* Profile Image */}
              <div className="shrink-0">
                <div className="w-64 h-80 bg-card border border-border rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl font-semibold text-muted-foreground">
                        A
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Profile Photo
                    </p>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div className="flex-1 space-y-8">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Full Name
                  </p>
                  <h1 className="text-4xl font-semibold text-foreground">
                    {user.firstName} {user.lastName}
                  </h1>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Email Address
                  </p>
                  <p className="text-lg text-foreground">{user.email}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Account Status
                  </p>
                  <div className="flex items-center gap-2">
                    {!user.pending && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-accent" />
                        <span className="text-foreground font-medium">
                          Verified
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Device Id
                  </p>
                  <p className="text-foreground">{user.deviceId}</p>
                </div>
              </div>
            </div>
          </div>
        ) : user === null ? (
          <div className="flex items-center justify-center min-h-125">
            <p className="text-muted-foreground">
              Login to see your profile and account details
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-125">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
