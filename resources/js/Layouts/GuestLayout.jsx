import React, {
  createContext,
  forwardRef,
  memo as GuestLayout,
  useContext,
  useMemo,
  useState,
} from "react";
import MasterLayout from "./MasterLayout";
import { cn } from "@/lib/utils";
import useTheme from "@/Hooks/useTheme";
import NavbarGuest from "@/Components/Navbar/NavbarGuest";
import { SiteFooter } from "@/Pages/Guest/Footer";
import RolesSelectionModal from "@/Components/Modals/LoginModal";
import RegisterModal from "@/Components/Modals/RegisterModal";
import { router, usePage } from "@inertiajs/react";
import { buildGuestThemeStyle } from "@/lib/guestTheme";
import { GuestLiveEditorProvider } from "@/Pages/Guest/LiveEditor/GuestLiveEditorContext";
import GuestLiveEditorPanel from "@/Pages/Guest/LiveEditor/GuestLiveEditorPanel";

export const RolesSelectionModalContext = createContext(null);
export const RegisterModalContext = createContext(null);

export function useRolesSelectionModal() {
  return useContext(RolesSelectionModalContext);
}
export function useRegisterModal() {
  return useContext(RegisterModalContext);
}

export default GuestLayout(
  forwardRef(function AppLayout(
    { className, actions, children, ...props },
    ref,
  ) {
    const { content = {}, liveEditor = {} } = usePage().props;
    const [_showSearch, setShowSearch] = React.useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const { _setTheme } = useTheme();
    const pageKey = liveEditor?.pageKey ?? "home";
    const guestThemeStyle = useMemo(
      () => buildGuestThemeStyle(content),
      [content],
    );
    React.useEffect(() => {
      const down = (e) => {
        if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
          if (
            (e.target instanceof HTMLElement && e.target.isContentEditable) ||
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement
          ) {
            return;
          }
          e.preventDefault();
          setShowSearch((open) => !open);
        }
      };

      document.addEventListener("keydown", down);
      return () => document.removeEventListener("keydown", down);
    }, []);
    const handleLogout = () => router.post("/logout");
    return (
      <RolesSelectionModalContext.Provider value={() => setShowLogin(true)}>
        <RegisterModalContext.Provider value={() => setShowRegister(true)}>
          <GuestLiveEditorProvider content={content} pageKey={pageKey}>
            <MasterLayout>
              <div
                className="relative mx-auto max-w-full print:hidden dark:bg-gray-900 bg-background text-foreground"
                style={guestThemeStyle}
              >
                <NavbarGuest
                  actions={actions}
                  setShowSearch={setShowSearch}
                  onLogout={handleLogout}
                />
                <div
                  ref={ref}
                  {...props}
                  className={cn(
                    "relative flex flex-col flex-1 max-h-full p-0 overflow-y-auto",
                    className,
                  )}
                >
                  {children}
                </div>
              </div>
              <SiteFooter />
              <GuestLiveEditorPanel />
              {showLogin && (
                <RolesSelectionModal
                  onClose={() => setShowLogin(false)}
                  onSwitchToRegister={() => {
                    setShowLogin(false);
                    setShowRegister(true);
                  }}
                />
              )}
              {showRegister && (
                <RegisterModal
                  onClose={() => setShowRegister(false)}
                  onSwitchToLogin={() => {
                    setShowRegister(false);
                    setShowLogin(true);
                  }}
                />
              )}
            </MasterLayout>
          </GuestLiveEditorProvider>
        </RegisterModalContext.Provider>
      </RolesSelectionModalContext.Provider>
    );
  }),
);
