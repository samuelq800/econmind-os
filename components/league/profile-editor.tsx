"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { MemberIdentityCenter } from "@/components/profile/member-identity-center";
import { getMyMemberIdentity } from "@/lib/supabase/member-identity";
import type { MemberProfile } from "@/lib/profile/member-identity";
export function ProfileEditor() {
  const { user, openAuth } = useAuth();
  return user ? (
    <MemberLoader key={user.id} userId={user.id} email={user.email} />
  ) : (
    <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center">
      <div>
        <h1 className="text-3xl font-bold">Your EconMind identity</h1>
        <p className="mt-3">
          Sign in to manage your profile and see your participation.
        </p>
        <Button className="mt-5" onClick={() => openAuth("sign-in")}>
          Sign in
        </Button>
      </div>
    </main>
  );
}
function MemberLoader({ userId, email }: { userId: string; email?: string }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void getMyMemberIdentity()
      .then((next) => {
        if (active && next.userId === userId) setProfile(next);
        else if (active)
          setError("Your account changed. Please reload the page.");
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load your profile.",
          );
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  if (!profile)
    return (
      <main className="mx-auto max-w-5xl px-5 py-16">
        <h1 className="text-3xl font-bold">Member Profile</h1>
        {error ? (
          <div role="alert" className="mt-5">
            <p>{error}</p>
            <Button
              className="mt-4"
              onClick={() => {
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <p role="status" className="mt-5">
            Loading your identity and participation…
          </p>
        )}
      </main>
    );
  return (
    <MemberIdentityCenter
      profile={profile}
      setProfile={setProfile}
      email={email}
    />
  );
}
