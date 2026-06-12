export function createTempId(): string {
  return `temp_${crypto.randomUUID()}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith("temp_") || id.startsWith("optimistic-");
}
