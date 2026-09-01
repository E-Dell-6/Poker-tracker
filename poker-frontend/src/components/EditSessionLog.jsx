import { uploadImage } from "../api/uploads";
import { getPeoplePage, createPerson } from "../api/people";
import { updateSession } from "../api/sessions";
import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import PersonPicker from "../pages/HandCreator/components/PersonPicker";
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
  // Starred players only - see api/people.js's createPerson comment and
  // peopleController.js's createPerson: a person made from this modal is
  // created with starred: true specifically so they show up here.
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  useEffect(() => {
    if (!isOpen) return;
    setPeopleLoading(true);
    getPeoplePage({ page: 1, limit: 200, starred: true })
      .then(data => setPeople(Array.isArray(data?.players) ? data.players : []))
      .catch(err => console.error("Failed to fetch starred people:", err))
      .finally(() => setPeopleLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter") handleSaveChanges();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editFormData]);

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

  // Links opponent row `index` to an existing starred person (`personId`),
  // or back to its original session name when the picker is cleared
  // (PersonPicker's "— not linked —" option, id === null).
  const handleLink = (index, personId) => {
    const newOpponents = [...editFormData.opponents];
    const person = people.find(p => p._id === personId);
    newOpponents[index] = {
      ...newOpponents[index],
      current: person ? person.name : newOpponents[index].original,
      personId: person ? person._id : null
    };
    setEditFormData({ ...editFormData, opponents: newOpponents });
  };

  // Creates a new starred person from opponent row `index`'s picker, then
  // links that row to it - mirrors HandCreator's createAndLinkPerson.
  // Links directly off `created` rather than delegating to handleLink
  // (which looks the person up in `people`): the setPeople call just above
  // hasn't re-rendered yet, so `people` here would still be the pre-create
  // array and the lookup would silently miss.
  const handleCreatePersonForRow = async (index, name, file) => {
    try {
      let imageUrl = "";
      if (file) imageUrl = await uploadImage(file);

      const created = await createPerson({ name, image: imageUrl, starred: true });
      setPeople(prev => [...prev, created]);
      setEditFormData(prev => {
        const newOpponents = [...prev.opponents];
        newOpponents[index] = { ...newOpponents[index], current: created.name, personId: created._id };
        return { ...prev, opponents: newOpponents };
      });
      showStatus('success', `"${created.name}" created and starred`);
    } catch (error) {
      console.error("Error creating person:", error);
      showStatus('error', 'Failed to create person. Name might already exist.');
    }
  };

  const handleSaveChanges = async () => {
    try {
      const renameMap = {};
      editFormData.opponents.forEach((opp) => {
        if (opp.original !== opp.current) renameMap[opp.original] = opp.current;
      });

      const result = await updateSession(editFormData.id, {
        date: editFormData.date,
        gameType: editFormData.gameType,
        opponentRenames: renameMap,
        totalProfit: Number(editFormData.totalProfit),
      });
      if (onSave) onSave(result.hand || result);
      onClose();
    } catch (error) {
      console.error("Error saving changes", error);
      showStatus('error', 'There was an error saving changes');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="esl-overlay" onClick={onClose}>
      <div className="esl-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="esl-heading">Edit Session</h3>

        {statusMessage && (
          <div className={`esl-status esl-status--${statusMessage.type}`}>
            {statusMessage.type === 'success' ? <Check size={14} /> : <X size={14} />} {statusMessage.text}
          </div>
        )}

        <div className="esl-field">
          <label className="esl-label">Date</label>
          <input
            type="date"
            className="esl-input"
            value={editFormData.date}
            onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
          />
        </div>

        <div className="esl-field">
          <label className="esl-label">Game Type</label>
          <select
            className="esl-input"
            value={editFormData.gameType}
            onChange={(e) => setEditFormData({ ...editFormData, gameType: e.target.value })}
          >
            <option value="NLH">No Limit Hold'em (NLH)</option>
            <option value="PLO">Pot Limit Omaha (PLO)</option>
            <option value="Heads-Up">Heads-Up</option>
          </select>
        </div>

        <div className="esl-field">
          <label className="esl-label">Total Profit</label>
          <input
            type="number"
            className="esl-input"
            value={editFormData.totalProfit}
            onChange={(e) => setEditFormData({ ...editFormData, totalProfit: e.target.value })}
          />
        </div>

        {editFormData.opponents && editFormData.opponents.length > 0 && (
          <div className="esl-field">
            <label className="esl-label">Opponents</label>
            <p className="esl-hint">Link each name to one of your starred players, or create a new one.</p>
            <div className="esl-opponents">
              {editFormData.opponents.map((opp, index) => (
                <div key={index} className="esl-opponent-row">
                  <span className="esl-opponent-original">{opp.original}</span>
                  <PersonPicker
                    people={people}
                    peopleLoading={peopleLoading}
                    selectedId={opp.personId}
                    defaultName={opp.original}
                    onLink={(personId) => handleLink(index, personId)}
                    onCreate={(name, file) => handleCreatePersonForRow(index, name, file)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="esl-actions">
          <button className="esl-btn" onClick={onClose}>Cancel</button>
          <button className="esl-btn esl-btn--primary" onClick={handleSaveChanges}>Save</button>
        </div>
      </div>
    </div>
  );
}
