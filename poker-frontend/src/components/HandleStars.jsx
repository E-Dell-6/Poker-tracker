import { useState, useEffect } from "react";
import { API_URL } from "../config";

export function HandleStars({ hand, isStarred: initialIsStarred, onToggle }) {
  const [isStarred, setIsStarred] = useState(initialIsStarred);

  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [initialIsStarred]);

  const handleStarClick = async (e) => {
    e.stopPropagation();

    const newStatus = !isStarred;
    setIsStarred(newStatus);

    try {
      const response = await fetch(`${API_URL}/api/favourites/${hand._id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to toggle favourite");

      const data = await response.json();
      if (onToggle) onToggle(hand._id, data.isFavorited);
    } catch (err) {
      console.error("Failed to star", err);
      setIsStarred(!newStatus); // Revert UI if API fails
    }
  };

  return (
    <button
      className="star-btn"
      onClick={handleStarClick}
      title={isStarred ? "Remove from favourites" : "Add to favourites"}
    >
      {isStarred ? '⭐' : '☆'}
    </button>
  );
}