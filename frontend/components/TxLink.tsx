import { ExternalLink } from "lucide-react";
import { EXPLORER_URL } from "@/lib/wallet";

export function TxLink({ hash }: { hash: string }) {
  return <a className="tx-link" href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13}/></a>;
}
