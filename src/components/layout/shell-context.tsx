"use client";
import * as React from "react";

export interface ShellCtx {
  openPalette: () => void;
  openNewVideo: () => void;
}
export const ShellContext = React.createContext<ShellCtx>({ openPalette: () => {}, openNewVideo: () => {} });
export const useShell = () => React.useContext(ShellContext);
