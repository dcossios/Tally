const ALLOWED_CANONICAL_SENDERS = new Set([
  "85540",
  "85286",
  "87400",
  "85784",
  "890220",
  "bancolombia",
]);

export function normalizeSender(sender: string) {
  return sender
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function isAllowedSender(sender: string) {
  return ALLOWED_CANONICAL_SENDERS.has(normalizeSender(sender));
}
