export function isWebHostAllowed(
  host: string,
  containerMode: boolean,
): boolean {
  return host === "127.0.0.1" || (containerMode && host === "0.0.0.0");
}
