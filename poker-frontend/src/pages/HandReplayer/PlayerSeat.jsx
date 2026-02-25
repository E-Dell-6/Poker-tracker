import { useState, useEffect } from "react";
import "./PlayerSeat.css";
import { API_URL } from "../../config";

export default function PlayerSeat({ player, style, betAmount, isFolded, winners, isChecked, shownPlayerHand }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [isCreatingNewPerson, setIsCreatingNewPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [playerImage, setPlayerImage] = useState(null);


  // Fetch people list when modal opens
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch(`${API_URL}/api/people`);
        if (response.ok) {
          const data = await response.json();
          setPeople(data);
        }
      } catch (error) {
        console.error("Failed to fetch people:", error);
      }
    };
    
    if (isEditModalOpen) {
      fetchPeople();
    }
  }, [isEditModalOpen]);

  // Fetch player's image on mount and when player changes
  useEffect(() => {
    const fetchPlayerImage = async () => {
      try {
        const response = await fetch(`${API_URL}/api/people`);
        if (response.ok) {
          const allPeople = await response.json();
          const matchedPerson = allPeople.find(p => p.name === player.name);
          if (matchedPerson && matchedPerson.image) {
            setPlayerImage(matchedPerson.image);
          }
        }
      } catch (error) {
        console.error("Failed to fetch player image:", error);
      }
    };

    if (!player.isHero) {
      fetchPlayerImage();
    }
  }, [player.name, player.isHero]);

    if (!player) return null;
  
  let isWinner = false;
  let isArray = shownPlayerHand === null;
  
  if (winners) {
    winners.forEach((winner) => {
      if (player.name === winner) isWinner = true;
    });
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    setSelectedFile(file);
  };

  const uploadImageToServer = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_URL}/api/upload-image`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      return result.imageUrl;
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

      if (selectedFile) {
        imageUrl = await uploadImageToServer(selectedFile);
      }

      const response = await fetch(`${API_URL}/api/people`, {
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
      
      setNewPersonName("");
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

  const handleAssignPerson = async () => {
    if (!selectedPersonId) {
      alert("Please select a person");
      return;
    }

    // Here you would typically update the player-person mapping in your backend
    // For now, we'll just update the local state
    const selectedPerson = people.find(p => p._id === selectedPersonId);
    if (selectedPerson && selectedPerson.image) {
      setPlayerImage(selectedPerson.image);
    }

    setIsEditModalOpen(false);
    alert(`Assigned ${selectedPerson?.name || 'person'} to ${player.name}`);
    
    // TODO: Add API call to save the mapping
    // await fetch(`${API_URL}/api/players/${player.name}/assign-person`, {
    //   method: 'POST',
    //   body: JSON.stringify({ personId: selectedPersonId })
    // });
  };

  const handleProfilePictureClick = (e) => {
    e.stopPropagation();
    if (!player.isHero) {
      setIsEditModalOpen(true);
    }
  };

  return (
    <>
      <div
        className={`player-seat ${player.isHero ? "hero" : ""} ${
          isFolded ? "folded" : ""
        }`}
        style={style}
      >
        <div className={player.isDealer ? "Dealer" : "nothing"}>Dealer</div>
        <div className={betAmount > 0 ? "bet" : "nothing"}>{betAmount}</div>
        <div className={isChecked ? "check" : "nothing"}>Check</div>
        <div className={player.stack === 0 && !isFolded ? "all-in" : "nothing"}>All-In</div>
        <div className={isWinner ? "winner" : ""}>
          {isWinner ? player.winnings || 0 : null}
        </div>

        <div className="player-name">{player.name}</div>
        
        <div 
          className={!player.isHero ? "profile-picture" : "nothing"}
          onClick={handleProfilePictureClick}
          style={{ cursor: !player.isHero ? 'pointer' : 'default' }}
        >
          {playerImage ? (
            <img 
              src={`${API_URL}${playerImage}`} 
              alt={player.name}
              className="profile-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%'
              }}
            />
          ) : null}
        </div>

        <div className="player-stack">Stack: {player.stack}</div>

        <div className="hole-cards">
          {player.isHero && player.holeCards?.length > 0 ? (
            player.holeCards.map((card, index) => (
              <img
                key={index}
                src={`/images/cards/${card}.png`}
                alt={card}
                className="card-image"
              />
            ))
          ) : shownPlayerHand && shownPlayerHand.length > 0 ? (
            shownPlayerHand.map((card, index) => (
              <img
                key={index}
                src={`/images/cards/${card}.png`}
                alt={card}
                className="card-image"
              />
            ))
          ) : !player.isHero && isArray ? (
            <>
              <img
                src="/images/cardbacks/fire_cardback.png"
                alt="Hidden card"
                className="card-image"
              />
              <img
                src="/images/cardbacks/fire_cardback.png"
                alt="Hidden card"
                className="card-image"
              />
            </>
          ) : null}
        </div>
      </div>

      {isEditModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsEditModalOpen(false)}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Assign Person to {player.name}</h3>

            {!isCreatingNewPerson ? (
              <>
                <label className="modal-label">Select Person:</label>
                <select
                  className="modal-input"
                  value={selectedPersonId || ""}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                >
                  <option value="">-- Select a person --</option>
                  {people.map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.name}
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: '20px' }}>
                  <button 
                    className="create-person-btn"
                    onClick={() => setIsCreatingNewPerson(true)}
                    style={{ marginBottom: '10px', width: '100%' }}
                  >
                    + Create New Person
                  </button>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </button>
                  <button 
                    className="save-btn" 
                    onClick={handleAssignPerson}
                    disabled={!selectedPersonId}
                  >
                    Assign
                  </button>
                </div>
              </>
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
                    id="player-image-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <button 
                    type="button"
                    className="upload-image-btn"
                    onClick={() => document.getElementById('player-image-upload').click()}
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
                
                <div className="new-person-actions" style={{ marginTop: '20px' }}>
                  <button 
                    onClick={() => {
                      setIsCreatingNewPerson(false);
                      setNewPersonName("");
                      setImagePreview(null);
                      setSelectedFile(null);
                    }}
                    disabled={isUploading}
                  >
                    Back
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
        </div>
      )}
    </>
  );
}
