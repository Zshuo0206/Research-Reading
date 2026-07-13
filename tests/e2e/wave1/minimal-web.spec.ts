import { expect, test } from "@playwright/test";

test("local workbench navigates core states and surfaces errors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("local-mode-notice")).toBeVisible();

  await page.getByLabel("Project name").fill("Paper notes");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByTestId("project-created")).toContainText(
    "proj_local_demo",
  );

  await page.getByLabel("PDF file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(page.getByRole("alert")).toContainText("not accepted");
  await page.getByLabel("PDF file").setInputFiles({
    name: "paper.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nmock"),
  });
  await expect(page.getByTestId("document-name")).toContainText("paper.pdf");
  await page
    .getByRole("button", { name: "Generate method-learning question" })
    .click();
  await expect(page.getByTestId("job-status")).toContainText("RUNNING");

  await page.getByLabel("Provider").selectOption("OPENAI");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByRole("alert")).toContainText("temporary API key");
  await page.getByLabel("Temporary API key").fill("not-a-real-key");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByRole("status")).toContainText("Testing connection");
  await expect(page.getByRole("status")).toContainText(
    "Connection test succeeded",
  );

  await page.getByRole("button", { name: "Confirm question" }).click();
  await expect(page.getByText("CONFIRMED").first()).toBeVisible();
  await page.getByRole("button", { name: "Generate answer" }).click();
  await expect(page.getByTestId("job-status")).toContainText(
    "ANSWER_GENERATION",
  );
  await page.getByRole("button", { name: "Confirm answer" }).click();
  await expect(page.getByText("VERIFIED").first()).toBeVisible();
});
