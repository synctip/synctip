// React Compiler aggressively memoizes; react-hook-form's `{...field}`
// render-prop spread re-creates handlers each render and breaks under the
// compiler (typed input no-ops). Opt this file out.
"use no memo";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { PhoneInput } from "@/components/ui/phone-input";
import { Separator } from "@/components/ui/separator";
import { isValidPhoneNumber } from "react-phone-number-input";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Step = "phone" | "code";

const OTP_LENGTH = 6;

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone || !isValidPhoneNumber(phone)) {
      setPhoneError("Enter a valid phone number");
      return;
    }
    setPhoneError(null);
    setSending(true);
    try {
      const { error } = await authClient.phoneNumber.sendOtp({
        phoneNumber: phone,
      });
      if (error) {
        toast.error(error.message ?? "Failed to send code");
        return;
      }
      setCode("");
      setCodeError(null);
      setStep("code");
      toast.success("Code sent");
    } finally {
      setSending(false);
    }
  }

  async function verify(submittedCode: string) {
    if (submittedCode.length !== OTP_LENGTH) {
      setCodeError("Enter the 6-digit code");
      return;
    }
    setCodeError(null);
    setVerifying(true);
    try {
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code: submittedCode,
      });
      if (error) {
        toast.error(error.message ?? "Invalid code");
        return;
      }
      toast.success("Signed in");
      await navigate({ to: "/" });
    } finally {
      setVerifying(false);
    }
  }

  // Auto-submit when all 6 digits are entered (covers iOS Messages autofill
  // and manual paste of the full code).
  useEffect(() => {
    if (step === "code" && code.length === OTP_LENGTH && !verifying) {
      void verify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  async function onCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verify(code);
  }

  async function onGoogle() {
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
    if (error) toast.error(error.message ?? "Google sign-in failed");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {step === "phone"
              ? "We'll send a one-time code to your phone."
              : `Enter the code we sent to ${phone}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "phone" ? (
            <form
              id="phone-form"
              onSubmit={onSendCode}
              className="space-y-2"
              noValidate
            >
              <label
                htmlFor="phone"
                className="text-sm leading-none font-medium select-none"
              >
                Phone number
              </label>
              <PhoneInput
                id="phone"
                placeholder="Enter phone number"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  if (phoneError) setPhoneError(null);
                }}
                aria-invalid={phoneError ? "true" : "false"}
              />
              {phoneError ? (
                <p className="text-destructive text-sm">{phoneError}</p>
              ) : null}
            </form>
          ) : (
            <form
              id="code-form"
              onSubmit={onCodeSubmit}
              className="space-y-2"
              noValidate
            >
              <label
                htmlFor="otp-code"
                className="text-sm leading-none font-medium select-none"
              >
                Verification code
              </label>
              <InputOTP
                id="otp-code"
                maxLength={OTP_LENGTH}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (codeError) setCodeError(null);
                }}
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                aria-invalid={codeError ? "true" : "false"}
                disabled={verifying}
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {codeError ? (
                <p className="text-destructive text-sm">{codeError}</p>
              ) : null}
            </form>
          )}

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onGoogle}
          >
            Continue with Google
          </Button>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          {step === "phone" ? (
            <Button
              type="submit"
              form="phone-form"
              className="w-full"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send code"}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                form="code-form"
                className="w-full"
                disabled={verifying || code.length !== OTP_LENGTH}
              >
                {verifying ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setCodeError(null);
                }}
              >
                Use a different number
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
