// React Compiler aggressively memoizes; react-hook-form's `{...field}`
// render-prop spread re-creates handlers each render and breaks under the
// compiler (typed input no-ops). Opt this file out.
"use no memo";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "Use E.164 format, e.g. +14155552671"),
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Enter the code you received"),
});

type Step = "phone" | "code";

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");

  // Code step uses plain state instead of react-hook-form. The Controller +
  // Slot + spread chain was preventing keyboard input on this input (see
  // git history). Plain state side-steps the issue and is fine for a single
  // numeric field.
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "" },
  });

  async function onSendCode(values: z.infer<typeof phoneSchema>) {
    const { error } = await authClient.phoneNumber.sendOtp({
      phoneNumber: values.phoneNumber,
    });
    if (error) {
      toast.error(error.message ?? "Failed to send code");
      return;
    }
    setPhone(values.phoneNumber);
    setCode("");
    setCodeError(null);
    setStep("code");
    toast.success("Code sent");
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = codeSchema.safeParse({ code });
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? "Invalid code");
      return;
    }
    setCodeError(null);
    setVerifying(true);
    try {
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code: parsed.data.code,
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
            <Form {...phoneForm}>
              <form
                id="phone-form"
                onSubmit={phoneForm.handleSubmit(onSendCode)}
                className="space-y-4"
              >
                <FormField
                  control={phoneForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          autoComplete="tel"
                          placeholder="+14155552671"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          ) : (
            <form
              id="code-form"
              onSubmit={onVerify}
              className="space-y-2"
              noValidate
            >
              <label
                htmlFor="otp-code"
                className="text-sm leading-none font-medium select-none"
              >
                Verification code
              </label>
              <input
                id="otp-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={codeError ? "true" : "false"}
                className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
              />
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
              disabled={phoneForm.formState.isSubmitting}
            >
              {phoneForm.formState.isSubmitting ? "Sending..." : "Send code"}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                form="code-form"
                className="w-full"
                disabled={verifying}
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
