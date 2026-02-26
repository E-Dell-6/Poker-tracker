import './PlayerInfo.css';
import { TagMenu } from './TagMenu';
import { PlayerStats } from './PlayerStats';
import { useState, useRef, useEffect } from 'react';
import { API_URL } from '../../config';

export function PlayerInfo({ player, sessions, onPlayerUpdate }) {

    const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState(player);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState(player.notes || '');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef(null);

    // Sync internal state when the selected player changes
    useEffect(() => {
        setCurrentPlayer(player);
        setNotes(player.notes || '');
        setIsEditingNotes(false);
    }, [player._id]);
     if (!player) return null;
    const handleTagCreated = (updatedPlayer) => {
        setCurrentPlayer(updatedPlayer);
        setIsTagMenuOpen(false);
        if (onPlayerUpdate) onPlayerUpdate(updatedPlayer);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', file);

            const uploadResponse = await fetch(`${API_URL}/api/upload-image`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!uploadResponse.ok) throw new Error('Failed to upload image');
            const { imageUrl } = await uploadResponse.json();

            const updateResponse = await fetch(`${API_URL}/api/people/${currentPlayer._id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageUrl }),
            });

            if (!updateResponse.ok) throw new Error('Failed to update player image');
            const updatedPlayer = await updateResponse.json();

            setCurrentPlayer(updatedPlayer);
            if (onPlayerUpdate) onPlayerUpdate(updatedPlayer);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
        } finally {
            setIsUploadingImage(false);
            e.target.value = '';
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            const response = await fetch(`${API_URL}/api/people/${currentPlayer._id}/notes`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });

            if (!response.ok) throw new Error('Failed to update notes');

            const updatedPlayer = await response.json();
            setCurrentPlayer(updatedPlayer);
            setIsEditingNotes(false);
            if (onPlayerUpdate) onPlayerUpdate(updatedPlayer);
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Failed to save notes');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleCancelNotes = () => {
        setNotes(currentPlayer.notes || '');
        setIsEditingNotes(false);
    };

    return (
        <div className="player-info">
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
            />

            <div
                className={`avatar-upload-wrapper${isUploadingImage ? ' uploading' : ''}`}
                onClick={() => !isUploadingImage && fileInputRef.current.click()}
                title="Click to change photo"
            >
                {currentPlayer.image ? (
                    <img
                        src={`${API_URL}${currentPlayer.image}`}
                        alt={currentPlayer.name}
                        className="player-avatar-large"
                    />
                ) : (
                    <div className="avatar-placeholder">
                        {currentPlayer.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="avatar-upload-overlay">
                    {isUploadingImage ? '⏳ Uploading...' : '📷 Change Photo'}
                </div>
            </div>

            <h1 className="name">{currentPlayer.name}</h1>

            <div className="tags-list">
                {currentPlayer.tags && currentPlayer.tags.map((tag, index) => (
                    <div
                        key={index}
                        className="tag"
                        style={{ backgroundColor: tag.color }}
                    >
                        {tag.label}
                    </div>
                ))}
                <button
                    className="tag create-tag-btn"
                    onClick={() => setIsTagMenuOpen(true)}
                >
                    + Add Tag
                </button>
            </div>

            <div className="notes-section">
                <div className="notes-header">
                    <h3>Notes</h3>
                    {!isEditingNotes && (
                        <button
                            className="edit-notes-btn"
                            onClick={() => setIsEditingNotes(true)}
                        >
                            ✏️ Edit
                        </button>
                    )}
                </div>

                {isEditingNotes ? (
                    <div className="notes-editor">
                        <textarea
                            className="notes-textarea"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this player..."
                            rows={6}
                            autoFocus
                        />
                        <div className="notes-actions">
                            <button
                                className="cancel-notes-btn"
                                onClick={handleCancelNotes}
                                disabled={isSavingNotes}
                            >
                                Cancel
                            </button>
                            <button
                                className="save-notes-btn"
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes}
                            >
                                {isSavingNotes ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="notes-display">
                        {currentPlayer.notes ? (
                            <p>{currentPlayer.notes}</p>
                        ) : (
                            <p className="notes-empty">No notes yet. Click "Edit" to add notes.</p>
                        )}
                    </div>
                )}
            </div>

            <PlayerStats player={currentPlayer} sessions={sessions} />

            {isTagMenuOpen && (
                <TagMenu
                    player={currentPlayer}
                    onClose={() => setIsTagMenuOpen(false)}
                    onTagCreated={handleTagCreated}
                />
            )}
        </div>
    );
}