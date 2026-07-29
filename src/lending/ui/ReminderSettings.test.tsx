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

    expect(screen.getByLabelText("Bật nhắc hạn")).toBeChecked();
    expect(screen.getByLabelText("Nhắc trước (ngày)")).toHaveValue("1");
    expect(screen.getByLabelText("Giờ nhắc")).toHaveValue("08:00");
    await user.click(screen.getByLabelText("Bật nhắc hạn"));
    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "3");
    await user.clear(screen.getByLabelText("Giờ nhắc"));
    await user.type(screen.getByLabelText("Giờ nhắc"), "17:45");
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt nhắc hạn" }));

    expect(onSave).toHaveBeenCalledWith({ enabled: false, offsetDays: 3, time: "17:45" });
  });

  it("keeps invalid global reminder values out of persistence", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ReminderSettings value={defaultSettings} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.type(screen.getByLabelText("Nhắc trước (ngày)"), "-1");
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt nhắc hạn" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Số ngày nhắc trước phải là số nguyên không âm");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects a blank global reminder offset instead of saving it as zero", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ReminderSettings value={defaultSettings} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Nhắc trước (ngày)"));
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt nhắc hạn" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Số ngày nhắc trước phải là số nguyên không âm");
    expect(screen.getByLabelText("Nhắc trước (ngày)")).toHaveValue("");
    expect(onSave).not.toHaveBeenCalled();
  });
});
