import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export interface TotpSetup {
  secret: string;
  uri: string;
  qrCodeDataUrl: string;
}

export class TotpService {
  async generateSecret(username: string): Promise<TotpSetup> {
    const secret = new OTPAuth.Secret({ size: 20 });

    const totp = new OTPAuth.TOTP({
      issuer: "CODEMobile",
      label: username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
    });

    return {
      secret: secret.base32,
      uri,
      qrCodeDataUrl,
    };
  }

  verify(secret: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: "CODEMobile",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // window: 1 means check current step +/- 1 step
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }
}
