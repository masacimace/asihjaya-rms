export type ReleaseInfo = {
  releaseId: string;
  revision: string;
  buildDate: string;
};

function normalized(value: string | undefined): string {
  return value?.trim() || "unknown";
}

export function getReleaseInfo(
  source: Readonly<Record<string, string | undefined>> = process.env,
): ReleaseInfo {
  return {
    releaseId: normalized(source.APP_RELEASE_ID),
    revision: normalized(source.APP_REVISION),
    buildDate: normalized(source.APP_BUILD_DATE),
  };
}
