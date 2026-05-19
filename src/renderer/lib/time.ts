export function formatDistanceToNow(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffSec < 60) return "agora";
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffH < 24) return `${diffH} h atrás`;
  return `${diffD} d atrás`;
}


