import React, { useMemo, useState } from "react";
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

const getPeriodLabels = (entry = {}) => {
  const rawLabels = entry.period_labels || entry.periodLabels || {};

  const t1 =
    rawLabels.t1 ||
    rawLabels.T1 ||
    entry.period_label_t1 ||
    entry.periodLabelT1 ||
    entry.t1_label ||
    entry.t1Label ||
    "T1";

  const t2 =
    rawLabels.t2 ||
    rawLabels.T2 ||
    entry.period_label_t2 ||
    entry.periodLabelT2 ||
    entry.t2_label ||
    entry.t2Label ||
    "T2";

  return { t1, t2 };
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)",
    padding: "32px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  shell: {
    width: "100%",
    maxWidth: "980px",
    background: "white",
    borderRadius: "28px",
    padding: "36px",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
    textAlign: "center",
    boxSizing: "border-box",
  },

  title: {
    margin: 0,
    fontSize: "44px",
    fontWeight: 900,
    color: "#4338ca",
    letterSpacing: "-1px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
  },

  nav: {
    marginTop: "24px",
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  navButton: {
    padding: "10px 18px",
    borderRadius: "999px",
    border: "1px solid #c7d2fe",
    background: "white",
    color: "#374151",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
    transition: "0.2s ease",
  },

  navButtonActive: {
    padding: "10px 18px",
    borderRadius: "999px",
    border: "1px solid #4f46e5",
    background: "#4f46e5",
    color: "white",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(79, 70, 229, 0.28)",
    transition: "0.2s ease",
  },

  searchOuter: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: "28px",
  },

  searchRow: {
    width: "620px",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "12px",
  },

  inputWrap: {
    flex: 1,
    minWidth: 0,
  },

  input: {
    width: "100%",
    height: "48px",
    padding: "0 18px",
    border: "1px solid #c7d2fe",
    borderRadius: "14px",
    fontSize: "17px",
    boxSizing: "border-box",
    outline: "none",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
  },

  primaryButton: {
    height: "48px",
    padding: "0 26px",
    backgroundColor: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: "14px",
    fontSize: "17px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 10px 22px rgba(79, 70, 229, 0.32)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.45)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    display: "inline-block",
    marginRight: "8px",
    verticalAlign: "middle",
    animation: "chronoSpin 0.8s linear infinite",
  },

  aboutBox: {
    marginTop: "28px",
    width: "100%",
    textAlign: "left",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "28px",
    boxSizing: "border-box",
  },

  aboutTitle: {
    marginTop: 0,
    marginBottom: "14px",
    color: "#4338ca",
    fontSize: "30px",
    fontWeight: 900,
  },

  aboutCard: {
    marginTop: "20px",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "22px",
  },

  resultCard: {
    marginTop: "32px",
    width: "100%",
    background: "transparent",
    borderRadius: "0",
    padding: "0",
    boxSizing: "border-box",
    boxShadow: "none",
  },

  section: {
    marginTop: "28px",
    width: "100%",
    background: "white",
    border: "1px solid #c7d2fe",
    borderRadius: "24px",
    padding: "26px",
    boxSizing: "border-box",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    color: "#4338ca",
    fontSize: "24px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  smallCard: {
    background: "#f8fafc",
    border: "1px solid #c7d2fe",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "18px",
    textAlign: "left",
  },

  exampleCard: {
    background: "#f3f4f6",
    borderLeft: "4px solid #818cf8",
    borderRadius: "12px",
    padding: "14px",
    marginTop: "12px",
    textAlign: "left",
    overflowWrap: "break-word",
  },

  chipButton: {
    padding: "12px 16px",
    background: "#f8fafc",
    border: "1px solid #c7d2fe",
    borderRadius: "14px",
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
    textAlign: "left",
  },
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

  const [isSearching, setIsSearching] = useState(false);
  const searchInFlightRef = React.useRef(false);

  // Sense Explorer state
  const [senseWord, setSenseWord] = useState("power");
  const [sensePos, setSensePos] = useState("nn");
  const [senseDescription, setSenseDescription] = useState(
    "energy or electricity produced from wind, solar, hydro or nuclear sources"
  );
  const [senseKeywords, setSenseKeywords] = useState(
    "energy, electricity, wind, solar, hydro, nuclear"
  );
  const [senseResult, setSenseResult] = useState(null);
  const [isExploringSense, setIsExploringSense] = useState(false);
  const [senseError, setSenseError] = useState("");

  const debouncedWord = useDebouncedValue(word, 300);

  const resetSuggestions = () => {
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestionIdx(-1);
  };

  const fetchSemanticChange = async (overrideWord, displayWord) => {
    const query = (overrideWord ?? searchWordForCurrentInput ?? word)?.trim();
    if (!query) return;

    if (searchInFlightRef.current) return;

    searchInFlightRef.current = true;
    setIsSearching(true);
    resetSuggestions();

    try {
      const API_BASE = getApiBase();

      const res = await fetch(`${API_BASE}/api/words/${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Word not found");

      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [raw];

      const forms = data.map((entry) => {
        const periodLabels = getPeriodLabels(entry);
        const totalExamples = entry.total_examples || { t1: 0, t2: 0 };

        const history = [
          {
            period: periodLabels.t1,
            usage: totalExamples.t1 ?? 0,
          },
          {
            period: periodLabels.t2,
            usage: totalExamples.t2 ?? 0,
          },
        ];

        return {
          word: entry.word,
          part_of_speech: entry.pos,
          semantic_change: entry.semantic_change,

          conclusion_t1: entry.conclusion_t1,
          conclusion_t2: entry.conclusion_t2,

          clusters: entry.clusters || {},
          total_examples: totalExamples,

          period_labels: periodLabels,
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

      setShowAllAxes(false);
      setExpandedAxisIds(new Set());
    } catch (error) {
      console.error("Error fetching data:", error);

      setWordForms([]);
      setSelectedForm(null);
      resetSuggestions();
    } finally {
      searchInFlightRef.current = false;
      setIsSearching(false);
    }
  };

  React.useEffect(() => {
    if (suppressSuggestRef.current) {
      suppressSuggestRef.current = false;
      return;
    }

    const q = debouncedWord.trim();

    if (!q || q.length < 2) {
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

        if (!res.ok) {
          resetSuggestions();
          return;
        }

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
        top: r.bottom + 8,
        width: r.width,
        zIndex: 9999,
        background: "white",
        border: "1px solid #c7d2fe",
        borderRadius: 14,
        boxShadow: "0 16px 40px rgba(15,23,42,0.16)",
        overflow: "hidden",
        maxHeight: 260,
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
    if (searchInFlightRef.current) return;
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
    if (searchInFlightRef.current) return;

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
    if (searchInFlightRef.current) return;

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

  const cleanDisplaySentence = (sentence) => {
    return String(sentence || "")
      .replaceAll("_nn", "")
      .replaceAll("_vb", "")
      .replaceAll("_adj", "")
      .replaceAll("_adv", "");
  };

  const getMatchStrength = (score) => {
    const s = Number(score);

    if (!Number.isFinite(s)) return "unknown";
    if (s >= 0.6) return "strong match";
    if (s >= 0.35) return "moderate match";
    return "weak match";
  };

  const getBestScore = (items = []) => {
    if (!items.length) return 0;
    return Math.max(...items.map((item) => Number(item.similarity) || 0));
  };

  const buildSenseVerdict = (result) => {
    if (!result?.matches) return "";

    if (result.has_enough_evidence === false) {
      return "Not enough evidence was found for this proposed sense.";
    }

    const t1Best = getBestScore(result.matches.t1 || []);
    const t2Best = getBestScore(result.matches.t2 || []);

    if (t1Best === 0 && t2Best === 0) {
      return "Not enough evidence was found for this proposed sense.";
    }

    if (Math.abs(t1Best - t2Best) < 0.05) {
      return "The proposed sense appears with similar support in both periods.";
    }

    if (t2Best > t1Best) {
      return `The proposed sense appears more strongly in ${
        result.period_labels?.t2 || "T2"
      }.`;
    }

    return `The proposed sense appears more strongly in ${
      result.period_labels?.t1 || "T1"
    }.`;
  };

  const exploreSense = async () => {
    if (!senseWord.trim() || !senseDescription.trim()) {
      setSenseError("Please enter a word and a proposed sense.");
      return;
    }

    setIsExploringSense(true);
    setSenseError("");
    setSenseResult(null);

    try {
      const API_BASE = getApiBase();

      const keywords = senseKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch(`${API_BASE}/api/words/sense-explorer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: senseWord.trim(),
          pos: sensePos.trim() || "nn",
          sense: senseDescription.trim(),
          keywords,
          topK: 5,
          maxExamplesPerPeriod: 5,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Sense Explorer request failed.");
      }

      setSenseResult(data);
    } catch (error) {
      console.error("Sense Explorer error:", error);
      setSenseError(
      error.message === "Failed to fetch"
        ? "The request could not reach the backend or the backend took too long to respond. Please check the Render logs."
        : error.message || "Something went wrong."
);
    } finally {
      setIsExploringSense(false);
    }
  };

  const ScoreBar = ({ score }) => {
    const s = typeof score === "number" ? score : Number(score);
    const clamped = Number.isFinite(s) ? Math.max(-1, Math.min(1, s)) : 0;
    const pos = ((clamped + 1) / 2) * 100;

    return (
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#6b7280",
            marginBottom: "6px",
          }}
        >
          <span>
            <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} /> axis score:
          </span>
          <strong style={{ color: "#374151" }}>
            {Number.isFinite(s) ? s.toFixed(3) : score ?? "—"}
          </strong>
        </div>

        <div
          style={{
            position: "relative",
            height: "8px",
            borderRadius: "999px",
            background: "#e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "1px",
              background: "#6b7280",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "8px",
              borderRadius: "999px",
              background: "#4f46e5",
              left: `calc(${pos}% - 4px)`,
            }}
          />
        </div>

        <div
          style={{
            marginTop: "5px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#6b7280",
          }}
        >
          <span>negative</span>
          <span>positive</span>
        </div>
      </div>
    );
  };

  const PillList = ({ title, items }) => {
    const safeItems = Array.isArray(items) ? items : [];

    return (
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <p style={{ margin: "0 0 10px", fontWeight: 800, color: "#374151" }}>{title}</p>

        {safeItems.length ? (
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.6 }}>
            {safeItems.slice(0, 12).join(" - ")}
          </p>
        ) : (
          <p style={{ margin: 0, color: "#6b7280", fontStyle: "italic" }}>—</p>
        )}
      </div>
    );
  };

  const ExampleList = ({ label, examples }) => (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <h5 style={{ margin: "0 0 14px", color: "#4338ca", fontSize: "16px" }}>{label}</h5>

      {examples?.length ? (
        <div>
          {examples.slice(0, 6).map((ex, i) => (
            <div key={i} style={styles.exampleCard}>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 6px" }}>
                signed_score: {ex.signed_score?.toFixed?.(3) ?? ex.signed_score}
              </p>
              <p style={{ color: "#374151", fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                "{cleanDisplaySentence(ex.sentence)}"
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "#6b7280", fontStyle: "italic" }}>No axis examples.</p>
      )}
    </div>
  );

  const renderAboutPage = () => (
    <div style={styles.aboutBox}>
      <h2 style={styles.aboutTitle}>What is ChronoWords?</h2>

      <p style={{ color: "#374151", lineHeight: 1.7, fontSize: "16px" }}>
        ChronoWords is a semantic change explorer. It compares how a word is used in two time
        periods and surfaces interpretable signals of meaning shift.
      </p>

      <div style={styles.aboutCard}>
        <h3 style={{ color: "#4338ca", marginTop: 0 }}>What you see on the main page</h3>

        <p>
          <b>Change Score</b> — a normalized indicator of how much the word’s meaning changed
          between periods.
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
        <p>
          <b>Sense Explorer</b> — an experimental page where the user can introduce a proposed
          meaning and search for matching examples in the corpus.
        </p>
      </div>
    </div>
  );

  const renderSenseExplorerPage = () => (
    <div style={styles.aboutBox}>
      <h2 style={styles.aboutTitle}>Sense Explorer</h2>

      <p style={{ color: "#374151", lineHeight: 1.7, fontSize: "16px" }}>
        This experimental page lets the user test a proposed meaning for a word already included
        in the application. The system compares the proposed sense with the stored corpus examples
        and retrieves the closest examples from both time periods.
      </p>

      <div style={styles.aboutCard}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 800,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Word
            </label>
            <input
              value={senseWord}
              onChange={(e) => setSenseWord(e.target.value)}
              placeholder="power"
              style={styles.input}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 800,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Part of speech
            </label>
            <input
              value={sensePos}
              onChange={(e) => setSensePos(e.target.value)}
              placeholder="nn"
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Proposed sense
          </label>
          <textarea
            value={senseDescription}
            onChange={(e) => setSenseDescription(e.target.value)}
            placeholder="Describe the meaning you want to search for..."
            rows={4}
            style={{
              ...styles.input,
              height: "auto",
              paddingTop: "14px",
              paddingBottom: "14px",
              resize: "vertical",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          />
        </div>

        <div style={{ marginTop: "18px" }}>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Optional keywords
          </label>
          <input
            value={senseKeywords}
            onChange={(e) => setSenseKeywords(e.target.value)}
            placeholder="energy, electricity, wind, solar"
            style={styles.input}
          />
          <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: "13px" }}>
            Separate keywords with commas.
          </p>
        </div>

        <button
          type="button"
          disabled={isExploringSense}
          onClick={exploreSense}
          style={{
            ...styles.primaryButton,
            marginTop: "22px",
            opacity: isExploringSense ? 0.75 : 1,
            cursor: isExploringSense ? "not-allowed" : "pointer",
          }}
        >
          {isExploringSense ? (
            <>
              <span style={styles.spinner} />
              Exploring...
            </>
          ) : (
            "Explore sense"
          )}
        </button>

        {senseError && (
          <p style={{ color: "#dc2626", fontWeight: 700, marginTop: "18px" }}>{senseError}</p>
        )}
      </div>

      {senseResult && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <FontAwesomeIcon icon={faBrain} />
            Sense Exploration Result
          </h3>

          <div style={styles.smallCard}>
            <p style={{ marginTop: 0, color: "#374151", lineHeight: 1.7 }}>
              <b>Word:</b> {senseResult.word} ({senseResult.pos})
            </p>

            <p style={{ color: "#374151", lineHeight: 1.7 }}>
              <b>Proposed sense:</b> {senseResult.proposed_sense}
            </p>

            <p style={{ color: "#4338ca", fontWeight: 900, fontSize: "18px" }}>
              {buildSenseVerdict(senseResult)}
            </p>

            <p style={{ color: "#374151", lineHeight: 1.7 }}>
              <b>Evidence level:</b> {senseResult.support_level || "unknown"}{" "}
              {typeof senseResult.best_similarity === "number"
                ? `(best similarity: ${senseResult.best_similarity.toFixed(3)})`
                : ""}
            </p>

            {senseResult.has_enough_evidence === false && (
              <div
                style={{
                  color: "#92400e",
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: "12px",
                  padding: "12px",
                  marginTop: "12px",
                  marginBottom: "14px",
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                The proposed sense may not be strongly supported by the available corpus
                examples. The closest matches should be interpreted with caution.
              </div>
            )}

            <p style={{ color: "#6b7280", lineHeight: 1.6, marginBottom: 0 }}>
              {senseResult.interpretation}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {["t1", "t2"].map((periodKey) => {
              const label =
                periodKey === "t1"
                  ? senseResult.period_labels?.t1 || "T1"
                  : senseResult.period_labels?.t2 || "T2";

              const examples = senseResult.matches?.[periodKey] || [];
              const bestScore = getBestScore(examples);

              return (
                <div key={periodKey} style={styles.smallCard}>
                  <h4 style={{ color: "#4338ca", marginTop: 0 }}>
                    <FontAwesomeIcon icon={faClockRotateLeft} /> {label}
                  </h4>

                  <p style={{ color: "#374151", fontWeight: 800 }}>
                    Best similarity: {bestScore ? bestScore.toFixed(3) : "N/A"}{" "}
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>
                      ({getMatchStrength(bestScore)})
                    </span>
                  </p>

                  {examples.length > 0 ? (
                    examples.map((ex, idx) => (
                      <div key={ex.text_id || idx} style={styles.exampleCard}>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 6px" }}>
                          similarity: {Number(ex.similarity).toFixed(3)}
                        </p>
                        <p
                          style={{
                            color: "#374151",
                            fontStyle: "italic",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          "{cleanDisplaySentence(ex.sentence)}"
                        </p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: "#6b7280", fontStyle: "italic" }}>
                      No matching examples found for this period.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ marginTop: "18px", color: "#6b7280", fontSize: "13px" }}>
            {senseResult.note}
          </p>
        </div>
      )}
    </div>
  );

  const renderHomePage = () => (
    <>
      <div style={styles.searchOuter}>
        <div style={styles.searchRow}>
          <div ref={inputWrapRef} style={styles.inputWrap}>
            <input
              type="text"
              placeholder="Enter a word..."
              value={word}
              disabled={isSearching}
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
              style={{
                ...styles.input,
                opacity: isSearching ? 0.75 : 1,
                background: isSearching ? "#f9fafb" : "white",
              }}
            />
          </div>

          <button
            type="button"
            disabled={isSearching || !word.trim()}
            onClick={() => {
              fetchSemanticChange(searchWordForCurrentInput ?? word, word);
            }}
            style={{
              ...styles.primaryButton,
              opacity: isSearching || !word.trim() ? 0.7 : 1,
              cursor: isSearching || !word.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isSearching ? (
              <>
                <span style={styles.spinner} />
                Loading...
              </>
            ) : (
              "Check"
            )}
          </button>
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && dropdownStyle && !isSearching && (
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
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: "1px solid #eef2ff",
                  background: active ? "#eef2ff" : "white",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "15px",
                }}
              >
                <span style={{ fontWeight: 800 }}>{displayWord}</span>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{s.pos}</span>
              </button>
            );
          })}
        </div>
      )}

      {wordForms.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <label
            style={{
              display: "block",
              color: "#374151",
              fontWeight: 800,
              fontSize: "17px",
              marginBottom: "10px",
            }}
          >
            Part of Speech
          </label>

          <select
            onChange={(e) =>
              setSelectedForm(wordForms.find((f) => f.part_of_speech === e.target.value))
            }
            value={selectedForm?.part_of_speech || ""}
            disabled={wordForms.length === 1 || isSearching}
            style={{
              width: "260px",
              maxWidth: "100%",
              height: "46px",
              border: "1px solid #c7d2fe",
              borderRadius: "14px",
              padding: "0 14px",
              fontSize: "16px",
              fontWeight: 700,
              color: "#374151",
              background: "white",
              boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
              opacity: wordForms.length === 1 || isSearching ? 0.7 : 1,
            }}
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
        <div style={styles.resultCard}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "20px",
              fontWeight: 800,
              color: "#374151",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <FontAwesomeIcon icon={faBrain} style={{ color: "#4f46e5" }} />
            Change Score:
            <span style={{ color: "#4f46e5" }}>
              {Number.isFinite(Number(selectedForm.semantic_change?.normalized_score))
                ? Number(selectedForm.semantic_change.normalized_score).toFixed(2)
                : "N/A"}{" "}
              – {selectedForm.semantic_change?.change_category ?? "Unknown"}
            </span>
          </p>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FontAwesomeIcon icon={faChartSimple} />
              Word Usage Over Time
            </h3>

            <div style={{ width: "100%", height: "300px" }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={selectedForm.history}>
                  <XAxis dataKey="period" tick={{ fill: "#6b46c1", fontSize: 14 }} />
                  <YAxis tick={{ fill: "#6b46c1", fontSize: 14 }} />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;

                      return (
                        <div
                          style={{
                            background: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "10px",
                            padding: "10px 14px",
                            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
                            color: "#4338ca",
                            fontWeight: 700,
                          }}
                        >
                          usage: {payload[0]?.value}
                        </div>
                      );
                    }}
                  />

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

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FontAwesomeIcon icon={faBookOpen} />
              Usage Examples (Clusters)
            </h3>

            {["t1", "t2"].map((periodKey) => {
              const clusters = selectedForm.clusters?.[periodKey];
              const explanation =
                periodKey === "t1" ? selectedForm.conclusion_t1 : selectedForm.conclusion_t2;
              const label =
                periodKey === "t1"
                  ? selectedForm.period_labels?.t1 || "T1"
                  : selectedForm.period_labels?.t2 || "T2";

              return (
                <div key={periodKey} style={styles.smallCard}>
                  <h4
                    style={{
                      color: "#4338ca",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: 0,
                    }}
                  >
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                    Period: {label}
                  </h4>

                  <p style={{ color: "#db2777", fontStyle: "italic" }}>
                    <FontAwesomeIcon icon={faCommentDots} /> Explanation:{" "}
                    {explanation || "No conclusion"}
                  </p>

                  {clusters &&
                    Object.entries(clusters).map(([clusterIdx, sentences]) => {
                      const safeSentences = Array.isArray(sentences) ? sentences : [];

                      return (
                        <div
                          key={clusterIdx}
                          style={{
                            background: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "16px",
                            padding: "16px",
                            marginTop: "16px",
                          }}
                        >
                          <h5 style={{ color: "#4f46e5", marginTop: 0 }}>
                            <FontAwesomeIcon icon={faLayerGroup} /> Cluster {clusterIdx}
                          </h5>

                          {safeSentences.length > 0 ? (
                            safeSentences.slice(0, 1).map((sentence, i) => (
                              <div key={i} style={styles.exampleCard}>
                                <p
                                  style={{
                                    color: "#374151",
                                    fontStyle: "italic",
                                    lineHeight: 1.6,
                                    margin: 0,
                                  }}
                                >
                                  "
                                  {typeof sentence === "string"
                                    ? cleanDisplaySentence(sentence)
                                    : JSON.stringify(sentence)}
                                  "
                                </p>
                              </div>
                            ))
                          ) : (
                            <p style={{ color: "#6b7280", fontStyle: "italic" }}>
                              No examples for this cluster.
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>

          <div style={styles.section}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: "18px",
              }}
            >
              <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
                <FontAwesomeIcon icon={faBrain} />
                Axis-based Explanation
              </h3>

              {totalAxesCount > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllAxes((v) => !v)}
                  style={{
                    ...styles.navButton,
                    color: "#4338ca",
                    borderColor: "#c7d2fe",
                  }}
                >
                  <FontAwesomeIcon
                    icon={showAllAxes ? faChevronUp : faChevronDown}
                    style={{ marginRight: "8px" }}
                  />
                  {showAllAxes ? "Show top 3" : `Show all (${totalAxesCount})`}
                </button>
              )}
            </div>

            {selectedForm.axes_explanation?.length > 0 ? (
              <div>
                {selectedAxes.map((ax, idx) => {
                  const axisId = ax.axis_id;
                  const isOpen = expandedAxisIds.has(axisId);
                  const examplesForAxis = selectedForm.axis_examples?.[axisId] || {
                    t1: [],
                    t2: [],
                  };

                  return (
                    <div key={axisId} style={styles.smallCard}>
                      <button
                        type="button"
                        onClick={() => toggleAxisExpanded(axisId)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <p
                              style={{
                                margin: "0 0 6px",
                                color: "#4338ca",
                                fontWeight: 800,
                              }}
                            >
                              #{idx + 1} • Axis {axisId}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                color: "#111827",
                                fontWeight: 900,
                                lineHeight: 1.4,
                              }}
                            >
                              {axisShortLabel(ax)}
                            </p>
                          </div>

                          <span style={{ color: "#4338ca", fontWeight: 800 }}>
                            <FontAwesomeIcon
                              icon={isOpen ? faChevronUp : faChevronDown}
                              style={{ marginRight: "8px" }}
                            />
                            {isOpen ? "Hide" : "Examples"}
                          </span>
                        </div>

                        <div style={{ marginTop: "14px" }}>
                          <ScoreBar score={ax.signed_projection} />
                        </div>
                      </button>

                      {isOpen && (
                        <div style={{ marginTop: "18px" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <PillList title="Positive side keywords" items={ax.top_pos_words || []} />
                            <PillList title="Negative side keywords" items={ax.top_neg_words || []} />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: "16px",
                            }}
                          >
                            <ExampleList
                              label={`Examples (${selectedForm.period_labels?.t1 || "T1"})`}
                              examples={examplesForAxis.t1 || []}
                            />
                            <ExampleList
                              label={`Examples (${selectedForm.period_labels?.t2 || "T2"})`}
                              examples={examplesForAxis.t2 || []}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontStyle: "italic" }}>
                No axis explanation available.
              </p>
            )}
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FontAwesomeIcon icon={faLayerGroup} />
              Words with Similar Change
            </h3>

            {selectedForm.similar_drift_words?.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  justifyContent: "center",
                }}
              >
                {selectedForm.similar_drift_words.map((w, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSearching}
                    onClick={() => handleSimilarWordClick(w)}
                    style={{
                      ...styles.chipButton,
                      opacity: isSearching ? 0.7 : 1,
                      cursor: isSearching ? "not-allowed" : "pointer",
                    }}
                    title="Click to search"
                  >
                    <p style={{ margin: "0 0 6px", color: "#4338ca", fontWeight: 900 }}>
                      {stripPosSuffix(w.word, w.pos)}{" "}
                      <span style={{ color: "#6b7280" }}>({w.pos})</span>
                    </p>
                    <p style={{ margin: "0 0 4px", color: "#4b5563", fontSize: "13px" }}>
                      sim: {w.similarity?.toFixed?.(3) ?? w.similarity}
                    </p>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: "12px" }}>
                      {w.method ? `method: ${w.method}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontStyle: "italic" }}>
                No similar-change suggestions available.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div style={styles.page}>
      <style>
        {`
          @keyframes chronoSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div style={styles.shell}>
        <h1 style={styles.title}>
          <FontAwesomeIcon icon={faClock} />
          ChronoWords
        </h1>

        <div style={styles.nav}>
          <button
            type="button"
            onClick={() => setActivePage("home")}
            style={activePage === "home" ? styles.navButtonActive : styles.navButton}
          >
            <FontAwesomeIcon icon={faHouse} style={{ marginRight: "8px" }} />
            Home
          </button>

          <button
            type="button"
            onClick={() => setActivePage("sense")}
            style={activePage === "sense" ? styles.navButtonActive : styles.navButton}
          >
            <FontAwesomeIcon icon={faBrain} style={{ marginRight: "8px" }} />
            Sense Explorer
          </button>

          <button
            type="button"
            onClick={() => setActivePage("about")}
            style={activePage === "about" ? styles.navButtonActive : styles.navButton}
          >
            <FontAwesomeIcon icon={faCircleInfo} style={{ marginRight: "8px" }} />
            About
          </button>
        </div>

        {activePage === "about" && renderAboutPage()}
        {activePage === "sense" && renderSenseExplorerPage()}
        {activePage === "home" && renderHomePage()}
      </div>
    </div>
  );
};

export default SemanticChangeApp;