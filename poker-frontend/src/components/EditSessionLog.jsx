import { API_URL } from "../config";
import React, { useState, useEffect } from "react";
import './EditSessionLog.css';

export function EditSessionLog({ 
  isOpen, 
  onClose, 
  sessionData, 
  onSave 
}) {
  const [editFormData, setEditFormData] = useState({
    id: "",
    gameType: "",
    date: "",
    opponents: [],
    totalProfit: ""
  });
  const [people, setPeople] = useState([]);
  const [isCreatingNewPerson, setIsCreatingNewPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonImage, setNewPersonImage] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_URL}/api/people`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setPeople(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to fetch people:", err));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !isCreatingNewPerson && !isUploading) {
        handleSaveChanges();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCreatingNewPerson, isUploading, editFormData]);

  useEffect(() => {
    if (isOpen && sessionData) {
      let dateStr = "";
      if (sessionData.date) {
        const d = new Date(sessionData.date);
        if (!isNaN(d)) dateStr = d.toISOString().split("T")[0];
      }
      setEditFormData({
        id: sessionData._id,
        gameType: sessionData.gameType || "NLH",
        date: dateStr,
        opponents: sessionData.opponents.map(name => ({ 
          original: name, 
          current: name,
          personId: null 
        })),
        totalProfit: sessionData.totalProfit || 0
      });
      setStatusMessage(null);
    }
  }, [isOpen, sessionData]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showStatus('error', 'Image size should be less than 5MB'); return; }
    if (!file.type.startsWith('image/')) { showStatus('error', 'Please select an image file'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setSelectedFile(file);
  };

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

  const handleCreateNewPerson = async () => {
    if (!newPersonName.trim()) { showStatus('error', 'Please enter a name'); return; }
    setIsUploading(true);
    try {
      let imageUrl = "";
      if (selectedFile) imageUrl = await uploadImageToServer(selectedFile);

      const response = await fetch(`${API_URL}/api/people`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPersonName, image: imageUrl }),
      });
      if (!response.ok) throw new Error("Failed to create person");

      const newPerson = await response.json();
      setPeople(prev => [...prev, newPerson]);
      setNewPersonName("");
      setNewPersonImage("");
      setImagePreview(null);
      setSelectedFile(null);
      setIsCreatingNewPerson(false);
      showStatus('success', `"${newPerson.name}" created successfully`);
    } catch (error) {
      console.error("Error creating person:", error);
      showStatus('error', 'Failed to create person. Name might already exist.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpponentChange = (index, selectedPersonName) => {
    const newOpponents = [...editFormData.opponents];
    const selectedPerson = people.find(p => p.name === selectedPersonName);
    newOpponents[index].current = selectedPersonName;
    newOpponents[index].personId = selectedPerson ? selectedPerson._id : null;
    setEditFormData({ ...editFormData, opponents: newOpponents });
  };

  const handleSaveChanges = async () => {
    try {
      const renameMap = {};
      editFormData.opponents.forEach((opp) => {
        if (opp.original !== opp.current) renameMap[opp.original] = opp.current;
      });

      const response = await fetch(
        `${API_URL}/api/sessions/${editFormData.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: editFormData.date,
            gameType: editFormData.gameType,
            opponentRenames: renameMap,
            totalProfit: Number(editFormData.totalProfit),
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to update data");

      const result = await response.json();
      if (onSave) onSave(result.hand || result);
      onClose();
    } catch (error) {
      console.error("Error saving changes", error);
      showStatus('error', 'There was an error saving changes');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Session</h3>

        {/* Inline status message */}
        {statusMessage && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px',
            fontWeight: 500,
            background: statusMessage.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: statusMessage.type === 'success' ? '#22c55e' : '#ef4444',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {statusMessage.type === 'success' ? '✓ ' : '✕ '}{statusMessage.text}
          </div>
        )}

        <label className="modal-label">Date:</label>
        <input
          type="date"
          className="modal-input"
          value={editFormData.date}
          onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
        />

        <label className="modal-label">Game Type:</label>
        <select
          className="modal-input"
          value={editFormData.gameType}
          onChange={(e) => setEditFormData({ ...editFormData, gameType: e.target.value })}
        >
          <option value="NLH">No Limit Hold'em (NLH)</option>
          <option value="PLO">Pot Limit Omaha (PLO)</option>
          <option value="Heads-Up">Heads-Up</option>
        </select>

        <label className="modal-label">Total Profit:</label>
        <input
          type="number"
          className="modal-input"
          value={editFormData.totalProfit}
          onChange={(e) => setEditFormData({ ...editFormData, totalProfit: e.target.value })}
        />

        {editFormData.opponents && editFormData.opponents.length > 0 && (
          <div className="opponents-section">
            <label className="modal-label">Edit Opponents:</label>
            <div className="opponents-scroll-container">
              {editFormData.opponents.map((opp, index) => (
                <div key={index} className="opponent-row">
                  <span className="opponent-original-name">Original: {opp.original}</span>
                  <select
                    className="opponent-name-input"
                    value={opp.current}
                    onChange={(e) => handleOpponentChange(index, e.target.value)}
                  >
                    <option value={opp.original}>{opp.original} (Keep Original)</option>
                    {people.map((person) => (
                      <option key={person._id} value={person.name}>{person.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="create-person-section">
          {!isCreatingNewPerson ? (
            <button className="create-person-btn" onClick={() => setIsCreatingNewPerson(true)}>
              + Create New Person
            </button>
          ) : (
            <div className="new-person-form">
              <h4>Create New Person</h4>
              <label className="modal-label">Name:</label>
              <input
                type="text"
                className="modal-input"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Enter person's name"
              />
              <label className="modal-label">Profile Image:</label>
              <div className="image-upload-section">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="upload-image-btn"
                  onClick={() => document.getElementById('image-upload').click()}
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
                      onClick={() => { setNewPersonImage(""); setImagePreview(null); setSelectedFile(null); }}
                      style={{ marginLeft: '10px' }}
                      disabled={isUploading}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
              </div>
              <div className="new-person-actions">
                <button
                  onClick={() => { setIsCreatingNewPerson(false); setNewPersonName(""); setNewPersonImage(""); setImagePreview(null); setSelectedFile(null); }}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button className="save-btn" onClick={handleCreateNewPerson} disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSaveChanges}>Save</button>
        </div>
      </div>
    </div>
  );
}
