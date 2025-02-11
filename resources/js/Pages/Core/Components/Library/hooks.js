import { createContext, useContext } from "react";

export const LibraryContext = createContext();
export const useLibrary = () => useContext(LibraryContext);
