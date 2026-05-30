import axios from "axios";
import { router, usePage } from "@inertiajs/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { textToTiptapDoc } from "@/lib/tiptapContent";
import {
  addListItemByPath,
  cloneValue,
  getByPath,
  removeListItemByPath,
  setByPath,
} from "@/lib/guestContentDraft";
import {
  HOME_ADS_PATH,
  HOME_TRUSTED_COMPANIES_PATH,
} from "@/lib/guestLiveEditorConfig";

const GuestLiveEditorContext = createContext(null);

function createDefaultAdItem() {
  return {
    enabled: false,
    title: textToTiptapDoc("TRAINING PARTNER PROMO"),
    description: textToTiptapDoc(
      "Promosikan program atau partner strategis di area home page.",
    ),
    imageFileId: null,
    ctaLabel: textToTiptapDoc("LEARN MORE"),
    url: "",
    openInNewTab: true,
  };
}

function createDefaultTrustedCompany() {
  return textToTiptapDoc("NEW PARTNER");
}

export function GuestLiveEditorProvider({
  children,
  content = {},
  pageKey = "home",
}) {
  const { liveEditor = {} } = usePage().props;
  const isLiveEditEnabled = Boolean(liveEditor?.enabled);

  const [draftContent, setDraftContent] = useState(() => cloneValue(content));
  const [selectedPath, setSelectedPath] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(isLiveEditEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    setDraftContent(cloneValue(content));
  }, [content]);

  useEffect(() => {
    if (isLiveEditEnabled) {
      setIsPanelOpen(true);
      return;
    }

    setSelectedPath(null);
    setIsPanelOpen(false);
  }, [isLiveEditEnabled, pageKey]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draftContent) !== JSON.stringify(content),
    [content, draftContent],
  );

  const setFieldValue = (path, value) => {
    setDraftContent((previousValue) => setByPath(previousValue, path, value));
  };

  const addAdItem = () => {
    setDraftContent((previousValue) =>
      addListItemByPath(previousValue, HOME_ADS_PATH, createDefaultAdItem()),
    );
  };

  const removeAdItem = (indexToRemove) => {
    setDraftContent((previousValue) => {
      const existingItems = getByPath(previousValue, HOME_ADS_PATH);
      const listLength = Array.isArray(existingItems)
        ? existingItems.length
        : 0;

      if (listLength <= 1) {
        return previousValue;
      }

      return removeListItemByPath(previousValue, HOME_ADS_PATH, indexToRemove);
    });
  };

  const addTrustedCompany = () => {
    setDraftContent((previousValue) =>
      addListItemByPath(
        previousValue,
        HOME_TRUSTED_COMPANIES_PATH,
        createDefaultTrustedCompany(),
      ),
    );
  };

  const removeTrustedCompany = (indexToRemove) => {
    setDraftContent((previousValue) => {
      const existingItems = getByPath(
        previousValue,
        HOME_TRUSTED_COMPANIES_PATH,
      );
      const listLength = Array.isArray(existingItems)
        ? existingItems.length
        : 0;

      if (listLength <= 1) {
        return previousValue;
      }

      return removeListItemByPath(
        previousValue,
        HOME_TRUSTED_COMPANIES_PATH,
        indexToRemove,
      );
    });
  };

  const uploadImage = async (file) => {
    if (!isLiveEditEnabled || !liveEditor?.uploadRoute) {
      return null;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(liveEditor.uploadRoute, formData);
      const payload = response?.data ?? null;

      if (!payload?.id) {
        throw new Error("Invalid upload response");
      }

      return payload;
    } catch (_error) {
      toast.error("Gagal mengunggah gambar.");
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = () => {
    if (!isLiveEditEnabled || isSaving || !hasUnsavedChanges) {
      return;
    }

    setIsSaving(true);

    router.patch(
      liveEditor.saveRoute,
      { content: draftContent },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
          toast.success("Landing page berhasil diperbarui.");
        },
        onError: () => {
          toast.error("Gagal menyimpan perubahan.");
        },
        onFinish: () => {
          setIsSaving(false);
        },
      },
    );
  };

  const contextValue = {
    isLiveEditEnabled,
    liveEditor,
    pageKey,
    draftContent,
    selectedPath,
    isPanelOpen,
    isSaving,
    isUploadingImage,
    hasUnsavedChanges,
    setSelectedPath,
    setIsPanelOpen,
    setFieldValue,
    handleSave,
    uploadImage,
    addAdItem,
    removeAdItem,
    addTrustedCompany,
    removeTrustedCompany,
  };

  return (
    <GuestLiveEditorContext.Provider value={contextValue}>
      {children}
    </GuestLiveEditorContext.Provider>
  );
}

export function useGuestLiveEditor() {
  const contextValue = useContext(GuestLiveEditorContext);

  if (!contextValue) {
    throw new Error(
      "useGuestLiveEditor must be used inside GuestLiveEditorProvider.",
    );
  }

  return contextValue;
}

export function useGuestLiveContent(content = {}) {
  const { isLiveEditEnabled, draftContent } = useGuestLiveEditor();

  if (isLiveEditEnabled) {
    return draftContent;
  }

  return content;
}

export function LiveEditableText({
  path,
  as: Component = "span",
  className,
  children,
  disableSelection = false,
  ...props
}) {
  const { isLiveEditEnabled, selectedPath, setSelectedPath, setIsPanelOpen } =
    useGuestLiveEditor();

  if (!isLiveEditEnabled || disableSelection) {
    return (
      <Component className={className} {...props}>
        {children}
      </Component>
    );
  }

  const isSelected = selectedPath === path;

  return (
    <Component
      className={cn(
        className,
        "cursor-pointer rounded-md transition-shadow",
        "outline outline-1 outline-offset-2 outline-dashed outline-primary/25 hover:outline-primary/50",
        isSelected && "outline-primary ring-2 ring-primary/20",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedPath(path);
        setIsPanelOpen(true);
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
