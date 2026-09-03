import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, Star, Plus, Upload, FolderUp } from "lucide-react";
import { Layout } from "../../components/Layout";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import { useHandImport } from "../../hooks/useHandImport";
import { ImportLogCta } from "../../components/ui/ImportLogCta";
import { SessionLog } from "../../components/SessionLog";
import { HandSearchMenu } from "../../components/HandSearchMenu";
import { Tabs } from "../../components/ui/Tabs";
import { Pagination } from "../../components/ui/Pagination";
import { SessionListSkeleton } from "./SessionListSkeleton";
import { formatSignedMajorUnits } from "../../utils/formatMoney";
import { uploadImage } from "../../api/uploads";
import { getPeople, createPerson } from "../../api/people";
import { getSessions, getSessionStakes, mapSessionPlayer, updateSession } from "../../api/sessions";
import "./History.css";

const gameFilters = ["All", "NLH", "PLO", "Heads-Up"];
const PAGE_SIZE = 50;

function EditSession({ renamingState, usedPersonIds, onSelect, onCancel }) {
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    getPeople()
      .then((data) => setPeople(data))
      .catch(() => {});
  }, []);

  const filtered = people.filter(
    (p) =>
      !usedPersonIds.includes(p._id) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { alert("Please select an image"); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { alert("Please enter a name"); return; }
    setIsUploading(true);
    try {
      let imageUrl = "";
      if (selectedFile) imageUrl = await uploadImage(selectedFile);

      const newPerson = await createPerson({ name: newName, image: imageUrl });
      onSelect(newPerson);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="player-search-overlay">
      <div className="player-search-modal">
        {!isCreating ? (
          <>
            <h3>Map "{renamingState.originalName}" to a person</h3>
            <input
              className="modal-input"
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="player-scroll-list">
              {filtered.length === 0 && (
                <p style={{ padding: "10px", color: "#888" }}>No players found.</p>
              )}
              {filtered.map((p) => (
                <div key={p._id} className="player-row" onClick={() => onSelect(p)}>
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="player-avatar-small" />
                  ) : (
                    <div className="avatar-placeholder" />
                  )}
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
            <button className="create-toggle-btn" onClick={() => setIsCreating(true)}>
              + Create New Person
            </button>
            <div className="button-group" style={{ marginTop: 10 }}>
              <button className="back-btn" onClick={onCancel}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="create-form">
            <h3>Create New Person</h3>
            <input
              className="modal-input"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <input
              type="file"
              id="edit-session-img"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
            <button
              type="button"
              className="back-btn"
              onClick={() => document.getElementById("edit-session-img").click()}
              disabled={isUploading}
            >
              <Camera size={14} /> {imagePreview ? "Change Image" : "Choose Image"}
            </button>
            {imagePreview && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }}
                />
                <button
                  type="button"
                  className="back-btn"
                  style={{ flex: "none", padding: "6px 10px" }}
                  onClick={() => { setSelectedFile(null); setImagePreview(null); }}
                  disabled={isUploading}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="button-group">
              <button
                className="back-btn"
                onClick={() => { setIsCreating(false); setNewName(""); setSelectedFile(null); setImagePreview(null); }}
                disabled={isUploading}
              >
                Back
              </button>
              <button className="save-btn" onClick={handleCreate} disabled={isUploading}>
                {isUploading ? "Saving..." : "Create & Select"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function History() {
  const navigate = useNavigate();
  const isLoggedIn = useIsLoggedIn();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedGame, setSelectedGame] = useState("All");
  // Handles this page's own CTA-driven (file picker) upload. Dropping a
  // file anywhere on the page is handled by Layout's own page-wide drop
  // zone (see onImportSettled below) - a separate instance, since Layout
  // has no visibility into this page's upload state.
  const { uploadStatus, setUploadStatus, error, setError, uploadFiles } = useHandImport();
  const fileInputRef = useRef(null);
  // Separate ref because an input carrying webkitdirectory can only
  // select folders - it can't also serve the multi-file picker.
  const folderInputRef = useRef(null);

  const [renamingState, setRenamingState] = useState(null);
  const [usedPersonIds, setUsedPersonIds] = useState([]);

  const [showStarredSessions, setShowStarredSessions] = useState(false);
  const [selectedStakes, setSelectedStakes] = useState("All");
  const [stakesOptions, setStakesOptions] = useState([]);

  // Filtering (game type, stakes, starred-only) is pushed server-side
  // alongside the pagination itself - both have to happen together in the
  // same query, or a filter would only ever see whichever page happened to
  // already be loaded. `summary` (hands/net-profit totals across the
  // *whole* filtered set, not just this page) backs the header subtitle
  // below.
  const fetchSessions = () => {
    return getSessions({ page, limit: PAGE_SIZE, gameType: selectedGame, stakes: selectedStakes, starred: showStarredSessions })
      .then((data) => {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        setTotal(data.total ?? 0);
        setSummary(data.summary ?? null);
      })
      .catch(() => setError("Server connection failed."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedGame, selectedStakes, showStarredSessions, uploadStatus]);

  // Options for the stakes filter <select> - fetched once (and again after
  // an upload, in case it introduced a new stakes level), not per
  // page/filter change.
  useEffect(() => {
    getSessionStakes()
      .then((data) => setStakesOptions(Array.isArray(data.stakes) ? data.stakes : []))
      .catch(() => {});
  }, [uploadStatus]);

  // Changing a filter resets to page 1 - otherwise a search/filter that
  // narrows the result set could strand you on a page number that no
  // longer exists. Wraps the raw setters rather than a separate effect, so
  // the filter change and the page reset land in the same render/fetch
  // instead of firing two fetches (one with the stale page, one correct).
  const handleGameChange = (game) => { setPage(1); setSelectedGame(game); };
  const handleStakesChange = (e) => { setPage(1); setSelectedStakes(e.target.value); };
  const handleToggleStarredFilter = () => { setPage(1); setShowStarredSessions((prev) => !prev); };

  const handleFileUpload = async (event) => {
    await uploadFiles(event.target.files);
    event.target.value = null;
  };

  // A page-wide drop (handled by Layout) uses its own separate upload
  // state, so this page's own uploadStatus/effect-based refetch never
  // fires for it - nudge uploadStatus here instead, which the effect
  // above already treats as "something changed, refetch."
  const handleImportSettled = () => setUploadStatus("success-" + Date.now());

  const onPlayerMapped = async (person) => {
    const { sessionId, originalName } = renamingState;
    try {
      await mapSessionPlayer(sessionId, { pokerNowName: originalName, personId: person._id });

      setSessions((prev) =>
        prev.map((s) => {
          if (s._id !== sessionId) return s;
          return {
            ...s,
            opponents: s.opponents.map((name) =>
              name === originalName ? person.name : name
            ),
            players: s.players
              ? s.players.map((p) =>
                  p.name === originalName ? { ...p, name: person.name } : p
                )
              : s.players,
          };
        })
      );

      setUsedPersonIds((prev) => [...prev, person._id]);
      setRenamingState(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleSessionStar = async (session) => {
    const nextStarred = !session.starred;
    try {
      await updateSession(session._id, { starred: nextStarred });
      // Refetch rather than patch the local array in place - if the
      // "starred only" filter is active, un-starring a session has to
      // drop it from the current page (and the total count), which a
      // simple in-place update can't do correctly across pages.
      await fetchSessions();
    } catch (err) {
      console.error("Error toggling session star:", err);
    }
  };

  // Totals across the whole filtered set (not just the current page) come
  // from the server alongside the paginated rows - see fetchSessions()/
  // GET /api/sessions's $facet summary, which does the same per-session
  // currency-normalize-then-sum this subtitle used to do client-side over
  // a fully-loaded list.
  const subtitle = total > 0 && summary
    ? `${total} session${total === 1 ? '' : 's'} · ${summary.totalHands.toLocaleString()} hands · ${formatSignedMajorUnits(summary.netProfit, summary.currency)} net`
    : undefined;

  return (
    <Layout
      title="History"
      subtitle={subtitle}
      ctaLabel={uploadStatus === "uploading" ? "Processing..." : "Import hands"}
      ctaIcon={Upload}
      onCta={() => fileInputRef.current.click()}
      onImportSettled={handleImportSettled}
    >
      <div className="history-container">
        {renamingState && (
          <EditSession
            renamingState={renamingState}
            usedPersonIds={usedPersonIds}
            onSelect={onPlayerMapped}
            onCancel={() => setRenamingState(null)}
          />
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".csv,.txt"
          multiple
          className="visually-hidden-input"
        />

        {/* Separate input because an input with webkitdirectory accepts
            ONLY folders - it can't double as the file picker above. The
            attribute is lowercase-spelled for React's DOM property, and
            `directory` covers the non-WebKit spelling. */}
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFileUpload}
          webkitdirectory=""
          directory=""
          multiple
          className="visually-hidden-input"
        />

        {error && <div className="error-message">{error}</div>}

        <div className="filter-bar">
          <div className="filter-bar-primary">
            <Tabs options={gameFilters} active={selectedGame} onChange={handleGameChange} />
            {stakesOptions.length > 0 && (
              <select
                className="stakes-filter-select"
                value={selectedStakes}
                onChange={handleStakesChange}
                aria-label="Filter by stakes"
              >
                <option value="All">All stakes</option>
                {stakesOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
          <div className="filter-bar-actions">
            <button
              className="create-button"
              onClick={() => navigate("/hand-creator")}
            ><Plus size={15} /> Create Hand </button>
            <button
              className="create-button"
              onClick={() => folderInputRef.current.click()}
              disabled={uploadStatus === "uploading"}
              title="Import every hand history file in a folder"
            ><FolderUp size={15} /> Import folder </button>
            <HandSearchMenu
              onHandClick={(hand, session) =>
                navigate("/hand-replay", { state: { hand, session } })
              }
            />
            <button
              className={`favourites-toggle ${showStarredSessions ? "active" : ""}`}
              onClick={handleToggleStarredFilter}
              title={showStarredSessions ? "Show all sessions" : "Show starred sessions"}
            >
              <Star size={16} fill={showStarredSessions ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
        <hr />
        {loading ? (
          <SessionListSkeleton />
        ) : sessions.length === 0 && isLoggedIn === false ? (
          <ImportLogCta />
        ) : sessions.length === 0 ? (
          <div className="no-sessions">
            <p>No sessions found.</p>
          </div>
        ) : (
          <>
            <SessionLog
              sessions={sessions}
              onSessionsChange={() => fetchSessions()}
              onHandClick={(hand, session) =>
                navigate("/hand-replay", { state: { hand, session } })
              }
              onRenameRequest={(name, sid) =>
                setRenamingState({ originalName: name, sessionId: sid })
              }
              onToggleStar={handleToggleSessionStar}
            />
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
          </>
        )}
      </div>
    </Layout>
  );
}