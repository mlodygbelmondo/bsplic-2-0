import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SlotsPage from "./SlotsPage";
import { INITIAL_FRAME, type SlotSpin } from "./model";

const mock = vi.hoisted(() => ({
  spin: vi.fn(),
  state: {
    data: { boostRemaining: 10, freeSpins: 0, bonusStake: 5, history: [] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  busy: false,
  pending: null,
  error: null,
  balance: 100,
}));
vi.mock("./useSlotGame", () => ({ useSlotGame: () => mock }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));
const result: SlotSpin = {
  id: "11111111-1111-4111-8111-111111111111",
  game: "bandit",
  stake: 5,
  charged: 5,
  payout: 2,
  net: -3,
  balance: 97,
  boosted: true,
  boostRemaining: 9,
  freeSpins: 0,
  awardedFreeSpins: 0,
  frames: [INITIAL_FRAME],
  createdAt: "2026-09-07T12:00:00Z",
};
function setup(game = "bandit") {
  return render(
    <MemoryRouter initialEntries={[`/casino/slots/${game}`]}>
      <Routes>
        <Route path="/casino/slots/:game" element={<SlotsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mock.spin.mockReset();
  mock.spin.mockResolvedValue(result);
  mock.state.data = {
    boostRemaining: 10,
    freeSpins: 0,
    bonusStake: 5,
    history: [],
  };
  mock.balance = 100;
  mock.busy = false;
  mock.state.isError = false;
});
describe("Slots", () => {
  it("shows a payout below the stake as a net loss", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    await screen.findByText("Strata netto · wypłata 2,00");
    expect(screen.getAllByText("-3,00")).toHaveLength(2);
  });
  it("locks bonus stake and permits free spins with an empty wallet", async () => {
    mock.state.data.freeSpins = 3;
    mock.state.data.bonusStake = 20;
    mock.balance = 0;
    setup("candy");
    expect(screen.getByLabelText("STAWKA")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "DARMOWY OBRÓT" }));
    await waitFor(() => expect(mock.spin).toHaveBeenCalledWith(20));
  });
  it("prevents betting beyond the wallet and while account data is unavailable", () => {
    mock.balance = 0;
    setup();
    expect(screen.getByRole("button", { name: "ZAKRĘĆ" })).toBeDisabled();
  });
  it("stops the session without offering another spin", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Kończę na dziś" }));
    expect(screen.getByRole("button", { name: "ZAKRĘĆ" })).toBeDisabled();
    expect(screen.getByText(/Zatrzymujesz się z bilansem/)).toBeVisible();
  });
  it("does not double-submit rapid clicks", async () => {
    mock.spin.mockReturnValue(new Promise(() => {}));
    setup();
    const button = screen.getByRole("button", { name: "ZAKRĘĆ" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mock.spin).toHaveBeenCalledTimes(1);
  });
  it("recovers from an unsuccessful spin", async () => {
    mock.spin.mockResolvedValue(null);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    await waitFor(() => expect(mock.spin).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    await waitFor(() => expect(mock.spin).toHaveBeenCalledTimes(2));
  });
  it("explains the welcome odds and net payout rules", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Zasady i wypłaty" }));
    expect(screen.getByText(/Pierwsze 10 płatnych obrotów/)).toBeVisible();
    expect(screen.getByText(/Wynik netto = wypłata/)).toBeVisible();
  });
});
