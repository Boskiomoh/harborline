"use client";

import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { signIn, type SignInState } from "@/lib/actions/auth";
import { useTranslations } from "next-intl";
import { FC, useActionState } from "react";

interface SignInFormProps {
  next: string;
  initialError?: "invalid" | "generic";
}

const SignInForm: FC<SignInFormProps> = ({ next, initialError }) => {
  const t = useTranslations("signIn");

  // Form
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    initialError ? { error: initialError } : undefined,
  );

  // Derived
  const emailError = state?.fieldErrors?.email ? t("errors.email") : undefined;
  const passwordError = state?.fieldErrors?.password
    ? t("errors.password")
    : undefined;

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next} />

      <Field id="email" label={t("emailLabel")} error={emailError}>
        <input
          key={state?.email}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state?.email}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          className={`${inputClass} h-11`}
        />
      </Field>

      <Field id="password" label={t("passwordLabel")} error={passwordError}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
          className={`${inputClass} h-11`}
        />
      </Field>

      {state?.error && (
        <p
          role="alert"
          className="rounded-[8px] border border-danger/25 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className={buttonClass({
          variant: "secondary",
          size: "lg",
          className: "w-full",
        })}
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
};

export default SignInForm;
