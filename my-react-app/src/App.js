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

const SemanticChangeApp = () => {
  const [activePage, setActivePage] = useState("home"); // ✅ NEW (home | about)

  const [word, setWord] = useState("");
  const [wordForms, setWordForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);

  // Axes UI state
  const [showAllAxes, setShowAllAxes] = useState(false);
  const [expandedAxisIds, setExpandedAxisIds] = useState(new Set());

  const fetchSemanticChange = async (overrideWord) => {
    const query = (overrideWord ?? word)?.trim();
    if (!query) return;

    try {
          const API_BASE =
      import.meta?.env?.VITE_API_URL ||
      process.env.REACT_APP_API_URL ||
      "http://localhost:5000";

    const res = await fetch(`${API_BASE}/api/words/${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Word not found");

      const raw = await res.json();
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

      setWord(query);
      setWordForms(forms);
      setSelectedForm(forms[0] || null);

      // Reset axes UI
      setShowAllAxes(false);
      setExpandedAxisIds(new Set());
    } catch (error) {
      console.error("Error fetching data:", error);
      setWordForms([]);
      setSelectedForm(null);
    }
  };

  const handleSimilarWordClick = (w) => {
    if (!w) return;
    fetchSemanticChange(w);
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

  const PillList = ({ title, items }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>

      {items?.length ? (
        <p className="text-sm text-gray-800 break-words">{items.slice(0, 12).join(" - ")}</p>
      ) : (
        <p className="text-sm text-gray-500 italic">—</p>
      )}
    </div>
  );

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
        {/* Header */}
        <h1 className="text-5xl font-extrabold text-indigo-700 shadow-lg tracking-wide flex items-center">
          <FontAwesomeIcon icon={faClock} className="mr-4 text-indigo-600" />
          ChronoWords
        </h1>

        {/* ✅ NEW: simple navigation tabs */}
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

        {/* ===================== ABOUT PAGE ===================== */}
        {activePage === "about" ? (
          <div className="w-full text-left bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-3xl font-bold text-indigo-700">What is ChronoWords?</h2>

            <p className="text-gray-700 leading-relaxed">
              ChronoWords is a semantic change explorer. It compares how a word is used in two time periods
              (1810–1860 vs 1960–2010) and surfaces interpretable signals of meaning shift.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xl font-semibold text-indigo-700 mb-3">What you see on the main page</h3>

              <div className="space-y-3 text-gray-700 leading-relaxed">
                <p>
                  <b>Change Score</b> — a normalized indicator of how much the word’s meaning changed between periods.
                </p>
                <p>
                  <b>Word Usage Over Time</b> — how many examples were analyzed in each period.
                </p>
                <p>
                  <b>Usage Examples (Clusters)</b> — sentences grouped by similar usage (often corresponding to senses).
                </p>
                <p>
                  <b>Axis-based Explanation</b> — interpretable “dimensions” that separate contexts (keywords + example sentences).
                </p>
                <p>
                  <b>Words with Similar Change</b> — other words that drifted in a similar way.
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xl font-semibold text-indigo-700 mb-3">Quick tip</h3>
              <p className="text-gray-700 leading-relaxed">
                In the Axis-based section, each axis has two keyword lists (positive/negative) and examples for each
                time period. The goal is to help you “see” what contexts the model associates with the word in each period.
              </p>
            </div>
          </div>
        ) : (
          /* ===================== HOME PAGE (your current UI) ===================== */
          <>
            <div className="w-full flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Input
                type="text"
                placeholder="Enter a word..."
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full sm:w-3/4 p-4 border border-gray-300 rounded-xl shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500 text-lg text-center"
              />
              <Button
                onClick={() => fetchSemanticChange()}
                className="w-full sm:w-1/4 p-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-800 transition-all text-lg"
              >
                Check
              </Button>
            </div>

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
                    {selectedForm.semantic_change?.normalized_score?.toFixed(2) ?? "N/A"} –{" "}
                    {selectedForm.semantic_change?.change_category ?? "Unknown"}
                  </span>
                </p>

                <div className="mt-8 w-full flex flex-col items-center">
                  <h3 className="text-xl font-semibold text-gray-700 mt-4 flex items-center">
                    <FontAwesomeIcon icon={faChartSimple} className="text-indigo-600 text-2xl" />
                    <span className="ml-2">Word Usage Over Time</span>
                  </h3>

                  {selectedForm.history.length > 0 ? (
                    <div className="chart-container w-full">
                      <ResponsiveContainer width="100%" height={300} className="mx-auto">
                        <BarChart data={selectedForm.history}>
                          <XAxis dataKey="period" tick={{ fill: "#6b46c1", fontSize: 14 }} />
                          <YAxis tick={{ fill: "#6b46c1", fontSize: 14 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#fff",
                              color: "#333",
                              borderRadius: 8,
                              padding: 10,
                              border: "1px solid #ccc",
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
                  ) : (
                    <p className="text-gray-500 italic mt-2">No usage data available.</p>
                  )}
                </div>

                {/* CLUSTERS */}
                <div className="mt-10 w-full bg-white border-2 border-indigo-400 rounded-3xl shadow-xl px-6 py-8">
                  <h3 className="text-2xl font-bold text-indigo-700 flex items-center mb-4">
                    <FontAwesomeIcon icon={faBookOpen} className="text-indigo-600 text-xl mr-2" />
                    Usage Examples (Clusters)
                  </h3>

                  {["t1", "t2"].map((periodKey) => {
                    const clusters = selectedForm.clusters?.[periodKey];
                    const explanation = periodKey === "t1" ? selectedForm.conclusion_t1 : selectedForm.conclusion_t2;
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
                          Object.entries(clusters).map(([clusterIdx, sentences]) => (
                            <div key={clusterIdx} className="p-4 bg-white border border-gray-300 rounded-xl shadow-sm">
                              <h5 className="text-md font-semibold text-indigo-600 mb-3 flex items-center">
                                <FontAwesomeIcon icon={faLayerGroup} className="mr-2" />
                                Cluster {clusterIdx}
                              </h5>

                              <div className="space-y-4">
                                {sentences.map((sentence, i) => (
                                  <div
                                    key={i}
                                    className="p-3 bg-gray-100 rounded-lg border-l-4 border-indigo-300 text-left whitespace-pre-wrap break-words max-w-prose mx-auto"
                                  >
                                    <p className="text-gray-800 italic leading-relaxed">"{sentence}"</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>

                {/* AXIS EXPLANATION */}
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
                          {showAllAxes ? (
                            <>
                              <FontAwesomeIcon icon={faChevronUp} className="mr-2" />
                              Show top 3
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faChevronDown} className="mr-2" />
                              Show all ({totalAxesCount})
                            </>
                          )}
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
                                    {isOpen ? (
                                      <>
                                        <FontAwesomeIcon icon={faChevronUp} className="mr-2" />
                                        Hide
                                      </>
                                    ) : (
                                      <>
                                        <FontAwesomeIcon icon={faChevronDown} className="mr-2" />
                                        Examples
                                      </>
                                    )}
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

                {/* SIMILAR DRIFT WORDS */}
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
                            onClick={() => handleSimilarWordClick(w.word)}
                            className="px-4 py-2 bg-gray-50 border border-indigo-200 rounded-xl shadow-sm hover:bg-indigo-50 transition-all text-left"
                            title="Click to search"
                          >
                            <p className="text-sm font-semibold text-indigo-700">
                              {w.word} <span className="text-gray-500">({w.pos})</span>
                            </p>
                            <p className="text-xs text-gray-600">
                              sim: {w.similarity?.toFixed?.(3) ?? w.similarity}
                            </p>
                            <p className="text-[11px] text-gray-500">{w.method ? `method: ${w.method}` : ""}</p>
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
