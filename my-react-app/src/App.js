import React, { useMemo, useState } from "react";
import Input from "./components/Input";
import Button from "./components/Button";
import Card from "./components/Card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartSimple,
  faBrain,
  faBookOpen,
  faClockRotateLeft,
  faCommentDots,
  faLayerGroup,
  faClock,
  faChevronDown,
  faChevronUp,
  faUpRightAndDownLeftFromCenter,
  faCircleInfo,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";

const getApiBase = () => {
  const viteApiUrl = import.meta?.env?.VITE_API_URL;

  if (viteApiUrl) {
    return viteApiUrl;
  }

  const reactApiUrl =
    typeof process !== "undefined" && process.env
      ? process.env.REACT_APP_API_URL
      : undefined;

  if (reactApiUrl) {
    return reactApiUrl;
  }

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (isLocalhost) {
    return "http://localhost:5000";
  }

  return "https://chronowords-apiv2.onrender.com";
};

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

const stripPosSuffix = (rawWord, pos) => {
  if (!rawWord) return "";

  const sepMatch = rawWord.match(/^(.*?)(__|_|-)([a-z]{1,4})$/i);
  if (sepMatch) return sepMatch[1];

  if (pos) {
    const lower = rawWord.toLowerCase();
    const posLower = String(pos).toLowerCase();

    if (lower.endsWith(posLower) && rawWord.length > posLower.length + 1) {
      return rawWord.slice(0, rawWord.length - posLower.length);
    }
  }

  return rawWord;
};

const SemanticChangeApp = () => {
  const [activePage, setActivePage] = useState("home");

  const [word, setWord] = useState("");
  const [searchWordForCurrentInput, setSearchWordForCurrentInput] = useState(null);

  const [wordForms, setWordForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);

  const inputWrapRef = React.useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const suppressSuggestRef = React.useRef(false);

  const [showAllAxes, setShowAllAxes] = useState(false);
  const [expandedAxisIds, setExpandedAxisIds] = useState(new Set());

  const debouncedWord = useDebouncedValue(word, 200);

  const resetSuggestions = () => {
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestionIdx(-1);
  };

  const fetchSemanticChange = async (overrideWord, displayWord) => {
    const query = (overrideWord ?? searchWordForCurrentInput ?? word)?.trim();
    if (!query) return;

    try {
      const API_BASE = getApiBase();

      const res = await fetch(`${API_BASE}/api/words/${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Word not found");

      const raw = await res.json();
      console.log("Fetched word:", query);
      console.log("Raw backend response:", raw);
      const data = Array.isArray(raw) ? raw : [raw];

      const forms = data.map((entry) => {
        const history = [
          { period: "1810–1860", usage: entry.total_examples?.t1 || 0 },
          { period: "1960–2010", usage: entry.total_examples?.t2 || 0 },
        ];

        return {
          word: entry.word,
          part_of_speech: entry.pos,
          semantic_change: entry.semantic_change,
          conclusion_t1: entry.conclusion_t1,
          conclusion_t2: entry.conclusion_t2,
          clusters: entry.clusters,
          total_examples: entry.total_examples,
          history,
          axes_explanation: entry.axes_explanation || [],
          axis_examples: entry.axis_examples || {},
          similar_drift_words: entry.similar_drift_words || [],
        };
      });

      setSearchWordForCurrentInput(query);
      setWord(displayWord ?? stripPosSuffix(query));
      setWordForms(forms);
      setSelectedForm(forms[0] || null);

      resetSuggestions();

      setShowAllAxes(false);
      setExpandedAxisIds(new Set());
    } catch (error) {
      console.error("Error fetching data:", error);

      setWordForms([]);
      setSelectedForm(null);
      resetSuggestions();
    }
  };

  React.useEffect(() => {
    if (suppressSuggestRef.current) {
      suppressSuggestRef.current = false;
      return;
    }

    const q = debouncedWord.trim();

    if (!q) {
      resetSuggestions();
      return;
    }

    const API_BASE = getApiBase();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/words/suggest?q=${encodeURIComponent(q)}&limit=10`
        );

        if (!res.ok) throw new Error("suggest failed");

        const data = await res.json();
        if (cancelled) return;

        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(Array.isArray(data) && data.length > 0);
        setActiveSuggestionIdx(-1);
      } catch (e) {
        if (cancelled) return;
        resetSuggestions();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedWord]);

  React.useEffect(() => {
    if (!showSuggestions) return;

    const updatePos = () => {
      const wrap = inputWrapRef.current;
      if (!wrap) return;

      const el = wrap.querySelector("input") || wrap;
      const r = el.getBoundingClientRect();

      setDropdownStyle({
        position: "fixed",
        left: r.left,
        top: r.bottom + 6,
        width: r.width,
        zIndex: 9999,
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        overflow: "hidden",
        maxHeight: 240,
        overflowY: "auto",
      });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);

    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [showSuggestions, suggestions.length]);

  const handleSimilarWordClick = (w) => {
    if (!w) return;

    const displayValue = stripPosSuffix(w.word ?? w, w.pos).trim();
    const searchValue = (w.word ?? w).trim();

    if (!searchValue) return;

    suppressSuggestRef.current = true;

    resetSuggestions();

    setSearchWordForCurrentInput(searchValue);
    setWord(displayValue);

    fetchSemanticChange(searchValue, displayValue);
  };

  const handlePickSuggestion = (sug) => {
    const searchValue = sug?.word?.trim();
    const displayValue = stripPosSuffix(sug?.word, sug?.pos).trim();

    if (!searchValue) return;

    suppressSuggestRef.current = true;

    resetSuggestions();

    setSearchWordForCurrentInput(searchValue);
    setWord(displayValue);

    fetchSemanticChange(searchValue, displayValue);
  };

  const handleInputKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") {
        fetchSemanticChange(searchWordForCurrentInput ?? word, word);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();

      const picked = suggestions[Math.max(activeSuggestionIdx, 0)];

      if (picked) handlePickSuggestion(picked);
      else fetchSemanticChange(searchWordForCurrentInput ?? word, word);
    } else if (e.key === "Escape") {
      resetSuggestions();
    }
  };

  const toggleAxisExpanded = (axisId) => {
    setExpandedAxisIds((prev) => {
      const next = new Set(prev);
      if (next.has(axisId)) next.delete(axisId);
      else next.add(axisId);
      return next;
    });
  };

  const totalAxesCount = selectedForm?.axes_explanation?.length || 0;

  const selectedAxes = useMemo(() => {
    const axes = selectedForm?.axes_explanation || [];
    const TOP_VISIBLE = 3;
    return showAllAxes ? axes : axes.slice(0, TOP_VISIBLE);
  }, [selectedForm, showAllAxes]);

  const axisShortLabel = (ax) => {
    const name = ax.axis_name?.trim();

    if (name && name.length <= 72) return name;
    if (name && name.length > 72) return `${name.slice(0, 72)}…`;

    const left = (ax.top_pos_words || []).slice(0, 3).join("/");
    const right = (ax.top_neg_words || []).slice(0, 3).join("/");

    return `${left || "—"} ↔ ${right || "—"}`;
  };

  const ScoreBar = ({ score }) => {
    const s = typeof score === "number" ? score : Number(score);
    const clamped = Number.isFinite(s) ? Math.max(-1, Math.min(1, s)) : 0;
    const pos = ((clamped + 1) / 2) * 100;

    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="flex items-center gap-1">
            <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} />
            axis score:
          </span>
          <span className="font-semibold text-gray-800">
            {Number.isFinite(s) ? s.toFixed(3) : score ?? "—"}
          </span>
        </div>

        <div className="relative h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gray-500/60" />
          <div
            className="absolute top-0 bottom-0 w-2 rounded-full bg-indigo-600"
            style={{ left: `calc(${pos}% - 0.25rem)` }}
          />
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>negative</span>
          <span>positive</span>
        </div>
      </div>
    );
  };

const PillList = ({ title, items }) => {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>

      {safeItems.length ? (
        <p className="text-sm text-gray-800 break-words">
          {safeItems.slice(0, 12).join(" - ")}
        </p>
      ) : (
        <p className="text-sm text-gray-500 italic">—</p>
      )}
    </div>
  );
};

  const ExampleList = ({ label, examples }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h5 className="text-md font-bold text-indigo-700 mb-3">{label}</h5>

      {examples?.length ? (
        <div className="space-y-3">
          {examples.slice(0, 6).map((ex, i) => (
            <div
              key={i}
              className="p-3 bg-gray-100 rounded-lg border-l-4 border-indigo-300 whitespace-pre-wrap break-words"
            >
              <p className="text-xs text-gray-500 mb-1">
                signed_score: {ex.signed_score?.toFixed?.(3) ?? ex.signed_score}
              </p>
              <p className="text-gray-800 italic leading-relaxed">"{ex.sentence}"</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 italic">No axis examples.</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-400 to-indigo-500 p-8">
      <div className="w-full max-w-3xl bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center space-y-6 mx-auto">
        <h1 className="text-5xl font-extrabold text-indigo-700 shadow-lg tracking-wide flex items-center">
          <FontAwesomeIcon icon={faClock} className="mr-4 text-indigo-600" />
          ChronoWords
        </h1>

        <div className="flex gap-3">
          <button
            onClick={() => setActivePage("home")}
            className={`px-4 py-2 rounded-xl border shadow-sm transition ${
              activePage === "home"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <FontAwesomeIcon icon={faHouse} className="mr-2" />
            Home
          </button>

          <button
            onClick={() => setActivePage("about")}
            className={`px-4 py-2 rounded-xl border shadow-sm transition ${
              activePage === "about"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <FontAwesomeIcon icon={faCircleInfo} className="mr-2" />
            About
          </button>
        </div>

        {activePage === "about" ? (
          <div className="w-full text-left bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-3xl font-bold text-indigo-700">What is ChronoWords?</h2>

            <p className="text-gray-700 leading-relaxed">
              ChronoWords is a semantic change explorer. It compares how a word is used in two time periods
              (1810–1860 vs 1960–2010) and surfaces interpretable signals of meaning shift.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xl font-semibold text-indigo-700 mb-3">
                What you see on the main page
              </h3>

              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <b>Change Score</b> — a normalized indicator of how much the word’s meaning changed between periods.
                </p>
                <p>
                  <b>Word Usage Over Time</b> — how many examples were analyzed in each period.
                </p>
                <p>
                  <b>Usage Examples (Clusters)</b> — sentences grouped by similar usage.
                </p>
                <p>
                  <b>Axis-based Explanation</b> — interpretable dimensions that separate contexts.
                </p>
                <p>
                  <b>Words with Similar Change</b> — other words that drifted in a similar way.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <div ref={inputWrapRef} className="w-full sm:w-3/4" style={{ width: "100%" }}>
                <Input
                  type="text"
                  placeholder="Enter a word..."
                  value={word}
                  onChange={(e) => {
                    suppressSuggestRef.current = false;
                    setSearchWordForCurrentInput(null);
                    setWord(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 120);
                  }}
                  onFocus={() => {
                    if (suggestions.length) setShowSuggestions(true);
                  }}
                  className="w-full p-4 border border-gray-300 rounded-xl shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500 text-lg text-center"
                />
              </div>

              <Button
                onClick={() => {
                  resetSuggestions();
                  fetchSemanticChange(searchWordForCurrentInput ?? word, word);
                }}
                className="w-full sm:w-1/4 p-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-800 transition-all text-lg"
              >
                Check
              </Button>
            </div>

            {showSuggestions && suggestions.length > 0 && dropdownStyle && (
              <div style={dropdownStyle}>
                {suggestions.map((s, idx) => {
                  const active = idx === activeSuggestionIdx;
                  const displayWord = stripPosSuffix(s.word, s.pos);

                  return (
                    <button
                      key={`${s.word}-${s.pos}-${idx}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickSuggestion(s)}
                      style={{
                        display: "flex",
                        width: "100%",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        border: "none",
                        borderBottom: "1px solid #f3f4f6",
                        background: active ? "#eef2ff" : "white",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{displayWord}</span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{s.pos}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {wordForms.length > 0 && (
              <div className="w-full flex flex-col items-center mt-2 space-y-2">
                <label className="text-gray-600 font-semibold text-lg">Part of Speech</label>

                <select
                  className={`w-1/2 p-3 border border-gray-300 rounded-xl shadow-lg bg-white text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500 ${
                    wordForms.length === 1 ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  onChange={(e) =>
                    setSelectedForm(wordForms.find((f) => f.part_of_speech === e.target.value))
                  }
                  value={selectedForm?.part_of_speech || ""}
                  disabled={wordForms.length === 1}
                >
                  {wordForms.map((form, index) => (
                    <option key={index} value={form.part_of_speech}>
                      {form.part_of_speech}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedForm && (
              <Card className="w-full max-w-3xl p-8 bg-gray-100 shadow-lg rounded-xl">
                <p className="text-xl font-semibold text-gray-700 flex items-center justify-center">
                  <FontAwesomeIcon icon={faBrain} className="text-indigo-600 text-xl mr-2" />
                  Change Score:
                  <span className="ml-2 font-bold text-indigo-500">
                    {Number.isFinite(Number(selectedForm.semantic_change?.normalized_score))
                      ? Number(selectedForm.semantic_change.normalized_score).toFixed(2)
                      : "N/A"}{" "}
                    –{" "}
                    {selectedForm.semantic_change?.change_category ?? "Unknown"}
                  </span>
                </p>

                <div className="mt-8 w-full flex flex-col items-center">
                  <h3 className="text-xl font-semibold text-gray-700 mt-4 flex items-center">
                    <FontAwesomeIcon icon={faChartSimple} className="text-indigo-600 text-2xl" />
                    <span className="ml-2">Word Usage Over Time</span>
                  </h3>

                  <div className="chart-container w-full">
                    <ResponsiveContainer width="100%" height={300} className="mx-auto">
                      <BarChart data={selectedForm.history}>
                        <XAxis dataKey="period" tick={{ fill: "#6b46c1", fontSize: 14 }} />
                        <YAxis tick={{ fill: "#6b46c1", fontSize: 14 }} />
                        <Tooltip />
                        <Bar
                          dataKey="usage"
                          fill="rgb(79, 70, 229)"
                          radius={[10, 10, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-10 w-full bg-white border-2 border-indigo-400 rounded-3xl shadow-xl px-6 py-8">
                  <h3 className="text-2xl font-bold text-indigo-700 flex items-center mb-4">
                    <FontAwesomeIcon icon={faBookOpen} className="text-indigo-600 text-xl mr-2" />
                    Usage Examples (Clusters)
                  </h3>

                  {["t1", "t2"].map((periodKey) => {
                    const clusters = selectedForm.clusters?.[periodKey];
                    const explanation =
                      periodKey === "t1" ? selectedForm.conclusion_t1 : selectedForm.conclusion_t2;
                    const label = periodKey === "t1" ? "1810–1860" : "1960–2010";

                    return (
                      <div
                        key={periodKey}
                        className="w-full bg-gray-50 border border-indigo-200 rounded-xl p-6 shadow-sm space-y-6 max-w-2xl mx-auto mb-6"
                      >
                        <h4 className="text-lg font-bold text-indigo-700 flex items-center">
                          <FontAwesomeIcon icon={faClockRotateLeft} className="text-indigo-500 text-md mr-2" />
                          Period: {label}
                        </h4>

                        <p className="text-sm text-pink-600 italic flex items-center">
                          <FontAwesomeIcon icon={faCommentDots} className="text-pink-600 mr-2" />
                          Explanation: {explanation || "No conclusion"}
                        </p>

                        {clusters &&
                          Object.entries(clusters).map(([clusterIdx, sentences]) => {
                            const safeSentences = Array.isArray(sentences) ? sentences : [];

                            return (
                              <div
                                key={clusterIdx}
                                className="p-4 bg-white border border-gray-300 rounded-xl shadow-sm"
                              >
                                <h5 className="text-md font-semibold text-indigo-600 mb-3 flex items-center">
                                  <FontAwesomeIcon icon={faLayerGroup} className="mr-2" />
                                  Cluster {clusterIdx}
                                </h5>

                                <div className="space-y-4">
                                  {safeSentences.length > 0 ? (
                                    safeSentences.map((sentence, i) => (
                                      <div
                                        key={i}
                                        className="p-3 bg-gray-100 rounded-lg border-l-4 border-indigo-300 text-left whitespace-pre-wrap break-words max-w-prose mx-auto"
                                      >
                                        <p className="text-gray-800 italic leading-relaxed">
                                          "{typeof sentence === "string" ? sentence : JSON.stringify(sentence)}"
                                        </p>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-gray-500 italic">No examples for this cluster.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-10 w-full bg-white border-2 border-indigo-400 rounded-3xl shadow-xl px-6 py-8">
                  <div className="w-full max-w-2xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <h3 className="text-2xl font-bold text-indigo-700 flex items-center">
                        <FontAwesomeIcon icon={faBrain} className="text-indigo-600 text-xl mr-2" />
                        Axis-based Explanation
                      </h3>

                      {totalAxesCount > 3 && (
                        <button
                          onClick={() => setShowAllAxes((v) => !v)}
                          className="px-4 py-2 bg-gray-50 border border-indigo-200 rounded-xl shadow-sm hover:bg-indigo-50 transition-all text-sm font-semibold text-indigo-700 w-fit"
                        >
                          <FontAwesomeIcon icon={showAllAxes ? faChevronUp : faChevronDown} className="mr-2" />
                          {showAllAxes ? "Show top 3" : `Show all (${totalAxesCount})`}
                        </button>
                      )}
                    </div>

                    {selectedForm.axes_explanation?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedAxes.map((ax, idx) => {
                          const axisId = ax.axis_id;
                          const isOpen = expandedAxisIds.has(axisId);
                          const examplesForAxis = selectedForm.axis_examples?.[axisId] || { t1: [], t2: [] };

                          return (
                            <div key={axisId} className="bg-gray-50 border border-indigo-200 rounded-2xl shadow-sm">
                              <button
                                onClick={() => toggleAxisExpanded(axisId)}
                                className="w-full text-left p-5 flex flex-col gap-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-indigo-700">
                                      #{idx + 1} • Axis {axisId}
                                    </p>
                                    <p className="text-base font-bold text-gray-900 leading-snug break-words">
                                      {axisShortLabel(ax)}
                                    </p>
                                  </div>

                                  <span className="text-sm font-semibold text-indigo-700 shrink-0">
                                    <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} className="mr-2" />
                                    {isOpen ? "Hide" : "Examples"}
                                  </span>
                                </div>

                                <ScoreBar score={ax.signed_projection} />
                              </button>

                              {isOpen && (
                                <div className="px-5 pb-5">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <PillList title="Positive side keywords" items={ax.top_pos_words || []} />
                                    <PillList title="Negative side keywords" items={ax.top_neg_words || []} />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ExampleList label="Examples (1810–1860)" examples={examplesForAxis.t1 || []} />
                                    <ExampleList label="Examples (1960–2010)" examples={examplesForAxis.t2 || []} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No axis explanation available.</p>
                    )}
                  </div>
                </div>

                <div className="mt-10 w-full bg-white border-2 border-indigo-400 rounded-3xl shadow-xl px-6 py-8">
                  <div className="w-full max-w-2xl mx-auto">
                    <h3 className="text-2xl font-bold text-indigo-700 flex items-center mb-4">
                      <FontAwesomeIcon icon={faLayerGroup} className="text-indigo-600 text-xl mr-2" />
                      Words with Similar Change
                    </h3>

                    {selectedForm.similar_drift_words?.length > 0 ? (
                      <div className="flex flex-wrap gap-3 justify-center">
                        {selectedForm.similar_drift_words.map((w, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSimilarWordClick(w)}
                            className="px-4 py-2 bg-gray-50 border border-indigo-200 rounded-xl shadow-sm hover:bg-indigo-50 transition-all text-left"
                            title="Click to search"
                          >
                            <p className="text-sm font-semibold text-indigo-700">
                              {stripPosSuffix(w.word, w.pos)}{" "}
                              <span className="text-gray-500">({w.pos})</span>
                            </p>
                            <p className="text-xs text-gray-600">
                              sim: {w.similarity?.toFixed?.(3) ?? w.similarity}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {w.method ? `method: ${w.method}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No similar-change suggestions available.</p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SemanticChangeApp;