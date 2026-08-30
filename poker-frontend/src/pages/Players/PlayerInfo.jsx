import './PlayerInfo.css';
import { TagMenu } from './TagMenu';
import { PlayerStats } from './PlayerStats';
import { PlayerStarred } from './PlayerStarred';
import { useState, useRef, useEffect } from 'react';
import { Loader2, Camera, Pencil } from 'lucide-react';
import { API_URL } from '../../config';
import { uploadImage } from '../../api/uploads';
import { updatePerson, updatePersonNotes } from '../../api/people';

export function PlayerInfo({ player, onPlayerUpdate }) {

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
            const imageUrl = await uploadImage(file);
            const updatedPlayer = await updatePerson(currentPlayer._id, { image: imageUrl });

            setCurrentPlayer(updatedPlayer);
            if (onPlayerUpdate) onPlayerUpdate(updatedPlayer);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(error.message || 'Failed to upload image');
        } finally {
            setIsUploadingImage(false);
            e.target.value = '';
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            const updatedPlayer = await updatePersonNotes(currentPlayer._id, notes);
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
                    {isUploadingImage ? <><Loader2 size={14} className="spin" /> Uploading...</> : <><Camera size={14} /> Change Photo</>}
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
                            <Pencil size={14} /> Edit
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

            <PlayerStats player={currentPlayer} />

            <PlayerStarred player={currentPlayer} />

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