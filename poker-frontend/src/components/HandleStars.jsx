import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { toggleFavourite } from "../api/favourites";

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
      const data = await toggleFavourite(hand._id);
      if (onToggle) onToggle(hand._id, data.isFavorited);
    } catch (err) {
      console.error("Failed to star", err);
      setIsStarred(!newStatus);  
    }
  };

  return (
    <button
      className="star-btn"
      onClick={handleStarClick}
      title={isStarred ? "Remove from favourites" : "Add to favourites"}
    >
      <Star size={16} fill={isStarred ? "currentColor" : "none"} />
    </button>
  );
}