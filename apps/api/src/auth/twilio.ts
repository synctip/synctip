import { Twilio } from 'twilio';

/**
 * Send an SMS-OTP via Twilio. Returns silently if Twilio is not configured —
 * Better-Auth will still record the verification and throw on its side, but
 * the API stays operational in local dev where Twilio credentials are absent.
 */
export async function sendOtpSms(
  phoneNumber: string,
  code: string,
): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn(
      `[twilio] credentials not configured; would have sent OTP ${code} to ${phoneNumber}`,
    );
    return;
  }

  const client = new Twilio(sid, token);
  await client.messages.create({
    to: phoneNumber,
    from,
    body: `Your Synctip verification code is ${code}`,
  });
}
