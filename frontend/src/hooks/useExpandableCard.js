import { useState } from 'react';

// Shared "compact card that expands on click" mechanics used by RuleCard and
// MappingCard: in 'compact' viewMode the card starts collapsed and toggles on
// click (ignoring clicks on buttons/links inside it); in 'expanded' viewMode
// details are always shown and the card itself isn't clickable.
export function useExpandableCard(viewMode) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCompact = viewMode === 'compact';
  const shouldShowDetails = !isCompact || isExpanded;

  const handleCardClick = (e) => {
    if (!isCompact) return;
    if (e.target.closest('button') || e.target.closest('a')) return;
    setIsExpanded((prev) => !prev);
  };

  return { isExpanded, isCompact, shouldShowDetails, handleCardClick };
}
