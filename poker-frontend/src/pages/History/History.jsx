import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { SessionLog } from "../../components/SessionLog";
import { FavouritesLog } from "../../components/FavouritesLog";
import { API_URL } from "../../config";
import "./History.css";

const gameFilters = ["All", "NLH", "PLO", "Heads-Up"];

// --- Player-mapping modal ---
function EditSession({ renamingState, usedPersonIds, onSelect, onCancel }) {
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/people`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setPeople(Array.isArray(data) ? data : []))
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
      if (selectedFile) {
        const formData = new FormData();
        formData.append("image", selectedFile);
        const imgRes = await fetch(`${API_URL}/api/upload-image`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!imgRes.ok) throw new Error("Image upload failed");
        const imgData = await imgRes.json();
        imageUrl = imgData.imageUrl;
      }

      const res = await fetch(`${API_URL}/api/people`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, image: imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to create person");
      const newPerson = await res.json();

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
              📷 {imagePreview ? "Change Image" : "Choose Image"}
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
                  ✕
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

// --- Main History page ---
export function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [selectedGame, setSelectedGame] = useState("All");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [renamingState, setRenamingState] = useState(null);
  const [usedPersonIds, setUsedPersonIds] = useState([]);

  const [isFavouritesShowing, setIsFavouritesShowing] = useState("☆");
  const [favourites, setFavourites] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/sessions`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setError("Server connection failed."));
  }, [uploadStatus]);

  useEffect(() => {
    if (isFavouritesShowing !== "⭐") return;
    fetch(`${API_URL}/api/favourites`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setFavourites(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load favourites", err));
  }, [isFavouritesShowing]);

  const filteredSessions = useMemo(() => {
    if (selectedGame === "All") return sessions;
    return sessions.filter((s) => s.gameType === selectedGame);
  }, [selectedGame, sessions]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadStatus("uploading");
    const formData = new FormData();
    formData.append("csvFile", file);
    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setUploadStatus("success-" + Date.now());
    } catch (err) {
      setUploadStatus("error");
      setError(err.message);
    }
    event.target.value = null;
  };

  const onPlayerMapped = async (person) => {
    const { sessionId, originalName } = renamingState;
    try {
      const response = await fetch(
        `${API_URL}/api/sessions/${sessionId}/map-player`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pokerNowName: originalName,
            personId: person._id,
          }),
        }
      );
      if (!response.ok) throw new Error("Mapping failed");

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

  function HandleFavouriteClick() {
    if (isFavouritesShowing === "☆") {
      setIsFavouritesShowing("⭐");
    } else {
      setIsFavouritesShowing("☆");
    }
  }

  return (
    <Layout>
      <div className="history-container">
        {renamingState && (
          <EditSession
            renamingState={renamingState}
            usedPersonIds={usedPersonIds}
            onSelect={onPlayerMapped}
            onCancel={() => setRenamingState(null)}
          />
        )}

        <div className="history-header">
          <h1>Hand History Review</h1>
          <div className="upload-section">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              style={{ display: "none" }}
            />
            <button
              className="upload-button"
              onClick={() => fileInputRef.current.click()}
              disabled={uploadStatus === "uploading"}
            >
              {uploadStatus === "uploading" ? "Processing..." : "📂 Upload Log"}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="game-filter">
          {gameFilters.map((game) => (
            <button
              key={game}
              className={selectedGame === game ? "active" : ""}
              onClick={() => setSelectedGame(game)}
            >
              {game}
            </button>
          ))}
        </div>
        <button
          className={`favourites-toggle ${isFavouritesShowing === "⭐" ? "active" : ""}`}
          onClick={HandleFavouriteClick}
          title={isFavouritesShowing === "⭐" ? "Show All Sessions" : "Show Favourites"}
        >
          {isFavouritesShowing}
        </button>
        <hr />
        {isFavouritesShowing === "☆" ? (
          sessions.length === 0 ? (
            <div className="no-sessions">
              <p>No sessions found.</p>
            </div>
          ) : (
            <SessionLog
              sessions={filteredSessions}
              onSessionsChange={(updater) => setSessions((prev) => updater(prev))}
              onHandClick={(hand, session) =>
                navigate("/hand-replay", { state: { hand, session } })
              }
              onRenameRequest={(name, sid) =>
                setRenamingState({ originalName: name, sessionId: sid })
              }
            />
          )
        ) : (
          <FavouritesLog
            hands={favourites}
            onHandClick={(hand, session) =>
              navigate("/hand-replay", { state: { hand, session } })
            }
          />
        )}
      </div>
    </Layout>
  );
}
