import * as QRCode from "qrcode/lib/browser.js";

export type EccLevel = "L" | "M" | "Q" | "H";

type DataUrlOptions = {
  errorCorrectionLevel?: EccLevel;
  margin?: number;
  width?: number;
  color?: { dark?: string; light?: string };
};

type DataUrlFn = (text: string, options?: DataUrlOptions) => Promise<string>;

function renderer(): DataUrlFn {
  const mod = QRCode as unknown as DataUrlFn & { toDataURL?: DataUrlFn; default?: { toDataURL?: DataUrlFn } };
  if (typeof mod.toDataURL === "function") return mod.toDataURL;
  if (typeof mod.default?.toDataURL === "function") return mod.default.toDataURL;
  if (typeof mod === "function") return mod;
  throw new Error("QR renderer unavailable");
}

export function qrPngDataUrl(
  text: string,
  options: { ecc: EccLevel; size: number; foreground: string; background: string },
): Promise<string> {
  return renderer()(text, {
    errorCorrectionLevel: options.ecc,
    width: options.size,
    margin: 2,
    color: { dark: options.foreground, light: options.background },
  });
}

export function describeQrError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/too big/i.test(raw)) {
    return "内容超出当前二维码容量。请缩短文字，或把纠错等级调低。";
  }
  return "暂时无法生成二维码。请调整内容后再试。";
}
