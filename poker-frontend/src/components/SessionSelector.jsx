import './SessionSelector.css';

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SessionSelector({ sessions, disabledSessions, onToggle, onToggleAll }) {
    const activeCount = sessions.filter(s => !disabledSessions.has(s._id)).length;

    console.log('[SessionSelector] sessions:', sessions.length, sessions[0]);

    return (
        <div className="session-panel">
            <div className="session-panel-header">
                <span className="session-panel-title">
                    Sessions <span className="session-panel-count">({activeCount}/{sessions.length})</span>
                </span>
                <div className="session-panel-actions">
                    <button onClick={() => onToggleAll(true)}>Select All</button>
                    <button onClick={() => onToggleAll(false)}>Deselect All</button>
                </div>
            </div>
            <div className="session-list">
                {sessions.length === 0 && (
                    <p className="session-empty">No sessions match current filters.</p>
                )}
                {sessions.map(session => {
                    const id = session._id ?? session.id;
                    const enabled = !disabledSessions.has(id);
                    const handCount = session.hands?.length ?? 0;
                    return (
                        <div
                            key={id}
                            className={`session-row ${enabled ? 'enabled' : 'disabled'}`}
                            onClick={() => onToggle(id)}
                        >
                            <div className={`session-checkbox ${enabled ? 'checked' : ''}`}>
                                {enabled && '✓'}
                            </div>
                            <div className="session-row-info">
                                <span className="session-row-date">{formatDate(session.date)}</span>
                                <span className="session-row-type">{session.gameType ?? session.type ?? '—'}</span>
                            </div>
                            <span className="session-row-hands">{handCount} hands</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}