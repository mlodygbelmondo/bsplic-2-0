import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SlotsPage from "./SlotsPage";
import { INITIAL_FRAME, spinSchema, stateSchema, type SlotSpin } from "./model";

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
  luckyShot: false,
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
  mock.error = null;
  mock.pending = null;
});
describe("Slots", () => {
  it("shows a payout below the stake as a net loss", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    await screen.findByText("Strata netto · wypłata 2,00");
    expect(screen.getAllByText("-3,00")).toHaveLength(2);
  });
  it("accepts and displays the fifteen-spin award from the server", async () => {
    const awarded = { ...result, freeSpins: 15, awardedFreeSpins: 15 };
    expect(spinSchema.parse(awarded).awardedFreeSpins).toBe(15);
    expect(stateSchema.parse({ ...mock.state.data, freeSpins: 15, history: [awarded] }).freeSpins).toBe(15);
    mock.spin.mockResolvedValue(awarded);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    expect(await screen.findByText("+15 darmowych obrotów")).toBeVisible();
  });
  it("labels the lucky shot separately from the board payout", async () => {
    mock.spin.mockResolvedValue({ ...result, luckyShot: true, payout: 1000, net: 995, balance: 1095 });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    expect(await screen.findByText("Lucky shot · wypłata ×200")).toBeVisible();
    expect(screen.getByText("Zysk netto · wypłata 1000,00")).toBeVisible();
  });
  it("locks bonus stake and permits free spins with an empty wallet", async () => {
    mock.state.data.freeSpins = 3;
    mock.state.data.bonusStake = 20;
    mock.balance = 0;
    setup("candy");
    expect(screen.getByLabelText("STAWKA")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "DARMOWY OBRÓT" }));
    await waitFor(() => expect(mock.spin).toHaveBeenCalledWith(20, true));
  });
  it("prevents betting beyond the wallet and while account data is unavailable", () => {
    mock.balance = 0;
    setup();
    expect(screen.getByRole("button", { name: "ZAKRĘĆ" })).toBeDisabled();
  });
  it("lets users clear the stake input before typing a replacement", () => {
    setup();
    const input = screen.getByLabelText("STAWKA");
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: "ZAKRĘĆ" })).toBeDisabled();
  });
  it("allows slot stakes above 100 when the wallet covers them", async () => {
    mock.balance = 500;
    setup();
    fireEvent.change(screen.getByLabelText("STAWKA"), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    await waitFor(() => expect(mock.spin).toHaveBeenCalledWith(250, false));
  });
  it("stops the session without offering another spin", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Zakończ sesję" }));
    expect(screen.getByRole("button", { name: "ZAKRĘĆ" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Wróć do lobby" })).toBeVisible();
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
  it("explains the lucky shot odds and net payout rules", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Zasady i wypłaty" }));
    expect(screen.getByText(/Pierwszy płatny obrót po co najmniej 6 godzinach/)).toBeVisible();
    expect(screen.getByText(/Wynik netto = wypłata/)).toBeVisible();
  });
});

describe("automatic bonus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  async function advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(100, ms - elapsed)); });
    }
  }
  it("plays a newly awarded bonus and never starts a paid spin afterwards despite stale state", async () => {
    mock.spin.mockResolvedValueOnce({ ...result, freeSpins: 2, awardedFreeSpins: 15 })
      .mockResolvedValueOnce({ ...result, charged: 0, freeSpins: 1 })
      .mockResolvedValueOnce({ ...result, charged: 0, freeSpins: 0 });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "ZAKRĘĆ" }));
    await advance(100);
    mock.state.data.freeSpins = 2;
    await advance(5000);
    expect(mock.spin.mock.calls).toEqual([[5, false], [5, true], [5, true]]);
    expect(screen.getByRole("button", { name: "ZAKRĘĆ" })).toBeEnabled();
    await advance(5000);
    expect(mock.spin).toHaveBeenCalledTimes(3);
  });
  it("starts saved free spins automatically and supports pause and resume", async () => {
    mock.state.data.freeSpins = 2;
    mock.spin.mockResolvedValueOnce({ ...result, charged: 0, freeSpins: 1 })
      .mockResolvedValueOnce({ ...result, charged: 0, freeSpins: 0 });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pauza bonusu" }));
    await advance(3000);
    expect(mock.spin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Wznów bonus" }));
    await advance(900);
    expect(mock.spin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Pauza bonusu" }));
    await advance(3000);
    expect(mock.spin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Wznów bonus" }));
    await advance(3000);
    expect(mock.spin.mock.calls).toEqual([[5, true], [5, true]]);
  });
  it("pauses on a failed request instead of retrying indefinitely", async () => {
    mock.state.data.freeSpins = 2;
    mock.spin.mockResolvedValue(null);
    setup();
    await advance(5000);
    expect(mock.spin).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Bonus wstrzymany")).toBeVisible();
  });
  it("pauses when the tab is hidden", async () => {
    mock.state.data.freeSpins = 2;
    setup();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    await advance(3000);
    expect(mock.spin).not.toHaveBeenCalled();
    expect(screen.getByText("Bonus wstrzymany")).toBeVisible();
    hidden.mockRestore();
  });
  it("cancels the scheduled bonus when the page is left", async () => {
    mock.state.data.freeSpins = 2;
    const view = setup();
    view.unmount();
    await advance(3000);
    expect(mock.spin).not.toHaveBeenCalled();
  });
  it("does not autoplay after ending the session", async () => {
    mock.state.data.freeSpins = 2;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Zakończ sesję" }));
    await advance(3000);
    expect(mock.spin).not.toHaveBeenCalled();
  });
});
