import { test, expect } from "@playwright/test";
test("criar, conflito, editar, cancelar, reativar e excluir uma série", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Você está no modo demonstração.")).toBeVisible();
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título", { exact: true }).fill("Caminhada de teste");
  await dialog.getByLabel("Horário", { exact: true }).fill("18:00");
  await dialog.getByLabel("Repetição").selectOption("weekly");
  await dialog.getByRole("button", { name: "Salvar compromisso" }).click();
  await expect(
    page.getByRole("heading", { name: "Caminhada de teste" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await dialog.getByLabel("Título", { exact: true }).fill("Conflito de teste");
  await dialog.getByLabel("Horário", { exact: true }).fill("18:15");
  await dialog.getByRole("button", { name: "Salvar compromisso" }).click();
  await expect(dialog.getByRole("alert")).toContainText("conflita");
  await dialog.getByRole("button", { name: "Voltar" }).click();
  await page
    .getByRole("button", { name: "Editar Caminhada de teste", exact: true })
    .click();
  await dialog.getByLabel("Título", { exact: true }).fill("Caminhada editada");
  await dialog.getByRole("button", { name: "Salvar compromisso" }).click();
  await page.getByRole("button", { name: "Compromissos", exact: true }).click();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Alterar status de Caminhada editada",
      exact: true,
    })
    .click();
  await expect(page.getByText("Cancelado · toda a série")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Alterar status de Caminhada editada",
      exact: true,
    })
    .click();
  await expect(page.getByText("Cancelado · toda a série")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Excluir Caminhada editada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Caminhada editada" }),
  ).toHaveCount(0);
});
test("calendário, resumo e link manual do WhatsApp", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Calendário", exact: true }).click();
  await expect(page.getByText("Calendário mensal")).toBeVisible();
  await page
    .getByRole("button", { name: "Gerar resumo da data selecionada" })
    .click();
  const summary = page.getByLabel("Mensagem da agenda");
  await expect(summary).toHaveValue(/09:00[\s\S]*Marina/);
  const value = await summary.inputValue();
  expect(value.indexOf("09:00")).toBeLessThan(value.indexOf("12:30"));
  expect(value.indexOf("12:30")).toBeLessThan(value.indexOf("15:00"));
  const link = page.getByRole("link", { name: "Abrir WhatsApp" });
  expect(
    new URL((await link.getAttribute("href"))!).searchParams.get("text"),
  ).toBe(value);
  await page.getByRole("button", { name: "Copiar mensagem" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
});
test("layout móvel, demonstração reinicia e banco permanece desligado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tudo no seu tempo." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const response = await page.request.get("/api/appointments");
  expect(response.status()).toBe(503);
  const invalid = await page.request.get(
    "/auth/confirm?token_hash=invalid&type=invite",
  );
  expect(invalid.status()).toBe(401);
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Título", { exact: true })
    .fill("Temporário");
  await page
    .getByRole("dialog")
    .getByLabel("Horário", { exact: true })
    .fill("20:00");
  await page.getByRole("button", { name: "Salvar compromisso" }).click();
  await expect(page.getByRole("heading", { name: "Temporário" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Temporário" })).toHaveCount(
    0,
  );
});
