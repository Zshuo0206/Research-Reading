const major = Number(process.versions.node.split(".")[0]);
if (major !== 24) {
  console.error(`Node.js 24 is required; detected ${process.versions.node}`);
  process.exit(1);
}
console.log(`[node24] ${process.versions.node}`);
