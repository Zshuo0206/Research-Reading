import { expect, test } from "@playwright/test";

test("opens the Wave 1 platform shell and API health endpoint", async ({
  page,
  request,
}) => {
  const health = await request.get("http://127.0.0.1:4310/health");
  expect(health.ok()).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Research Reading" }),
  ).toBeVisible();
  await expect(page.getByTestId("local-mode-notice")).toContainText(
    "local UI state",
  );
});
