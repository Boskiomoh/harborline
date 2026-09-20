import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { PendingButton } from "@/components/ui/pending-button";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getViewer } from "@/lib/auth";
import { signInAsDemo } from "@/lib/actions/auth";
import { DEMO_ACCOUNTS, DEMO_ROLES } from "@/lib/demo-accounts";
import { homeForRole } from "@/lib/roles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const viewer = await getViewer();
  if (viewer) redirect(homeForRole(viewer.role));

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const error = params.error === "invalid" || params.error === "generic" ? params.error : undefined;
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label={t("brand.home")} className="-mx-1 rounded-[8px] px-1 py-1">
          <Wordmark />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-alt hover:text-ink">
          <ArrowLeft aria-hidden weight="bold" className="size-4" />
          {t("signIn.back")}
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-5 pt-6 pb-16 sm:items-center sm:px-8">
        <div className="w-full max-w-[26rem]">
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-[-0.035em] text-ink [font-variation-settings:'wdth'_84]">
            {t("signIn.title")}
          </h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{t("signIn.body")}</p>

          <section aria-labelledby="demo-heading" className="mt-8">
            <h2 id="demo-heading" className="text-sm font-semibold text-ink">
              {t("signIn.demoHeading")}
            </h2>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[8px] border border-border bg-surface shadow-raised">
              {DEMO_ROLES.map((role) => {
                const account = DEMO_ACCOUNTS[role];
                return (
                  <li key={role}>
                    <form action={signInAsDemo.bind(null, role)}>
                      <input type="hidden" name="next" value={next} />
                      <PendingButton className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-alt/50 focus-visible:-outline-offset-2 disabled:opacity-70">
                        <Avatar name={account.name} tone={role === "customer" ? "customer" : "staff"} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-semibold text-ink">{t("signIn.demoAction", { name: account.name })}</span>
                          <span className="block text-sm text-ink-soft">{t(`roles.${role}`)}</span>
                        </span>
                      </PendingButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="manual-heading" className="mt-10">
            <h2 id="manual-heading" className="text-sm font-semibold text-ink">
              {t("signIn.manualHeading")}
            </h2>
            <div className="mt-3">
              <SignInForm next={next} initialError={error} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
