"use client";

import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { apiInstance } from "@/lib/api/instance";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { Constants, type Enums } from "@/lib/supabase/database.types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowCounterClockwise,
  Check,
  CreditCard,
  FileText,
  Package,
  Question,
  SpinnerGap,
  Trash,
  UploadSimple,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FC, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const categoryIcons = {
  order_delivery: Package,
  returns_refunds: ArrowCounterClockwise,
  payments: CreditCard,
  account: UserCircle,
  product_question: Question,
} as const;

const maxFiles = 3;
const maxBytes = 10 * 1024 * 1024;
const accepted = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];

// Error messages are translation keys under portal.new.errors.
const schema = z.object({
  category: z.enum(Constants.public.Enums.ticket_category, {
    message: "category",
  }),
  subject: z.string().trim().min(3, "subjectShort").max(160, "subjectLong"),
  description: z
    .string()
    .trim()
    .min(10, "descriptionShort")
    .max(10_000, "descriptionLong"),
  orderReference: z.string().trim().max(40, "order"),
});

const steps = ["category", "details", "attachments", "review"] as const;
const stepFields: Record<
  (typeof steps)[number],
  Array<keyof z.infer<typeof schema>>
> = {
  category: ["category"],
  details: ["subject", "description", "orderReference"],
  attachments: [],
  review: [],
};

const NewTicketWizard: FC = () => {
  const t = useTranslations();

  // Router
  const router = useRouter();

  // State
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "sending" | "uploading">("idle");

  // Ref
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Form
  const {
    register,
    trigger,
    control,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", description: "", orderReference: "" },
    mode: "onTouched",
  });
  const category = useWatch({ control, name: "category" });

  // Queries
  const queryClient = useQueryClient();

  // Mutations
  const { mutate: createTicketMutate } = useMutation({
    mutationKey: ["create-ticket"],
    mutationFn: async (values: z.infer<typeof schema>) => {
      try {
        const body = {
          category: values.category,
          subject: values.subject,
          description: values.description,
          ...(values.orderReference && {
            orderReference: values.orderReference,
          }),
        };

        const res = await apiInstance.post("/api/tickets", body);

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: async (data) => {
      // Files upload straight to Storage (its own RLS confines this to the new
      // ticket's folder), then each attachment's metadata row is recorded
      // through the API so it shows in the thread.
      let failed = 0;

      if (files.length > 0) {
        setPhase("uploading");
        const supabase = createClient();

        for (const file of files) {
          const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-120);
          const path = `${data.ticketId}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage
            .from("ticket-attachments")
            .upload(path, file, { contentType: file.type, upsert: false });

          if (error) {
            failed += 1;
            continue;
          }

          try {
            await apiInstance.post(
              `/api/tickets/${data.ticketId}/attachments`,
              {
                messageId: data.messageId,
                storagePath: path,
                fileName: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
              },
            );
          } catch {
            failed += 1;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      router.push(
        `/portal/tickets/${data.ticketId}?created=1${failed > 0 ? "&upload=failed" : ""}`,
      );
    },
    onError: () => {
      setPhase("idle");
      setSubmitError(t("portal.new.errors.generic"));
    },
  });

  // Derived
  const busy = phase !== "idle";
  const current = steps[step];

  // Move focus to the new step's heading so keyboard and screen reader users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    headingRef.current?.focus();
  }, [step]);

  // Handlers
  const errorText = (key?: string) =>
    key ? t(`portal.new.errors.${key}`) : undefined;

  const handleNext = async () => {
    const valid = await trigger(stepFields[steps[step]]);

    if (valid) setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleAddFiles = (incoming: FileList | File[]) => {
    const problems: string[] = [];
    const next = [...files];

    for (const file of Array.from(incoming)) {
      if (!accepted.includes(file.type)) {
        problems.push(
          t("portal.new.attachments.wrongType", { name: file.name }),
        );
      } else if (file.size > maxBytes) {
        problems.push(
          t("portal.new.attachments.tooLarge", { name: file.name }),
        );
      } else if (next.length >= maxFiles) {
        problems.push(t("portal.new.attachments.tooMany"));
        break;
      } else {
        next.push(file);
      }
    }

    setFiles(next);
    setFileErrors(problems);
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    const valid = await trigger();

    if (!valid) {
      setStep(errors.category ? 0 : 1);
      return;
    }

    setPhase("sending");
    createTicketMutate(getValues());
  };

  return (
    <div className="mt-8">
      <div>
        <p className="text-sm text-ink-soft">
          {t("portal.new.stepOf", { current: step + 1, total: steps.length })}
        </p>
        <ol
          aria-label={t("portal.new.progressLabel")}
          className="mt-3 grid grid-cols-4 gap-2"
        >
          {steps.map((key, index) => {
            const done = index < step;
            const active = index === step;

            return (
              <li key={key} aria-current={active ? "step" : undefined}>
                <span
                  aria-hidden
                  className={cn(
                    "block h-1.5 rounded-full transition-colors",
                    done || active ? "bg-accent" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "mt-2 flex items-center gap-1 text-xs sm:text-sm",
                    active
                      ? "font-semibold text-ink"
                      : done
                        ? "text-accent-ink"
                        : "text-ink-soft",
                  )}
                >
                  {done && (
                    <Check aria-hidden weight="bold" className="size-3.5" />
                  )}
                  {t(`portal.new.steps.${key}`)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (current === "review") void handleSubmit();
          else void handleNext();
        }}
        className="mt-8 rounded-[8px] border border-border bg-surface p-5 shadow-raised sm:p-7"
      >
        {current === "category" && (
          <fieldset>
            <legend className="contents">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink outline-none"
              >
                {t("portal.new.category.title")}
              </h2>
            </legend>
            <p className="mt-1.5 text-ink-soft">
              {t("portal.new.category.body")}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Constants.public.Enums.ticket_category.map(
                (key: Enums<"ticket_category">) => {
                  const Icon = categoryIcons[key];
                  const selected = category === key;

                  return (
                    <label
                      key={key}
                      className={cn(
                        "relative flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition-[border-color,background-color,box-shadow]",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                        selected
                          ? "border-accent bg-accent-soft/60 ring-1 ring-accent"
                          : "border-border hover:border-ink-faint",
                        key === "product_question" && "sm:col-span-2",
                      )}
                    >
                      <input
                        type="radio"
                        value={key}
                        {...register("category")}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full",
                          selected
                            ? "bg-accent text-white"
                            : "bg-surface-alt text-ink-soft",
                        )}
                      >
                        <Icon aria-hidden weight="bold" className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">
                          {t(`category.${key}`)}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-ink-soft">
                          {t(`portal.new.categoryHints.${key}`)}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          aria-hidden
                          weight="bold"
                          className="absolute top-4 right-4 size-4 text-accent-ink"
                        />
                      )}
                    </label>
                  );
                },
              )}
            </div>
            {errors.category && (
              <p
                role="alert"
                className="mt-3 text-[0.8125rem] font-medium text-danger"
              >
                {errorText("category")}
              </p>
            )}
          </fieldset>
        )}

        {current === "details" && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink outline-none"
            >
              {t("portal.new.details.title")}
            </h2>
            <div className="mt-6 grid gap-5">
              <Field
                id="subject"
                label={t("portal.new.details.subjectLabel")}
                hint={t("portal.new.details.subjectHint")}
                error={errorText(errors.subject?.message)}
              >
                <input
                  id="subject"
                  {...register("subject")}
                  maxLength={160}
                  aria-invalid={errors.subject ? true : undefined}
                  aria-describedby={
                    errors.subject ? "subject-error" : "subject-hint"
                  }
                  className={`${inputClass} h-11`}
                />
              </Field>
              <Field
                id="description"
                label={t("portal.new.details.descriptionLabel")}
                hint={t("portal.new.details.descriptionHint")}
                error={errorText(errors.description?.message)}
              >
                <textarea
                  id="description"
                  rows={6}
                  {...register("description")}
                  aria-invalid={errors.description ? true : undefined}
                  aria-describedby={
                    errors.description
                      ? "description-error"
                      : "description-hint"
                  }
                  className={`${inputClass} resize-y py-3 leading-relaxed`}
                />
              </Field>
              <Field
                id="orderReference"
                label={t("portal.new.details.orderLabel")}
                hint={t("portal.new.details.orderHint")}
                error={errorText(errors.orderReference?.message)}
              >
                <input
                  id="orderReference"
                  {...register("orderReference")}
                  maxLength={40}
                  autoComplete="off"
                  aria-invalid={errors.orderReference ? true : undefined}
                  aria-describedby={
                    errors.orderReference
                      ? "orderReference-error"
                      : "orderReference-hint"
                  }
                  className={`${inputClass} h-11 font-mono sm:max-w-60`}
                />
              </Field>
            </div>
          </div>
        )}

        {current === "attachments" && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink outline-none"
            >
              {t("portal.new.attachments.title")}
            </h2>
            <p className="mt-1.5 text-ink-soft">
              {t("portal.new.attachments.body")}
            </p>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleAddFiles(event.dataTransfer.files);
              }}
              className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-[8px] border border-dashed border-ink-faint/60 bg-bg px-6 py-9 text-center transition-colors hover:border-accent hover:bg-accent-soft/30 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
            >
              <UploadSimple
                aria-hidden
                weight="bold"
                className="size-6 text-accent-ink"
              />
              <span className="font-semibold text-accent-ink">
                {t("portal.new.attachments.choose")}
              </span>
              <span className="text-sm text-ink-soft">
                {t("portal.new.attachments.drop")}
              </span>
              <input
                type="file"
                multiple
                accept={accepted.join(",")}
                className="sr-only"
                disabled={files.length >= maxFiles}
                onChange={(event) => {
                  if (event.target.files) handleAddFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>

            {fileErrors.length > 0 && (
              <ul
                role="alert"
                className="mt-3 grid gap-1 text-[0.8125rem] font-medium text-danger"
              >
                {fileErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <ul className="mt-4 grid gap-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 rounded-[8px] border border-border px-3 py-2.5"
                  >
                    <FileText
                      aria-hidden
                      weight="bold"
                      className="size-5 shrink-0 text-ink-soft"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {file.name}
                    </span>
                    <span className="font-mono text-xs text-ink-soft">
                      {Math.max(1, Math.round(file.size / 1000))} KB
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles(files.filter((_, i) => i !== index))
                      }
                      aria-label={t("portal.new.attachments.remove", {
                        name: file.name,
                      })}
                      className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-surface-alt hover:text-danger"
                    >
                      <Trash aria-hidden weight="bold" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {current === "review" && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink outline-none"
            >
              {t("portal.new.review.title")}
            </h2>
            <p className="mt-1.5 text-ink-soft">
              {t("portal.new.review.body")}
            </p>
            <dl className="mt-6 divide-y divide-border rounded-[8px] border border-border">
              {[
                {
                  label: t("portal.new.review.topic"),
                  value: category ? t(`category.${category}`) : "",
                  step: 0,
                },
                {
                  label: t("portal.new.review.subject"),
                  value: getValues("subject"),
                  step: 1,
                },
                {
                  label: t("portal.new.review.description"),
                  value: getValues("description"),
                  step: 1,
                  multiline: true,
                },
                {
                  label: t("portal.new.review.order"),
                  value:
                    getValues("orderReference") || t("portal.new.review.none"),
                  step: 1,
                  mono: Boolean(getValues("orderReference")),
                },
                {
                  label: t("portal.new.review.files"),
                  value: files.length
                    ? files.map((f) => f.name).join(", ")
                    : t("portal.new.review.none"),
                  step: 2,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 px-4 py-3.5 sm:grid-cols-[9rem_1fr_auto] sm:gap-4"
                >
                  <dt className="text-sm text-ink-soft">{row.label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 text-[0.9375rem] text-ink",
                      row.multiline && "line-clamp-4 whitespace-pre-line",
                      row.mono && "font-mono",
                    )}
                  >
                    {row.value}
                  </dd>
                  <dd className="sm:text-right">
                    <button
                      type="button"
                      onClick={() => setStep(row.step)}
                      className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
                      aria-label={t("portal.new.review.edit", {
                        section: row.label,
                      })}
                    >
                      {t("portal.new.review.edit", { section: "" }).trim()}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            {submitError && (
              <Banner tone="error" className="mt-4">
                {submitError}
              </Banner>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={busy}
              className={buttonClass({ variant: "ghost" })}
            >
              {t("portal.new.back")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className={buttonClass()}
          >
            {busy && (
              <SpinnerGap
                aria-hidden
                weight="bold"
                className="size-4 motion-safe:animate-spin"
              />
            )}
            {current !== "review"
              ? t("portal.new.next")
              : phase === "sending"
                ? t("portal.new.submitting")
                : phase === "uploading"
                  ? t("portal.new.uploading")
                  : t("portal.new.submit")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewTicketWizard;
