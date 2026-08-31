import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPeople, createPerson } from '../../../api/people';
import { uploadImage } from '../../../api/uploads';
import { saveFavouriteHand } from '../../../api/favourites';
import {
  POSITIONS_BY_COUNT,
  AMOUNT_ACTIONS,
  FOLD_ACTIONS,
  HOLE_CARD_COUNTS,
  BOARD_KEY_BY_STREET,
} from '../constants';

let idCounter = 0;
const nextId = () => `a${Date.now()}_${idCounter++}`;

function clockwiseSeatOrder(numPlayers, dealerSeat) {
  const seats = [];
  for (let i = 0; i < numPlayers; i++) {
    const seat = ((dealerSeat - 1 + i) % numPlayers) + 1;
    seats.push(seat);
  }
  return seats;
}

function assignSeats(numPlayers, dealerSeat) {
  const order = POSITIONS_BY_COUNT[numPlayers];
  const seats = clockwiseSeatOrder(numPlayers, dealerSeat);
  const bySeat = seats.map((seat, i) => ({ seat, position: order[i] }));
  return bySeat.sort((a, b) => a.seat - b.seat);
}

function actionOrderSeats(street, numPlayers, dealerSeat) {
  const posOrder = POSITIONS_BY_COUNT[numPlayers];
  const seats = clockwiseSeatOrder(numPlayers, dealerSeat);
  const bbIndex = posOrder.indexOf('BB');

  if (street === 'PREFLOP') {
    return [...seats.slice(bbIndex + 1), ...seats.slice(0, bbIndex + 1)];
  }
  return [...seats.slice(1), ...seats.slice(0, 1)];
}

function withPotSizes(actions, ante, numPlayers) {
  let pot = (ante || 0) * (numPlayers || 0);
  return actions.map((a) => {
    pot += Number(a.amount) || 0;
    return { ...a, potSizeAfter: pot };
  });
}

// Exported: ActionRow/ActionList render hints/warnings from these against
// the same per-action meta this hook already computes for validation.
export function computeBettingState(actions, players, bigBlind) {
  const remainingStack = {};
  players.forEach((p) => {
    remainingStack[p.name] = p.stack;
  });

  let currentStreet = null;
  let currentBetToMatch = 0;
  let lastRaiseSize = bigBlind || 0;
  const streetCommitted = {};

  return actions.map((a) => {
    if (a.street !== currentStreet) {
      currentStreet = a.street;
      Object.keys(streetCommitted).forEach((k) => {
        streetCommitted[k] = 0;
      });
      currentBetToMatch = 0;
      lastRaiseSize = bigBlind || 0;
    }

    const alreadyCommitted = streetCommitted[a.player] || 0;
    const stackBefore = remainingStack[a.player] ?? 0;
    const callAmount = Math.min(Math.max(currentBetToMatch - alreadyCommitted, 0), stackBefore);
    const minRaiseAmount = Math.min(callAmount + lastRaiseSize, stackBefore);

    const meta = {
      stackBefore,
      callAmount,
      minRaiseAmount,
      isFacingBet: currentBetToMatch - alreadyCommitted > 0,
    };

    const amt = Math.max(Number(a.amount) || 0, 0);
    remainingStack[a.player] = stackBefore - amt;
    const newCommitted = alreadyCommitted + amt;
    streetCommitted[a.player] = newCommitted;

    if (a.actionType === 'BET' || a.actionType === 'RAISE' || a.actionType === 'POST_BB') {
      if (newCommitted > currentBetToMatch) {
        lastRaiseSize = newCommitted - currentBetToMatch;
        currentBetToMatch = newCommitted;
      }
    } else if (a.actionType === 'CALL' || a.actionType === 'POST_SB') {
      currentBetToMatch = Math.max(currentBetToMatch, newCommitted);
    }

    return meta;
  });
}

export function bettingHintText(action, constraint) {
  const parts = [`Stack: ${constraint.stackBefore}`];
  if (action.actionType === 'BET' || action.actionType === 'RAISE') {
    parts.push(`Min: ${constraint.minRaiseAmount}`);
  } else if (constraint.callAmount > 0) {
    parts.push(`To call: ${constraint.callAmount}`);
  }
  return parts.join(' · ');
}

export function bettingWarning(action, constraint) {
  const amount = Number(action.amount) || 0;

  if (amount > constraint.stackBefore) {
    return `Exceeds stack (${constraint.stackBefore} left)`;
  }
  if (action.actionType === 'CHECK' && constraint.isFacingBet) {
    return `Can't check — facing a bet of ${constraint.callAmount}`;
  }
  if (action.actionType === 'CALL' && amount !== constraint.callAmount) {
    return `Call should be ${constraint.callAmount} to match the previous bet`;
  }
  if (
    (action.actionType === 'BET' || action.actionType === 'RAISE') &&
    amount < constraint.minRaiseAmount
  ) {
    return `Minimum raise is ${constraint.minRaiseAmount}`;
  }
  return null;
}

function setArrayIndex(arr, index, value) {
  const next = [...(arr || [])];
  while (next.length <= index) next.push(null);
  next[index] = value;
  return next;
}

function compactCards(arr) {
  return (arr || []).filter(Boolean);
}

function collectUsedCards(hand, excludeCard) {
  const used = new Set();
  const add = (c) => {
    if (c && c !== excludeCard) used.add(c);
  };
  hand.board.flop.forEach(add);
  hand.board.turn.forEach(add);
  hand.board.river.forEach(add);
  hand.players.forEach((p) => (p.holeCards || []).forEach(add));
  return used;
}

export function defaultTableSetup() {
  return {
    smallBlind: 1,
    bigBlind: 2,
    ante: 0,
    numPlayers: 4,
    dealerSeat: 2,
    heroSeat: 1,
    stacksBySeat: {},
  };
}

export function defaultHand() {
  return {
    sessionId: '',
    handIndex: 1,
    notes: '',
    gameType: 'NLH',
    stakes: '',
    datePlayed: new Date().toISOString(),
    players: [],
    actions: [],
    isRunTwice: false,
    board: { flop: [], turn: [], river: [] },
    winners: [],
    finalPotSize: undefined,
    isStarred: false,
  };
}

// Every piece of pure/derived hand-building logic, extracted out of the old
// monolithic HandCreator.jsx so the step components stay presentational.
// The `hand`/`tableSetup` shapes below are unchanged from the original
// implementation on purpose - poker-backend/model/PokerHands.js and
// HandReplayer.jsx both depend on this exact field layout.
export function useHandBuilder({ onSubmit } = {}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [tableSetup, setTableSetup] = useState(defaultTableSetup());
  const [hand, setHand] = useState(defaultHand());
  const [activeStreet, setActiveStreet] = useState('PREFLOP');
  const [editingSeat, setEditingSeat] = useState(null);

  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSavingHand, setIsSavingHand] = useState(false);
  const [cardSelector, setCardSelector] = useState(null);

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const { smallBlind, bigBlind, ante, numPlayers, dealerSeat, heroSeat, stacksBySeat } = tableSetup;

  const seatPositions = useMemo(
    () => assignSeats(numPlayers, dealerSeat),
    [numPlayers, dealerSeat]
  );

  const preflopOrderSeats = useMemo(
    () => actionOrderSeats('PREFLOP', numPlayers, dealerSeat),
    [numPlayers, dealerSeat]
  );
  const postflopOrderSeats = useMemo(
    () => actionOrderSeats('FLOP', numPlayers, dealerSeat),
    [numPlayers, dealerSeat]
  );

  const orderSeatsForStreet = (street) =>
    street === 'PREFLOP' ? preflopOrderSeats : postflopOrderSeats;

  const foldedSeats = useMemo(() => {
    const folded = new Set();
    hand.actions.forEach((a) => {
      if (FOLD_ACTIONS.has(a.actionType)) {
        const p = hand.players.find((pl) => pl.name === a.player);
        if (p) folded.add(p.seat);
      }
    });
    return folded;
  }, [hand.actions, hand.players]);

  const nextToActSeat = (street) => {
    const order = orderSeatsForStreet(street).filter((s) => !foldedSeats.has(s));
    if (order.length === 0) return null;

    const streetActions = hand.actions.filter((a) => a.street === street);
    if (streetActions.length === 0) return order[0];

    const last = streetActions[streetActions.length - 1];
    const lastSeat = hand.players.find((p) => p.name === last.player)?.seat;
    const idx = order.indexOf(lastSeat);
    if (idx === -1) return order[0];
    return order[(idx + 1) % order.length];
  };

  const positionForSeat = (seat) =>
    seatPositions.find((s) => s.seat === seat)?.position || '';

  const updateTableField = (field, value) => {
    setTableSetup((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'numPlayers') {
        if (prev.dealerSeat > value) next.dealerSeat = 1;
        if (prev.heroSeat > value) next.heroSeat = 1;
      }
      return next;
    });
  };

  const updateSeatStack = (seat, value) => {
    setTableSetup((prev) => ({
      ...prev,
      stacksBySeat: { ...prev.stacksBySeat, [seat]: value },
    }));
  };

  const proceedToActions = () => {
    const players = seatPositions.map(({ seat, position }) => {
      const existing = hand.players.find((p) => p.seat === seat);
      return {
        seat,
        name: existing?.name || `Seat ${seat}`,
        stack:
          existing?.stack ??
          (stacksBySeat[seat] !== undefined && stacksBySeat[seat] !== ''
            ? Number(stacksBySeat[seat])
            : bigBlind * 100),
        isDealer: position.startsWith('BTN'),
        isHero: seat === heroSeat,
        holeCards: existing?.holeCards || [],
        showedHand: existing?.showedHand || [],
        winnings: existing?.winnings || 0,
      };
    });

    const sbSeat = seatPositions.find((s) => s.position === 'SB' || s.position === 'BTN/SB');
    const bbSeat = seatPositions.find((s) => s.position === 'BB');

    const seededActions =
      hand.actions.length > 0
        ? hand.actions
        : withPotSizes(
            [
              sbSeat && {
                id: nextId(),
                street: 'PREFLOP',
                actionType: 'POST_SB',
                player: players.find((p) => p.seat === sbSeat.seat)?.name,
                amount: smallBlind,
              },
              bbSeat && {
                id: nextId(),
                street: 'PREFLOP',
                actionType: 'POST_BB',
                player: players.find((p) => p.seat === bbSeat.seat)?.name,
                amount: bigBlind,
              },
            ].filter(Boolean),
            ante,
            numPlayers
          );

    setHand((prev) => ({
      ...prev,
      players,
      actions: seededActions,
      stakes: `${smallBlind}/${bigBlind}${ante > 0 ? ` (${ante} ante)` : ''}`,
    }));
    setActiveStreet('PREFLOP');
    setStep(2);
  };

  const updatePlayerField = (seat, field, value) => {
    setHand((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.seat === seat ? { ...p, [field]: value } : p)),
    }));
  };

  const toggleWinner = (playerName) => {
    setHand((prev) => ({
      ...prev,
      winners: prev.winners.includes(playerName)
        ? prev.winners.filter((n) => n !== playerName)
        : [...prev.winners, playerName],
    }));
  };

  const setActions = (updater) => {
    setHand((prev) => {
      const raw = typeof updater === 'function' ? updater(prev.actions) : updater;
      return { ...prev, actions: withPotSizes(raw, ante, numPlayers) };
    });
  };

  const addAction = (street) => {
    const seat = nextToActSeat(street);
    const playerName =
      hand.players.find((p) => p.seat === seat)?.name || hand.players[0]?.name || '';

    setActions((prev) => [
      ...prev,
      { id: nextId(), street, actionType: 'FOLD', player: playerName, amount: 0 },
    ]);
  };

  // Preview the betting constraint a new action for `playerName` on `street`
  // would face right now: append a zero-amount dummy action and read the
  // meta computeBettingState derives for it before any amount is applied -
  // the same meta shape ActionRow's hints/warnings already use. Lets the
  // one-tap quick-action buttons pick correct Call/Min-raise/All-in amounts
  // without the user typing anything.
  const previewConstraint = (street, playerName) => {
    if (!playerName) return null;
    const dummy = { id: '__preview__', street, actionType: 'CHECK', player: playerName, amount: 0 };
    const meta = computeBettingState([...hand.actions, dummy], hand.players, bigBlind);
    return meta[meta.length - 1];
  };

  const addQuickAction = (street, actionType, amount) => {
    const seat = nextToActSeat(street);
    const playerName =
      hand.players.find((p) => p.seat === seat)?.name || hand.players[0]?.name || '';
    if (!playerName) return;

    const clampedAmount = AMOUNT_ACTIONS.has(actionType) ? Math.max(0, Number(amount) || 0) : 0;

    setActions((prev) => [
      ...prev,
      { id: nextId(), street, actionType, player: playerName, amount: clampedAmount },
    ]);
  };

  const updateAction = (id, field, value) => {
    setActions((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index === -1) return prev;

      const applied = prev.map((a) => (a.id === id ? { ...a, [field]: value } : a));
      const meta = computeBettingState(applied, hand.players, bigBlind);
      const constraint = meta[index];
      if (!constraint) return applied;

      return applied.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a };

        if (field === 'actionType') {
          if (!AMOUNT_ACTIONS.has(value)) {
            next.amount = 0;
          } else if (value === 'CALL') {
            next.amount = constraint.callAmount;
          } else if (value === 'BET' || value === 'RAISE') {
            next.amount = constraint.minRaiseAmount;
          }
        } else if (field === 'amount') {
          next.amount = Math.max(0, Math.min(Number(value) || 0, constraint.stackBefore));
        }

        return next;
      });
    });
  };

  const removeAction = (id) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const openCardSelector = (descriptor) => setCardSelector(descriptor);
  const closeCardSelector = () => setCardSelector(null);

  const usedCardsForSelector = useMemo(() => {
    if (!cardSelector) return new Set();
    return collectUsedCards(hand, cardSelector.current);
  }, [hand, cardSelector]);

  const handleCardSelect = (cardStr) => {
    if (!cardSelector) return;

    if (cardSelector.type === 'board') {
      const boardKey = BOARD_KEY_BY_STREET[cardSelector.street];
      setHand((prev) => ({
        ...prev,
        board: {
          ...prev.board,
          [boardKey]: setArrayIndex(prev.board[boardKey], cardSelector.index, cardStr),
        },
      }));
    } else if (cardSelector.type === 'hole') {
      setHand((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.seat === cardSelector.seat
            ? { ...p, holeCards: setArrayIndex(p.holeCards, cardSelector.index, cardStr) }
            : p
        ),
      }));
    } else if (cardSelector.type === 'showedHand') {
      setHand((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.seat === cardSelector.seat
            ? { ...p, showedHand: setArrayIndex(p.showedHand, cardSelector.index, cardStr) }
            : p
        ),
      }));
    }

    setCardSelector(null);
  };

  const handleCardRemove = (descriptor) => {
    if (descriptor.type === 'board') {
      const boardKey = BOARD_KEY_BY_STREET[descriptor.street];
      setHand((prev) => ({
        ...prev,
        board: {
          ...prev.board,
          [boardKey]: setArrayIndex(prev.board[boardKey], descriptor.index, null),
        },
      }));
    } else if (descriptor.type === 'hole') {
      setHand((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.seat === descriptor.seat
            ? { ...p, holeCards: setArrayIndex(p.holeCards, descriptor.index, null) }
            : p
        ),
      }));
    } else if (descriptor.type === 'showedHand') {
      setHand((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.seat === descriptor.seat
            ? { ...p, showedHand: setArrayIndex(p.showedHand, descriptor.index, null) }
            : p
        ),
      }));
    }
  };

  const hasRevealed = (playerName) =>
    hand.actions.some((a) => a.actionType === 'SHOW_HAND' && a.player === playerName);

  const toggleRevealHand = (seat) => {
    const player = hand.players.find((p) => p.seat === seat);
    if (!player) return;

    if (hasRevealed(player.name)) {
      setActions((prev) => prev.filter((a) => !(a.actionType === 'SHOW_HAND' && a.player === player.name)));
      updatePlayerField(seat, 'showedHand', []);
      return;
    }

    const holeCardCount = HOLE_CARD_COUNTS[hand.gameType] || 2;
    const existingHoleCards = compactCards(player.holeCards);
    const seededShowedHand = existingHoleCards.length === holeCardCount ? existingHoleCards : [];

    setActions((prev) => [
      ...prev,
      { id: nextId(), street: 'RIVER', actionType: 'SHOW_HAND', player: player.name, amount: 0 },
    ]);
    updatePlayerField(seat, 'showedHand', seededShowedHand);
  };

  useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;

    setPeopleLoading(true);
    getPeople()
      .then((data) => {
        if (!cancelled) setPeople(data);
      })
      .catch((err) => {
        console.error('Failed to fetch people:', err);
      })
      .finally(() => {
        if (!cancelled) setPeopleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step]);

  const createAndLinkPerson = async (seat, name, imageFile) => {
    try {
      let imageUrl = '';
      if (imageFile) imageUrl = await uploadImage(imageFile);

      const created = await createPerson({ name, image: imageUrl });
      setPeople((prev) => [...prev, created]);
      updatePlayerField(seat, 'personId', created._id);
      showStatus('success', `"${created.name}" created successfully`);
    } catch (err) {
      console.error('Error creating person:', err);
      showStatus('error', 'Failed to create person. Name might already exist.');
    }
  };

  const goToReview = () => setStep(3);

  // Accepts an optional {playerName: winnings} map so ReviewStep can pass a
  // freshly-computed pot split straight into the save payload instead of
  // round-tripping through setHand + a stale-closure re-render first.
  const saveHand = async (winningsByName = {}) => {
    if (!hand.winners.length) {
      showStatus('error', 'Select at least one winner before saving');
      return;
    }

    const finalPotSize = hand.actions.length
      ? hand.actions[hand.actions.length - 1].potSizeAfter
      : 0;

    const finalHand = {
      ...hand,
      finalPotSize,
      board: {
        flop: compactCards(hand.board.flop),
        turn: compactCards(hand.board.turn),
        river: compactCards(hand.board.river),
      },
      players: hand.players.map((p) => ({
        ...p,
        holeCards: compactCards(p.holeCards),
        winnings: winningsByName[p.name] ?? p.winnings ?? 0,
      })),
    };

    setIsSavingHand(true);
    try {
      const placeholderId = `new-${Date.now()}`;
      const result = await saveFavouriteHand(placeholderId, finalHand);
      const savedHand = Array.isArray(result.hands)
        ? result.hands[result.hands.length - 1]
        : finalHand;

      showStatus('success', 'Hand saved to favourites');
      if (onSubmit) onSubmit(savedHand);
      navigate(-1);
    } catch (err) {
      console.error('Error saving hand:', err);
      showStatus('error', 'Failed to save hand. Please try again.');
    } finally {
      setIsSavingHand(false);
    }
  };

  const actionsForStreet = hand.actions.filter((a) => a.street === activeStreet);
  const activeNextSeat = nextToActSeat(activeStreet);

  const bettingMetaById = useMemo(() => {
    const meta = computeBettingState(hand.actions, hand.players, bigBlind);
    const map = new Map();
    hand.actions.forEach((a, i) => map.set(a.id, meta[i]));
    return map;
  }, [hand.actions, hand.players, bigBlind]);

  const activeNextSeatConstraint = useMemo(() => {
    const playerName = hand.players.find((p) => p.seat === activeNextSeat)?.name;
    return previewConstraint(activeStreet, playerName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand.actions, hand.players, bigBlind, activeStreet, activeNextSeat]);

  return {
    navigate,
    step,
    setStep,
    tableSetup,
    hand,
    setHand,
    activeStreet,
    setActiveStreet,
    editingSeat,
    setEditingSeat,
    cardSelector,
    people,
    peopleLoading,
    statusMessage,
    isSavingHand,
    smallBlind,
    bigBlind,
    ante,
    numPlayers,
    dealerSeat,
    heroSeat,
    stacksBySeat,
    seatPositions,
    foldedSeats,
    nextToActSeat,
    positionForSeat,
    updateTableField,
    updateSeatStack,
    proceedToActions,
    updatePlayerField,
    toggleWinner,
    addAction,
    addQuickAction,
    updateAction,
    removeAction,
    openCardSelector,
    closeCardSelector,
    usedCardsForSelector,
    handleCardSelect,
    handleCardRemove,
    hasRevealed,
    toggleRevealHand,
    createAndLinkPerson,
    goToReview,
    saveHand,
    actionsForStreet,
    activeNextSeat,
    activeNextSeatConstraint,
    bettingMetaById,
  };
}
