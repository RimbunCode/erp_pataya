import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/Components/ui/command";
import React, { memo } from "react";
import { router } from "@inertiajs/react";

import axios from "axios";
import useTheme from "@/Hooks/useTheme";

const DEFAULT_COMMAND_RESULTS = {
  navigation: [],
  documents: [],
  recent: [],
  meta: {
    intent: {
      is_scoped: false,
      doctype_model: null,
      doctype_token: null,
      code_tokens: [],
      prioritize_documents: false,
    },
  },
};

const THEME_COMMANDS = [
  {
    key: "theme-light",
    label: "Light",
    value: "light",
    keywords: ["theme", "light", "terang", "siang"],
  },
  {
    key: "theme-dark",
    label: "Dark",
    value: "dark",
    keywords: ["theme", "dark", "gelap", "night", "malam"],
  },
  {
    key: "theme-system",
    label: "System",
    value: "system",
    keywords: ["theme", "system", "default", "auto"],
  },
];

const normalizeSearch = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreThemeCommand = (query, command) => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return 0;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const keywords = [...command.keywords, command.label, command.value].map(
    normalizeSearch,
  );
  const searchText = keywords.join(" ");

  let score = 0;
  if (normalizedQuery === "theme") {
    score += 240;
  }
  if (normalizedQuery === normalizeSearch(command.value)) {
    score += 220;
  }
  if (normalizedQuery === normalizeSearch(command.label)) {
    score += 200;
  }
  if (keywords.some((keyword) => keyword === normalizedQuery)) {
    score += 180;
  }
  if (searchText.includes(normalizedQuery)) {
    score += 120;
  }

  queryTokens.forEach((token) => {
    if (token === "theme") {
      score += 70;
    }
    if (keywords.some((keyword) => keyword === token)) {
      score += 110;
    } else if (searchText.includes(token)) {
      score += 50;
    }
  });

  return score;
};

const ThemeIcon = ({ value }) => {
  if (value === "light") {
    return (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
        className="size-6"
      >
        <path
          fillRule="evenodd"
          d="M13 3a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0V3ZM6.343 4.929A1 1 0 0 0 4.93 6.343l1.414 1.414a1 1 0 0 0 1.414-1.414L6.343 4.929Zm12.728 1.414a1 1 0 0 0-1.414-1.414l-1.414 1.414a1 1 0 0 0 1.414 1.414l1.414-1.414ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-9 4a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H3Zm16 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2ZM7.757 17.657a1 1 0 1 0-1.414-1.414l-1.414 1.414a1 1 0 1 0 1.414 1.414l1.414-1.414Zm9.9-1.414a1 1 0 0 0-1.414 1.414l1.414 1.414a1 1 0 0 0 1.414-1.414l-1.414-1.414ZM13 19a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (value === "dark") {
    return (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
        className="size-6"
      >
        <path
          fillRule="evenodd"
          d="M11.675 2.015a.998.998 0 0 0-.403.011C6.09 2.4 2 6.722 2 12c0 5.523 4.477 10 10 10 4.356 0 8.058-2.784 9.43-6.667a1 1 0 0 0-1.02-1.33c-.08.006-.105.005-.127.005h-.001l-.028-.002A5.227 5.227 0 0 0 20 14a8 8 0 0 1-8-8c0-.952.121-1.752.404-2.558a.996.996 0 0 0 .096-.428V3a1 1 0 0 0-.825-.985Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-6"
    >
      <path
        fill="currentColor"
        d="M10.85 12.65h2.3L12 9zM20 8.69V4h-4.69L12 .69L8.69 4H4v4.69L.69 12L4 15.31V20h4.69L12 23.31L15.31 20H20v-4.69L23.31 12zM14.3 16l-.7-2h-3.2l-.7 2H7.8L11 7h2l3.2 9z"
      />
    </svg>
  );
};

const CommandKindIcon = ({ type }) => {
  if (type === "record") {
    return (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="size-5"
      >
        <path
          fill="currentColor"
          d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 2zm6 1.5V8h4.5z"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-5"
    >
      <path
        fill="currentColor"
        d="M3 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v6.5a1.5 1.5 0 0 0 1.5 1.5H22v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      />
      <path
        fill="currentColor"
        d="M15.5 11a3.5 3.5 0 0 1 0-7h3a2 2 0 0 1 2 2v5z"
      />
    </svg>
  );
};

export default memo(function GlobalCommandPalette({ onRegisterOpenTrigger }) {
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [commandResults, setCommandResults] = React.useState(
    DEFAULT_COMMAND_RESULTS,
  );
  const { setTheme } = useTheme();
  const hasSearchQuery = searchQuery.trim() !== "";

  const toggleSearch = React.useCallback(() => {
    setShowSearch((open) => !open);
  }, []);

  React.useEffect(() => {
    onRegisterOpenTrigger?.(toggleSearch);
    return () => {
      onRegisterOpenTrigger?.(null);
    };
  }, [onRegisterOpenTrigger, toggleSearch]);

  const runCommand = React.useCallback((callback) => {
    setShowSearch(false);
    callback?.();
  }, []);

  const refreshSearchResults = React.useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const trackRecentCommand = React.useCallback(async (command) => {
    if (!command?.route_name || !command?.url) {
      return;
    }

    try {
      await axios.post(route("commands.recent.track"), {
        command: {
          signature: command.signature ?? null,
          type: command.type ?? null,
          title: command.title ?? null,
          subtitle: command.subtitle ?? null,
          route_name: command.route_name ?? null,
          route_params: command.route_params ?? {},
          target_model_type: command.target_model_type ?? null,
          target_model_id: command.target_model_id ?? null,
          source_model_type: command.source_model_type ?? null,
          source_model_id: command.source_model_id ?? null,
        },
      });
    } catch {
      // Track recent tidak boleh menghalangi navigasi utama command.
    }
  }, []);

  const handleSelectCommand = React.useCallback(
    (command) => {
      runCommand(() => {
        void trackRecentCommand(command);
        if (command?.url) {
          router.visit(command.url);
        }
      });
    },
    [runCommand, trackRecentCommand],
  );

  const handleRemoveRecent = React.useCallback(
    async (recentKey) => {
      if (!recentKey) {
        return;
      }

      const currentRows = commandResults?.recent ?? [];
      setCommandResults((prev) => ({
        ...prev,
        recent: (prev?.recent ?? []).filter(
          (item) => item.recent_key !== recentKey,
        ),
      }));

      try {
        await axios.delete(route("commands.recent.remove"), {
          data: {
            recent_key: recentKey,
          },
        });
      } catch {
        setCommandResults((prev) => ({
          ...prev,
          recent: currentRows,
        }));
      } finally {
        if (!hasSearchQuery) {
          refreshSearchResults();
        }
      }
    },
    [commandResults?.recent, hasSearchQuery, refreshSearchResults],
  );

  const handleClearAllRecent = React.useCallback(() => {
    runCommand(async () => {
      try {
        await axios.delete(route("commands.recent.remove"));
      } finally {
        refreshSearchResults();
      }
    });
  }, [refreshSearchResults, runCommand]);

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
        toggleSearch();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggleSearch]);

  React.useEffect(() => {
    if (!showSearch) {
      setSearchQuery("");
    }
  }, [showSearch]);

  React.useEffect(() => {
    if (!showSearch) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await axios.get(route("commands.search"), {
          signal: controller.signal,
          params: {
            q: searchQuery,
            limit: 30,
          },
        });

        setCommandResults(response?.data?.data ?? DEFAULT_COMMAND_RESULTS);
      } catch (error) {
        if (error?.name !== "CanceledError") {
          setCommandResults(DEFAULT_COMMAND_RESULTS);
        }
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refreshKey, searchQuery, showSearch]);

  const hasNavigationResults = commandResults.navigation.length > 0;
  const hasDocumentResults = commandResults.documents.length > 0;
  const hasRecentResults = commandResults.recent.length > 0;
  const prioritizeDocuments =
    hasSearchQuery &&
    Boolean(commandResults?.meta?.intent?.prioritize_documents);
  const rankedThemeResults = React.useMemo(() => {
    if (!hasSearchQuery) {
      return THEME_COMMANDS;
    }

    const ranked = THEME_COMMANDS.map((item) => ({
      ...item,
      score: scoreThemeCommand(searchQuery, item),
    }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    return ranked;
  }, [hasSearchQuery, searchQuery]);
  const hasThemeResults = rankedThemeResults.length > 0;

  const shouldShowResultSeparator =
    hasSearchQuery &&
    (hasNavigationResults || hasDocumentResults || hasThemeResults);

  return (
    <CommandDialog
      open={showSearch}
      onOpenChange={setShowSearch}
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput
        placeholder="Type a command or search..."
        className="outline-0! border-0! shadow-none! ring-0!"
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? "Searching..." : "No results found."}
        </CommandEmpty>
        {shouldShowResultSeparator && <CommandSeparator />}
        {hasSearchQuery && hasThemeResults && (
          <CommandGroup heading="Theme">
            {rankedThemeResults.map((themeCommand) => (
              <CommandItem
                key={themeCommand.key}
                value={`${themeCommand.key}-${themeCommand.label}`}
                onSelect={() => runCommand(() => setTheme(themeCommand.value))}
              >
                <ThemeIcon value={themeCommand.value} />
                {themeCommand.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {prioritizeDocuments && hasDocumentResults && (
          <CommandGroup heading="Documents">
            {commandResults.documents.map((command) => (
              <CommandItem
                key={command.signature}
                value={`record-${command.title}-${command.subtitle ?? ""}-${command.signature}`}
                onSelect={() => handleSelectCommand(command)}
              >
                <CommandKindIcon type="record" />
                <div className="flex flex-col gap-0.5">
                  <span>{command.title}</span>
                  {command.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {command.subtitle}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {hasNavigationResults && (
          <CommandGroup heading="Navigation">
            {commandResults.navigation.map((command) => (
              <CommandItem
                key={command.signature}
                value={`navigation-${command.title}-${command.subtitle ?? ""}-${command.signature}`}
                onSelect={() => handleSelectCommand(command)}
              >
                <CommandKindIcon type="navigation" />
                <div className="flex flex-col gap-0.5">
                  <span>{command.title}</span>
                  {command.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {command.subtitle}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!prioritizeDocuments && hasDocumentResults && (
          <CommandGroup heading="Documents">
            {commandResults.documents.map((command) => (
              <CommandItem
                key={command.signature}
                value={`record-${command.title}-${command.subtitle ?? ""}-${command.signature}`}
                onSelect={() => handleSelectCommand(command)}
              >
                <CommandKindIcon type="record" />
                <div className="flex flex-col gap-0.5">
                  <span>{command.title}</span>
                  {command.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {command.subtitle}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!hasSearchQuery && (
          <>
            <CommandSeparator />
            {hasRecentResults && (
              <CommandGroup heading="Recent">
                {commandResults.recent.map((command) => (
                  <CommandItem
                    key={command.recent_key}
                    value={`recent-${command.title}-${command.subtitle ?? ""}-${command.recent_key}`}
                    onSelect={() => handleSelectCommand(command)}
                  >
                    <CommandKindIcon type={command.type} />
                    <div className="flex flex-col flex-1 gap-0.5">
                      <span>{command.title}</span>
                      {command.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {command.subtitle}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${command.title} from recent`}
                      className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleRemoveRecent(command.recent_key);
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="size-4"
                      >
                        <path
                          fill="currentColor"
                          d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"
                        />
                      </svg>
                    </button>
                  </CommandItem>
                ))}
                <CommandItem
                  value="recent-clear-all"
                  onSelect={handleClearAllRecent}
                >
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="size-5"
                  >
                    <path
                      fill="currentColor"
                      d="M9 3h6l1 1h4v2H4V4h4zm1 6h2v8h-2zm4 0h2v8h-2zM7 9h2v8H7zm-1 12h12a2 2 0 0 0 2-2V8H4v11a2 2 0 0 0 2 2"
                    />
                  </svg>
                  Clear All Recent
                  <CommandShortcut>Soft</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Theme">
              {THEME_COMMANDS.map((themeCommand) => (
                <CommandItem
                  key={themeCommand.key}
                  value={themeCommand.key}
                  onSelect={() =>
                    runCommand(() => setTheme(themeCommand.value))
                  }
                >
                  <ThemeIcon value={themeCommand.value} />
                  {themeCommand.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
});
