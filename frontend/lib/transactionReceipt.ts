import { isFinalizedSuccessfulReceipt } from "./receiptSafety";

export function requireSuccessfulExecution<T>(receipt: T, transactionHash: string): T {
  if (!isFinalizedSuccessfulReceipt(receipt)) {
    throw new Error(
      `Transaction ${transactionHash} did not produce a finalized successful GenVM execution. Check its explorer trace before retrying.`,
    );
  }
  return receipt;
}
