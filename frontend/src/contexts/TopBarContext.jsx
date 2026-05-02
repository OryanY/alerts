import { createContext, useContext } from 'react';

export const TopBarContext = createContext({
  slots: {},
  setTopBarSlots: () => {},
  clearTopBarSlots: () => {},
});

export const useTopBar = () => useContext(TopBarContext);
