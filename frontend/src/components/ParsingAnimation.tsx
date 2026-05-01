import { useEffect, useState } from "react";
import { SpinnerIcon } from "./icons";

const PHRASES = [
  "Meticulously scrutinizing your document…",
  "Hermeneutically decoding your submission…",
  "Taxonomizing your academic obligations…",
  "Epistemologically interrogating your syllabus…",
  "Philologically dissecting your documents…",
  "Comprehensively perusing your pedagogical imperatives…",
  "Assiduously extrapolating your chronological deliverables…",
  "Exhaustively cross-referencing your curricular artifacts…",
  "Painstakingly exegeting your academic record…",
  "Rigorously assimilating your scholastic compendium…",
  "Systematically canvassing your instructional directives…",
  "Diligently disambiguating your coursework manuscript…",
  "Reading…",
];

interface ParsingAnimationProps {
  size?: number;
}

export default function ParsingAnimation({ size = 12 }: ParsingAnimationProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 font-body text-xs text-slate-blue">
      <SpinnerIcon size={size} />
      <span className="transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
        {PHRASES[index]}
      </span>
    </div>
  );
}
