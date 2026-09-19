import Link from "next/link";

export function EmptyState({ title, text, action, href }: { title: string; text: string; action?: string; href?: string }) {
  return <div className="empty-state"><span>∅</span><h3>{title}</h3><p>{text}</p>{action && href ? <Link className="text-link" href={href}>{action} →</Link> : null}</div>;
}
