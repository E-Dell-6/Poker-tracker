import { useId, useState } from 'react';
import { Camera, Star, X } from 'lucide-react';
import './PersonPicker.css';

// Splits the old overloaded "link person" <select> (which hid a "__create__"
// sentinel among real options) into a clear dropdown plus a separate
// "+ New person" button.
export default function PersonPicker({ people, peopleLoading, selectedId, defaultName, onLink, onCreate }) {
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <CreatePersonForm
        defaultName={defaultName}
        onCancel={() => setCreating(false)}
        onCreate={async (name, file) => {
          await onCreate(name, file);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="pp-row">
      <select
        className="pp-select"
        value={selectedId || ''}
        onChange={(e) => onLink(e.target.value || null)}
        disabled={peopleLoading}
      >
        <option value="">— not linked —</option>
        {people.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" className="pp-new-btn" onClick={() => setCreating(true)}>
        + New person
      </button>
    </div>
  );
}

// Also used standalone (not just inside PersonPicker's own "+ New person"
// flow) - Players.jsx's "Add Player" modal reuses it directly rather than
// keeping a third copy of the same name+image create-person form.
// `showStarToggle` opts into an extra "Star this player" checkbox, passed
// as a 3rd (starred: boolean) argument to onCreate - off by default so
// PersonPicker's own inline "+ New person" flow (HandCreator) and
// EditSessionLog.jsx's per-opponent picker (which always force-stars via
// its own onCreate wrapper, since its list only shows starred players)
// render exactly as before. Only Players.jsx's "Add Player" modal opts in.
export function CreatePersonForm({ defaultName, onCancel, onCreate, showStarToggle = false }) {
  const inputId = useId();
  const [name, setName] = useState(defaultName || '');
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [starred, setStarred] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setSelectedFile(file);
  };

  const submit = async () => {
    if (!name.trim() || isUploading) return;
    setIsUploading(true);
    await onCreate(name.trim(), selectedFile, starred);
    setIsUploading(false);
  };

  return (
    <div className="pp-create-form">
      <label className="pp-label">Name</label>
      <input
        type="text"
        className="pp-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter person's name"
      />

      <label className="pp-label">Profile Image</label>
      <div className="pp-image-section">
        <input type="file" id={inputId} accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        <button
          type="button"
          className="pp-upload-btn"
          onClick={() => document.getElementById(inputId).click()}
          disabled={isUploading}
        >
          <Camera size={14} /> Choose Image
        </button>
        {imagePreview && (
          <div className="pp-image-preview">
            <img src={imagePreview} alt="Preview" />
            <button
              type="button"
              className="pp-remove-image-btn"
              onClick={() => {
                setImagePreview(null);
                setSelectedFile(null);
              }}
              disabled={isUploading}
            >
              <X size={14} /> Remove
            </button>
          </div>
        )}
      </div>

      {showStarToggle && (
        <label className="pp-star-toggle">
          <input
            type="checkbox"
            checked={starred}
            onChange={(e) => setStarred(e.target.checked)}
            disabled={isUploading}
          />
          <Star size={14} fill={starred ? 'currentColor' : 'none'} />
          Star this player
        </label>
      )}

      <div className="pp-create-actions">
        <button type="button" onClick={onCancel} disabled={isUploading}>
          Cancel
        </button>
        <button type="button" className="pp-save-btn" onClick={submit} disabled={isUploading}>
          {isUploading ? 'Uploading…' : 'Create'}
        </button>
      </div>
    </div>
  );
}
