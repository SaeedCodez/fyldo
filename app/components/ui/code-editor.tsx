import { Field } from '@base-ui/react/field';
import { useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { highlight, type CodeTokenKind } from '../../lib/code-highlight';
import type { CodeLanguage } from '../../types';
import { CONTROL_LOOK } from './control';
import { InFieldRoot } from './field-shell';
import { IconButton } from './icon-button';

/** Figma "Code Editor": Mono/13 on a 20px line; the code area starts 8 below the toolbar and keeps 10 under the last row. */
const LINE = 20;
const PAD_TOP = 8;
const PAD_BOTTOM = 10;
/** Two spaces: what Tab inserts and Shift+Tab removes. */
const INDENT = '  ';

/** The syntax colours: the tokens the design binds the code sample's runs to (design/figma/components/code-editor.json). */
const KIND: Record<CodeTokenKind, string> = {
  plain: 'fy:text-text-primary',
  muted: 'fy:text-text-tertiary',
  name: 'fy:text-status-info-text',
  key: 'fy:text-text-primary',
  value: 'fy:text-status-success-text',
};

const LANGUAGE_LABELS: Record<CodeLanguage, () => string> = {
  css: () => 'CSS',
  html: () => 'HTML',
  json: () => 'JSON',
  text: () => __('Text', 'fyldo'),
};

export interface CodeEditorProps {
  /** The code. */
  value: string;
  onValueChange: (value: string) => void;
  /** Colours the syntax and names it in the toolbar; `text` is plain. */
  language?: CodeLanguage;
  /** Lines shown before the code scrolls (Figma: 7). */
  rows?: number;
  /** Figma `Toolbar`: the language and the copy button. */
  toolbar?: boolean;
  /** Figma `Line numbers`. */
  lineNumbers?: boolean;
  /** Lines with an error (from 1): their number and their values turn red (Figma `State=Error`). */
  invalidLines?: readonly number[];
  disabled?: boolean;
  /** Focus left the editor (the caller validates). */
  onBlur?: () => void;
  name?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * Replace `start`–`end` of the textarea with `text` the way typing would (one undo step where the browser can), then
 * select `selectStart`–`selectEnd`.
 */
function replace(textarea: HTMLTextAreaElement, start: number, end: number, text: string, selectStart: number, selectEnd = selectStart): void {
  textarea.setSelectionRange(start, end);
  const typed = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!typed) {
    textarea.setRangeText(text, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  textarea.setSelectionRange(selectStart, selectEnd);
}

/**
 * Figma "Code Editor": a toolbar (the language, a copy button), line numbers and the code in Geist Mono with its syntax
 * coloured, always left to right (only the row's label and helper follow the page's direction). It is a real textarea
 * under a coloured copy of its text, so typing, selection, undo and screen readers are the browser's own. Tab indents and
 * Shift+Tab outdents; Escape, then Tab, leaves the editor; Enter keeps the line's indentation.
 * Inside a Setting Row the row names and describes it; on its own, give it an `aria-label`.
 */
export function CodeEditor({
  value,
  onValueChange,
  language = 'text',
  rows = 7,
  toolbar = true,
  lineNumbers = true,
  invalidLines = [],
  disabled = false,
  onBlur,
  name,
  id,
  className,
  ...aria
}: CodeEditorProps): ReactElement {
  const area = useRef<HTMLTextAreaElement>(null);
  const layer = useRef<HTMLPreElement>(null);
  const numbers = useRef<HTMLDivElement>(null);
  // Escape, then Tab, moves focus on: the editor must never trap the keyboard.
  const leaving = useRef(false);
  const [copied, setCopied] = useState(false);
  const hintId = useId();
  const inField = useContext(InFieldRoot);

  const lines = useMemo(() => highlight(language, value), [language, value]);
  const bad = useMemo(() => new Set(invalidLines), [invalidLines]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // The coloured copy and the line numbers follow the textarea's scrolling.
  const follow = (): void => {
    const textarea = area.current;
    if (!textarea) return;
    if (layer.current) layer.current.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    if (numbers.current) numbers.current.style.transform = `translateY(${-textarea.scrollTop}px)`;
  };
  useEffect(follow, [value]);

  // Base UI types the control's events as an input's; it is the textarea.
  const keyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    if (event.nativeEvent.isComposing) return; // an input method is still composing: its keys are its own
    if (event.key === 'Escape') {
      leaving.current = true;
      return;
    }
    const wasLeaving = leaving.current;
    leaving.current = false;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const { selectionStart: start, selectionEnd: end } = textarea;
    if (event.key === 'Tab') {
      if (wasLeaving) return; // the browser moves focus
      event.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      if (!event.shiftKey && start === end) {
        replace(textarea, start, end, INDENT, start + INDENT.length);
        return;
      }
      // Several lines (or Shift+Tab): indent or outdent every line the selection touches.
      const block = value.slice(lineStart, end);
      const parts = block.split('\n');
      const changed = event.shiftKey ? parts.map((line) => line.replace(/^ {1,2}/, '')) : parts.map((line) => INDENT + line);
      const next = changed.join('\n');
      const firstShift = (changed[0] as string).length - (parts[0] as string).length;
      replace(textarea, lineStart, end, next, Math.max(lineStart, start + firstShift), lineStart + next.length);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const indent = /^[ \t]*/.exec(value.slice(lineStart, start))?.[0] ?? '';
      replace(textarea, start, end, `\n${indent}`, start + 1 + indent.length);
    }
  };

  const copy = (): void => {
    void navigator.clipboard?.writeText(value).then(
      () => setCopied(true),
      () => undefined,
    );
  };

  const hint = __('Tab inserts two spaces. To leave the editor, press Escape, then Tab.', 'fyldo');
  const height = rows * LINE + PAD_TOP + PAD_BOTTOM;
  const surface = 'fy:bg-background-subtle fy:group-data-[disabled]/field:bg-surface-disabled';

  return (
    <div
      dir="ltr"
      data-slot="fy-code-editor"
      data-language={language}
      className={cn(CONTROL_LOOK, 'fy:flex fy:w-full fy:flex-col fy:overflow-hidden fy:rounded-sm', className)}
    >
      {toolbar ? (
        <div data-slot="fy-code-toolbar" className={cn('fy:flex fy:h-9 fy:shrink-0 fy:items-center fy:border-b fy:border-border-subtle fy:ps-3 fy:pe-1', surface)}>
          <span className="fy:flex-1 fy:text-mono-12 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">{LANGUAGE_LABELS[language]()}</span>
          <IconButton icon={copied ? 'tick-circle' : 'copy'} label={copied ? __('Copied', 'fyldo') : __('Copy code', 'fyldo')} disabled={disabled} onClick={copy} />
          <span role="status" className="fy:sr-only">
            {copied ? __('Copied', 'fyldo') : ''}
          </span>
        </div>
      ) : null}

      <div className="fy:flex fy:min-h-0" style={{ height }}>
        {lineNumbers ? (
          <div aria-hidden="true" data-slot="fy-code-lines" className={cn('fy:w-10 fy:shrink-0 fy:overflow-hidden fy:border-e fy:border-border-subtle fy:px-2 fy:pt-2', surface)}>
            <div ref={numbers} className="fy:text-end fy:text-mono-13 fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">
              {lines.map((_, index) => (
                <div key={index} data-invalid={bad.has(index + 1) ? '' : undefined} className="fy:data-invalid:text-status-error-text">
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="fy:relative fy:min-w-0 fy:flex-1 fy:overflow-hidden">
          <pre
            ref={layer}
            aria-hidden="true"
            data-slot="fy-code-layer"
            className="fy:pointer-events-none fy:absolute fy:start-0 fy:top-0 fy:m-0 fy:px-3 fy:pt-2 fy:text-mono-13 fy:whitespace-pre fy:group-data-[disabled]/field:[&_span]:text-text-disabled"
          >
            {lines.map((tokens, index) => (
              <span key={index} data-line={index + 1} data-invalid={bad.has(index + 1) ? '' : undefined} className="fy:group/line">
                {tokens.map((token, at) => (
                  <span key={at} className={cn(KIND[token.kind], token.kind === 'value' && 'fy:group-data-invalid/line:text-status-error-text')}>
                    {token.text}
                  </span>
                ))}
                {'\n'}
              </span>
            ))}
          </pre>
          <Field.Control
            {...aria}
            {...(inField ? {} : { 'aria-describedby': hintId })}
            render={<textarea wrap="off" />}
            ref={area}
            id={id}
            name={name}
            value={value}
            disabled={disabled}
            onValueChange={(next: string) => onValueChange(next)}
            onBlur={() => {
              leaving.current = false;
              onBlur?.();
            }}
            onKeyDown={keyDown}
            onScroll={follow}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            data-slot="fy-code-input"
            className="fy:focus-none fy:absolute fy:inset-0 fy:block fy:size-full fy:resize-none fy:appearance-none fy:overflow-auto fy:border-0 fy:bg-transparent fy:px-3 fy:pt-2 fy:pb-2.5 fy:text-mono-13 fy:whitespace-pre fy:text-transparent fy:caret-text-primary fy:outline-none fy:selection:bg-brand-border/40 fy:disabled:cursor-not-allowed"
          />
        </div>
      </div>
      {inField ? (
        <Field.Description className="fy:sr-only">{hint}</Field.Description>
      ) : (
        <p id={hintId} className="fy:sr-only">
          {hint}
        </p>
      )}
    </div>
  );
}
