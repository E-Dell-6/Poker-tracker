import { Layout } from "../../components/Layout";
import { useState } from "react";
import "./Clock.css";

export function Clock() {
  const [isClocked, setIsClocked] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showBuyInForm, setShowBuyInForm] = useState(false);
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [clockInTime, setClockInTime] = useState(null);

  // Blinds are set once at clock-in and shared across all buy-ins
  const [sessionBlinds, setSessionBlinds] = useState({ bigBlind: "", smallBlind: "" });
  // All buy-ins accumulated during the active session
  const [activeBuyIns, setActiveBuyIns] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    bigBlind: "",
    smallBlind: "",
    buyIn: "",
    cashOut: ""
  });

  const totalActiveBuyIn = activeBuyIns.reduce((sum, b) => sum + b, 0);

  const handleClockIn = () => {
    setIsClocked(true);
    setClockInTime(new Date());
    setShowSessionForm(true);
  };

  // Called when the user clicks "Clock Out" — show cash-out prompt
  const handleClockOutClick = () => {
    setShowClockOutForm(true);
  };

  // Called when user confirms cash-out amount
  const handleConfirmClockOut = () => {
    const cashOut = parseFloat(formData.cashOut);
    if (isNaN(cashOut)) return;

    const profit = cashOut - totalActiveBuyIn;
    const clockOutTime = new Date();

    const newSession = {
      id: Date.now(),
      date: clockInTime,
      clockInTime,
      clockOutTime,
      bigBlind: parseFloat(sessionBlinds.bigBlind),
      smallBlind: parseFloat(sessionBlinds.smallBlind),
      buyIns: [...activeBuyIns],
      totalBuyIn: totalActiveBuyIn,
      cashOut,
      profit
    };

    setCompletedSessions([newSession, ...completedSessions]);

    // Reset everything
    setIsClocked(false);
    setClockInTime(null);
    setSessionBlinds({ bigBlind: "", smallBlind: "" });
    setActiveBuyIns([]);
    setShowClockOutForm(false);
    setShowSessionForm(false);
    setShowBuyInForm(false);
    setFormData({ bigBlind: "", smallBlind: "", buyIn: "", cashOut: "" });
  };

  const handleSaveSession = () => {
    if (formData.bigBlind && formData.smallBlind && formData.buyIn) {
      setSessionBlinds({
        bigBlind: formData.bigBlind,
        smallBlind: formData.smallBlind
      });
      setActiveBuyIns([parseFloat(formData.buyIn)]);
      setShowSessionForm(false);
      setFormData({ bigBlind: "", smallBlind: "", buyIn: "", cashOut: "" });
    }
  };

  const handleAddBuyIn = () => {
    const amount = parseFloat(formData.buyIn);
    if (!isNaN(amount) && amount > 0) {
      setActiveBuyIns([...activeBuyIns, amount]);
      setShowBuyInForm(false);
      setFormData({ ...formData, buyIn: "" });
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
    <Layout>
      <div className="clock-page">
        <div className="clock-container">
          {/* Header */}
          <div className="clock-header">
            <h1 className="clock-title">Session Tracker</h1>
            <p className="clock-subtitle">Track your poker sessions with precision</p>
          </div>

          {/* Main Clock Card */}
          <div className="clock-card">
            <div className="status-indicator">
              <div className={`status-dot ${isClocked ? "active" : ""}`}></div>
              <span className="status-text">
                {isClocked ? "Session Active" : "Not Clocked In"}
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
                <button className="btn btn-primary" onClick={handleClockIn}>
                  <span className="btn-icon">▶</span>
                  Clock In
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowBuyInForm(true)}>
                    <span className="btn-icon">+</span>
                    Add Buy-In
                  </button>
                  <button className="btn btn-danger" onClick={handleClockOutClick}>
                    <span className="btn-icon">■</span>
                    Clock Out
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Session Form Modal (clock-in) */}
          {showSessionForm && (
            <div className="modal-overlay" onClick={() => setShowSessionForm(false)}>
              <div className="clock-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>New Session</h2>
                  <button className="modal-close" onClick={() => setShowSessionForm(false)}>×</button>
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
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowSessionForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveSession}>Start Session</button>
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
                  <button className="modal-close" onClick={() => setShowBuyInForm(false)}>×</button>
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
                  <button className="modal-close" onClick={() => setShowClockOutForm(false)}>×</button>
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
                      {parseFloat(formData.cashOut) - totalActiveBuyIn >= 0 ? "▲" : "▼"}{" "}
                      {formatCurrency(Math.abs(parseFloat(formData.cashOut) - totalActiveBuyIn))}
                      {" "}
                      {parseFloat(formData.cashOut) - totalActiveBuyIn >= 0 ? "profit" : "loss"}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowClockOutForm(false)}>Cancel</button>
                  <button
                    className="btn btn-danger"
                    onClick={handleConfirmClockOut}
                    disabled={formData.cashOut === "" || isNaN(parseFloat(formData.cashOut))}
                  >
                    End Session
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
                  <div key={session.id} className="session-item">
                    <div className="session-time">
                      <div>{formatDate(session.date)}</div>
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
        </div>
      </div>
    </Layout>
  );
}
