import { useState } from 'react';
import './TagMenu.css';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#64748b', // gray
  '#dc2626', // dark red
  '#16a34a', // dark green
  '#2563eb', // dark blue
];

export function TagMenu({ player, onClose, onTagCreated }) {
  const [tagLabel, setTagLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!tagLabel.trim()) {
      alert('Please enter a tag label');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`http://localhost:1111/api/people/${player._id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: tagLabel.trim(),
          color: selectedColor
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create tag');
      }

      const updatedPlayer = await response.json();
      
      // Notify parent component of the update
      if (onTagCreated) {
        onTagCreated(updatedPlayer);
      }

      // Close the menu
      if (onClose) {
        onClose();
      }

      alert('Tag created successfully!');
    } catch (error) {
      console.error('Error creating tag:', error);
      alert('Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tag-menu-overlay" onClick={onClose}>
      <div className="tag-menu" onClick={(e) => e.stopPropagation()}>
        <h3>Create New Tag</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="tag-label">Tag Label</label>
            <input
              id="tag-label"
              type="text"
              className="tag-input"
              value={tagLabel}
              onChange={(e) => setTagLabel(e.target.value)}
              placeholder="e.g., Aggressive, Tight, Fish"
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Tag Color</label>
            <div className="color-picker">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="tag-preview">
            <span>Preview:</span>
            <div 
              className="tag preview-tag"
              style={{ backgroundColor: selectedColor }}
            >
              {tagLabel || 'Tag Label'}
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="create-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}