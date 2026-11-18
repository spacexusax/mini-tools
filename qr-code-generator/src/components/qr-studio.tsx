import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight, Download, QrCode } from "lucide-react";
import { describeQrError, qrPngDataUrl, type EccLevel } from "@/lib/qr-png";

const MIN_SIZE = 128;
const MAX_SIZE = 1024;
const DEFAULT_SIZE = 320;
const DEFAULT_TEXT = "https://example.com";
const DEFAULT_FG = "#1f1a14";
const DEFAULT_BG = "#fffdf9";

const LEVELS: { value: EccLevel; title: string; detail: string }[] = [
  { value: "L", title: "L · 低", detail: "约 7% 容错，容量最大" },
  { value: "M", title: "M · 中", detail: "约 15% 容错，常用" },
  { value: "Q", title: "Q · 较高", detail: "约 25% 容错" },
  { value: "H", title: "H · 高", detail: "约 30% 容错，容量最小" },
];

type Rendered = {
  url: string;
  size: number;
  ecc: EccLevel;
  text: string;
};

function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}

function channel(hex: string, index: number): number {
  const n = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

function previewAlt(value: string): string {
  const shown = value.length > 80 ? `${value.slice(0, 80)}…` : value;
  return `二维码预览，内容：${shown}`;
}

function clampSize(n: number): number {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)));
}

export function QrStudio() {
  const reactId = useId();
  const textId = `${reactId}-text`;
  const fgId = `${reactId}-fg`;
  const bgId = `${reactId}-bg`;
  const sizeId = `${reactId}-size`;
  const sizeNumberId = `${reactId}-size-number`;
  const statusId = `${reactId}-status`;
  const contrastId = `${reactId}-contrast`;

  const [text, setText] = useState(DEFAULT_TEXT);
  const [fg, setFg] = useState(DEFAULT_FG);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [fgText, setFgText] = useState(DEFAULT_FG);
  const [bgText, setBgText] = useState(DEFAULT_BG);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [sizeDraft, setSizeDraft] = useState(String(DEFAULT_SIZE));
  const [ecc, setEcc] = useState<EccLevel>("M");
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef({ error: "", low: false });

  const fgInvalid = normalizeHex(fgText) === null;
  const bgInvalid = normalizeHex(bgText) === null;
  const ratio = contrastRatio(fg, bg);
  const lowContrast = ratio < 3;
  const trimmed = text.trim();
  const length = [...text].length;

  useEffect(() => {
    if (!trimmed) {
      setRendered(null);
      setError(null);
      setPending(false);
      return;
    }

    let cancelled = false;
    setPending(true);
    const timer = window.setTimeout(() => {
      qrPngDataUrl(trimmed, { ecc, size, foreground: fg, background: bg })
        .then((url) => {
          if (cancelled) return;
          setRendered({ url, size, ecc, text: trimmed });
          setError(null);
          setPending(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setRendered(null);
          setError(describeQrError(err));
          setPending(false);
        });
    }, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, fg, bg, size, ecc]);

  useEffect(() => {
    const prev = announced.current;
    if (error && error !== prev.error) setAnnouncement(error);
    else if (!error && lowContrast && !prev.low) {
      setAnnouncement(`前景与背景对比度为 ${ratio.toFixed(1)} 比 1，偏低，扫码可能会失败。`);
    }
    announced.current = { error: error ?? "", low: lowContrast };
  }, [error, lowContrast, ratio]);

  function updateHex(which: "fg" | "bg", raw: string) {
    const setText = which === "fg" ? setFgText : setBgText;
    const setColor = which === "fg" ? setFg : setBg;
    setText(raw);
    const next = normalizeHex(raw);
    if (next) setColor(next);
  }

  function pickColor(which: "fg" | "bg", value: string) {
    const next = normalizeHex(value) ?? DEFAULT_FG;
    if (which === "fg") {
      setFg(next);
      setFgText(next);
    } else {
      setBg(next);
      setBgText(next);
    }
  }

  function swapColors() {
    setFg(bg);
    setBg(fg);
    setFgText(bg);
    setBgText(fg);
  }

  function onSizeDraft(raw: string) {
    setSizeDraft(raw);
    if (!/^\d{1,4}$/.test(raw)) return;
    const n = Number(raw);
    if (n >= MIN_SIZE && n <= MAX_SIZE) setSize(n);
  }

  function commitSizeDraft() {
    if (!/^\d{1,4}$/.test(sizeDraft)) {
      setSizeDraft(String(size));
      return;
    }
    const next = clampSize(Number(sizeDraft));
    setSize(next);
    setSizeDraft(String(next));
  }

  function download() {
    if (!rendered) return;
    const anchor = document.createElement("a");
    anchor.href = rendered.url;
    anchor.download = "qrcode.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setAnnouncement(`已开始下载 ${rendered.size} 乘 ${rendered.size} 像素的 PNG。`);
  }

  const statusText = !trimmed
    ? "输入内容后，这里会显示二维码。"
    : error
      ? error
      : pending
        ? "正在按当前设置更新预览…"
        : lowContrast
          ? "预览已更新，但对比度偏低。"
          : "预览已与当前内容同步。";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-8 pb-28 sm:px-6 sm:pt-12">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <header className="lg:col-start-1">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-seal text-seal-ink" aria-hidden="true">
              <QrCode className="size-5" />
            </span>
            <p className="text-sm font-medium text-seal">在浏览器内即时生成</p>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">二维码生成器</h1>
          <p className="mt-3 max-w-xl text-pretty text-muted">
            输入网址或文字，调节前景色、背景色、尺寸和纠错等级。预览会立刻更新，并可以下载 PNG。内容不会离开这台设备。
          </p>
        </header>

        <section className="rounded-2xl bg-surface p-4 shadow-card sm:p-5 lg:col-start-1" aria-labelledby={`${textId}-label`}>
          <div className="flex items-baseline justify-between gap-3">
            <label id={`${textId}-label`} htmlFor={textId} className="text-sm font-semibold">
              内容
            </label>
            <p id={`${textId}-count`} className="text-sm text-muted tabular-nums">
              {length} 个字符
            </p>
          </div>
          <textarea
            id={textId}
            className="field mt-2"
            value={text}
            placeholder="https:// 或任意文字"
            aria-describedby={`${textId}-hint ${textId}-count`}
            onChange={(event) => setText(event.target.value)}
          />
          <p id={`${textId}-hint`} className="mt-2 text-sm text-muted">
            支持网址、中文和英文。中文会占用更多容量。
          </p>
        </section>

        <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-3">
          <section className="rounded-2xl bg-surface p-4 shadow-card sm:p-5" aria-labelledby="qr-preview-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="qr-preview-heading" className="text-lg font-semibold">
                预览
              </h2>
              <p className="text-sm text-muted tabular-nums">{rendered ? `${rendered.size}×${rendered.size}` : `${size}×${size}`}</p>
            </div>
            <div className="mt-3 flex min-h-64 items-center justify-center rounded-xl bg-well p-4">
              {rendered ? (
                <img
                  id="qr-preview"
                  className="qr-bitmap"
                  style={{ ["--qr-px" as string]: `${rendered.size}px` }}
                  src={rendered.url}
                  width={rendered.size}
                  height={rendered.size}
                  alt={previewAlt(rendered.text)}
                  aria-describedby={statusId}
                />
              ) : (
                <p className="max-w-xs text-center text-sm text-muted">
                  {error ? "无法显示二维码。" : pending && trimmed ? "正在生成二维码…" : "输入网址或文字后，二维码会出现在这里。"}
                </p>
              )}
            </div>
            <p id={statusId} className={`mt-3 text-sm ${error || lowContrast ? "text-seal" : "text-muted"}`}>
              {statusText}
            </p>
            <p className="mt-1 text-sm text-muted">预览会适配屏幕。下载文件是所选像素的 PNG。</p>
            <button type="button" className="btn btn-primary mt-4" onClick={download} disabled={!rendered}>
              <Download className="size-4" aria-hidden="true" />
              {rendered ? `下载 ${rendered.size}×${rendered.size} PNG` : "下载 PNG"}
            </button>
          </section>
        </aside>

        <section className="space-y-6 rounded-2xl bg-surface p-4 shadow-card sm:p-5 lg:col-start-1">
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                id={fgId}
                label="前景色"
                picker={fg}
                text={fgText}
                invalid={fgInvalid}
                onPick={(value) => pickColor("fg", value)}
                onText={(value) => updateHex("fg", value)}
              />
              <ColorField
                id={bgId}
                label="背景色"
                picker={bg}
                text={bgText}
                invalid={bgInvalid}
                onPick={(value) => pickColor("bg", value)}
                onText={(value) => updateHex("bg", value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p id={contrastId} className={`text-sm ${lowContrast ? "font-medium text-seal" : "text-muted"}`}>
                对比度 <span className="tabular-nums">{ratio.toFixed(1)}:1</span>
                {lowContrast ? "，偏低，扫码可能失败。" : "。"}
              </p>
              <button type="button" className="btn btn-ghost" onClick={swapColors}>
                <ArrowLeftRight className="size-4" aria-hidden="true" />
                互换前景色与背景色
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={sizeId} className="text-sm font-semibold">
                尺寸
              </label>
              <p id={`${sizeId}-readout`} className="text-sm text-muted tabular-nums">
                {size}×{size} 像素
              </p>
            </div>
            <input
              id={sizeId}
              className="size-range"
              type="range"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step={16}
              value={size}
              aria-valuemin={MIN_SIZE}
              aria-valuemax={MAX_SIZE}
              aria-valuenow={size}
              aria-valuetext={`${size} 乘 ${size} 像素`}
              aria-describedby={`${sizeId}-readout ${sizeId}-hint`}
              onChange={(event) => {
                const next = clampSize(Number(event.target.value));
                setSize(next);
                setSizeDraft(String(next));
              }}
            />
            <div className="mt-1 flex items-center gap-3">
              <label htmlFor={sizeNumberId} className="text-sm text-muted">
                精确像素
              </label>
              <input
                id={sizeNumberId}
                className="field w-28"
                type="text"
                inputMode="numeric"
                value={sizeDraft}
                aria-describedby={`${sizeId}-hint`}
                onChange={(event) => onSizeDraft(event.target.value)}
                onBlur={commitSizeDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitSizeDraft();
                  }
                }}
              />
            </div>
            <p id={`${sizeId}-hint`} className="mt-2 text-sm text-muted">
              {MIN_SIZE} 到 {MAX_SIZE} 像素。滑块按 16 像素步进，数字框可输入任意整数。
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">纠错等级</legend>
            <p id={`${reactId}-ecc-hint`} className="mt-1 text-sm text-muted">
              等级越高，越能抵抗污损，但能装下的内容越少。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="presentation">
              {LEVELS.map((level) => (
                <label key={level.value} className="choice">
                  <input
                    className="sr-only"
                    type="radio"
                    name="qr-ecc"
                    value={level.value}
                    checked={ecc === level.value}
                    aria-describedby={`${reactId}-ecc-hint`}
                    onChange={() => setEcc(level.value)}
                  />
                  <span className="text-sm font-semibold">{level.title}</span>
                  <span className="text-xs text-muted">{level.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}

function ColorField({
  id,
  label,
  picker,
  text,
  invalid,
  onPick,
  onText,
}: {
  id: string;
  label: string;
  picker: string;
  text: string;
  invalid: boolean;
  onPick: (value: string) => void;
  onText: (value: string) => void;
}) {
  const hexId = `${id}-hex`;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          className="swatch"
          type="color"
          value={picker}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => onPick(event.target.value)}
        />
        <input
          id={hexId}
          className="field"
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={7}
          value={text}
          aria-label={`${label}十六进制色值`}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => onText(event.target.value)}
        />
      </div>
      {invalid ? (
        <p id={errorId} className="mt-1 text-sm text-seal">
          请输入 #RGB 或 #RRGGBB。
        </p>
      ) : null}
    </div>
  );
}
