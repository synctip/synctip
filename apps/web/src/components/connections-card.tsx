// React Compiler conflicts with shadcn Dialog + react-phone-number-input
// renders; opt this file out (same pattern as the login route).
"use no memo";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, Phone } from "lucide-react";
import { isValidPhoneNumber } from "react-phone-number-input";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { PhoneInput } from "@/components/ui/phone-input";

const OTP_LENGTH = 6;

type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
};

type SessionUser = {
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
};

type Props = {
  user: SessionUser;
  onChanged: () => void | Promise<void>;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a11 11 0 0 0 0 9.92l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function ConnectionsCard({ user, onChanged }: Props) {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Phone-link dialog state
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Per-action in-flight flags
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [removingPhone, setRemovingPhone] = useState(false);

  async function refreshAccounts() {
    setRefreshing(true);
    try {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        setAccountsError(error.message ?? "Failed to load accounts");
        setAccounts([]);
        return;
      }
      setAccountsError(null);
      setAccounts((data ?? []) as LinkedAccount[]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshAccounts();
  }, []);

  const hasPhone = Boolean(user.phoneNumber && user.phoneNumberVerified);
  const hasGoogle = (accounts ?? []).some((a) => a.providerId === "google");
  const methodsCount = (hasPhone ? 1 : 0) + (hasGoogle ? 1 : 0);
  const allConnected = hasPhone && hasGoogle;

  // Auto-submit OTP when all 6 digits arrive (paste / iOS autofill).
  useEffect(() => {
    if (
      phoneDialogOpen &&
      step === "code" &&
      code.length === OTP_LENGTH &&
      !verifying
    ) {
      void verifyPhone(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step, phoneDialogOpen]);

  function resetPhoneDialog() {
    setStep("phone");
    setPhone("");
    setPhoneError(null);
    setCode("");
    setCodeError(null);
    setSending(false);
    setVerifying(false);
  }

  async function onSendPhoneOtp(event: React.FormEvent<HTMLFormElement>) {
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

  async function verifyPhone(submittedCode: string) {
    if (submittedCode.length !== OTP_LENGTH) {
      setCodeError("Enter the 6-digit code");
      return;
    }
    setCodeError(null);
    setVerifying(true);
    try {
      // `updatePhoneNumber: true` links the new (verified) phone to the
      // currently logged-in user instead of creating a new account.
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code: submittedCode,
        updatePhoneNumber: true,
      });
      if (error) {
        toast.error(error.message ?? "Invalid code");
        return;
      }
      toast.success("Phone connected");
      setPhoneDialogOpen(false);
      resetPhoneDialog();
      await onChanged();
    } finally {
      setVerifying(false);
    }
  }

  async function linkGoogle() {
    setLinkingGoogle(true);
    try {
      // Absolute URLs — the web and api live on different origins, so a
      // relative path would resolve against the API base. Without an explicit
      // errorCallbackURL, Better-Auth falls back to the API origin on failure,
      // which dead-ends the user on a raw `/?error=...` page (see #19).
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "";
      const { error } = await authClient.linkSocial({
        provider: "google",
        callbackURL: `${origin}/dashboard`,
        errorCallbackURL: `${origin}/dashboard`,
      });
      if (error) {
        toast.error(error.message ?? "Could not start Google linking");
        setLinkingGoogle(false);
      }
      // On success the browser is redirected; no further work here.
    } catch (err) {
      console.error(err);
      toast.error("Could not start Google linking");
      setLinkingGoogle(false);
    }
  }

  async function unlinkGoogle() {
    if (methodsCount <= 1) return; // safety: don't allow lockout
    setUnlinkingGoogle(true);
    try {
      const { error } = await authClient.unlinkAccount({
        providerId: "google",
      });
      if (error) {
        toast.error(error.message ?? "Could not unlink Google");
        return;
      }
      toast.success("Google disconnected");
      await Promise.all([refreshAccounts(), onChanged()]);
    } finally {
      setUnlinkingGoogle(false);
    }
  }

  async function removePhone() {
    if (methodsCount <= 1) return;
    setRemovingPhone(true);
    try {
      const { error } = await authClient.updateUser({
        // Passing null clears the phone number on the user record.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phoneNumber: null as any,
      });
      if (error) {
        toast.error(error.message ?? "Could not remove phone");
        return;
      }
      toast.success("Phone disconnected");
      await onChanged();
    } finally {
      setRemovingPhone(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in methods</CardTitle>
        <CardDescription>
          Connect more than one way to sign in. You can use any connected method
          to log in to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {allConnected ? (
          <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="space-y-0.5 text-sm">
              <p className="font-medium">All sign-in methods connected</p>
              <p className="text-muted-foreground">
                You can sign in with either your phone number or Google.
              </p>
            </div>
          </div>
        ) : null}

        <MethodRow
          icon={<Phone className="size-5" />}
          name="Phone number"
          value={hasPhone ? (user.phoneNumber ?? null) : null}
          loading={accounts === null}
          connected={hasPhone}
          actionLabel={hasPhone ? "Disconnect" : "Connect"}
          actionLoading={removingPhone}
          actionDisabled={hasPhone && methodsCount <= 1}
          actionTitle={
            hasPhone && methodsCount <= 1
              ? "Connect another method before removing this one."
              : undefined
          }
          onAction={
            hasPhone
              ? removePhone
              : () => {
                  resetPhoneDialog();
                  setPhoneDialogOpen(true);
                }
          }
        />

        <MethodRow
          icon={<GoogleIcon className="size-5" />}
          name="Google account"
          value={hasGoogle ? "Connected" : null}
          loading={accounts === null}
          connected={hasGoogle}
          actionLabel={hasGoogle ? "Disconnect" : "Connect"}
          actionLoading={linkingGoogle || unlinkingGoogle}
          actionDisabled={hasGoogle && methodsCount <= 1}
          actionTitle={
            hasGoogle && methodsCount <= 1
              ? "Connect another method before removing this one."
              : undefined
          }
          onAction={hasGoogle ? unlinkGoogle : linkGoogle}
        />

        {accountsError ? (
          <p className="text-sm text-destructive">{accountsError}</p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {refreshing
            ? "Refreshing..."
            : "Tip: connecting both methods means you can sign in even if you lose access to one."}
        </p>
      </CardContent>

      {/* Connect phone dialog */}
      <Dialog
        open={phoneDialogOpen}
        onOpenChange={(open) => {
          setPhoneDialogOpen(open);
          if (!open) resetPhoneDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {step === "phone" ? "Add your phone number" : "Enter the code"}
            </DialogTitle>
            <DialogDescription>
              {step === "phone"
                ? "We will text you a 6-digit code to confirm the number."
                : `We sent a code to ${phone}.`}
            </DialogDescription>
          </DialogHeader>

          {step === "phone" ? (
            <form
              id="connect-phone-form"
              onSubmit={onSendPhoneOtp}
              className="space-y-3"
            >
              <PhoneInput
                value={phone}
                onChange={(v) => setPhone(v ?? "")}
                disabled={sending}
                autoFocus
              />
              {phoneError ? (
                <p className="text-sm text-destructive">{phoneError}</p>
              ) : null}
            </form>
          ) : (
            <form
              id="connect-phone-form"
              onSubmit={(e) => {
                e.preventDefault();
                void verifyPhone(code);
              }}
              className="space-y-3"
            >
              <InputOTP
                maxLength={OTP_LENGTH}
                value={code}
                onChange={setCode}
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                disabled={verifying}
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {codeError ? (
                <p className="text-sm text-destructive">{codeError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setCodeError(null);
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Change number
              </button>
            </form>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPhoneDialogOpen(false)}
              disabled={sending || verifying}
            >
              Cancel
            </Button>
            {step === "phone" ? (
              <Button
                type="submit"
                form="connect-phone-form"
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Send code
                    <ChevronRight className="size-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                form="connect-phone-form"
                disabled={verifying || code.length !== OTP_LENGTH}
              >
                {verifying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MethodRow({
  icon,
  name,
  value,
  connected,
  loading,
  actionLabel,
  actionLoading,
  actionDisabled,
  actionTitle,
  onAction,
}: {
  icon: React.ReactNode;
  name: string;
  value: string | null;
  connected: boolean;
  loading: boolean;
  actionLabel: string;
  actionLoading: boolean;
  actionDisabled?: boolean;
  actionTitle?: string;
  onAction: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Checking...</p>
          ) : connected ? (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Check className="size-3 text-primary" />
              <span className="truncate">{value ?? "Connected"}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Not connected</p>
          )}
        </div>
      </div>
      <Button
        variant={connected ? "outline" : "default"}
        size="sm"
        onClick={() => void onAction()}
        disabled={actionLoading || actionDisabled || loading}
        title={actionTitle}
      >
        {actionLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          actionLabel
        )}
      </Button>
    </div>
  );
}
