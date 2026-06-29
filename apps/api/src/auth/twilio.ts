import { Twilio } from 'twilio';

/**
 * Twilio Verify integration.
 *
 * Verify generates AND validates the OTP itself, so we ignore the code
 * Better-Auth would otherwise generate and delegate both send + check to
 * Verify. This avoids needing a `from` phone number, handles A2P / sender-ID
 * compliance for international destinations (e.g. IL +972), and gives us
 * Twilio's anti-fraud and rate-limiting for free.
 *
 * In local dev without credentials, `sendOtp` is a no-op that logs to the
 * console and `verifyOtp` accepts the literal string "000000" so phone flows
 * remain testable.
 */
function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !serviceSid) return null;
  return { sid, token, serviceSid };
}

export async function sendOtp(phoneNumber: string): Promise<void> {
  const cfg = twilioConfig();
  if (!cfg) {
    console.warn(
      `[twilio] credentials not configured; pretending to send OTP to ${phoneNumber} (use "000000" to verify)`,
    );
    return;
  }
  const client = new Twilio(cfg.sid, cfg.token);
  await client.verify.v2
    .services(cfg.serviceSid)
    .verifications.create({ to: phoneNumber, channel: 'sms', locale: 'he' });
}

export async function verifyOtp(
  phoneNumber: string,
  code: string,
): Promise<boolean> {
  const cfg = twilioConfig();
  if (!cfg) {
    return code === '000000';
  }
  const client = new Twilio(cfg.sid, cfg.token);
  const check = await client.verify.v2
    .services(cfg.serviceSid)
    .verificationChecks.create({ to: phoneNumber, code });
  return check.status === 'approved';
}
