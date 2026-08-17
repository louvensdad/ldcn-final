import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "./i18n/I18nContext";
import { Marketplace } from "./Marketplace";

function renderMarketplace() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Marketplace />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe("Marketplace", () => {
  it("defaults to Sistemas completos and renders the featured system with category tab counts", () => {
    renderMarketplace();
    expect(screen.getByRole("heading", { name: "ERP System Template" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sistemas completos.*4/s })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agentes.*8/s })).toBeInTheDocument();
  });

  it("switches to the Agentes tab and still finds the agent catalog", () => {
    renderMarketplace();
    fireEvent.click(screen.getByRole("button", { name: /Agentes.*8/s }));
    expect(screen.getByRole("heading", { name: "Java Backend Engineer" })).toBeInTheDocument();
  });

  it("filters by search query within the default category", () => {
    renderMarketplace();
    const search = screen.getByPlaceholderText("Buscar agentes, stacks, templates...");
    fireEvent.change(search, { target: { value: "landing" } });
    expect(screen.getByRole("heading", { name: "Marketing Landing Page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ERP System Template" })).not.toBeInTheDocument();
  });

  it("opens the detail panel and closes it with Escape", () => {
    renderMarketplace();
    fireEvent.click(screen.getByRole("heading", { name: "Multi-tenant SaaS" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Descrição")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches locale and re-renders translated strings", () => {
    renderMarketplace();
    const localeSelect = screen.getByLabelText("Idioma");
    fireEvent.change(localeSelect, { target: { value: "en" } });
    expect(screen.getByPlaceholderText("Search agents, stacks, templates...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ERP System Template" })).toBeInTheDocument();
  });

  it("shows a lock indicator for items above the selected workspace plan", () => {
    renderMarketplace();
    const planSelect = screen.getByLabelText("Plano necessário");
    fireEvent.change(planSelect, { target: { value: "free" } });
    fireEvent.click(screen.getByRole("heading", { name: "ERP System Template" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Ver planos/ })).toBeInTheDocument();
  });
});
