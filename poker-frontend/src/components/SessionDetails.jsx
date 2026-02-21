/*/import React, { useState, useEffect } from "react";

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

  // Fetch people from backend
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch('http://localhost:1111/api/people');
        if (response.ok) {
          const data = await response.json();
          setPeople(data);
        }
      } catch (error) {
        console.error("Failed to fetch people:", error);
      }
    };
    
    if (isOpen) {
      fetchPeople();
    }
  }, [isOpen]);

  // Save on Enter key (but not when creating a new person, to avoid conflicts)
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

  // Initialize form data when modal opens
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
    }
  }, [isOpen, sessionData]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert("Please select an image file");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Store the file for upload when creating person
    setSelectedFile(file);
  };

  const uploadImageToServer = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:1111/api/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      return result.imageUrl; // Returns the URL path to the image
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleCreateNewPerson = async () => {
    if (!newPersonName.trim()) {
      alert("Please enter a name");
      return;
    }

    setIsUploading(true);

    try {
      let imageUrl = "";

      // Upload image if one was selected
      if (selectedFile) {
        imageUrl = await uploadImageToServer(selectedFile);
      }

      // Create the person with the image URL
      const response = await fetch('http://localhost:1111/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPersonName,
          image: imageUrl
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create person");
      }

      const newPerson = await response.json();
      setPeople(prev => [...prev, newPerson]);
      
      // Reset form
      setNewPersonName("");
      setNewPersonImage("");
      setImagePreview(null);
      setSelectedFile(null);
      setIsCreatingNewPerson(false);
      setIsUploading(false);
      
      alert("Person created successfully!");
    } catch (error) {
      console.error("Error creating person:", error);
      setIsUploading(false);
      alert("Failed to create person. Name might already exist or image upload failed.");
    }
  };

  const handleOpponentChange = (index, selectedPersonName) => {
    const newOpponents = [...editFormData.opponents];
    const selectedPerson = people.find(p => p.name === selectedPersonName);
    
    newOpponents[index].current = selectedPersonName;
    newOpponents[index].personId = selectedPerson ? selectedPerson._id : null;
    
    setEditFormData({
      ...editFormData,
      opponents: newOpponents
    });
  };

  const handleSaveChanges = async () => {
    try {
      const renameMap = {};
      editFormData.opponents.forEach((opp) => {
        if (opp.original !== opp.current) {
          renameMap[opp.original] = opp.current;
        }
      });

      const updatedData = {
        date: editFormData.date,
        gameType: editFormData.gameType,
        opponentRenames: renameMap,
        totalProfit: Number(editFormData.totalProfit)
      };

      const response = await fetch(
        `http://localhost:1111/api/sessions/${editFormData.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update data");
      }

      const result = await response.json();
      const updatedSession = result.hand || result;

      if (onSave) {
        onSave(updatedSession);
      }

      onClose();
    } catch (error) {
      console.error("Error saving changes", error);
      alert("There was an error saving changes");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Session</h3>

        <label className="modal-label">Date:</label>
        <input
          type="date"
          className="modal-input"
          value={editFormData.date}
          onChange={(e) =>
            setEditFormData({ ...editFormData, date: e.target.value })
          }
        />

        <label className="modal-label">Game Type:</label>
        <select
          className="modal-input"
          value={editFormData.gameType}
          onChange={(e) =>
            setEditFormData({ ...editFormData, gameType: e.target.value })
          }
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
          onChange={(e) =>
            setEditFormData({ ...editFormData, totalProfit: e.target.value })
          }
        />

        {editFormData.opponents && editFormData.opponents.length > 0 && (
          <div className="opponents-section">
            <label className="modal-label">Edit Opponents:</label>
            <div className="opponents-scroll-container">
              {editFormData.opponents.map((opp, index) => (
                <div key={index} className="opponent-row">
                  <span className="opponent-original-name">
                    Original: {opp.original}
                  </span>
                  <select
                    className="opponent-name-input"
                    value={opp.current}
                    onChange={(e) => handleOpponentChange(index, e.target.value)}
                  >
                    <option value={opp.original}>{opp.original} (Keep Original)</option>
                    {people.map((person) => (
                      <option key={person._id} value={person.name}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="create-person-section">
          {!isCreatingNewPerson ? (
            <button 
              className="create-person-btn"
              onClick={() => setIsCreatingNewPerson(true)}
            >
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
                      style={{ 
                        maxWidth: '100px', 
                        maxHeight: '100px', 
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginTop: '10px'
                      }} 
                    />
                    <button 
                      type="button"
                      className="remove-image-btn"
                      onClick={() => {
                        setNewPersonImage("");
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}
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
                  onClick={() => {
                    setIsCreatingNewPerson(false);
                    setNewPersonName("");
                    setNewPersonImage("");
                    setImagePreview(null);
                    setSelectedFile(null);
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button 
                  className="save-btn" 
                  onClick={handleCreateNewPerson}
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading..." : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSaveChanges}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
*/