export function assessDependencyAdvisories(
  advisories: readonly {
    github_advisory_id: string;
    module_name: string;
    findings: readonly { version: string; dev: boolean }[];
    url?: string;
  }[],
): {
  locallyMitigated: string[];
  notApplicable: {
    advisory: string;
    version: string;
    sourceSha256: string;
    reason: string;
  }[];
  modernMinimatch: string;
};
