import { existsSync } from "node:fs";

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_RPC = "https://studio.genlayer.com/api";

const RELEASES = {
  v1: "V1",
  v2: "V2",
  v2_1: "V2_1",
  v2_2: "V2_2",
};

function flagIsSet(env, name) {
  return env?.[name] === "1";
}

/**
 * Resolve whether a versioned deploy entrypoint may run.
 *
 * An ordinary `genlayer deploy` has no release-only flag and therefore returns
 * `skip`. A release-only flag without its matching explicit authorization is a
 * hard failure. A different release flag never activates this release.
 */
export function deploymentRunMode(env = process.env, release) {
  const suffix = RELEASES[release];
  if (!suffix) throw new Error(`Unknown Crux deployment release: ${String(release)}`);

  const ownOnly = `CRUX_DEPLOY_${suffix}_ONLY`;
  const ownAuthorized = `CRUX_DEPLOY_${suffix}_AUTHORIZED`;
  const competingOnly = Object.values(RELEASES)
    .filter((item) => item !== suffix)
    .map((item) => `CRUX_DEPLOY_${item}_ONLY`);

  if (competingOnly.some((name) => flagIsSet(env, name))) return "skip";
  if (!flagIsSet(env, ownOnly)) return "skip";
  if (env?.[ownAuthorized] !== "YES") {
    throw new Error(
      `Refusing ${suffix} deployment: set ${ownAuthorized}=YES alongside ${ownOnly}=1 for an explicit version-specific authorization.`,
    );
  }
  return "run";
}

export function assertStudionetTarget({ chainId, rpc }, release = "Crux") {
  if (Number(chainId) !== STUDIONET_CHAIN_ID) {
    throw new Error(`Refusing ${release} deployment: expected Studionet ${STUDIONET_CHAIN_ID}, got ${String(chainId)}`);
  }
  if (rpc !== STUDIONET_RPC) {
    throw new Error(`Refusing ${release} deployment: expected ${STUDIONET_RPC}, got ${rpc || "an unknown RPC endpoint"}`);
  }
}

export function assertManifestWriteAllowed(manifestPath, env = process.env, release = "V2") {
  if (existsSync(manifestPath)
    && env?.[`CRUX_DEPLOY_${RELEASES[release]}_ALLOW_MANIFEST_OVERWRITE`] !== "YES") {
    throw new Error(
      `Refusing ${release} deployment: ${manifestPath} already exists. Inspect its receipts and set `
      + `CRUX_DEPLOY_${RELEASES[release]}_ALLOW_MANIFEST_OVERWRITE=YES only for an explicitly approved resume or replacement.`,
    );
  }
}

export function assertFrontendEnvWriteAllowed(envPath, env = process.env) {
  if (existsSync(envPath) && env?.CRUX_DEPLOY_V1_ALLOW_ENV_WRITE !== "YES") {
    throw new Error(
      `Refusing V1 deployment: ${envPath} already exists. Set CRUX_DEPLOY_V1_ALLOW_ENV_WRITE=YES only for an explicitly approved V1 environment update.`,
    );
  }
}

export function assertNoAmbiguousResume(stage, pendingTransaction) {
  if (typeof stage !== "string" || stage.length === 0) {
    throw new Error("Refusing deployment resume: missing deployment stage.");
  }
  if (stage.endsWith("_SUBMITTED")) {
    if (!pendingTransaction
      || typeof pendingTransaction.txHash !== "string"
      || !/^0x[0-9a-fA-F]{64}$/.test(pendingTransaction.txHash)) {
      throw new Error(`Refusing deployment resume: ${stage} has no valid submitted transaction hash.`);
    }
    return;
  }
  if (stage.endsWith("_DEPLOYING")) {
    throw new Error(`Refusing deployment resume: ${stage} is ambiguous and has no recorded submitted transaction.`);
  }
}
