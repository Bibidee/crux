export declare const STUDIONET_CHAIN_ID: 61999;
export declare const STUDIONET_RPC: "https://studio.genlayer.com/api";
export declare function deploymentRunMode(
  env: Record<string, string | undefined>,
  release: "v1" | "v2" | "v2_1" | "v2_2",
): "skip" | "run";
export declare function assertStudionetTarget(
  target: { chainId: number; rpc: string | undefined },
  release?: string,
): void;
export declare function assertManifestWriteAllowed(
  manifestPath: string,
  env: Record<string, string | undefined>,
  release?: "v1" | "v2" | "v2_1" | "v2_2",
): void;
export declare function assertFrontendEnvWriteAllowed(
  envPath: string,
  env: Record<string, string | undefined>,
): void;
export declare function assertNoAmbiguousResume(
  stage: string,
  pendingTransaction: { txHash?: string } | undefined,
): void;
