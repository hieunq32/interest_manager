import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReminderSettings as ReminderSettingsValue } from "../domain/types";
import { ReminderSettings } from "./ReminderSettings";

const defaultSettings: ReminderSettingsValue = { enabled: true, offsetDays: 1, time: "08:00" };

describe("ReminderSettings", () => {
  it("edits the enabled default one-day 08:00 global settings and saves them", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ReminderSettings value={defaultSettings} onSave={onSave} />);

    expect(screen.getByLabelText("Enable global reminders")).toBeChecked();
    expect(screen.getByLabelText("Reminder offset (days)")).toHaveValue("1");
    expect(screen.getByLabelText("Reminder time")).toHaveValue("08:00");
    await user.click(screen.getByLabelText("Enable global reminders"));
    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.type(screen.getByLabelText("Reminder offset (days)"), "3");
    await user.clear(screen.getByLabelText("Reminder time"));
    await user.type(screen.getByLabelText("Reminder time"), "17:45");
    await user.click(screen.getByRole("button", { name: "Save reminder settings" }));

    expect(onSave).toHaveBeenCalledWith({ enabled: false, offsetDays: 3, time: "17:45" });
  });

  it("keeps invalid global reminder values out of persistence", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ReminderSettings value={defaultSettings} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.type(screen.getByLabelText("Reminder offset (days)"), "-1");
    await user.click(screen.getByRole("button", { name: "Save reminder settings" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Reminder offset must be a non-negative whole number");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects a blank global reminder offset instead of saving it as zero", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ReminderSettings value={defaultSettings} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Reminder offset (days)"));
    await user.click(screen.getByRole("button", { name: "Save reminder settings" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Reminder offset must be a non-negative whole number");
    expect(onSave).not.toHaveBeenCalled();
  });
});
