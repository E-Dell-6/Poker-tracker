import { Layout } from "../../components/Layout";
import { useState, useEffect } from "react";
import { Play, Square, X, TrendingUp, TrendingDown, Trash2, Plus } from "lucide-react";
import "./Clock.css";

const normalizeSession = (s) => ({
  ...s,
  id: s._id ?? s.id,
  date: new Date(s.clockInTime),
  clockInTime: new Date(s.clockInTime),
  clockOutTime: new Date(s.clockOutTime),
  profit: s.totalProfit ?? s.profit
});

export function Clock() {
  const [isClocked, setIsClocked] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showBuyInForm, setShowBuyInForm] = useState(false);
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [clockInTime, setClockInTime] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await fetch("/api/live-sessions", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load sessions");
        const data = await res.json();
        setCompletedSessions(data.map(normalizeSession));
      } catch (err) {
        console.error(err);
      }
    };

    const restoreActiveSession = async () => {
      try {
        const res = await fetch("/api/live-sessions/active", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to check active session");
        const active = await res.json();
        if (active) {
          setSessionId(active._id ?? active.id);
          setIsClocked(true);
          setClockInTime(new Date(active.clockInTime));
          setSessionBlinds({
            bigBlind: String(active.bigBlind),
            smallBlind: String(active.smallBlind)
          });
          setActiveBuyIns(active.buyIns ?? []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsRestoring(false);
      }
    };

    loadSessions();
    restoreActiveSession();
  }, []);

  useEffect(() => {
    if (contextMenu === null) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [contextMenu]);

  const [sessionBlinds, setSessionBlinds] = useState({ bigBlind: "", smallBlind: "" });
  const [activeBuyIns, setActiveBuyIns] = useState([]);

  const [formData, setFormData] = useState({
    bigBlind: "",
    smallBlind: "",
    buyIn: "",
    cashOut: ""
  });

  const totalActiveBuyIn = activeBuyIns.reduce((sum, b) => sum + b, 0);

  const handleClockIn = () => {
    setClockInTime(new Date());
    setShowSessionForm(true);
  };

  const handleClockOutClick = () => {
    setShowClockOutForm(true);
  };

  const handleConfirmClockOut = async () => {
    const cashOut = parseFloat(formData.cashOut);
    if (isNaN(cashOut) || !sessionId) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/live-sessions/${sessionId}/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cashOut })
      });

      if (!res.ok) throw new Error("Failed to save session");

      const savedSession = await res.json();
      setCompletedSessions([normalizeSession(savedSession), ...completedSessions]);

      setIsClocked(false);
      setClockInTime(null);
      setSessionId(null);
      setSessionBlinds({ bigBlind: "", smallBlind: "" });
      setActiveBuyIns([]);
      setShowClockOutForm(false);
      setShowSessionForm(false);
      setShowBuyInForm(false);
      setFormData({ bigBlind: "", smallBlind: "", buyIn: "", cashOut: "" });
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't save this session. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSession = async () => {
    if (!(formData.bigBlind && formData.smallBlind && formData.buyIn)) return;

    const buyIn = parseFloat(formData.buyIn);
    if (isNaN(buyIn)) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/live-sessions/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clockInTime: clockInTime ?? new Date(),
          bigBlind: parseFloat(formData.bigBlind),
          smallBlind: parseFloat(formData.smallBlind),
          buyIns: [buyIn],
          totalBuyIn: buyIn
        })
      });

      if (!res.ok) throw new Error("Failed to start session");

      const session = await res.json();
      setSessionId(session._id ?? session.id);
      setIsClocked(true);
      setClockInTime(new Date(session.clockInTime));
      setSessionBlinds({
        bigBlind: formData.bigBlind,
        smallBlind: formData.smallBlind
      });
      setActiveBuyIns([buyIn]);
      setShowSessionForm(false);
      setFormData({ bigBlind: "", smallBlind: "", buyIn: "", cashOut: "" });
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't start the session. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBuyIn = async () => {
    const amount = parseFloat(formData.buyIn);
    if (isNaN(amount) || amount <= 0 || !sessionId) return;

    setSaveError(null);

    try {
      const res = await fetch(`/api/live-sessions/${sessionId}/buy-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount })
      });

      if (!res.ok) throw new Error("Failed to add buy-in");

      setActiveBuyIns([...activeBuyIns, amount]);
      setShowBuyInForm(false);
      setFormData({ ...formData, buyIn: "" });
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't add that buy-in. Please try again.");
    }
  };

  const handleSessionContextMenu = (e, id) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, id });
  };

  const handleDeleteClick = async (id) => {
    setContextMenu(null);

    const confirmed = window.confirm("Delete this session? This can't be undone.");
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/live-sessions/${id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to delete session");

      setCompletedSessions(completedSessions.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("Couldn't delete this session. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatDuration = (start, end) => {
    const diff = Math.floor((end - start) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);
  };

  return (
    <Layout title="Session Tracker" subtitle="Track your poker sessions with precision">
      <div className="clock-page">
        <div className="clock-container">
          {/* Main Clock Card */}
          <div className="clock-card">
            <div className="status-indicator">
              <div className={`status-dot ${isClocked ? "active" : ""}`}></div>
              <span className="status-text">
                {isRestoring ? "Checking for active session..." : isClocked ? "Session Active" : "Not Clocked In"}
              </span>
            </div>

            {isClocked && clockInTime && (
              <div className="time-display">
                <div className="time-label">Started at</div>
                <div className="time-value">{formatTime(clockInTime)}</div>
                <div className="time-label current">Current Time</div>
                <div className="time-value current">{formatTime(new Date())}</div>
                {activeBuyIns.length > 0 && (
                  <>
                    <div className="time-label">Total Bought In</div>
                    <div className="time-value">{formatCurrency(totalActiveBuyIn)}</div>
                    {activeBuyIns.length > 1 && (
                      <div className="time-label">{activeBuyIns.length} buy-ins</div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="clock-actions">
              {!isClocked ? (
                <button className="btn btn-primary" onClick={handleClockIn} disabled={isRestoring}>
                  <Play size={16} className="btn-icon" fill="currentColor" />
                  Clock In
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowBuyInForm(true)}>
                    <Plus size={16} className="btn-icon" />
                    Add Buy-In
                  </button>
                  <button className="btn btn-danger" onClick={handleClockOutClick}>
                    <Square size={16} className="btn-icon" fill="currentColor" />
                    Clock Out
                  </button>
                </>
              )}
            </div>
            {saveError && !showSessionForm && !showBuyInForm && !showClockOutForm && (
              <p className="modal-info">{saveError}</p>
            )}
          </div>

          {/* Session Form Modal (clock-in) */}
          {showSessionForm && (
            <div className="modal-overlay" onClick={() => setShowSessionForm(false)}>
              <div className="clock-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>New Session</h2>
                  <button className="modal-close" onClick={() => setShowSessionForm(false)}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Big Blind</label>
                    <input
                      type="number"
                      placeholder="e.g., 2"
                      value={formData.bigBlind}
                      onChange={(e) => setFormData({ ...formData, bigBlind: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Small Blind</label>
                    <input
                      type="number"
                      placeholder="e.g., 1"
                      value={formData.smallBlind}
                      onChange={(e) => setFormData({ ...formData, smallBlind: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Initial Buy-In</label>
                    <input
                      type="number"
                      placeholder="e.g., 200"
                      value={formData.buyIn}
                      onChange={(e) => setFormData({ ...formData, buyIn: e.target.value })}
                    />
                  </div>
                  {saveError && <p className="modal-info">{saveError}</p>}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowSessionForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveSession} disabled={isSaving}>
                    {isSaving ? "Starting..." : "Start Session"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Buy-In Form Modal */}
          {showBuyInForm && (
            <div className="modal-overlay" onClick={() => setShowBuyInForm(false)}>
              <div className="clock-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Add Buy-In</h2>
                  <button className="modal-close" onClick={() => setShowBuyInForm(false)}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  <p className="modal-info">
                    You've bought in for <strong>{formatCurrency(totalActiveBuyIn)}</strong> so far.
                  </p>
                  <div className="form-group">
                    <label>Buy-In Amount</label>
                    <input
                      type="number"
                      placeholder="e.g., 200"
                      value={formData.buyIn}
                      onChange={(e) => setFormData({ ...formData, buyIn: e.target.value })}
                    />
                  </div>
                  {saveError && <p className="modal-info">{saveError}</p>}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowBuyInForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleAddBuyIn}>Add Buy-In</button>
                </div>
              </div>
            </div>
          )}

          {/* Clock Out / Cash-Out Modal */}
          {showClockOutForm && (
            <div className="modal-overlay" onClick={() => setShowClockOutForm(false)}>
              <div className="clock-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>End Session</h2>
                  <button className="modal-close" onClick={() => setShowClockOutForm(false)}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  <p className="modal-info">
                    Total bought in: <strong>{formatCurrency(totalActiveBuyIn)}</strong>
                    {activeBuyIns.length > 1 && ` across ${activeBuyIns.length} buy-ins`}
                  </p>
                  <div className="form-group">
                    <label>How much are you walking away with?</label>
                    <input
                      type="number"
                      placeholder="e.g., 350"
                      value={formData.cashOut}
                      autoFocus
                      onChange={(e) => setFormData({ ...formData, cashOut: e.target.value })}
                    />
                  </div>
                  {formData.cashOut !== "" && !isNaN(parseFloat(formData.cashOut)) && (
                    <div className={`profit-preview ${parseFloat(formData.cashOut) - totalActiveBuyIn >= 0 ? "profit-positive" : "profit-negative"}`}>
                      {parseFloat(formData.cashOut) - totalActiveBuyIn >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{" "}
                      {formatCurrency(Math.abs(parseFloat(formData.cashOut) - totalActiveBuyIn))}
                      {" "}
                      {parseFloat(formData.cashOut) - totalActiveBuyIn >= 0 ? "profit" : "loss"}
                    </div>
                  )}
                  {saveError && <p className="modal-info">{saveError}</p>}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowClockOutForm(false)}>Cancel</button>
                  <button
                    className="btn btn-danger"
                    onClick={handleConfirmClockOut}
                    disabled={isSaving || formData.cashOut === "" || isNaN(parseFloat(formData.cashOut))}
                  >
                    {isSaving ? "Saving..." : "End Session"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Completed Session History */}
          {completedSessions.length > 0 && (
            <div className="history-section">
              <h2 className="history-title">Session History</h2>
              <div className="session-list">
                {completedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="session-item"
                    onContextMenu={(e) => handleSessionContextMenu(e, session.id)}
                    title="Right-click for options"
                  >
                    <div className="session-time">
                      <div className="session-time-header">
                        <span>{formatDate(session.date)}</span>
                      </div>
                      <div className="session-duration">
                        {formatTime(session.clockInTime)} – {formatTime(session.clockOutTime)}
                        {" · "}
                        {formatDuration(session.clockInTime, session.clockOutTime)}
                      </div>
                    </div>
                    <div className="session-details">
                      <div className="session-blinds">
                        <span className="blinds-label">Blinds</span>
                        <span className="blinds-value">
                          {formatCurrency(session.smallBlind)}/{formatCurrency(session.bigBlind)}
                        </span>
                      </div>
                      <div className="session-buyin">
                        <span className="buyin-label">
                          Bought In{session.buyIns.length > 1 ? ` (×${session.buyIns.length})` : ""}
                        </span>
                        <span className="buyin-value">{formatCurrency(session.totalBuyIn)}</span>
                      </div>
                      <div className="session-buyin">
                        <span className="buyin-label">Cash Out</span>
                        <span className="buyin-value">{formatCurrency(session.cashOut)}</span>
                      </div>
                      <div className="session-profit">
                        <span className="buyin-label">Net</span>
                        <span className={`profit-value ${session.profit >= 0 ? "profit-positive" : "profit-negative"}`}>
                          {session.profit >= 0 ? "+" : ""}{formatCurrency(session.profit)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Session Context Menu (positioned at right-click location) */}
          {contextMenu && (
            <div
              className="session-context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="context-menu-item delete"
                onClick={() => handleDeleteClick(contextMenu.id)}
              >
                <Trash2 size={14} /> Delete
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}