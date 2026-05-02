import { useEffect, useState } from "react";
import { SpinnerIcon } from "./icons";

const PHRASES = [
  "Meticulously scrutinizing your document…",
  "Hermeneutically decoding your submission…",
  "Taxonomizing your academic obligations…",
  "Epistemologically interrogating your pdfs…",
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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const intervalId = setInterval(() => {
      setVisible(false);
      timeoutId = setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const textSize = size >= 14 ? "text-sm" : "text-xs";

  return (
    <div className={`flex items-center gap-2 font-body ${textSize} text-slate-blue`}>
      <SpinnerIcon size={size} />
      <span className={`transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
        {PHRASES[index]}
      </span>
    </div>
  );
}
