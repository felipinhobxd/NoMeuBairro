import { useEffect, useId, useRef, useState } from 'react';

/** Só oferece expansão quando o texto realmente não cabe, inclusive com fonte maior. */
export default function ExpandablePostText({ text }: { text: string }) {
  const id = useId();
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const element = paragraph.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      // Sem medição contínua, é melhor permitir expandir do que esconder conteúdo.
      setOverflows(true);
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="nmb-post-copy">
      <p ref={paragraph} id={id} className="nmb-post-description" data-expanded={expanded}>{text}</p>
      {(overflows || expanded) && (
        <button type="button" className="nmb-post-read-more" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Ver menos' : 'Ler descrição completa'}
        </button>
      )}
    </div>
  );
}
