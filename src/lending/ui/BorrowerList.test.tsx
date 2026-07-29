import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Borrower } from "../domain/types";
import { BorrowerList } from "./BorrowerList";

const borrowers: Borrower[] = [
  {
    id: "borrower-nguyen",
    displayName: "Nguyễn Văn A",
    phone: "0900000000",
    status: "active",
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  },
  {
    id: "borrower-tran",
    displayName: "Trần Thị B",
    phone: "0911111111",
    status: "active",
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  },
  {
    id: "borrower-archived",
    displayName: "Lê Văn C",
    phone: "0922222222",
    status: "archived",
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  },
];

describe("BorrowerList", () => {
  it("tìm theo tên không dấu, lọc trạng thái, và chọn đúng người vay", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BorrowerList borrowers={borrowers} onSelect={onSelect} />);

    const search = screen.getByLabelText("Tìm người vay");
    const status = screen.getByLabelText("Trạng thái người vay");
    expect(search).toBeInTheDocument();
    expect(status).toHaveValue("all");

    await user.type(search, "nguyen");
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.queryByText("Trần Thị B")).not.toBeInTheDocument();
    expect(screen.queryByText("Lê Văn C")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
    expect(onSelect).toHaveBeenCalledWith("borrower-nguyen");

    await user.clear(search);
    await user.selectOptions(status, "archived");
    expect(screen.getByText("Lê Văn C")).toBeInTheDocument();
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.queryByText("Trần Thị B")).not.toBeInTheDocument();
  });
});
