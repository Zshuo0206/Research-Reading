import fs from "node:fs";
import path from "node:path";
import { compile } from "json-schema-to-typescript";

const root = process.cwd();
const schemaDir = path.join(root, "packages", "contracts", "wave1");
const outIndex = process.argv.indexOf("--out");
const outputDir =
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : path.join(schemaDir, "generated");
const files = fs
  .readdirSync(schemaDir)
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const schemas = new Map();
for (const file of files)
  schemas.set(
    file,
    JSON.parse(fs.readFileSync(path.join(schemaDir, file), "utf8")),
  );
const byId = new Map(
  [...schemas.values()].map((schema) => [schema.$id, schema]),
);

const clone = (value) => JSON.parse(JSON.stringify(value));
const resolve = (ref, current) => {
  if (ref.startsWith("#/$defs/"))
    return current.$defs?.[ref.slice("#/$defs/".length)];
  const [id, fragment] = ref.split("#");
  const schema = byId.get(id);
  if (!schema) return undefined;
  if (!fragment) return schema;
  if (fragment.startsWith("/$defs/"))
    return schema.$defs?.[fragment.slice("/$defs/".length)];
  return undefined;
};
const inline = (value, current, seen = new Set()) => {
  if (Array.isArray(value))
    return value.map((entry) => inline(entry, current, seen));
  if (!value || typeof value !== "object") return value;
  if (typeof value.$ref === "string") {
    const target = resolve(value.$ref, current);
    if (!target || seen.has(value.$ref))
      return { type: "object", additionalProperties: true };
    const nextSeen = new Set(seen).add(value.$ref);
    return inline(clone(target), current, nextSeen);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      inline(entry, current, seen),
    ]),
  );
};

fs.mkdirSync(outputDir, { recursive: true });
for (const file of files) {
  const schema = schemas.get(file);
  const name = file
    .replace(/\.schema\.json$/, "")
    .replace(/[^A-Za-z0-9]+(.)/g, (_, char) => char.toUpperCase());
  const generated = await compile(inline(schema, schema), name, {
    bannerComment:
      "/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */",
    style: { singleQuote: true },
    format: false,
  });
  fs.writeFileSync(
    path.join(outputDir, `${file.replace(/\.schema\.json$/, "")}.d.ts`),
    generated.replace(/\r\n/g, "\n"),
  );
}
