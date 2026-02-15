"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { DisplayMode, User, AvatarStyle } from "@/types";

interface ModeContextValue {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
  agentName: string;
  setAgentName: (name: string) => void;
  avatarStyle: AvatarStyle;
  setAvatarStyle: (style: AvatarStyle) => void;
  avatarColor: string;
  setAvatarColor: (color: string) => void;
  isFun: boolean;
  // Returns the appropriate label based on mode
  label: (fun: string, professional: string) => string;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: Partial<User>;
}) {
  const [mode, setMode] = useState<DisplayMode>(
    initialUser?.display_mode || "fun"
  );
  const [agentName, setAgentName] = useState(
    initialUser?.agent_name || "Mrs. Claws"
  );
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(
    initialUser?.avatar_style || "lobster"
  );
  const [avatarColor, setAvatarColor] = useState(
    initialUser?.avatar_color || "#FF6B6B"
  );

  const isFun = mode === "fun";

  const label = useCallback(
    (fun: string, professional: string) => (isFun ? fun : professional),
    [isFun]
  );

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        agentName,
        setAgentName,
        avatarStyle,
        setAvatarStyle,
        avatarColor,
        setAvatarColor,
        isFun,
        label,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
