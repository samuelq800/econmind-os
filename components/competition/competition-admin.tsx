"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  getCompetitionAdmin,
  moderateCompetition,
  type CompetitionAdminData,
} from "@/lib/supabase/competition-matching";

export function CompetitionAdmin() {
  const { user, loading, roleLoading, platformRole } = useAuth();
  const [data, setData] = useState<CompetitionAdminData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setData(await getCompetitionAdmin());
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Admin data unavailable.",
      );
    }
  }
  useEffect(() => {
    if (user && !loading && !roleLoading && platformRole === "platform_admin") {
      const timer = window.setTimeout(() => void refresh(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [user, loading, roleLoading, platformRole]);
  async function act(
    action: string,
    id: string,
    values: Record<string, unknown> = {},
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await moderateCompetition(action, id, values);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  if (loading || roleLoading)
    return (
      <main className="cm-shell cm-state">Checking administrator access…</main>
    );
  if (!user || platformRole !== "platform_admin")
    return (
      <main className="cm-shell cm-state">
        Platform administrator access required.
      </main>
    );
  return (
    <main className="cm-shell">
      <div className="cm-container">
        <div className="cm-eyebrow">COMPETITION GOVERNANCE</div>
        <h1>Matching administration</h1>
        {error && (
          <p role="alert" className="cm-alert">
            {error}
          </p>
        )}
        {!data && (
          <Button onClick={() => void refresh()}>Load dashboard</Button>
        )}
        {data && (
          <>
            <section className="cm-content">
              <h2>Division rules</h2>
              {data.rules.map((rule) => (
                <div
                  className="cm-request"
                  key={`${rule.competition}:${rule.division}`}
                >
                  <div>
                    <h3>
                      {rule.competition} · {rule.division}
                    </h3>
                    <p>
                      {rule.min_team_size}–{rule.max_team_size} members ·{" "}
                      {rule.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const max = window.prompt(
                        "Maximum team size",
                        String(rule.max_team_size),
                      );
                      if (!max) return;
                      void act(
                        "update_rule",
                        `${rule.competition}:${rule.division}`,
                        {
                          min_team_size: rule.min_team_size,
                          max_team_size: Number(max),
                          active: rule.active,
                        },
                      );
                    }}
                  >
                    Edit size
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        "update_rule",
                        `${rule.competition}:${rule.division}`,
                        {
                          min_team_size: rule.min_team_size,
                          max_team_size: rule.max_team_size,
                          active: !rule.active,
                        },
                      )
                    }
                  >
                    {rule.active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const text = window.prompt(
                        "Stages (comma-separated)",
                        rule.stages.join(", "),
                      );
                      if (text !== null)
                        void act(
                          "update_rule",
                          `${rule.competition}:${rule.division}`,
                          {
                            stages: text
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          },
                        );
                    }}
                  >
                    Stages
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const text = window.prompt(
                        "Awards (comma-separated)",
                        rule.awards.join(", "),
                      );
                      if (text !== null)
                        void act(
                          "update_rule",
                          `${rule.competition}:${rule.division}`,
                          {
                            awards: text
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          },
                        );
                    }}
                  >
                    Awards
                  </Button>
                </div>
              ))}
            </section>
            <section className="cm-content">
              <h2>Reports</h2>
              {data.reports.map((report) => (
                <div className="cm-request" key={report.id}>
                  <div>
                    <small>
                      {report.status} ·{" "}
                      {new Date(report.created_at).toLocaleDateString()}
                    </small>
                    <p>{report.reason}</p>
                    <span>
                      Target {report.target_team_id || report.target_user_id}
                    </span>
                  </div>
                  {report.status === "open" && (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act("close_report", String(report.id))
                      }
                    >
                      Close report
                    </Button>
                  )}
                </div>
              ))}
            </section>
            <section className="cm-content">
              <h2>Recruitment posts</h2>
              {data.posts.map((post) => (
                <div className="cm-request" key={post.id}>
                  <span>{post.body}</span>
                  {post.active && (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => void act("remove_post", post.id)}
                    >
                      Remove post
                    </Button>
                  )}
                </div>
              ))}
            </section>
            <section className="cm-content">
              <h2>Team moderation</h2>
              {data.teams.map((team) => (
                <div className="cm-request" key={team.id}>
                  <span>
                    {team.name} · {team.competition} {team.division}
                  </span>
                  {team.active && (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Disable ${team.name}?`))
                          void act("disable_team", team.id);
                      }}
                    >
                      Disable
                    </Button>
                  )}
                </div>
              ))}
            </section>
            <section className="cm-content">
              <h2>Matching profiles</h2>
              {data.profiles.map((profile) => (
                <div className="cm-request" key={profile.id}>
                  <span>
                    {profile.userId} · {profile.competition} {profile.division}
                  </span>
                  {profile.active && (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => void act("disable_profile", profile.id)}
                    >
                      Disable
                    </Button>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
