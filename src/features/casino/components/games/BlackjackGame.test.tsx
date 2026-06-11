import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { BlackjackGame } from "./BlackjackGame";

const useBlackjackMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    profile: { balance: 250 },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("@/features/casino/hooks/useBlackjack", () => ({
  calculateHandValue: (hand: { value: number; rank: string }[]) =>
    hand.reduce((sum, card) => sum + card.value, 0),
  useBlackjack: (...args: unknown[]) => useBlackjackMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("BlackjackGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseBlackjackState = {
    playerHand: [],
    playerHands: [],
    activeHandIndex: 0,
    dealerHand: [],
    status: "betting" as const,
    stake: 0,
    gameId: null,
    tableInfo: {
      deckCount: 2,
      cardsRemaining: 104,
      shoeNumber: 1,
      handsPlayed: 0,
      needsShuffle: false,
    },
    dealerHiddenCount: 0,
    isLoading: false,
    isDealing: false,
    isResolving: false,
    actionMessage: null,
    startGame: vi.fn(),
    hit: vi.fn(),
    stand: vi.fn(),
    split: vi.fn(),
    doubleDown: vi.fn(),
    takeInsurance: vi.fn(),
    declineInsurance: vi.fn(),
    resetGame: vi.fn(),
    canSplit: false,
    canDoubleDown: false,
    canTakeInsurance: false,
    insuranceStatus: "unavailable",
    insuranceStake: 0,
    insurancePayout: 0,
  };

  it("shows a loading state while restoring the blackjack table", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      isLoading: true,
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Wczytywanie stołu...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Graj" }),
    ).not.toBeInTheDocument();
  });

  it("shows persistent shoe metadata without an automatic running count", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      tableInfo: {
        deckCount: 2,
        cardsRemaining: 78,
        shoeNumber: 4,
        handsPlayed: 11,
        needsShuffle: false,
      },
    });

    render(<BlackjackGame />);

    expect(screen.getByText("2 talie")).toBeInTheDocument();
    expect(screen.getByText("Pozostało 78/104 kart")).toBeInTheDocument();
    expect(screen.getByText("Shoe #4")).toBeInTheDocument();
    expect(screen.queryByText(/count/i)).not.toBeInTheDocument();
  });

  it("shows a dealing message while the initial hand is being created", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      isDealing: true,
      actionMessage: "Rozdawanie kart...",
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Rozdawanie kart...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rozdawanie..." }),
    ).toBeDisabled();
  });

  it("uses mobile-safe wrapping classes for blackjack actions and card rows", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      playerHand: [
        { suit: "hearts", rank: "10", value: 10 },
        { suit: "spades", rank: "9", value: 9 },
        { suit: "clubs", rank: "2", value: 2 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { id: "p-1", suit: "hearts", rank: "10", value: 10 },
            { id: "p-2", suit: "spades", rank: "9", value: 9 },
            { id: "p-3", suit: "clubs", rank: "2", value: 2 },
          ],
          stake: 10,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [{ id: "d-1", suit: "diamonds", rank: "8", value: 8 }],
      dealerHiddenCount: 1,
      canDoubleDown: true,
    });

    const { container } = render(<BlackjackGame />);

    expect(container.firstChild).toHaveClass(
      "grid",
      "flex-1",
      "min-h-0",
      "grid-rows-[minmax(12rem,1fr)_minmax(7rem,auto)_minmax(13rem,1fr)]",
    );
    expect(
      screen.getByRole("button", { name: "Hit" }).parentElement,
    ).toHaveClass("flex-wrap");
    expect(container.querySelector('[data-testid="player-hand"]')).toHaveClass(
      "max-w-full",
      "overflow-visible",
    );
    expect(container.querySelector('[data-testid="dealer-hand"]')).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
      "[scrollbar-width:none]",
    );
    expect(screen.getByTestId("dealer-hidden-card")).toBeInTheDocument();
    expect(container.querySelector('[data-card-id="p-1"]')).toBeInTheDocument();
  });

  it("shows a resolving message and keeps actions disabled during a server action", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      isResolving: true,
      actionMessage: "Dobieranie karty...",
      playerHand: [
        { id: "p-1", suit: "hearts", rank: "10", value: 10 },
        { id: "p-2", suit: "spades", rank: "9", value: 9 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { id: "p-1", suit: "hearts", rank: "10", value: 10 },
            { id: "p-2", suit: "spades", rank: "9", value: 9 },
          ],
          stake: 10,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [{ id: "d-1", suit: "diamonds", rank: "8", value: 8 }],
      dealerHiddenCount: 1,
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Dobieranie karty...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stand" })).toBeDisabled();
  });

  it("reserves the playing action message slot to prevent layout jumps", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      playerHand: [
        { id: "p-1", suit: "hearts", rank: "10", value: 10 },
        { id: "p-2", suit: "spades", rank: "9", value: 9 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { id: "p-1", suit: "hearts", rank: "10", value: 10 },
            { id: "p-2", suit: "spades", rank: "9", value: 9 },
          ],
          stake: 10,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [{ id: "d-1", suit: "diamonds", rank: "8", value: 8 }],
      dealerHiddenCount: 1,
    });

    render(<BlackjackGame />);

    expect(screen.getByTestId("blackjack-action-message-slot")).toHaveClass(
      "min-h-6",
      "invisible",
    );
  });

  it("keeps card animation timing short enough for mobile actions", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      playerHand: [
        { id: "p-1", suit: "hearts", rank: "10", value: 10 },
        { id: "p-2", suit: "spades", rank: "9", value: 9 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { id: "p-1", suit: "hearts", rank: "10", value: 10 },
            { id: "p-2", suit: "spades", rank: "9", value: 9 },
          ],
          stake: 10,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [{ id: "d-1", suit: "diamonds", rank: "8", value: 8 }],
      dealerHiddenCount: 1,
    });

    const { container } = render(<BlackjackGame />);

    expect(
      container.querySelector('[data-card-animation="quick"]'),
    ).toBeInTheDocument();
  });

  it("shows split and a double down action for eligible active hands", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      stake: 20,
      playerHand: [
        { suit: "hearts", rank: "10", value: 10 },
        { suit: "spades", rank: "K", value: 10 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { suit: "hearts", rank: "10", value: 10 },
            { suit: "spades", rank: "K", value: 10 },
          ],
          stake: 20,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "8", value: 8 },
        { suit: "clubs", rank: "K", value: 10 },
      ],
      canSplit: true,
      canDoubleDown: true,
    });

    render(<BlackjackGame />);

    expect(screen.getByRole("button", { name: /Split/i })).toHaveClass(
      "hover:text-white",
    );
    expect(screen.getByRole("button", { name: /Double Down/i })).toHaveClass(
      "hover:text-white",
    );
    expect(
      screen.queryByRole("button", { name: "x2" }),
    ).not.toBeInTheDocument();
  });

  it("shows only insurance choices when the dealer offers insurance", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "insurance",
      stake: 20,
      insuranceStatus: "offered",
      insuranceStake: 10,
      canTakeInsurance: true,
      playerHand: [
        { id: "p-1", suit: "hearts", rank: "9", value: 9 },
        { id: "p-2", suit: "clubs", rank: "7", value: 7 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { id: "p-1", suit: "hearts", rank: "9", value: 9 },
            { id: "p-2", suit: "clubs", rank: "7", value: 7 },
          ],
          stake: 20,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [{ id: "d-1", suit: "spades", rank: "A", value: 11 }],
      dealerHiddenCount: 1,
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Insurance?")).toBeInTheDocument();
    expect(screen.getByText("Stawka insurance: 10.00 zł")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insurance" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "No Insurance" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Hit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stand" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("dealer-hidden-card")).toBeInTheDocument();
  });

  it("keeps the single-hand view free of split hand labels", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      stake: 20,
      playerHand: [
        { suit: "hearts", rank: "K", value: 10 },
        { suit: "spades", rank: "Q", value: 10 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { suit: "hearts", rank: "K", value: 10 },
            { suit: "spades", rank: "Q", value: 10 },
          ],
          stake: 20,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "8", value: 8 },
        { suit: "clubs", rank: "K", value: 10 },
      ],
    });

    const { container } = render(<BlackjackGame />);

    expect(screen.queryByText("Ręka 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Aktywna")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="player-hand"]')?.parentElement
        ?.parentElement,
    ).toHaveClass("justify-center");
  });

  it("renders split hands with an active hand marker and per-hand stakes", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "playing",
      stake: 40,
      activeHandIndex: 1,
      playerHand: [
        { suit: "clubs", rank: "8", value: 8 },
        { suit: "diamonds", rank: "7", value: 7 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { suit: "hearts", rank: "8", value: 8 },
            { suit: "spades", rank: "10", value: 10 },
          ],
          stake: 20,
          payout: 0,
          status: "stand",
          doubleDownUsed: false,
          isSplitAces: false,
        },
        {
          id: "hand-2",
          cards: [
            { suit: "clubs", rank: "8", value: 8 },
            { suit: "diamonds", rank: "7", value: 7 },
          ],
          stake: 20,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "8", value: 8 },
        { suit: "clubs", rank: "K", value: 10 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Ręka 1")).toBeInTheDocument();
    expect(screen.getByText("Ręka 2")).toBeInTheDocument();
    expect(screen.getByText("Aktywna")).toBeInTheDocument();
    const handsRail =
      screen.getByText("Ręka 1").parentElement?.parentElement?.parentElement;
    expect(handsRail).toHaveClass("xl:justify-center");
    expect(handsRail).not.toHaveClass("lg:justify-center");
    expect(screen.getAllByText("Stawka: 20.00 zł")).toHaveLength(2);
  });

  it("summarizes settled split hands without flattening mixed outcomes to defeat copy", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "lost",
      stake: 60,
      activeHandIndex: 0,
      playerHand: [
        { suit: "hearts", rank: "10", value: 10 },
        { suit: "spades", rank: "9", value: 9 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { suit: "hearts", rank: "10", value: 10 },
            { suit: "spades", rank: "9", value: 9 },
          ],
          stake: 20,
          payout: 40,
          status: "won",
          doubleDownUsed: false,
          isSplitAces: false,
        },
        {
          id: "hand-2",
          cards: [
            { suit: "clubs", rank: "8", value: 8 },
            { suit: "diamonds", rank: "7", value: 7 },
          ],
          stake: 20,
          payout: 0,
          status: "lost",
          doubleDownUsed: false,
          isSplitAces: false,
        },
        {
          id: "hand-3",
          cards: [
            { suit: "clubs", rank: "Q", value: 10 },
            { suit: "diamonds", rank: "Q", value: 10 },
          ],
          stake: 20,
          payout: 20,
          status: "push",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "8", value: 8 },
        { suit: "clubs", rank: "K", value: 10 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Wynik splitu")).toBeInTheDocument();
    expect(screen.queryByText("Porażka")).not.toBeInTheDocument();
    expect(
      screen.getByText("Wygrane: 1 • Przegrane: 1 • Remisy: 1"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Graj ponownie/i })).toHaveClass(
      "hover:text-black",
    );
    expect(
      screen.getByRole("button", { name: "Zmień stawkę" }),
    ).toHaveClass("hover:text-white");
  });

  it("shows only the win title when blackjack resolves as won", async () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "won",
      stake: 25,
      playerHand: [
        { suit: "hearts", rank: "10", value: 10 },
        { suit: "spades", rank: "A", value: 11 },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "9", value: 9 },
        { suit: "clubs", rank: "8", value: 8 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByText("Wygrana!")).toBeInTheDocument();
    expect(
      screen.queryByText("Blackjack wypłaca nagrodę na saldo."),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Blackjack: wygrana!");
    });
  });

  it("offers quick stake chips and a mute toggle while betting", () => {
    useBlackjackMock.mockReturnValue(baseBlackjackState);

    render(<BlackjackGame />);

    for (const amount of ["5", "10", "25", "50", "100"]) {
      expect(screen.getByRole("button", { name: amount })).toBeEnabled();
    }
    expect(screen.getByRole("button", { name: "x2" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "MAX" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Wycisz dźwięki" }),
    ).toBeInTheDocument();
  });

  it("marks split-aces hands and shows per-hand results once settled", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "lost",
      stake: 40,
      playerHands: [
        {
          id: "hand-1-a",
          cards: [
            { suit: "hearts", rank: "A", value: 11 },
            { suit: "spades", rank: "K", value: 10 },
          ],
          stake: 20,
          payout: 40,
          status: "won",
          doubleDownUsed: false,
          isSplitAces: true,
        },
        {
          id: "hand-1-b",
          cards: [
            { suit: "clubs", rank: "A", value: 11 },
            { suit: "diamonds", rank: "2", value: 2 },
          ],
          stake: 20,
          payout: 0,
          status: "lost",
          doubleDownUsed: false,
          isSplitAces: true,
        },
      ],
      playerHand: [
        { suit: "hearts", rank: "A", value: 11 },
        { suit: "spades", rank: "K", value: 10 },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "10", value: 10 },
        { suit: "clubs", rank: "9", value: 9 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getAllByText("ASY")).toHaveLength(2);
    expect(screen.getByText("✓ +40.00 zł")).toBeInTheDocument();
    expect(screen.getByText("✗ przegrana")).toBeInTheDocument();
  });

  it("animates the net win with a payout count-up", () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: "won",
      stake: 10,
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { suit: "hearts", rank: "10", value: 10 },
            { suit: "spades", rank: "A", value: 11 },
          ],
          stake: 10,
          payout: 25,
          status: "won",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      playerHand: [
        { suit: "hearts", rank: "10", value: 10 },
        { suit: "spades", rank: "A", value: 11 },
      ],
      dealerHand: [
        { suit: "diamonds", rank: "9", value: 9 },
        { suit: "clubs", rank: "8", value: 8 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByTestId("blackjack-payout-countup")).toBeInTheDocument();
  });

  it("keeps the dealer hole-card slot stable when the dealer reveals and draws", () => {
    const playingState = {
      ...baseBlackjackState,
      gameId: "game-1",
      status: "playing" as const,
      playerHand: [
        { id: "p-1", suit: "hearts", rank: "10", value: 10 },
        { id: "p-2", suit: "spades", rank: "9", value: 9 },
      ],
      playerHands: [
        {
          id: "hand-1",
          cards: [
            { id: "p-1", suit: "hearts", rank: "10", value: 10 },
            { id: "p-2", suit: "spades", rank: "9", value: 9 },
          ],
          stake: 10,
          payout: 0,
          status: "playing",
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [{ id: "d-1", suit: "diamonds", rank: "3", value: 3 }],
      dealerHiddenCount: 1,
    };

    useBlackjackMock.mockReturnValue(playingState);
    const { rerender, container } = render(<BlackjackGame />);
    const hiddenSlot = screen.getByTestId("dealer-hidden-card");
    const dealerOpenCard = container.querySelector('[data-card-id="d-1"]');

    expect(container.querySelector('[data-testid="dealer-hand"]')).toHaveClass(
      "isolate",
      "-space-x-7",
      "[&::-webkit-scrollbar]:hidden",
    );
    expect(hiddenSlot).toHaveClass("h-28", "w-20", "bg-transparent");
    expect(
      within(hiddenSlot).getByRole("img", { name: "Rewers karty" }),
    ).toHaveAttribute(
      "src",
      "/casino/blackjack-card-reverse.png?v=20260503",
    );
    expect(hiddenSlot).not.toHaveClass(
      "border",
      "border-2",
      "bg-indigo-900",
      "shadow-xl",
    );
    expect(Number(hiddenSlot.getAttribute("data-card-delay"))).toBeGreaterThan(
      Number(dealerOpenCard?.getAttribute("data-card-delay")),
    );

    useBlackjackMock.mockReturnValue({
      ...playingState,
      status: "won",
      dealerHand: [
        { id: "d-1", suit: "diamonds", rank: "3", value: 3 },
        { id: "d-2", suit: "clubs", rank: "10", value: 10 },
        { id: "d-3", suit: "hearts", rank: "5", value: 5 },
      ],
      dealerHiddenCount: 0,
    });

    rerender(<BlackjackGame />);

    expect(hiddenSlot).toHaveAttribute("data-card-id", "d-2");
    expect(hiddenSlot).toHaveTextContent("10");
    expect(hiddenSlot.isConnected).toBe(true);
    expect(container.querySelector('[data-card-id="d-3"]')).toBeInTheDocument();
  });
});
