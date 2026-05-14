import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./HandReplayer.css";

import PokerTable from "./PokerTable";
import PlayerSeat from "./PlayerSeat";
import Controller from "../../components/controller";

import { API_URL } from "../../config";
import { getSeatStyle, reorderPlayersForDisplay } from "../../utils/getSeatStyle";

// ── Public viewer ─────────────────────────────────────────
export function PublicHandViewer() {
  const [hand, setHand] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("hand");
    if (!id) { setStatus("notfound"); return; }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/share/${id}`);
        if (res.status === 404) { setStatus("notfound"); return; }
        if (!res.ok) throw new Error("Server error");
        const { hand } = await res.json();
        setHand(hand);
        setStatus("found");
      } catch {
        setStatus("notfound");
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="hand-replayer public-loading">
        <div className="public-status">Loading hand…</div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="hand-replayer public-loading">
        <div className="public-status public-status--error">
          <span className="public-status-icon">🃏</span>
          <span>This hand replay is no longer available or the link is invalid.</span>
        </div>
      </div>
    );
  }

  return <HandReplayerCore hand={hand} session={null} isPublic={true} />;
}

// ── Private authenticated view ────────────────────────────
export function HandReplayer() {
  const { state } = useLocation();
  const navigate = useNavigate();
  return (
    <HandReplayerCore
      hand={state?.hand}
      session={state?.session}
      isPublic={false}
      navigate={navigate}
    />
  );
}

// ── Share Modal ───────────────────────────────────────────
function ShareModal({ hand, session, onClose }) {
  const [shareId, setShareId] = useState(null);
  const [isShared, setIsShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const overlayRef = useRef(null);

  // Check localStorage cache on mount
  useEffect(() => {
    if (!hand?._id) return;
    const saved = localStorage.getItem(`share:${hand._id}`);
    if (saved) { setShareId(saved); setIsShared(true); }
  }, [hand?._id]);

  const shareUrl = shareId ? `${window.location.origin}/hand-replay?hand=${shareId}` : null;

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hand, userId: session?.userId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { shareId: id } = await res.json();
      localStorage.setItem(`share:${hand._id}`, id);
      setShareId(id);
      setIsShared(true);
    } catch (e) {
      console.error("Failed to share hand:", e);
      alert("Failed to create share link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareId || revokeLoading) return;
    setRevokeLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/share/${shareId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: session?.userId }),
      });
      if (!res.ok) throw new Error(await res.text());
      localStorage.removeItem(`share:${hand._id}`);
      setShareId(null);
      setIsShared(false);
      setCopied(false);
    } catch (e) {
      console.error("Failed to revoke share:", e);
      alert("Failed to revoke share link. Please try again.");
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="share-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="share-modal">
        <div className="share-modal-header">
          <h3 className="share-modal-title">Share Hand Replay</h3>
          <button className="share-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="share-modal-body">
          {!isShared ? (
            <>
              <p className="share-modal-desc">
                Anyone with the link will be able to view this hand replay without logging in.
              </p>
              <button
                className="share-modal-enable-btn"
                onClick={handleShare}
                disabled={loading}
              >
                {loading ? "Creating link…" : "🔗 Create share link"}
              </button>
            </>
          ) : (
            <>
              <div className="share-modal-status">
                <span className="share-modal-status-dot" />
                <span className="share-modal-status-text">Anyone with the link can view</span>
              </div>

              <div className="share-modal-link-row">
                <a
                  className="share-modal-url"
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shareUrl}
                </a>
                <button className="share-modal-copy-btn" onClick={handleCopy}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>

              <button
                className="share-modal-revoke-btn"
                onClick={handleRevoke}
                disabled={revokeLoading}
              >
                {revokeLoading ? "Revoking…" : "Remove access"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared core ───────────────────────────────────────────
function HandReplayerCore({ hand, session, isPublic, navigate }) {
  const [actionIndex, setActionIndex] = useState(0);
  const [historyCollapse, setHistoryCollapse] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  // Track whether this specific hand is shared (for button label)
  // Re-read from localStorage whenever hand changes
  const [isHandShared, setIsHandShared] = useState(false);
  useEffect(() => {
    if (!hand?._id) return;
    setIsHandShared(Boolean(localStorage.getItem(`share:${hand._id}`)));
    setShowShareModal(false);
    setActionIndex(0);
  }, [hand?._id]);

  const actions = hand?.actions || [];

  const actionsWithReveals = useMemo(() => {
    const augmented = [];
    let lastStreet = "PREFLOP";
    actions.forEach((action) => {
      if (action.street && action.street !== lastStreet) {
        augmented.push({ actionType: "reveal", street: action.street, revealStreet: action.street });
        lastStreet = action.street;
      }
      augmented.push(action);
    });
    return augmented;
  }, [actions]);

  const initialIndex = useMemo(() => {
    const idx = actionsWithReveals.findIndex(
      (a) => a.actionType !== "POST_SB" && a.actionType !== "POST_BB"
    );
    return idx === -1 ? 0 : idx;
  }, [actionsWithReveals]);

  const derivedState = useMemo(() => {
    const players = JSON.parse(JSON.stringify(hand.players));
    let currentBoard = [], currentSecondBoard = [];
    let firstRunoutComplete = false, showSecondBoard = false;
    let bets = {}, folded = {}, shownPlayerHand = [];
    let maxBet = 0, checked = [];
    let pot = 0, currentStreetBets = 0;

    actionsWithReveals.slice(0, actionIndex).forEach((action) => {
      if (action.actionType === "reveal") {
        pot += currentStreetBets;
        currentStreetBets = 0; bets = {}; checked = []; maxBet = 0;
        const s = action.revealStreet;
        if (s === "FLOP") currentBoard = [...(hand.board.flop || [])];
        else if (s === "TURN") currentBoard = [...(hand.board.turn || [])];
        else if (s === "RIVER") { currentBoard = [...(hand.board.river || [])]; firstRunoutComplete = true; }
        return;
      }
      if (!action.player) return;
      const amount = Number(action.amount) || 0;
      const player = players.find((p) => p.name === action.player);
      if (!player) return;
      const previousBet = bets[action.player] || 0;

      if (action.actionType === "POST_SB" || action.actionType === "POST_BB") {
        bets[action.player] = amount; maxBet = Math.max(maxBet, amount);
        player.stack -= amount; currentStreetBets += amount; return;
      }
      if (action.actionType === "BET" || action.actionType === "RAISE") {
        const add = amount - previousBet;
        bets[action.player] = amount; maxBet = amount;
        player.stack -= add; currentStreetBets += add;
        const ci = checked.indexOf(action.player); if (ci > -1) checked.splice(ci, 1); return;
      }
      if (action.actionType === "CHECK") { checked.push(action.player); return; }
      if (action.actionType === "CALL") {
        const add = amount - previousBet;
        bets[action.player] = amount; maxBet = Math.max(maxBet, amount);
        player.stack -= add; currentStreetBets += add;
        const ci = checked.indexOf(action.player); if (ci > -1) checked.splice(ci, 1); return;
      }
      if (action.actionType === "FOLD") { folded[action.player] = true; return; }
      if (action.actionType === "SHOW_HAND") { shownPlayerHand.push(action.player); bets = {}; return; }
    });

    if (actionIndex >= actionsWithReveals.length && hand.board) {
      if (hand.board.river?.length > 0) { currentBoard = [...hand.board.river]; firstRunoutComplete = true; }
      else if (hand.board.turn?.length > 0) currentBoard = [...hand.board.turn];
      else if (hand.board.flop?.length > 0) currentBoard = [...hand.board.flop];
    }

    if (currentBoard.length === 5) firstRunoutComplete = true;

    if (firstRunoutComplete && hand.isRunTwice && hand.secondBoard) {
      showSecondBoard = true;
      const { flop = [], turn = [], river = [] } = hand.secondBoard;
      if (river.length > 0) currentSecondBoard = [...river];
      else if (turn.length > 0) currentSecondBoard = [...turn];
      else if (flop.length > 0) currentSecondBoard = [...flop];
    }

    return { players, currentBoard, currentBetAmount: bets, maxBet, folded, shownPlayerHand, pot: pot + currentStreetBets, checked, showSecondBoard, currentSecondBoard };
  }, [actionIndex, actionsWithReveals, hand]);

  const allBlinds = actionsWithReveals
    .filter((a) => a.actionType === "POST_SB" || a.actionType === "POST_BB")
    .map((a) => a.amount);
  const bigBlind = Math.max(...allBlinds, 0);

  const displayedPlayers = reorderPlayersForDisplay(derivedState.players);

  const seatNodes = displayedPlayers.map((player, index) => (
    <PlayerSeat
      key={player.name}
      player={player}
      style={getSeatStyle(index, displayedPlayers.length)}
      betAmount={derivedState.currentBetAmount[player.name] || 0}
      isFolded={derivedState.folded[player.name] === true}
      winners={actionIndex === actionsWithReveals.length ? hand?.winners : null}
      isChecked={derivedState.checked.includes(player.name)}
      shownPlayerHand={
        derivedState.shownPlayerHand.includes(player.name) ? player.showedHand : null
      }
      isPublic={isPublic}
    />
  ));

  return (
    <div className="hand-replayer">
      <div className="controller-wrapper">
        <Controller
          onNext={() => setActionIndex(Math.min(actionIndex + 1, actionsWithReveals.length))}
          onPrev={() => setActionIndex(Math.max(actionIndex - 1, initialIndex))}
          actionIndex={actionIndex}
          totalActions={actionsWithReveals.length}
          initialIndex={initialIndex}
        />
      </div>

      {/* Share button — private mode only */}
      {!isPublic && (
        <button
          className={`share-button ${isHandShared ? "share-button--shared" : ""}`}
          onClick={() => setShowShareModal(true)}
          title="Share this hand replay"
        >
          {isHandShared ? "✓ Shared" : "🔗 Share"}
        </button>
      )}

      {/* Share modal */}
      {showShareModal && !isPublic && (
        <ShareModal
          hand={hand}
          session={session}
          onClose={() => {
            setShowShareModal(false);
            // Refresh shared state after modal closes in case it changed
            setIsHandShared(Boolean(localStorage.getItem(`share:${hand._id}`)));
          }}
        />
      )}

      {/* Public badge */}
      {isPublic && (
        <div className="public-badge">👁 Public replay</div>
      )}

      {/* Menu button — private only */}
      {!isPublic && (
        <button className="history-button" onClick={() => setHistoryCollapse(c => !c)}>
          Menu
        </button>
      )}

      {!isPublic && (
        <div className={!historyCollapse ? "history" : "nothing"}>
          {session?.hands ? (
            <ul className="hands-list">
              {session.hands.map((h, i) => {
                const hero = h.players.find((p) => p.isHero);
                const isActive = h._id === hand?._id;
                return (
                  <li
                    key={i}
                    className={`hand-item ${isActive ? "active-hand" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/hand-replay', { state: { hand: h, session } });
                    }}
                  >
                    <div className="hand-item-left">
                      <span className="hand-round-number">#{h.handIndex || i + 1}</span>
                      <div className="menu-hole-cards">
                        {hero && hero.holeCards?.length > 0 ? (
                          hero.holeCards.map((card, ci) => (
                            <div key={ci} className="menu-card-wrapper">
                              <img src={`/images/cards/${card}.png`} alt={card} className="menu-card-img" />
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>—</span>
                        )}
                      </div>
                    </div>
                    <div className="hand-item-right">
                      <div className="hand-item-winner">
                        <span className="winner-label">Winner</span>
                        <span className="winner-name">{h.winners?.join(", ") || "—"}</span>
                      </div>
                      <div className="hand-item-pot">
                        <span className="pot-label">Pot</span>
                        <span className="pot-value">{h.finalPotSize}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', padding: '20px', fontSize: 13 }}>No session data available</p>
          )}
        </div>
      )}

      <div className="table-container">
        <PokerTable
          board={derivedState.currentBoard}
          pot={derivedState.pot}
          bigBlind={bigBlind}
          winners={actionIndex === actionsWithReveals.length ? hand?.winners : null}
          secondBoard={derivedState.showSecondBoard ? derivedState.currentSecondBoard : null}
          seats={seatNodes}
        />
      </div>
    </div>
  );
}