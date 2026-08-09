import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HandCreator.css';
import CardSelector from '../../components/CardSelector';
import { API_URL } from '../../config';

const STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

const ACTION_TYPES = [
  'POST_SB',
  'POST_BB',
  'FOLD',
  'CHECK',
  'CALL',
  'BET',
  'RAISE',
  'SHOW_HAND',
  'MUCK',
];

const SELECTABLE_ACTION_TYPES = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'];

const AMOUNT_ACTIONS = new Set(['POST_SB', 'POST_BB', 'BET', 'RAISE', 'CALL']);

const FOLD_ACTIONS = new Set(['FOLD', 'MUCK']);

const POSITIONS_BY_COUNT = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
};

const ACTION_LABELS = {
  POST_SB: 'post sb',
  POST_BB: 'post bb',
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  SHOW_HAND: 'show hand',
  MUCK: 'muck',
};

const STREET_LABELS = {
  PREFLOP: 'Pre-Flop',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
};

const STREET_INDEX = { PREFLOP: 0, FLOP: 1, TURN: 2, RIVER: 3 };

const BOARD_KEY_BY_STREET = { FLOP: 'flop', TURN: 'turn', RIVER: 'river' };
const BOARD_SLOT_COUNTS = { FLOP: 3, TURN: 1, RIVER: 1 };

const HOLE_CARD_COUNTS = { NLH: 2, PLO: 4 };

const SUIT_META = {
  s: { label: '♠', color: 'black' },
  h: { label: '♥', color: 'red' },
  d: { label: '♦', color: 'red' },
  c: { label: '♣', color: 'black' },
};

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

function seatCoordinates(seat, totalSeats) {
  const angleDeg = -90 + (seat - 1) * (360 / totalSeats);
  const angleRad = (angleDeg * Math.PI) / 180;
  const rx = 44;
  const ry = 38;
  const x = 50 + rx * Math.cos(angleRad);
  const y = 50 + ry * Math.sin(angleRad);
  return { left: `${x}%`, top: `${y}%` };
}

function withPotSizes(actions, ante, numPlayers) {
  let pot = (ante || 0) * (numPlayers || 0);
  return actions.map((a) => {
    pot += Number(a.amount) || 0;
    return { ...a, potSizeAfter: pot };
  });
}

function computeBettingState(actions, players, bigBlind) {
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

function bettingHintText(action, constraint) {
  const parts = [`Stack: ${constraint.stackBefore}`];
  if (action.actionType === 'BET' || action.actionType === 'RAISE') {
    parts.push(`Min: ${constraint.minRaiseAmount}`);
  } else if (constraint.callAmount > 0) {
    parts.push(`To call: ${constraint.callAmount}`);
  }
  return parts.join(' · ');
}

function bettingWarning(action, constraint) {
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

function defaultTableSetup() {
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

function defaultHand() {
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

export default function HandCreator({ onSubmit }) {
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

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const [cardSelector, setCardSelector] = useState(null);

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
      {
        id: nextId(),
        street,
        actionType: 'FOLD',
        player: playerName,
        amount: 0,
      },
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
    fetch(`${API_URL}/api/people`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPeople(Array.isArray(data) ? data : []);
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

  const uploadImageToServer = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${API_URL}/api/upload-image`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload image');
    const result = await response.json();
    return result.imageUrl;
  };

  const createAndLinkPerson = async (seat, name, imageFile) => {
    try {
      let imageUrl = '';
      if (imageFile) imageUrl = await uploadImageToServer(imageFile);

      const response = await fetch(`${API_URL}/api/people`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image: imageUrl }),
      });
      if (!response.ok) throw new Error('Failed to create person');

      const created = await response.json();
      setPeople((prev) => [...prev, created]);
      updatePlayerField(seat, 'personId', created._id);
      showStatus('success', `"${created.name}" created successfully`);
    } catch (err) {
      console.error('Error creating person:', err);
      showStatus('error', 'Failed to create person. Name might already exist.');
    }
  };

  const goToReview = () => setStep(3);

  const saveHand = async () => {
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
      players: hand.players.map((p) => ({ ...p, holeCards: compactCards(p.holeCards) })),
    };

    setIsSavingHand(true);
    try {
      const placeholderId = `new-${Date.now()}`;
      const response = await fetch(`${API_URL}/api/favourites/${placeholderId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalHand),
      });
      if (!response.ok) throw new Error('Failed to save hand');

      const result = await response.json();
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

  return (
    <div className="hc-page">
      {step === 1 && (
        <TableDetailsStep
          tableSetup={tableSetup}
          seatPositions={seatPositions}
          updateTableField={updateTableField}
          updateSeatStack={updateSeatStack}
          onNext={proceedToActions}
          onExit={() => navigate(-1)}
        />
      )}

      {step === 2 && (
        <HandActionStep
          hand={hand}
          numPlayers={numPlayers}
          seatPositions={seatPositions}
          activeStreet={activeStreet}
          setActiveStreet={setActiveStreet}
          actionsForStreet={actionsForStreet}
          bettingMetaById={bettingMetaById}
          addAction={addAction}
          updateAction={updateAction}
          removeAction={removeAction}
          onBack={() => setStep(1)}
          onFinish={goToReview}
          editingSeat={editingSeat}
          setEditingSeat={setEditingSeat}
          updatePlayerField={updatePlayerField}
          foldedSeats={foldedSeats}
          activeNextSeat={activeNextSeat}
          openCardSelector={openCardSelector}
          onCardRemove={handleCardRemove}
        />
      )}

      {step === 3 && (
        <ReviewStep
          hand={hand}
          setHand={setHand}
          seatPositions={seatPositions}
          updatePlayerField={updatePlayerField}
          toggleWinner={toggleWinner}
          hasRevealed={hasRevealed}
          toggleRevealHand={toggleRevealHand}
          openCardSelector={openCardSelector}
          onCardRemove={handleCardRemove}
          people={people}
          peopleLoading={peopleLoading}
          statusMessage={statusMessage}
          onCreatePerson={createAndLinkPerson}
          onBack={() => setStep(2)}
          onSave={saveHand}
          isSaving={isSavingHand}
        />
      )}

      {cardSelector && (
        <CardSelector
          title={
            cardSelector.type === 'board'
              ? `Select ${STREET_LABELS[cardSelector.street]} card`
              : cardSelector.type === 'showedHand'
              ? 'Select revealed card'
              : 'Select hole card'
          }
          usedCards={usedCardsForSelector}
          onSelect={handleCardSelect}
          onClose={closeCardSelector}
        />
      )}
    </div>
  );
}

function TableDetailsStep({ tableSetup, seatPositions, updateTableField, updateSeatStack, onNext, onExit }) {
  const { smallBlind, bigBlind, ante, numPlayers, dealerSeat, heroSeat, stacksBySeat } = tableSetup;
  const seatOptions = Array.from({ length: numPlayers }, (_, i) => i + 1);

  return (
    <div className="hc-card">
      <h1 className="hc-title">Required Table Details</h1>

      <div className="hc-grid hc-grid-3">
        <Field label="Small Blind" required>
          <input
            type="number"
            min="0"
            value={smallBlind}
            onChange={(e) => updateTableField('smallBlind', Number(e.target.value))}
          />
        </Field>
        <Field label="Big Blind" required>
          <input
            type="number"
            min="0"
            value={bigBlind}
            onChange={(e) => updateTableField('bigBlind', Number(e.target.value))}
          />
        </Field>
        <Field label="Ante (optional)">
          <input
            type="number"
            min="0"
            value={ante}
            onChange={(e) => updateTableField('ante', Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="hc-grid hc-grid-2">
        <Field label="Players at the table" required>
          <select
            value={numPlayers}
            onChange={(e) => updateTableField('numPlayers', Number(e.target.value))}
          >
            {Object.keys(POSITIONS_BY_COUNT).map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dealer button position" required>
          <select
            value={dealerSeat}
            onChange={(e) => updateTableField('dealerSeat', Number(e.target.value))}
          >
            {seatOptions.map((seat) => (
              <option key={seat} value={seat}>
                Seat {seat} — BTN
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="hc-grid hc-grid-2">
        <Field label="Who is the hero?" required>
          <select
            value={heroSeat}
            onChange={(e) => updateTableField('heroSeat', Number(e.target.value))}
          >
            {seatOptions.map((seat) => (
              <option key={seat} value={seat}>
                Seat {seat}
                {seat === dealerSeat ? ' — BTN' : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <PokerTable
        numPlayers={numPlayers}
        seatPositions={seatPositions}
        centerLabel={`${smallBlind} / ${bigBlind}`}
      />

      <div className="hc-field-label" style={{ margin: '16px 0 8px' }}>
        Starting Stacks (optional)
      </div>
      <div className="hc-grid hc-grid-3">
        {seatPositions.map(({ seat, position }) => (
          <Field key={seat} label={`Seat ${seat} — ${position}`}>
            <input
              type="number"
              min="0"
              placeholder={`Defaults to ${bigBlind * 100}`}
              value={stacksBySeat[seat] ?? ''}
              onChange={(e) => updateSeatStack(seat, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <div className="hc-footer-note">
        {smallBlind}/{bigBlind} · {numPlayers}-handed · BTN seat {dealerSeat}
      </div>

      <div className="hc-actions-row">
        <button className="hc-btn hc-btn-ghost" type="button" onClick={onExit}>
          ‹ Back
        </button>
        <button className="hc-btn hc-btn-primary" type="button" onClick={onNext}>
          Next ›
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  hand,
  setHand,
  seatPositions,
  updatePlayerField,
  toggleWinner,
  hasRevealed,
  toggleRevealHand,
  openCardSelector,
  onCardRemove,
  people,
  peopleLoading,
  statusMessage,
  onCreatePerson,
  onBack,
  onSave,
  isSaving,
}) {
  const [creatingSeat, setCreatingSeat] = useState(null);

  const updateNotes = (value) => setHand((prev) => ({ ...prev, notes: value }));

  const dateValue = hand.datePlayed ? hand.datePlayed.slice(0, 10) : '';
  const updateDate = (value) => {
    if (!value) return;
    setHand((prev) => ({ ...prev, datePlayed: new Date(value).toISOString() }));
  };

  const handleLinkChange = (seat, value) => {
    if (value === '__create__') {
      setCreatingSeat(seat);
      return;
    }
    updatePlayerField(seat, 'personId', value || null);
  };

  return (
    <div className="hc-card">
      <h1 className="hc-title">Review &amp; Finalize</h1>

      {statusMessage && (
        <div
          className={`hc-status-message ${
            statusMessage.type === 'success' ? 'hc-status-success' : 'hc-status-error'
          }`}
        >
          {statusMessage.type === 'success' ? '✓ ' : '✕ '}
          {statusMessage.text}
        </div>
      )}

      <div className="hc-grid">
        <Field label="Date played">
          <input type="date" value={dateValue} onChange={(e) => updateDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          rows={3}
          value={hand.notes}
          placeholder="Anything worth remembering about this hand..."
          onChange={(e) => updateNotes(e.target.value)}
        />
      </Field>

      <div className="hc-field-label hc-section-label">Players</div>

      <div className="hc-review-players">
        {hand.players.map((player) => {
          const position = seatPositions.find((s) => s.seat === player.seat)?.position;
          const linkedPerson = people.find((pn) => pn._id === player.personId);
          const revealed = hasRevealed(player.name);
          const holeCardCount = HOLE_CARD_COUNTS[hand.gameType] || 2;

          return (
            <div className="hc-review-player-row" key={player.seat}>
              <div className="hc-review-player-main">
                <span className="hc-review-seat-label">
                  Seat {player.seat} · {position}
                </span>

                <input
                  className="hc-review-name-input"
                  value={player.name}
                  onChange={(e) => updatePlayerField(player.seat, 'name', e.target.value)}
                />

                {creatingSeat === player.seat ? (
                  <InlineCreatePerson
                    seat={player.seat}
                    defaultName={player.name}
                    onCancel={() => setCreatingSeat(null)}
                    onCreate={async (name, imageFile) => {
                      await onCreatePerson(player.seat, name, imageFile);
                      setCreatingSeat(null);
                    }}
                  />
                ) : (
                  <select
                    className="hc-review-link-select"
                    value={player.personId || ''}
                    onChange={(e) => handleLinkChange(player.seat, e.target.value)}
                    disabled={peopleLoading}
                  >
                    <option value="">— not linked —</option>
                    {people.map((pn) => (
                      <option key={pn._id} value={pn._id}>
                        {pn.name}
                      </option>
                    ))}
                    <option value="__create__">+ Add "{player.name}" as a new player…</option>
                  </select>
                )}

                {linkedPerson && <span className="hc-review-linked-badge">✓ Linked</span>}
              </div>

              <div className="hc-review-reveal-row">
                <label className="hc-checkbox-label">
                  <input
                    type="checkbox"
                    checked={revealed}
                    onChange={() => toggleRevealHand(player.seat)}
                  />
                  Revealed hand at showdown
                </label>

                {revealed && (
                  <div className="hc-review-cards">
                    {Array.from({ length: holeCardCount }).map((_, i) => (
                      <CardSlot
                        key={i}
                        card={player.showedHand?.[i]}
                        onClick={() =>
                          openCardSelector({
                            type: 'showedHand',
                            seat: player.seat,
                            index: i,
                            current: player.showedHand?.[i],
                          })
                        }
                        onRemove={
                          player.showedHand?.[i]
                            ? () => onCardRemove({ type: 'showedHand', seat: player.seat, index: i })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hc-field-label hc-section-label">
        Winner(s) <span className="hc-required">*</span>
      </div>
      <div className="hc-review-winners">
        {hand.players.map((player) => (
          <label className="hc-winner-chip" key={player.seat}>
            <input
              type="checkbox"
              checked={hand.winners.includes(player.name)}
              onChange={() => toggleWinner(player.name)}
            />
            {player.name}
          </label>
        ))}
      </div>
      {hand.winners.length === 0 && (
        <div className="hc-warning-text">
          Select at least one winner (more than one for a split pot).
        </div>
      )}

      <div className="hc-actions-row">
        <button className="hc-btn hc-btn-ghost" type="button" onClick={onBack} disabled={isSaving}>
          ‹ Back
        </button>
        <button
          className="hc-btn hc-btn-primary"
          type="button"
          onClick={onSave}
          disabled={isSaving || hand.winners.length === 0}
        >
          {isSaving ? 'Saving…' : 'Create Hand'}
        </button>
      </div>
    </div>
  );
}

function InlineCreatePerson({ seat, defaultName, onCancel, onCreate }) {
  const [name, setName] = useState(defaultName || '');
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      // eslint-disable-next-line no-alert
      alert('Image size should be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      // eslint-disable-next-line no-alert
      alert('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setSelectedFile(file);
  };

  const submit = async () => {
    if (!name.trim() || isUploading) return;
    setIsUploading(true);
    await onCreate(name.trim(), selectedFile);
    setIsUploading(false);
  };

  return (
    <div className="new-person-form">
      <label className="modal-label">Name:</label>
      <input
        type="text"
        className="modal-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter person's name"
      />

      <label className="modal-label">Profile Image:</label>
      <div className="image-upload-section">
        <input
          type="file"
          id={`hc-image-upload-${seat}`}
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="upload-image-btn"
          onClick={() => document.getElementById(`hc-image-upload-${seat}`).click()}
          disabled={isUploading}
        >
          📷 Choose Image
        </button>
        {imagePreview && (
          <div className="image-preview">
            <img
              src={imagePreview}
              alt="Preview"
              style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }}
            />
            <button
              type="button"
              className="remove-image-btn"
              onClick={() => { setImagePreview(null); setSelectedFile(null); }}
              style={{ marginLeft: '10px' }}
              disabled={isUploading}
            >
              ✕ Remove
            </button>
          </div>
        )}
      </div>

      <div className="new-person-actions">
        <button type="button" onClick={onCancel} disabled={isUploading}>
          Cancel
        </button>
        <button type="button" className="save-btn" onClick={submit} disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Create'}
        </button>
      </div>
    </div>
  );
}

function HandActionStep({
  hand,
  numPlayers,
  seatPositions,
  activeStreet,
  setActiveStreet,
  actionsForStreet,
  bettingMetaById,
  addAction,
  updateAction,
  removeAction,
  onBack,
  onFinish,
  editingSeat,
  setEditingSeat,
  updatePlayerField,
  foldedSeats,
  activeNextSeat,
  openCardSelector,
  onCardRemove,
}) {
  const nextToActName = hand.players.find((p) => p.seat === activeNextSeat)?.name;

  return (
    <div className="hc-card">
      <h1 className="hc-title">Hand Action</h1>

      <PokerTable
        numPlayers={numPlayers}
        seatPositions={seatPositions}
        centerLabel={hand.stakes}
        players={hand.players}
        activeSeat={seatPositions.find((s) => s.position.startsWith('BTN'))?.seat}
        onSeatClick={(seat) => setEditingSeat(seat === editingSeat ? null : seat)}
        editingSeat={editingSeat}
        updatePlayerField={updatePlayerField}
        foldedSeats={foldedSeats}
        nextToActSeat={activeNextSeat}
        gameType={hand.gameType}
        openCardSelector={openCardSelector}
        onCardRemove={onCardRemove}
      />

      <HeroCards
        hero={hand.players.find((p) => p.isHero)}
        gameType={hand.gameType}
        openCardSelector={openCardSelector}
        onCardRemove={onCardRemove}
      />

      <div className="hc-tabs">
        {STREETS.map((street) => (
          <button
            key={street}
            type="button"
            className={`hc-tab ${activeStreet === street ? 'hc-tab-active' : ''}`}
            onClick={() => setActiveStreet(street)}
          >
            {STREET_LABELS[street].toUpperCase()}
          </button>
        ))}
      </div>

      <BoardCards
        board={hand.board}
        activeStreet={activeStreet}
        openCardSelector={openCardSelector}
        onCardRemove={onCardRemove}
      />

      {nextToActName && (
        <div className="hc-turn-indicator">
          Next to act: <strong>{nextToActName}</strong>
        </div>
      )}

      <div className="hc-actions-list">
        {actionsForStreet.map((action) => {
          const constraint = bettingMetaById.get(action.id);
          const warning = constraint ? bettingWarning(action, constraint) : null;

          return (
            <div className="hc-action-row-wrapper" key={action.id}>
              <div className="hc-action-row">
                <div className="hc-action-player">
                  {positionLabel(seatPositions, hand.players.find((p) => p.name === action.player)?.seat)}
                  {' · '}
                  {action.player}
                  {foldedSeats.has(hand.players.find((p) => p.name === action.player)?.seat)
                    ? ' (folded)'
                    : ''}
                </div>

                <select
                  value={action.actionType}
                  onChange={(e) => updateAction(action.id, 'actionType', e.target.value)}
                >
                  {(SELECTABLE_ACTION_TYPES.includes(action.actionType)
                    ? SELECTABLE_ACTION_TYPES
                    : [action.actionType, ...SELECTABLE_ACTION_TYPES]
                  ).map((type) => (
                    <option key={type} value={type}>
                      {ACTION_LABELS[type]}
                    </option>
                  ))}
                </select>

                {AMOUNT_ACTIONS.has(action.actionType) ? (
                  <input
                    type="number"
                    min="0"
                    max={constraint ? constraint.stackBefore : undefined}
                    value={action.amount}
                    onChange={(e) => updateAction(action.id, 'amount', Number(e.target.value))}
                  />
                ) : (
                  <div className="hc-amount-dash">—</div>
                )}

                <button
                  type="button"
                  className="hc-icon-btn hc-icon-btn-danger"
                  onClick={() => removeAction(action.id)}
                  aria-label="Delete action"
                >
                  🗑
                </button>
              </div>

              {constraint && (
                <div className={`hc-action-hint ${warning ? 'hc-action-hint-warning' : ''}`}>
                  {warning || bettingHintText(action, constraint)}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="hc-btn hc-btn-add"
          onClick={() => addAction(activeStreet)}
        >
          + Add action
        </button>
      </div>

      <div className="hc-actions-row">
        <button className="hc-btn hc-btn-ghost" type="button" onClick={onBack}>
          ‹ Back
        </button>
        {activeStreet === 'RIVER' ? (
          <button className="hc-btn hc-btn-primary" type="button" onClick={onFinish}>
            Review &amp; Create Hand ›
          </button>
        ) : (
          <button
            className="hc-btn hc-btn-primary"
            type="button"
            onClick={() => setActiveStreet(STREETS[STREETS.indexOf(activeStreet) + 1])}
          >
            Next street ›
          </button>
        )}
      </div>
    </div>
  );
}

function positionLabel(seatPositions, seat) {
  return seatPositions.find((s) => s.seat === seat)?.position || '';
}

function HeroCards({ hero, gameType, openCardSelector, onCardRemove }) {
  if (!hero) return null;

  const count = HOLE_CARD_COUNTS[gameType] || 2;

  return (
    <div className="hc-hero-row" style={{ margin: '12px 0' }}>
      <div className="hc-field-label" style={{ marginBottom: 6 }}>
        Hero's Hand — {hero.name}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: count }).map((_, i) => (
          <CardSlot
            key={i}
            card={hero.holeCards?.[i]}
            onClick={() =>
              openCardSelector({
                type: 'hole',
                seat: hero.seat,
                index: i,
                current: hero.holeCards?.[i],
              })
            }
            onRemove={
              hero.holeCards?.[i]
                ? () => onCardRemove({ type: 'hole', seat: hero.seat, index: i })
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function BoardCards({ board, activeStreet, openCardSelector, onCardRemove }) {
  if (activeStreet === 'PREFLOP') return null;

  const activeIndex = STREET_INDEX[activeStreet];

  const groups = [
    { street: 'FLOP', key: 'flop', count: BOARD_SLOT_COUNTS.FLOP },
    { street: 'TURN', key: 'turn', count: BOARD_SLOT_COUNTS.TURN },
    { street: 'RIVER', key: 'river', count: BOARD_SLOT_COUNTS.RIVER },
  ].filter((g) => activeIndex >= STREET_INDEX[g.street]);

  return (
    <div className="hc-board-row" style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
      {groups.map((g) => (
        <div
          className="hc-board-group"
          key={g.key}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
        >
          {Array.from({ length: g.count }).map((_, i) => (
            <CardSlot
              key={i}
              card={board[g.key][i]}
              onClick={() =>
                openCardSelector({
                  type: 'board',
                  street: g.street,
                  index: i,
                  current: board[g.key][i],
                })
              }
              onRemove={
                board[g.key][i]
                  ? () => onCardRemove({ type: 'board', street: g.street, index: i })
                  : undefined
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const slotBaseStyle = {
  width: 38,
  height: 54,
  borderRadius: 6,
  border: '1px solid #999',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  position: 'relative',
  background: '#fff',
  userSelect: 'none',
};

function CardSlot({ card, onClick, onRemove }) {
  if (!card) {
    return (
      <button
        type="button"
        className="hc-card-slot hc-card-slot-empty"
        style={{
          ...slotBaseStyle,
          background: '#cfd2d6',
          color: '#7a7f87',
          border: '1px dashed #9aa0a8',
        }}
        onClick={onClick}
        aria-label="Add card"
      >
        +
      </button>
    );
  }

  const rank = card[0];
  const suit = SUIT_META[card[1]];

  return (
    <div
      className={`hc-card-slot hc-card-slot-filled hc-card-${suit?.color || 'black'}`}
      style={{ ...slotBaseStyle, color: suit?.color === 'red' ? '#d33' : '#111' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <span>{rank}</span>
      <span>{suit?.label}</span>
      {onRemove && (
        <button
          type="button"
          className="hc-card-remove"
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: 'none',
            background: '#333',
            color: '#fff',
            fontSize: 11,
            lineHeight: '16px',
            padding: 0,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove card"
        >
          ×
        </button>
      )}
    </div>
  );
}

function PokerTable({
  numPlayers,
  seatPositions,
  centerLabel,
  players,
  onSeatClick,
  editingSeat,
  updatePlayerField,
  foldedSeats,
  nextToActSeat,
  gameType,
  openCardSelector,
  onCardRemove,
}) {
  const holeCardCount = HOLE_CARD_COUNTS[gameType] || 2;

  return (
    <div className="hc-table-wrap">
      <div className="hc-oval">
        <div className="hc-oval-center">{centerLabel}</div>
      </div>

      {seatPositions.map(({ seat, position }) => {
        const coords = seatCoordinates(seat, numPlayers);
        const player = players?.find((p) => p.seat === seat);
        const isDealer = position.startsWith('BTN');
        const isEditing = editingSeat === seat;
        const isFolded = foldedSeats?.has(seat);
        const isNextToAct = nextToActSeat === seat;

        const seatStyle = {
          ...coords,
          opacity: isFolded ? 0.4 : 1,
          outline: isNextToAct ? '3px solid #4ade80' : undefined,
          outlineOffset: isNextToAct ? '2px' : undefined,
        };

        return (
          <div
            className={`hc-seat ${isDealer ? 'hc-seat-dealer' : ''} ${
              isFolded ? 'hc-seat-folded' : ''
            } ${isNextToAct ? 'hc-seat-next' : ''}`}
            key={seat}
            style={seatStyle}
            onClick={() => onSeatClick && onSeatClick(seat)}
            role={onSeatClick ? 'button' : undefined}
            tabIndex={onSeatClick ? 0 : undefined}
          >
            <div className="hc-seat-pos">{position}</div>
            <div className="hc-seat-name">{player ? player.name : `Seat ${seat}`}</div>
            {isDealer && <div className="hc-seat-dealer-badge">Dealer</div>}
            {isFolded && <div className="hc-seat-folded-badge">Folded</div>}

            {isEditing && player && (
              <div className="hc-seat-popover" onClick={(e) => e.stopPropagation()}>
                <label>
                  Name
                  <input
                    value={player.name}
                    onChange={(e) => updatePlayerField(seat, 'name', e.target.value)}
                  />
                </label>
                <label>
                  Stack
                  <input
                    type="number"
                    min="0"
                    value={player.stack}
                    onChange={(e) =>
                      updatePlayerField(seat, 'stack', Number(e.target.value))
                    }
                  />
                </label>
                {player.isHero && <div className="hc-hero-badge">★ Hero</div>}

                {openCardSelector && (
                  <div className="hc-holecards-row" style={{ marginTop: 8 }}>
                    <span className="hc-field-label">Hole Cards</span>
                    <div
                      className="hc-holecards-slots"
                      style={{ display: 'flex', gap: 6, marginTop: 4 }}
                    >
                      {Array.from({ length: holeCardCount }).map((_, i) => (
                        <CardSlot
                          key={i}
                          card={player.holeCards?.[i]}
                          onClick={() =>
                            openCardSelector({
                              type: 'hole',
                              seat,
                              index: i,
                              current: player.holeCards?.[i],
                            })
                          }
                          onRemove={
                            player.holeCards?.[i]
                              ? () => onCardRemove({ type: 'hole', seat, index: i })
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="hc-field">
      <span className="hc-field-label">
        {label} {required && <span className="hc-required">*</span>}
      </span>
      {children}
    </label>
  );
}