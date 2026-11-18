declare module "qrcode/lib/browser.js" {
  export type QRCodeErrorCorrectionLevel = "L" | "M" | "Q" | "H";

  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
}
